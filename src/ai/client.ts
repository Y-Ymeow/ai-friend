import { signal } from "@preact/signals";
import {
  getZhipuConfig,
  getFriend,
  getMessages,
  createMessage,
  updateConversationLastMessage,
  getMemories,
  updateFriendStats,
} from "../db/db";
import { CHAT_MODELS } from "../types";
import type { Message, Friend } from "../types";

// === 状态 ===
export const isGenerating = signal(false);
export const generatingFriendIds = signal<Set<string>>(new Set());

// === 构建 Prompt ===
function buildSystemPrompt(friend: Friend): string {
  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 6 ? "深夜" : hour < 12 ? "早上" : hour < 14 ? "中午" : hour < 18 ? "下午" : "晚上";
  const timeStr = now.toLocaleString("zh-CN", { month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" });
  
  const memories = getMemories(friend.id).slice(0, 5);
  const memoryContext = memories.length > 0 
    ? `\n你记得关于对方的事：\n${memories.map(m => `- ${m.content}`).join('\n')}`
    : "";

  const moodDesc = friend.mood > 80 ? "心情很好" : friend.mood > 50 ? "心情一般" : "心情不太好";
  const intimacyDesc = friend.intimacy > 500 ? "你们很熟了" : friend.intimacy > 200 ? "你们正在变得熟悉" : "你们还不太熟";

  return `${friend.name}的回复指南：

你正在和${timeOfDay}的朋友聊天。${timeStr}。
${intimacyDesc}，${moodDesc}。
你现在${friend.physicalCondition}，穿着${friend.outfit}。${memoryContext}

你的性格：${friend.personality}

回复要求：
- 像发微信一样，简短自然，1-2句话
- 可以用表情符号，但别太多
- 语气要符合你们的关系亲疏
- 别提你是AI，别写什么"我："、"用户："这种格式
- 就像真的在跟朋友聊天一样`;
}

interface ChatMessage {
  role: "user" | "assistant";
  name?: string;
  content: string;
}

function buildMessages(conversationId: string, currentUserMessage: string): ChatMessage[] {
  const allRecentMessages = getMessages(conversationId, 50);
  const messages: ChatMessage[] = [];
  
  const MAX_CONTEXT_CHARS = 8000;
  let currentLength = 0;
  const contextMessages: ChatMessage[] = [];

  for (let i = allRecentMessages.length - 1; i >= 0; i--) {
    const msg = allRecentMessages[i];
    const chatMsg: ChatMessage = msg.senderId === "user"
      ? { role: "user", content: msg.content }
      : { role: "assistant", name: msg.senderName, content: msg.content };
    
    const msgLength = JSON.stringify(chatMsg).length;
    if (currentLength + msgLength > MAX_CONTEXT_CHARS) break;
    
    contextMessages.unshift(chatMsg);
    currentLength += msgLength;
  }

  messages.push(...contextMessages);
  messages.push({ role: "user", content: currentUserMessage });
  
  return messages;
}

interface ZhipuResponse {
  choices: Array<{
    message: {
      content: string | null;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
}

async function callZhipuVision(
  systemPrompt: string,
  messages: ChatMessage[],
  images: string[],
  config: { apiKey: string; model: string }
): Promise<string> {
  const lastMsg = messages[messages.length - 1];
  const modelConfig = CHAT_MODELS.find(m => m.id === config.model);
  const supportsVision = modelConfig?.supportsVision ?? false;
  
  let userContent: any = lastMsg.content;
  if (supportsVision && images.length > 0) {
    const content: any[] = [{ type: "text", text: lastMsg.content }];
    for (const img of images) content.push({ type: "image_url", image_url: { url: img } });
    userContent = content;
  }

  const apiMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...messages.slice(0, -1).map(m => m.name 
      ? { role: m.role, name: m.name, content: m.content }
      : { role: m.role, content: m.content }
    ),
    { role: "user", content: userContent }
  ];

  const body: any = {
    model: config.model,
    messages: apiMessages,
    max_tokens: 256,
    temperature: 0.9
  };
  body.thinking = { type: "disabled" };

  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`API 错误: ${await response.text()}`);
  const data: ZhipuResponse = await response.json();
  
  const choice = data.choices[0];
  if (!choice) throw new Error("API 返回空响应");
  
  const rawContent = choice.message?.content?.trim() || "";
  
  if (rawContent) return rawContent;
  
  if (choice.message?.reasoning_content) {
    throw new Error("Thinking模型返回空内容，请重试");
  }
  
  throw new Error("API返回空内容");
}

async function generateReply(
  conversationId: string,
  friendId: string,
  userMessage: string,
  images: string[],
  maxRetries = 5
): Promise<string> {
  const config = getZhipuConfig();
  if (!config) throw new Error("请先配置 API Key");
  const friend = getFriend(friendId);
  if (!friend) throw new Error("朋友不存在");

  const systemPrompt = buildSystemPrompt(friend);
  const messages = buildMessages(conversationId, userMessage);

  let lastError: any = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await callZhipuVision(systemPrompt, messages, images, {
        apiKey: config.apiKey,
        model: config.chatModel,
      });
      if (!result || !result.trim()) {
        throw new Error("收到空白回复");
      }
      return result;
    } catch (err: any) {
      lastError = err;
      if (i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 1000;
        console.warn(`[AI Client] 请求失败 (${err.message}), ${waitTime/1000}s 后进行第 ${i + 1} 次重试...`);
        await new Promise((r) => setTimeout(r, waitTime));
      }
    }
  }
  throw lastError;
}

export async function generateReplies(
  conversationId: string,
  friendIds: string[],
  userMessage: string,
  images: string[] = [],
  onReply?: (msg: Message) => void,
): Promise<{ messages: Message[]; errors: string[] }> {
  isGenerating.value = true;
  const results: Message[] = [];
  const errors: string[] = [];
  generatingFriendIds.value = new Set(friendIds);

  const promises = friendIds.map(async (friendId) => {
    const friend = getFriend(friendId);
    if (!friend) {
      errors.push(`找不到 ID: ${friendId}`);
      return;
    }
    try {
      const reply = await generateReply(conversationId, friendId, userMessage, images);
      const msg = createMessage({ conversationId, senderId: friendId, senderName: friend.name, content: reply, timestamp: Date.now(), status: "sent" });
      results.push(msg);
      updateConversationLastMessage(conversationId, reply);
      const intimacyGain = Math.floor(Math.random() * 3) + 1;
      const moodGain = Math.floor(Math.random() * 5) + 1;
      updateFriendStats(friendId, intimacyGain, moodGain);
      if (onReply) onReply(msg);
    } catch (err: any) {
      errors.push(`${friend.name}: ${err.message}`);
    } finally {
      const newSet = new Set(generatingFriendIds.value);
      newSet.delete(friendId);
      generatingFriendIds.value = newSet;
    }
  });

  await Promise.allSettled(promises);
  isGenerating.value = false;
  generatingFriendIds.value = new Set();
  return { messages: results, errors };
}

// === 生成状态 ===
interface FriendState {
  outfit: string;
  physicalCondition: string;
  mood: number;
}

const OUTFIT_OPTIONS = [
  "oversize卫衣", "碎花连衣裙", "修身小西装", "毛绒睡衣", "运动套装",
  "白衬衫", "针织开衫", "牛仔外套", "格子衬衫", "黑色高领",
  "百褶裙", "工装裤", "连帽外套", "真丝睡衣", "复古背带裤",
  "露肩上衣", "休闲短裤", "长款风衣", "紧身瑜伽服", "纯棉T恤"
];

const PHYSICAL_OPTIONS = [
  "元气满满", "有点犯困", "精神焕发", "状态一般", "好想睡觉",
  "鼻子不通", "胃口大开", "充满活力", "腰酸背痛", "心情愉悦",
  "头昏脑胀", "饿了饿了", "神清气爽", "有点emo", "活力四射",
  "口干舌燥", "浑身舒畅", "略感疲惫", "精神集中", "心情烦躁"
];

export async function generateFriendState(
  friend: Friend,
  recentMessages: { senderName: string; content: string; timestamp: number }[]
): Promise<FriendState> {
  const config = getZhipuConfig();
  if (!config) {
    // 没有配置，随机选择
    return {
      outfit: OUTFIT_OPTIONS[Math.floor(Math.random() * OUTFIT_OPTIONS.length)],
      physicalCondition: PHYSICAL_OPTIONS[Math.floor(Math.random() * PHYSICAL_OPTIONS.length)],
      mood: Math.floor(Math.random() * 40) + 30
    };
  }

  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 6 ? "深夜" : hour < 12 ? "早上" : hour < 14 ? "中午" : hour < 18 ? "下午" : "晚上";
  const timeStr = now.toLocaleString("zh-CN", { month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" });

  const chatContext = recentMessages.length > 0
    ? `\n最近聊天：\n${recentMessages.slice(-5).map(m => `${m.senderName}: ${m.content.slice(0, 50)}`).join('\n')}`
    : "";

  const prompt = `作为${friend.name}，${timeStr}，现在是${timeOfDay}。
你的性格：${friend.personality}
${chatContext}

请根据当前时间、你的性格${recentMessages.length > 0 ? "和最近的聊天内容" : ""}，选择你现在最可能的状态。

可选穿搭：${OUTFIT_OPTIONS.join('、')}
可选体感：${PHYSICAL_OPTIONS.join('、')}

必须以JSON格式返回（不要包含任何其他文字）：
{"outfit": "从可选穿搭中选择一个", "physicalCondition": "从可选体感中选择一个", "mood": 0-100的数字}`;

  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: "GLM-4-Flash",
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 错误: ${response.status}`);
  }

  const data: ZhipuResponse = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI 返回空内容");
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("无法解析 JSON");
    }
    const result = JSON.parse(jsonMatch[0]);
    
    // 验证并修正返回的数据
    let outfit = result.outfit;
    let physical = result.physicalCondition;
    
    if (!OUTFIT_OPTIONS.includes(outfit)) {
      outfit = OUTFIT_OPTIONS[Math.floor(Math.random() * OUTFIT_OPTIONS.length)];
    }
    if (!PHYSICAL_OPTIONS.includes(physical)) {
      physical = PHYSICAL_OPTIONS[Math.floor(Math.random() * PHYSICAL_OPTIONS.length)];
    }
    
    return {
      outfit,
      physicalCondition: physical,
      mood: Math.max(0, Math.min(100, Math.round(result.mood) || 50))
    };
  } catch (e) {
    // 解析失败，返回随机状态
    return {
      outfit: OUTFIT_OPTIONS[Math.floor(Math.random() * OUTFIT_OPTIONS.length)],
      physicalCondition: PHYSICAL_OPTIONS[Math.floor(Math.random() * PHYSICAL_OPTIONS.length)],
      mood: Math.floor(Math.random() * 40) + 30
    };
  }
}
