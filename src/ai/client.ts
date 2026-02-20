import { signal } from "@preact/signals";
import {
  getAppConfig,
  getFriend,
  getMessages,
  createMessage,
  updateConversationLastMessage,
  getMemories,
  updateFriendStats,
  imageUrlToBase64,
} from "../db/db";
import { CHAT_MODELS, type Message, type Friend, type AIProviderConfig } from "../types";

// === 状态 ===
export const isGenerating = signal(false);
export const generatingFriendIds = signal<Set<string>>(new Set());

// === 构建 Prompt ===
function buildSystemPrompt(friend: Friend): string {
  const now = new Date();
  const timeStr = now.toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const memories = getMemories(friend.id).slice(0, 10);
  const memoryContext = memories.length > 0 ? `\n你记得：\n${memories.map(m => `- ${m.content}`).join('\n')}` : "";

  return `你现在是${friend.name}。
【时间】${timeStr}
【性格】${friend.personality}
【当前心情】${friend.mood > 80 ? "特别好" : friend.mood > 40 ? "还不错" : "一般"}
【状况】${friend.physicalCondition}，穿着${friend.outfit}
【外貌】${friend.appearance}
【关系】${friend.intimacy > 500 ? "亲密朋友" : "朋友"}${memoryContext}

【规范】
1. 真人社交语境回复，简短随性。
2. 支持 [CONTINUE] 表示连发消息。
3. 支持 [GEN_IMAGE: 描述词] 主动分享图片（描述词用中文，尽量详细）。`;
}

interface ChatMessage { role: "user" | "assistant" | "system"; name?: string; content: string | any[]; }

function buildMessages(cid: string, umsg: string): ChatMessage[] {
  const all = getMessages(cid, 20);
  const msgs: ChatMessage[] = all.map(m => m.senderId === "user" ? { role: "user", content: m.content } : { role: "assistant", name: m.senderName, content: m.content });
  if (umsg) msgs.push({ role: "user", content: umsg });
  return msgs;
}

// === 通用 AI 调用实现 ===
async function callAI(config: AIProviderConfig, systemPrompt: string, messages: ChatMessage[], images: string[] = []): Promise<string> {
  const { provider, apiKey, chatModel, baseUrl } = config;
  const lastMsg = messages[messages.length - 1];
  const modelInfo = CHAT_MODELS[provider].find(m => m.id === chatModel);
  const supportsVision = modelInfo?.supportsVision ?? false;

  if (provider === 'google') {
    const base = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${base}/models/${chatModel}:generateContent?key=${apiKey}`;
    const apiMessages = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: (m.role === 'system' ? `SYSTEM: ${m.content}` : m.content) as string }] }));
    apiMessages.unshift({ role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}` }] });

    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: apiMessages }) });
    if (!response.ok) throw new Error(`Google API 错误: ${await response.text()}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  let userContent: any = lastMsg.content;
  if (supportsVision && images.length > 0) {
    userContent = [{ type: "text", text: lastMsg.content }];
    for (const img of images) userContent.push({ type: "image_url", image_url: { url: img } });
  }

  const endpoint = baseUrl || (
    provider === 'zhipu' ? "https://open.bigmodel.cn/api/paas/v4/chat/completions" :
    provider === 'groq' ? "https://api.groq.com/openai/v1/chat/completions" :
    provider === 'volcengine' ? "https://ark.cn-beijing.volces.com/api/v3/chat/completions" :
    provider === 'modelscope' ? "https://api.modelscope.cn/api/v1/chat/completions" : ""
  );

  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...messages.slice(0, -1).map(m => ({ role: m.role, name: m.name, content: m.content })),
    { role: "user", content: userContent }
  ];

  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: chatModel, messages: apiMessages, temperature: 0.8 }) });
  if (!response.ok) throw new Error(`${provider} API 错误: ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// === 解耦后的生图函数 ===
async function generateImage(prompt: string): Promise<string> {
  const config = getAppConfig();
  const provider = config.imageProvider || 'zhipu'; // 默认选智谱
  const active = config.providers[provider];
  
  if (!active?.apiKey) throw new Error(`请先配置用于生图的 ${provider} API Key`);

  if (provider === 'zhipu') {
    const endpoint = active.baseUrl ? `${active.baseUrl.replace(/\/$/, '')}/images/generations` : "https://open.bigmodel.cn/api/paas/v4/images/generations";
    const response = await fetch(endpoint, { 
      method: "POST", 
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${active.apiKey}` }, 
      body: JSON.stringify({ model: active.imageModel || "cogview-3-flash", prompt, size: active.imageSize || "1280x1280", quality: active.imageQuality || "hd" }) 
    });
    if (!response.ok) throw new Error(`生图失败: ${await response.text()}`);
    const data = await response.json();
    const url = data.data?.[0]?.url;
    return url ? await imageUrlToBase64(url) : "";
  }
  
  throw new Error(`目前暂不支持使用 ${provider} 进行生图`);
}

export async function generateAvatar(friend: Friend): Promise<string> {
  const prompt = `生成${friend.name}的二次元头像。性格：${friend.personality}。外貌描述：${friend.appearance}。正面肖像，简洁背景。`;
  return await generateImage(prompt);
}

// === 增强版的 Agent 逻辑，支持跨模型生图 ===
async function generateReplyWithAgent(cid: string, fid: string, umsg: string, imgs: string[], onReply?: (m: Message) => void, depth = 0): Promise<void> {
  if (depth > 2) return;
  const config = getAppConfig();
  const active = config.providers[config.activeProvider];
  if (!active?.apiKey) throw new Error(`请配置 API Key`);
  const friend = getFriend(fid); if (!friend) return;

  const reply = await callAI(active, buildSystemPrompt(friend), buildMessages(cid, umsg), imgs);
  if (!reply) return;

  let content = reply;
  let shouldContinue = content.includes("[CONTINUE]");
  content = content.replace("[CONTINUE]", "").trim();

  let imgPrompt = "";
  const match = content.match(/\[GEN_IMAGE:\s*(.*?)\]/);
  if (match) { imgPrompt = match[1]; content = content.replace(/\[GEN_IMAGE:.*?\]/, "").trim(); }

  if (content || imgPrompt) {
    let genImgs: string[] = [];
    if (imgPrompt && config.imageGenerationEnabled) {
      try { const b64 = await generateImage(imgPrompt); if (b64) genImgs.push(b64); } catch (e) { console.error("Agent 生图失败:", e); }
    }
    const msg = createMessage({ conversationId: cid, senderId: fid, senderName: friend.name, content: content || "[图片]", images: genImgs.length > 0 ? genImgs : undefined, timestamp: Date.now(), status: "sent" });
    updateConversationLastMessage(cid, msg.content);
    updateFriendStats(fid, 2, 3);
    if (onReply) onReply(msg);
    if (shouldContinue) { await new Promise(r => setTimeout(r, 2000)); await generateReplyWithAgent(cid, fid, "", [], onReply, depth + 1); }
  }
}

// ... 保持 generateReplies 和 generateFriendState 原逻辑不变 ...
export async function generateReplies(cid: string, fids: string[], msg: string, imgs: string[] = [], cb?: (m: Message) => void) {
  isGenerating.value = true; generatingFriendIds.value = new Set(fids);
  await Promise.allSettled(fids.map(async id => { try { await generateReplyWithAgent(cid, id, msg, imgs, cb); } catch (e: any) { console.error(e); } const s = new Set(generatingFriendIds.value); s.delete(id); generatingFriendIds.value = s; }));
  isGenerating.value = false; generatingFriendIds.value = new Set();
  return { messages: [], errors: [] };
}
export async function generateFriendState(friend: Friend, recent: any[]): Promise<any> {
  const config = getAppConfig(); const active = config.providers[config.activeProvider];
  if (!active?.apiKey) return null;
  const prompt = `作为${friend.name}，基于最近聊天生成状态。性格:${friend.personality}\n返回 JSON: {"outfit": "...", "physicalCondition": "...", "mood": 0-100}`;
  try { const res = await callAI(active, "JSON Generator", [{ role: "user", content: prompt }]); const json = JSON.parse(res.match(/\{[\s\S]*\}/)?.[0] || "{}"); return { outfit: json.outfit || "休闲装", physicalCondition: json.physicalCondition || "状态不错", mood: Math.max(0, Math.min(100, json.mood || 50)) }; } catch (e) { return { outfit: "休闲装", physicalCondition: "状态一般", mood: 50 }; }
}
