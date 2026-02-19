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
} from "./db/db";
import {
  generateReplies,
  isGenerating,
  generatingFriendIds,
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
        "休闲装",
        "运动服",
        "正装",
        "居家服",
        "裙子",
        "睡衣",
        "毛衣",
        "牛仔裤",
      ];
      const physicals = [
        "精力充沛",
        "有点累",
        "很精神",
        "一般般",
        "想睡觉",
        "有点感冒",
        "胃口大开",
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
  autoReplyTimer = setInterval(async () => {
    console.log("[Store] 检查自动回复...");
    for (const friend of friends.value) {
      if (!friend.autoReply?.enabled) continue;
      
      const conv = conversations.value.find(
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
      const idleMinutes = friend.autoReply.idleMinutes || 5;

      console.log(
        `[Store] ${friend.name}: lastMsg=${lastMsg ? `${lastMsg.senderName}: ${lastMsg.content.slice(0, 20)}...` : "无"}, diff=${Math.floor(diffMinutes)}分钟, idle=${idleMinutes}分钟`
      );

      if (diffMinutes < idleMinutes) continue;

      const lastAuto = lastAutoReplyTime.get(conv.id) || 0;
      const autoDiffMinutes = (Date.now() - lastAuto) / (1000 * 60);
      if (autoDiffMinutes < idleMinutes) {
        console.log(`[Store] ${friend.name} 上次自动回复在 ${Math.floor(autoDiffMinutes)} 分钟前，跳过`);
        continue;
      }

      if (!lastMsg || lastMsg.senderId === "user") {
        console.log(`[Store] ${friend.name} 触发自动回复...`);
        lastAutoReplyTime.set(conv.id, Date.now());

        try {
          await generateReplies(
            conv.id,
            [friend.id],
            "(用户已经很久没理你了，请根据你们的关系和当前时间，主动发一条消息引起对方注意)",
            [],
            (msg) => {
              refreshMessages();
              refreshConversations();
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`${friend.name}`, { body: msg.content });
              }
            },
          );
        } catch (err) {
          console.error(`[Store] ${friend.name} 自动回复失败:`, err);
        }
      }
    }
  }, 60000);
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

export { isGenerating, generatingFriendIds };
