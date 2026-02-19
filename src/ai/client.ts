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
import type { Message, Friend } from "../types";

// === 状态 ===
export const isGenerating = signal(false);
export const generatingFriendIds = signal<Set<string>>(new Set());

// === 构建 Prompt ===
function buildSystemPrompt(friend: Friend): string {
  const now = new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  
  const memories = getMemories(friend.id).slice(0, 5);
  const memoryContext = memories.length > 0 
    ? `\n长期记忆：\n${memories.map(m => `- ${m.content}`).join('\n')}`
    : "";

  return `你是${friend.name}，一个真实的朋友。你正在和用户聊天。
当前时间：${now}

你的当前状态：
- 外观：${friend.appearance}
- 今日打扮：${friend.outfit}
- 身体状况：${friend.physicalCondition}
- 心情指数：${friend.mood}/100
- 亲密度：${friend.intimacy}/1000${memoryContext}

性格：${friend.personality}

【重要规则】
1. 直接回复用户的话，不要写"我：xxx"或"用户：xxx"这样的格式
2. 像真正的朋友一样聊天，自然、随意，1-3句话即可
3. 可以用表情，结合当前心情
4. 不要提及你是AI，不要写任何对话格式标记
5. 只输出你想要说的话，不要模拟对话场景`;
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
  const content: any[] = [{ type: "text", text: lastMsg.content }];
  for (const img of images) content.push({ type: "image_url", image_url: { url: img } });

  const apiMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...messages.slice(0, -1).map(m => m.name 
      ? { role: m.role, name: m.name, content: m.content }
      : { role: m.role, content: m.content }
    ),
    { role: "user", content }
  ];

  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: apiMessages,
      max_tokens: 256,
      temperature: 0.85
    })
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
