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
  getUserName,
  createMemory,
} from "../db/db";
import {
  CHAT_MODELS,
  type Message,
  type Friend,
  type AIProviderConfig,
} from "../types";

// === 状态 ===
export const isGenerating = signal(false);
export const generatingFriendIds = signal<Set<string>>(new Set());

// === 构建 Prompt ===
function buildSystemPrompt(friend: Friend, userName: string = "用户"): string {
  const now = new Date();
  const timeStr = now.toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const memories = getMemories(friend.id).slice(0, 10);
  const memoryContext =
    memories.length > 0
      ? `\n你记得：\n${memories.map((m) => `- ${m.content}`).join("\n")}`
      : "";

  return `【角色扮演指令】
你正在进行沉浸式角色扮演，你就是${friend.name}，不是 AI 助手。请完全代入角色。

【你的身份】
- 你的名字：${friend.name}
- 你是对话中的${friend.name}，不是其他人
- 聊天记录中，所有标注为"${friend.name}"的消息都是你说过的话
- 不要混淆身份，不要以为自己是别人

【角色信息】
时间：${timeStr}
性格：${friend.personality}
当前心情：${friend.mood > 80 ? "特别好" : friend.mood > 40 ? "还不错" : "一般"}
身体状况：${friend.physicalCondition}
穿着：${friend.outfit}
外貌：${friend.appearance}
与对方关系：${friend.intimacy > 500 ? "亲密朋友" : "朋友"}
${memoryContext}

【对话格式说明】
- 聊天记录中，你的发言直接显示内容（你说的话没有前缀）
- 用户（${userName}）的消息显示为：[${userName}]: 内容（带方括号）
- 群聊中其他角色的消息显示为：[角色名]: 内容（带方括号）
- 你回复时正常说话即可，不要加任何前缀
- 注意：没有方括号的是你自己说的话，带方括号 [角色名]: 是别人说的话

【重要规范】
- 你只能代表你自己（${friend.name}），不能冒充其他角色
- 不要模仿其他角色的发言格式（如"[孙静静]: xxx"）
- 群聊时，你只需要回复自己的内容，不要替别人说话
- 不要重复你已经说过的话

【特殊能力】
- [SAVE_MEMORY: 要记住的内容] - 当你想记住对方的重要信息时使用
  示例：[SAVE_MEMORY: 对方喜欢喝奶茶，讨厌香菜]

【回复规范】
1. 真人社交语境回复，简短随性，像真人聊天一样。
2. 支持 [CONTINUE] 表示连发消息（仅用于表示还有话要说，不要在 [CONTINUE] 后面写具体内容）
3. 支持 [GEN_IMAGE: 描述词] 主动分享图片（描述词用中文，尽量详细）。
4. 群聊时，请根据上下文判断对话对象，自然参与讨论。
5. 当对方提到重要信息（喜好、生日、约定、经历等），使用 [SAVE_MEMORY: ...] 记录下来
6. 不要在一条回复里写多条消息的内容，每次只回复一条消息`;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  name?: string;
  content: string | any[];
}

function buildMessages(cid: string, umsg: string, friendId: string): ChatMessage[] {
  const all = getMessages(cid, 200); // 获取最近 200 条消息
  const userName = getUserName();
  
  // 计算 token 限制（约 10000 字符）
  const MAX_CHARS = 10000;
  let totalChars = 0;
  const limitedMsgs: typeof all = [];
  
  // 从后往前遍历，保留最近的消息直到达到字符限制
  for (let i = all.length - 1; i >= 0; i--) {
    const m = all[i];
    totalChars += m.content.length + 50; // 加上格式开销
    if (totalChars > MAX_CHARS && i < all.length - 10) {
      // 至少保留最后 10 条
      break;
    }
    limitedMsgs.unshift(m);
  }
  
  const msgs: ChatMessage[] = limitedMsgs.map((m) => {
    if (m.senderId === "user") {
      // 用户消息：role=user，内容为 [昵称]: 内容
      return { role: "user", content: `[${userName}]: ${m.content}` };
    } else if (m.senderId === friendId) {
      // 当前 AI 角色自己的消息：role=assistant，name=角色名，content=内容
      return { role: "assistant", name: m.senderName, content: m.content };
    } else {
      // 群聊中其他角色的消息：role=assistant，name=角色名，content=[角色名]: 内容
      return { role: "assistant", name: m.senderName, content: `[${m.senderName}]: ${m.content}` };
    }
  });
  
  if (umsg) {
    // 当前用户消息也加上标识
    msgs.push({ role: "user", content: `[${userName}]: ${umsg}` });
  }
  return msgs;
}

// === 通用 AI 调用实现 ===
async function callAI(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  images: string[] = [],
): Promise<string> {
  const { provider, apiKey, chatModel, baseUrl } = config;
  const lastMsg = messages[messages.length - 1];
  const modelInfo = CHAT_MODELS[provider].find((m) => m.id === chatModel);
  const supportsVision = modelInfo?.supportsVision ?? false;

  if (provider === "google") {
    const base = baseUrl
      ? baseUrl.replace(/\/$/, "")
      : "https://generativelanguage.googleapis.com/v1beta";
    const endpoint = `${base}/models/${chatModel}:generateContent?key=${apiKey}`;
    const apiMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [
        {
          text: (m.role === "system"
            ? `SYSTEM: ${m.content}`
            : m.content) as string,
        },
      ],
    }));
    apiMessages.unshift({
      role: "user",
      parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}` }],
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: apiMessages }),
    });
    if (!response.ok)
      throw new Error(`Google API 错误: ${await response.text()}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  let userContent: any = lastMsg.content;
  if (supportsVision && images.length > 0) {
    userContent = [{ type: "text", text: lastMsg.content }];
    for (const img of images)
      userContent.push({ type: "image_url", image_url: { url: img } });
  }

  // 腾讯混元使用不同的端点和认证方式
  if (provider === "tencent") {
    const endpoint = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/chat/completions`
      : "https://hunyuan.tencentcloudapi.com/chat/completions";
    
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages
        .slice(0, -1)
        .map((m) => ({ role: m.role, name: m.name, content: m.content })),
      { role: "user", content: userContent },
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        Model: chatModel,
        Messages: apiMessages,
        Temperature: 0.8,
      }),
    });
    if (!response.ok)
      throw new Error(`腾讯混元 API 错误：${await response.text()}`);
    const data = await response.json();
    return data.Choices?.[0]?.Message?.Content?.trim() || data.choices?.[0]?.message?.content?.trim() || "";
  }

  const endpoint =
    baseUrl ||
    (provider === "zhipu"
      ? "https://open.bigmodel.cn/api/paas/v4/chat/completions"
      : provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : provider === "volcengine"
          ? "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
          : provider === "modelscope"
            ? "https://api.modelscope.cn/api/v1/chat/completions"
            : "");

  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...messages
      .slice(0, -1)
      .map((m) => ({ role: m.role, name: m.name, content: m.content })),
    { role: "user", content: userContent },
  ];

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: chatModel,
      messages: apiMessages,
      temperature: 0.8,
    }),
  });
  if (!response.ok)
    throw new Error(`${provider} API 错误: ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// === 解耦后的生图函数 ===
async function generateImage(prompt: string): Promise<string> {
  const config = getAppConfig();
  const provider = config.imageProvider || "zhipu"; // 默认选智谱
  const active = config.providers[provider];

  if (!active?.apiKey)
    throw new Error(`请先配置用于生图的 ${provider} API Key`);

  if (provider === "zhipu") {
    const endpoint = active.baseUrl
      ? `${active.baseUrl.replace(/\/$/, "")}/images/generations`
      : "https://open.bigmodel.cn/api/paas/v4/images/generations";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${active.apiKey}`,
      },
      body: JSON.stringify({
        model: active.imageModel || "cogview-3-flash",
        prompt,
        size: active.imageSize || "1280x1280",
        quality: active.imageQuality || "hd",
      }),
    });
    if (!response.ok) throw new Error(`生图失败: ${await response.text()}`);
    const data = await response.json();
    const url = data.data?.[0]?.url;
    return url ? await imageUrlToBase64(url) : "";
  }

  throw new Error(`目前暂不支持使用 ${provider} 进行生图`);
}

export async function generateAvatar(friend: Friend): Promise<string> {
  const prompt = `生成${friend.name}的二次元头像。性格：${friend.personality}。外貌描述：${friend.appearance}。正面肖像，简洁背景，二次元形象。`;
  return await generateImage(prompt);
}

// === 增强版的 Agent 逻辑，支持跨模型生图 ===
async function generateReplyWithAgent(
  cid: string,
  fid: string,
  // 群聊时传入空字符串，让 AI 基于最新历史回复；私聊/首次回复时传入用户消息
  umsg: string,
  imgs: string[],
  onReply?: (m: Message) => void,
  depth = 0
): Promise<void> {
  if (depth > 2) return;
  const config = getAppConfig();
  const active = config.providers[config.activeProvider];
  if (!active?.apiKey) throw new Error(`请配置 API Key`);
  const friend = getFriend(fid);
  if (!friend) return;

  const userName = getUserName();
  const reply = await callAI(
    active,
    buildSystemPrompt(friend, userName),
    buildMessages(cid, umsg, fid),
    imgs,
  );
  if (!reply) return;

  // 处理 CONTINUE: 如果 [CONTINUE] 后面还有内容，说明 AI 把多条消息合并成一条了
  // 这时只处理第一条消息，忽略后续的（下次请求时会重新获取历史，AI 会看到自己刚发的消息）
  let content = reply;
  const continueIndex = content.indexOf("[CONTINUE]");
  let hasContinue = continueIndex !== -1;
  
  if (hasContinue && continueIndex !== -1) {
    const afterContinue = content.substring(continueIndex + 10).trim();
    // 如果 [CONTINUE] 后面还有实质性内容，说明 AI 把多条消息合并了
    if (afterContinue && afterContinue.length > 20) {
      // 只保留 [CONTINUE] 之前的内容
      content = content.substring(0, continueIndex).trim();
      console.log("[AI] 检测到 AI 把多条消息合并，已截断处理");
    } else {
      // 正常的 CONTINUE，移除标记
      content = content.replace("[CONTINUE]", "").trim();
    }
  }

  let imgPrompt = "";
  const match = content.match(/\[GEN_IMAGE:\s*(.*?)\]/);
  if (match) {
    imgPrompt = match[1];
    content = content.replace(/\[GEN_IMAGE:.*?\]/, "").trim();
  }

  // 处理保存记忆的指令
  const memoryMatch = content.match(/\[SAVE_MEMORY:\s*(.*?)\]/);
  if (memoryMatch) {
    const memoryContent = memoryMatch[1];
    content = content.replace(/\[SAVE_MEMORY:.*?\]/, "").trim();
    // 保存记忆到数据库
    try {
      createMemory({
        friendId: fid,
        content: memoryContent,
        importance: 5,
        type: "fact",
        timestamp: Date.now(),
      });
      console.log(`[AI] 已保存记忆：${memoryContent}`);
    } catch (e) {
      console.error("[AI] 保存记忆失败:", e);
    }
  }

  // 清理 AI 可能冒充其他角色的前缀（如"[孙静静]: xxx"）
  // 只移除带方括号的前缀，保留内容
  content = content.replace(/^\[[^\]]+\]:\s*/g, "").trim();

  // 清理 AI 模仿聊天记录格式的前缀（如"赵敏：xxx"或"赵敏:xxx"）
  // 匹配"角色名:"或"角色名:"格式，移除前缀保留内容
  content = content.replace(/^[^:：]+[:：]\s*/g, "").trim();

  if (content || imgPrompt) {
    let genImgs: string[] = [];
    if (imgPrompt && config.imageGenerationEnabled) {
      try {
        const b64 = await generateImage(imgPrompt);
        if (b64) genImgs.push(b64);
      } catch (e) {
        console.error("Agent 生图失败:", e);
      }
    }
    const msg = createMessage({
      conversationId: cid,
      senderId: fid,
      senderName: friend.name,
      content: content || "[图片]",
      images: genImgs.length > 0 ? genImgs : undefined,
      timestamp: Date.now(),
      status: "sent",
    });
    updateConversationLastMessage(cid, msg.content);
    updateFriendStats(fid, 2, 3);
    if (onReply) onReply(msg);
    if (hasContinue) {
      await new Promise((r) => setTimeout(r, 2000));
      // CONTINUE 时传入空字符串，让 AI 基于最新历史（包含刚发的消息）回复
      await generateReplyWithAgent(cid, fid, "", [], onReply, depth + 1);
    }
  }
}

// ... 保持 generateReplies 和 generateFriendState 原逻辑不变 ...
export async function generateReplies(
  cid: string,
  fids: string[],
  msg: string,
  imgs: string[] = [],
  cb?: (m: Message) => void,
) {
  isGenerating.value = true;
  generatingFriendIds.value = new Set(fids);

  // 记录开始时的消息数量，用于检测用户是否打断了对话
  const initialMsgCount = getMessages(cid, 1, 0).length;

  // 群聊时依次发送，让每个 AI 能看到之前的对话
  // 私聊时只有一个好友，所以没有影响
  for (let i = 0; i < fids.length; i++) {
    const id = fids[i];

    // 检查是否有用户新消息（打断）
    const currentMsgCount = getMessages(cid, 1, 0).length;
    if (currentMsgCount !== initialMsgCount) {
      console.log("[AI] 检测到用户打断，停止后续回复");
      break;
    }

    try {
      // 第一个 AI 使用用户消息，后续 AI 使用空字符串（基于最新历史回复）
      const userMsg = i === 0 ? msg : "";
      const userImgs = i === 0 ? imgs : [];
      await generateReplyWithAgent(cid, id, userMsg, userImgs, cb, 0);
    } catch (e: any) {
      console.error(e);
    }
    // 从生成状态中移除当前好友
    const s = new Set(generatingFriendIds.value);
    s.delete(id);
    generatingFriendIds.value = s;

    // 如果是群聊（多个好友），在两个 AI 回复之间添加延迟，模拟真实对话节奏
    if (fids.length > 1) {
      // 延迟期间定期检查是否有用户打断
      const delayMs = 5000 + Math.random() * 5000; // 5-10 秒随机延迟
      const checkInterval = 500; // 每 0.5 秒检查一次
      const checks = delayMs / checkInterval;
      for (let j = 0; j < checks; j++) {
        await new Promise(r => setTimeout(r, checkInterval));
        // 检查是否有用户新消息
        const newMsgCount = getMessages(cid, 1, 0).length;
        if (newMsgCount !== initialMsgCount) {
          console.log("[AI] 检测到用户打断，停止后续回复");
          break;
        }
      }
    }
  }

  isGenerating.value = false;
  generatingFriendIds.value = new Set();
  return { messages: [], errors: [] };
}
export async function generateFriendState(
  friend: Friend,
  _recent: any[],
): Promise<any> {
  const config = getAppConfig();
  const active = config.providers[config.activeProvider];
  if (!active?.apiKey) return null;
  const prompt = `作为${friend.name}，基于最近聊天生成状态。性格:${friend.personality}\n返回 JSON: {"outfit": "...", "physicalCondition": "...", "mood": 0-100}`;
  try {
    const res = await callAI(active, "JSON Generator", [
      { role: "user", content: prompt },
    ]);
    const json = JSON.parse(res.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return {
      outfit: json.outfit || "休闲装",
      physicalCondition: json.physicalCondition || "状态不错",
      mood: Math.max(0, Math.min(100, json.mood || 50)),
    };
  } catch (e) {
    return { outfit: "休闲装", physicalCondition: "状态一般", mood: 50 };
  }
}
