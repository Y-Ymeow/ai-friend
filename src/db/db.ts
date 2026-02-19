import initSqlJs, { type Database } from "sql.js";
import type { Friend, Conversation, Message, Memory, ZhipuConfig } from "../types";

let db: Database | null = null;

const DB_NAME = "ai-friends-db";
const STORE_NAME = "sqlite";
const KEY = "database";

// === IndexedDB 操作 ===
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
  });
}

async function saveToIndexedDB(data: Uint8Array): Promise<void> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(data, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function clearIndexedDB(): Promise<void> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// === 数据库初始化 ===
export async function initDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file) => {
      if (file === "sql-wasm-browser.wasm") {
        return "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm";
      }
      return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`;
    },
  });

  const savedData = await loadFromIndexedDB();
  if (savedData) {
    try {
      db = new SQL.Database(savedData);
      migrateSchema(db);
      console.log(
        "[DB] 从 IndexedDB 恢复成功，大小:",
        savedData.length,
        "bytes",
      );
      return db;
    } catch (e) {
      console.error("[DB] 恢复失败，创建新库", e);
      await clearIndexedDB();
    }
  }

  db = new SQL.Database();
  initSchema(db);
  console.log("[DB] 创建新数据库");
  return db;
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS friends (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      personality TEXT,
      mood INTEGER DEFAULT 50,
      intimacy INTEGER DEFAULT 0,
      appearance TEXT,
      outfit TEXT,
      physical_condition TEXT,
      last_state_update INTEGER,
      auto_reply TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      friend_id TEXT NOT NULL,
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 1,
      type TEXT DEFAULT 'fact',
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT,
      friend_ids TEXT NOT NULL,
      last_message TEXT,
      last_message_time INTEGER,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      status TEXT NOT NULL,
      images TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(timestamp);
  `);
  migrateSchema(db);
  saveDb();
}

function migrateSchema(db: Database) {
  try { db.run(`ALTER TABLE messages ADD COLUMN images TEXT`); } catch {}
  try { db.run(`ALTER TABLE friends ADD COLUMN mood INTEGER DEFAULT 50`); } catch {}
  try { db.run(`ALTER TABLE friends ADD COLUMN intimacy INTEGER DEFAULT 0`); } catch {}
  try { db.run(`ALTER TABLE friends ADD COLUMN appearance TEXT`); } catch {}
  try { db.run(`ALTER TABLE friends ADD COLUMN outfit TEXT`); } catch {}
  try { db.run(`ALTER TABLE friends ADD COLUMN physical_condition TEXT`); } catch {}
  try { db.run(`ALTER TABLE friends ADD COLUMN last_state_update INTEGER`); } catch {}
  try { db.run(`ALTER TABLE friends ADD COLUMN auto_reply TEXT`); } catch {}
  try {
    db.run(`CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      friend_id TEXT NOT NULL,
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 1,
      type TEXT DEFAULT 'fact',
      timestamp INTEGER NOT NULL
    )`);
  } catch {}
}

export async function saveDb(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await saveToIndexedDB(data);
}

// === 导出/导入 ===
export async function exportDatabase(): Promise<Blob> {
  if (!db) throw new Error("数据库未初始化");
  const data = db.export();
  return new Blob([new Uint8Array(data)], { type: "application/octet-stream" });
}

export async function importDatabase(file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  const SQL = await initSqlJs({
    locateFile: (file) => {
      if (file === "sql-wasm-browser.wasm") {
        return "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm";
      }
      return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`;
    },
  });

  const testDb = new SQL.Database(data);
  const tables = testDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
  testDb.close();

  if (tables.length === 0) {
    throw new Error("无效的数据库文件");
  }

  if (db) db.close();
  db = new SQL.Database(data);
  await saveToIndexedDB(data);
}

// === 朋友 CRUD ===
export function getFriends(): Friend[] {
  const result = db!.exec(
    `SELECT id, name, avatar, personality, mood, intimacy, appearance, outfit, physical_condition, last_state_update, auto_reply, created_at FROM friends ORDER BY created_at DESC`,
  );
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    avatar: row[2] as string | undefined,
    personality: row[3] as string,
    mood: (row[4] as number) || 50,
    intimacy: (row[5] as number) || 0,
    appearance: (row[6] as string) || "初次见面",
    outfit: (row[7] as string) || "休闲装",
    physicalCondition: (row[8] as string) || "精力充沛",
    lastStateUpdate: (row[9] as number) || Date.now(),
    autoReply: row[10] ? JSON.parse(row[10] as string) : { enabled: false, idleMinutes: 10 },
    createdAt: row[11] as number,
  }));
}

export function getFriend(id: string): Friend | null {
  const result = db!.exec(
    `SELECT id, name, avatar, personality, mood, intimacy, appearance, outfit, physical_condition, last_state_update, auto_reply, created_at FROM friends WHERE id = '${id}'`,
  );
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    avatar: row[2] as string | undefined,
    personality: row[3] as string,
    mood: (row[4] as number) || 50,
    intimacy: (row[5] as number) || 0,
    appearance: (row[6] as string) || "初次见面",
    outfit: (row[7] as string) || "休闲装",
    physicalCondition: (row[8] as string) || "精力充沛",
    lastStateUpdate: (row[9] as number) || Date.now(),
    autoReply: row[10] ? JSON.parse(row[10] as string) : { enabled: false, idleMinutes: 10 },
    createdAt: row[11] as number,
  };
}

export function createFriend(friend: Omit<Friend, "createdAt" | "mood" | "intimacy" | "appearance" | "outfit" | "physicalCondition" | "lastStateUpdate" | "autoReply">): void {
  const id = friend.id;
  const escapedName = friend.name.replace(/'/g, "''");
  const escapedAvatar = (friend.avatar || "").replace(/'/g, "''");
  const escapedPersonality = (friend.personality || "").replace(/'/g, "''");
  const defaultAutoReply = JSON.stringify({ enabled: false, idleMinutes: 10 });
  const timestamp = Date.now();

  const sql = `INSERT INTO friends (id, name, avatar, personality, mood, intimacy, appearance, outfit, physical_condition, last_state_update, auto_reply, created_at) 
               VALUES ('${id}', '${escapedName}', '${escapedAvatar}', '${escapedPersonality}', 50, 0, '初次见面', '休闲装', '精力充沛', ${timestamp}, '${defaultAutoReply}', ${timestamp})`;
  db!.run(sql);
  saveDb();
}

export function updateFriend(id: string, updates: Partial<Friend>): void {
  const current = getFriend(id);
  if (!current) return;
  const f = { ...current, ...updates };
  const sql = `UPDATE friends SET 
    name = '${f.name.replace(/'/g, "''")}', 
    avatar = '${(f.avatar || "").replace(/'/g, "''")}', 
    personality = '${f.personality.replace(/'/g, "''")}',
    mood = ${f.mood},
    intimacy = ${f.intimacy},
    appearance = '${f.appearance.replace(/'/g, "''")}',
    outfit = '${f.outfit.replace(/'/g, "''")}',
    physical_condition = '${f.physicalCondition.replace(/'/g, "''")}',
    last_state_update = ${f.lastStateUpdate},
    auto_reply = '${JSON.stringify(f.autoReply).replace(/'/g, "''")}'
    WHERE id = '${id}'`;
  db!.run(sql);
  saveDb();
}

export function deleteFriend(id: string): void {
  db!.run(`DELETE FROM friends WHERE id = '${id}'`);
  db!.run(`DELETE FROM memories WHERE friend_id = '${id}'`);
  const convs = db!.exec(`SELECT id FROM conversations WHERE friend_ids LIKE '%${id}%'`);
  if (convs.length > 0) {
    for (const row of convs[0].values) {
      db!.run(`DELETE FROM messages WHERE conversation_id = '${row[0]}'`);
    }
    db!.run(`DELETE FROM conversations WHERE friend_ids LIKE '%${id}%'`);
  }
  saveDb();
}

// === 记忆 CRUD ===
export function getMemories(friendId: string): Memory[] {
  const result = db!.exec(`SELECT id, friend_id, content, importance, type, timestamp FROM memories WHERE friend_id = '${friendId}' ORDER BY timestamp DESC`);
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    id: row[0] as string,
    friendId: row[1] as string,
    content: row[2] as string,
    importance: row[3] as number,
    type: row[4] as any,
    timestamp: row[5] as number,
  }));
}

export function createMemory(mem: Omit<Memory, "id">): Memory {
  const id = `mem_${Date.now()}`;
  const sql = `INSERT INTO memories (id, friend_id, content, importance, type, timestamp) 
               VALUES ('${id}', '${mem.friendId}', '${mem.content.replace(/'/g, "''")}', ${mem.importance}, '${mem.type}', ${mem.timestamp})`;
  db!.run(sql);
  saveDb();
  return { ...mem, id };
}

export function deleteMemory(id: string): void {
  db!.run(`DELETE FROM memories WHERE id = '${id}'`);
  saveDb();
}

// === 会话 CRUD ===
export function getConversations(): Conversation[] {
  const result = db!.exec(`SELECT id, type, name, friend_ids, last_message, last_message_time, created_at FROM conversations ORDER BY last_message_time DESC NULLS LAST, created_at DESC`);
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    id: row[0] as string,
    type: row[1] as any,
    name: row[2] as string,
    friendIds: JSON.parse(row[3] as string),
    lastMessage: row[4] as string,
    lastMessageTime: row[5] as number,
    createdAt: row[6] as number,
  }));
}

export function createConversation(conv: Omit<Conversation, "createdAt" | "lastMessage" | "lastMessageTime">): void {
  const sql = `INSERT INTO conversations (id, type, name, friend_ids, created_at) VALUES ('${conv.id}', '${conv.type}', '${(conv.name || "").replace(/'/g, "''")}', '${JSON.stringify(conv.friendIds).replace(/'/g, "''")}', ${Date.now()})`;
  db!.run(sql);
  saveDb();
}

export function updateConversationLastMessage(id: string, message: string): void {
  db!.run(`UPDATE conversations SET last_message = '${message.replace(/'/g, "''")}', last_message_time = ${Date.now()} WHERE id = '${id}'`);
  saveDb();
}

export function deleteConversation(id: string): void {
  db!.run(`DELETE FROM messages WHERE conversation_id = '${id}'`);
  db!.run(`DELETE FROM conversations WHERE id = '${id}'`);
  saveDb();
}

// === 消息 CRUD ===
export function getMessages(conversationId: string, limit = 20, offset = 0): Message[] {
  const result = db!.exec(`SELECT id, conversation_id, sender_id, sender_name, content, timestamp, status, images FROM messages WHERE conversation_id = '${conversationId}' ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`);
  if (result.length === 0) return [];
  const msgs = result[0].values.map((row) => ({
    id: row[0] as string,
    conversationId: row[1] as string,
    senderId: row[2] as string,
    senderName: row[3] as string,
    content: row[4] as string,
    timestamp: row[5] as number,
    status: row[6] as any,
    images: row[7] ? JSON.parse(row[7] as string) : undefined,
  }));
  return msgs.reverse();
}

export function createMessage(msg: Omit<Message, "id">): Message {
  const id = `msg_${Date.now()}`;
  const sql = `INSERT INTO messages (id, conversation_id, sender_id, sender_name, content, timestamp, status, images) VALUES ('${id}', '${msg.conversationId}', '${msg.senderId}', '${msg.senderName.replace(/'/g, "''")}', '${msg.content.replace(/'/g, "''")}', ${msg.timestamp}, '${msg.status}', '${msg.images ? JSON.stringify(msg.images).replace(/'/g, "''") : ""}')`;
  db!.run(sql);
  saveDb();
  return { ...msg, id };
}

export function getZhipuConfig(): ZhipuConfig | null {
  const apiKey = localStorage.getItem("zhipu_api_key");
  if (!apiKey) return null;
  return {
    apiKey,
    chatModel: (localStorage.getItem("zhipu_chat_model") || "GLM-4.6V-Flash") as any,
    imageModel: (localStorage.getItem("zhipu_image_model") || "Cogview-3-Flash") as any,
  };
}

export function setZhipuConfig(config: Partial<ZhipuConfig>): void {
  if (config.apiKey) localStorage.setItem("zhipu_api_key", config.apiKey);
  if (config.chatModel) localStorage.setItem("zhipu_chat_model", config.chatModel);
  if (config.imageModel) localStorage.setItem("zhipu_image_model", config.imageModel);
}

export function getShowImages(): boolean {
  return localStorage.getItem("show_images") !== "false";
}

export function setShowImages(show: boolean): void {
  localStorage.setItem("show_images", String(show));
}

export function updateFriendStats(id: string, intimacyGain: number, moodGain: number): void {
  const friend = getFriend(id);
  if (!friend) return;
  
  const newIntimacy = Math.min(1000, friend.intimacy + intimacyGain);
  const newMood = Math.min(100, Math.max(0, friend.mood + moodGain));
  
  updateFriend(id, { 
    intimacy: newIntimacy, 
    mood: newMood,
    lastStateUpdate: Date.now()
  });
}

export function clearDatabase(): void {
  if (db) {
    db.run("DELETE FROM friends; DELETE FROM conversations; DELETE FROM messages; DELETE FROM memories;");
    saveDb();
  }
}

export async function generateAvatar(friend: Friend): Promise<string> {
  const config = getZhipuConfig();
  if (!config) throw new Error("请先配置 API Key");

  const prompt = `生成一个二次元风格的头像，人物特点：${friend.appearance || '年轻女性'}，性格：${friend.personality?.slice(0, 50) || '温柔'}。要求：正面肖像，简洁背景，适合作为社交头像。`;

  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.imageModel,
      prompt,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`生成失败: ${err}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) throw new Error("未返回图片URL");

  return imageUrl;
}
