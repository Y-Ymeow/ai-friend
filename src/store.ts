import { signal } from "@preact/signals";
import {
  getFriends,
  getConversations,
  getMessages,
  getLastMessage,
  createFriend as dbCreateFriend,
  deleteFriend as dbDeleteFriend,
  createConversation as dbCreateConversation,
  deleteConversation as dbDeleteConversation,
  clearDatabase as dbResetAll,
  createMessage,
  updateConversationLastMessage,
  updateFriend as dbUpdateFriend,
  getMemories,
  createMemory as dbCreateMemory,
  deleteMemory as dbDeleteMemory,
  deleteMessage as dbDeleteMessage,
  clearConversationMessages as dbClearConversationMessages,
} from "./db/db";
import {
  generateReplies,
  isGenerating,
  generatingFriendIds,
  generateFriendState,
} from "./ai/client";
import type { Friend, Conversation, Message, Memory } from "./types";

// === 状态 ===
export const friends = signal<Friend[]>([]);
export const conversations = signal<Conversation[]>([]);
export const currentConversationId = signal<string | null>(null);
export const messages = signal<Message[]>([]);
export const isWaiting = signal(false); // 等待 3 秒发送中

let sendTimer: ReturnType<typeof setTimeout> | null = null;
let pendingContent = "";
let pendingImages: string[] = [];
let autoReplyTimer: ReturnType<typeof setInterval> | null = null;
const lastAutoReplyTime: Map<string, number> = new Map();

// === 刷新 ===
export function refreshFriends() {
  const all = getFriends();
  const now = new Date();

  const updated = all.map((f) => {
    const last = new Date(f.lastStateUpdate);
    if (
      last.getFullYear() !== now.getFullYear() ||
      last.getMonth() !== now.getMonth() ||
      last.getDate() !== now.getDate()
    ) {
      console.log(`[Store] 检测到新的一天，刷新 ${f.name} 的状态...`);
      const newMood = Math.max(
        0,
        Math.min(100, f.mood + (Math.random() * 40 - 20)),
      );
      const outfits = [
        "oversize卫衣",
        "碎花连衣裙",
        "修身小西装",
        "毛绒睡衣",
        "运动套装",
        "白衬衫",
        "针织开衫",
        "牛仔外套",
        "格子衬衫",
        "黑色高领",
        "百褶裙",
        "工装裤",
        "连帽外套",
        "真丝睡衣",
        "复古背带裤",
        "露肩上衣",
        "休闲短裤",
        "长款风衣",
        "紧身瑜伽服",
        "纯棉T恤",
      ];
      const physicals = [
        "元气满满",
        "有点犯困",
        "精神焕发",
        "状态一般",
        "好想睡觉",
        "鼻子不通",
        "胃口大开",
        "充满活力",
        "腰酸背痛",
        "心情愉悦",
        "头昏脑胀",
        "饿了饿了",
        "神清气爽",
        "有点emo",
        "活力四射",
        "口干舌燥",
        "浑身舒畅",
        "略感疲惫",
        "精神集中",
        "心情烦躁",
      ];
      const newF = {
        ...f,
        mood: Math.round(newMood),
        outfit: outfits[Math.floor(Math.random() * outfits.length)],
        physicalCondition:
          physicals[Math.floor(Math.random() * physicals.length)],
        lastStateUpdate: Date.now(),
      };
      dbUpdateFriend(f.id, newF);
      return newF;
    }
    return f;
  });

  friends.value = updated;
}

export function refreshConversations() {
  conversations.value = getConversations();
}

export function refreshMessages(limit = 30, offset = 0) {
  const id = currentConversationId.value;
  if (id) {
    const msgs = getMessages(id, limit, offset);
    if (offset === 0) {
      messages.value = msgs;
    } else {
      // 分页加载更多，拼在前面
      messages.value = [...msgs, ...messages.value];
    }
  } else {
    messages.value = [];
  }
}

export function refreshAll() {
  refreshFriends();
  refreshConversations();
  refreshMessages();
}

// === 朋友 ===
export function createFriend(
  friend: Omit<
    Friend,
    | "createdAt"
    | "mood"
    | "intimacy"
    | "appearance"
    | "outfit"
    | "physicalCondition"
    | "lastStateUpdate"
    | "autoReply"
  >,
) {
  dbCreateFriend(friend);
  refreshFriends();
}

export function updateFriend(id: string, updates: Partial<Friend>) {
  dbUpdateFriend(id, updates);
  refreshFriends();
}

export function deleteFriend(id: string) {
  dbDeleteFriend(id);
  refreshAll();
}

// === 记忆 ===
export function fetchMemories(friendId: string) {
  return getMemories(friendId);
}

export function addMemory(memory: Omit<Memory, "id">) {
  dbCreateMemory(memory);
}

export function removeMemory(id: string) {
  dbDeleteMemory(id);
}

// === 会话 ===
export function startPrivateChat(friendId: string): string {
  const existing = conversations.value.find(
    (c) =>
      c.type === "private" &&
      c.friendIds.length === 1 &&
      c.friendIds[0] === friendId,
  );
  if (existing) {
    currentConversationId.value = existing.id;
    refreshMessages();
    return existing.id;
  }
  const id = `conv_${Date.now()}`;
  dbCreateConversation({ id, type: "private", friendIds: [friendId] });
  refreshConversations();
  currentConversationId.value = id;
  refreshMessages();
  return id;
}

export function createGroupChat(name: string, friendIds: string[]): string {
  const id = `conv_${Date.now()}`;
  dbCreateConversation({ id, type: "group", name, friendIds });
  refreshConversations();
  currentConversationId.value = id;
  refreshMessages();
  return id;
}

export function selectConversation(id: string) {
  if (currentConversationId.value !== id) {
    if (sendTimer) clearTimeout(sendTimer);
    pendingContent = "";
    pendingImages = [];
    isWaiting.value = false;
  }
  currentConversationId.value = id;
  refreshMessages();
}

export function deleteConversation(id: string) {
  dbDeleteConversation(id);
  refreshConversations();
  if (currentConversationId.value === id) {
    currentConversationId.value = null;
    messages.value = [];
  }
}

// === 消息 ===
export function notifyTyping() {
  if (sendTimer && isWaiting.value) {
    clearTimeout(sendTimer);
    sendTimer = null;
    isWaiting.value = true;
  }
}

function startTimer() {
  const convId = currentConversationId.value;
  if (!convId) return;
  const conv = conversations.value.find((c) => c.id === convId);
  if (!conv) return;

  isWaiting.value = true;
  sendTimer = setTimeout(async () => {
    if (!pendingContent && pendingImages.length === 0) {
      isWaiting.value = false;
      sendTimer = null;
      return;
    }
    const finalContent = pendingContent;
    const finalImages = pendingImages;
    pendingContent = "";
    pendingImages = [];
    isWaiting.value = false;
    sendTimer = null;

    try {
      await generateReplies(
        convId,
        conv.friendIds,
        finalContent,
        finalImages,
        () => {
          refreshMessages();
          refreshConversations();
        },
      );
    } catch (err) {
      console.error("[Store] 请求 AI 发生异常:", err);
    } finally {
      refreshMessages();
      refreshConversations();
    }
  }, 3000);
}

export async function sendUserMessage(
  content: string,
  images: string[] = [],
): Promise<string[]> {
  const convId = currentConversationId.value;
  if (!convId) return ["没有选中会话"];
  const conv = conversations.value.find((c) => c.id === convId);
  if (!conv) return ["会话不存在"];
  if (!content.trim() && images.length === 0) return ["消息不能为空"];

  createMessage({
    conversationId: convId,
    senderId: "user",
    senderName: "我",
    content: content.trim(),
    images: images.length > 0 ? images : undefined,
    timestamp: Date.now(),
    status: "sent",
  });
  updateConversationLastMessage(
    convId,
    images.length > 0 ? "[图片]" : content.trim(),
  );
  refreshMessages();
  refreshConversations();

  pendingContent = pendingContent
    ? `${pendingContent}\n${content.trim()}`
    : content.trim();
  pendingImages = [...pendingImages, ...images];
  if (sendTimer) clearTimeout(sendTimer);
  startTimer();
  return [];
}

// === 自动回复服务 ===
export function startAppServices() {
  if (autoReplyTimer) return;
  console.log("[Store] 启动自动回复服务...");

  const checkAutoReply = async () => {
    const allFriends = getFriends();
    const allConvs = getConversations();

    console.log(
      `[Store] 检查自动回复... 共 ${allFriends.length} 个好友, ${allConvs.length} 个会话`,
    );

    for (const friend of allFriends) {
      if (!friend.autoReply?.enabled) {
        console.log(`[Store] ${friend.name} 未开启自动回复`);
        continue;
      }

      const conv = allConvs.find(
        (c) =>
          c.type === "private" &&
          c.friendIds.length === 1 &&
          c.friendIds[0] === friend.id,
      );
      if (!conv) {
        console.log(`[Store] ${friend.name} 没有私聊会话`);
        continue;
      }

      const lastMsg = getLastMessage(conv.id);
      const baseTime = lastMsg ? lastMsg.timestamp : conv.createdAt;
      const diffMinutes = (Date.now() - baseTime) / (1000 * 60);
      const idleMinutes = friend.autoReply.idleMinutes || 30;

      console.log(
        `[Store] ${friend.name}: 最后消息=${lastMsg ? `${lastMsg.senderName}: ${lastMsg.content.slice(0, 20)}...` : "无"}, 已过=${Math.floor(diffMinutes)}分钟, 需等待=${idleMinutes}分钟`,
      );

      if (diffMinutes < idleMinutes) {
        console.log(`[Store] ${friend.name} 时间未到，跳过`);
        continue;
      }

      const lastAuto = lastAutoReplyTime.get(conv.id) || 0;
      const autoDiffMinutes = (Date.now() - lastAuto) / (1000 * 60);
      if (autoDiffMinutes < idleMinutes) {
        console.log(
          `[Store] ${friend.name} 上次自动回复在 ${Math.floor(autoDiffMinutes)} 分钟前，跳过`,
        );
        continue;
      }

      if (!lastMsg || lastMsg.senderId !== "user") {
        console.log(`[Store] ${friend.name} 触发自动回复...`);
        lastAutoReplyTime.set(conv.id, Date.now());

        try {
          // 获取最近的聊天记录来构建上下文
          const recentMsgs = getMessages(conv.id, 10, 0);
          const now = new Date();
          const hour = now.getHours();
          const timeOfDay = hour < 6 ? "深夜" : hour < 12 ? "早上" : hour < 14 ? "中午" : hour < 18 ? "下午" : "晚上";

          // 构建智能提示词
          let prompt = "";
          if (recentMsgs.length === 0) {
            // 全新对话，主动打招呼
            prompt = `(${timeOfDay}了，你想起了对方，主动发个消息打个招呼或者开启一个新话题)`;
          } else {
            // 有聊天记录，根据上下文决定如何开启话题
            const lastUserMsg = [...recentMsgs].reverse().find(m => m.senderId === "user");
            const lastTopic = lastUserMsg ? lastUserMsg.content.slice(0, 30) : "";

            if (lastTopic) {
              // 根据最后话题延续或开启新话题
              const scenarios = [
                `(${timeOfDay}了，你突然想到之前聊的"${lastTopic}..."相关的事，想跟对方分享一下)`,
                `(你刚做完一件事，突然想起对方，想跟${timeOfDay}还在线的TA聊几句)`,
                `(你看到/想到某个东西，想起对方可能会喜欢/感兴趣，主动发消息)`,
                `(你${friend.physicalCondition}，${timeOfDay}想找人聊聊天，主动开启话题)`,
              ];
              prompt = scenarios[Math.floor(Math.random() * scenarios.length)];
            } else {
              prompt = `(${timeOfDay}了，你想起了对方，主动发个消息问问TA在干嘛)`;
            }
          }

          await generateReplies(
            conv.id,
            [friend.id],
            prompt,
            [],
            (msg) => {
              refreshFriends();
              refreshConversations();
              refreshMessages();
              if (
                "Notification" in window &&
                Notification.permission === "granted"
              ) {
                new Notification(`${friend.name}`, { body: msg.content });
              }
            },
          );
        } catch (err) {
          console.error(`[Store] ${friend.name} 自动回复失败:`, err);
        }
      }
    }
  };

  autoReplyTimer = setInterval(checkAutoReply, 60000);
  checkAutoReply();
}

export async function retryAIResponse(): Promise<string[]> {
  const convId = currentConversationId.value;
  if (!convId) return ["未选择会话"];
  const conv = conversations.value.find((c) => c.id === convId);
  if (!conv) return ["会话不存在"];

  // 1. 找到最后一条用户消息
  const lastUserMsg = [...messages.value]
    .reverse()
    .find((m) => m.senderId === "user");
  if (!lastUserMsg) return ["未找到可重试的消息"];

  console.log(`[Store] 手动重试消息: "${lastUserMsg.content}"`);

  // 2. 停止当前计时器并清除挂起的内容
  if (sendTimer) {
    clearTimeout(sendTimer);
    sendTimer = null;
  }
  pendingContent = "";
  pendingImages = [];
  isWaiting.value = false;

  // 3. 立即触发 AI 生成
  try {
    await generateReplies(
      convId,
      conv.friendIds,
      lastUserMsg.content,
      lastUserMsg.images || [],
      () => {
        refreshMessages();
        refreshConversations();
      },
    );
    return [];
  } catch (err: any) {
    return [err.message || "重试失败"];
  }
}

export function resetAllData() {
  dbResetAll();
  refreshAll();
  currentConversationId.value = null;
}

export function deleteMessage(msgId: string) {
  dbDeleteMessage(msgId);
  refreshMessages();
  refreshConversations();
}

export function clearChat(convId: string) {
  if (!confirm("确定要清空当前聊天记录吗？")) return;
  dbClearConversationMessages(convId);
  refreshMessages();
  refreshConversations();
}

export { isGenerating, generatingFriendIds, generateFriendState };
