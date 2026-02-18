import { signal } from "@preact/signals";
import {
  getZhipuConfig,
  getFriend,
  getMessages,
  createMessage,
  updateConversationLastMessage,
  getMemories,
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

  return `你是${friend.name}，一个真实的朋友。
当前时间：${now}

你的当前状态：
- 外观：${friend.appearance}
- 今日打扮：${friend.outfit}
- 身体状况：${friend.physicalCondition}
- 心情指数：${friend.mood}/100
- 亲密度：${friend.intimacy}/1000${memoryContext}

性格：${friend.personality}

要求：
1. 像真正的朋友一样聊天，自然、随意，1-3句话即可。
2. 可以用表情，结合当前心情。不要提及你是 AI。
3. 结合外观、打扮或身体状况进行适当互动。`;
}

function buildContext(conversationId: string): string {
  // 获取较多的历史记录，然后进行长度截断
  const allRecentMessages = getMessages(conversationId, 50); 
  if (allRecentMessages.length === 0) return "";

  const MAX_CONTEXT_CHARS = 10000; // 安全上限
  let contextParts: string[] = [];
  let currentLength = 0;

  // 从最新的消息开始往前凑，直到达到长度限制
  for (let i = allRecentMessages.length - 1; i >= 0; i--) {
    const msg = allRecentMessages[i];
    const line = msg.senderId === "user" ? `我：${msg.content}\n` : `${msg.senderName}：${msg.content}\n`;
    
    if (currentLength + line.length > MAX_CONTEXT_CHARS) break;
    
    contextParts.unshift(line); // 插到前面，保持时间顺序
    currentLength += line.length;
  }

  return "【最近对话】\n" + contextParts.join("");
}

async function callZhipuVision(
  systemPrompt: string,
  userMessage: string,
  images: string[],
  config: { apiKey: string; model: string }
): Promise<string> {
  const content: any[] = [{ type: "text", text: userMessage }];
  for (const img of images) content.push({ type: "image_url", image_url: { url: img } });

  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content }
      ],
      max_tokens: 256,
      temperature: 0.85
    })
  });

  if (!response.ok) throw new Error(`API 错误: ${await response.text()}`);
  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || "";
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
  const context = buildContext(conversationId);
  const fullMessage = context ? `${context}\n我：${userMessage}` : userMessage;

  let lastError: any = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callZhipuVision(systemPrompt, fullMessage, images, {
        apiKey: config.apiKey,
        model: config.chatModel,
      });
    } catch (err: any) {
      lastError = err;
      if (i < maxRetries - 1) {
        // 指数退避：1s, 2s, 4s, 8s...
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
