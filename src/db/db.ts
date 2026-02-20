import initSqlJs, { type Database } from "sql.js";
import type { Friend, Conversation, Message, Memory, AppConfig } from "../types";

let db: Database | null = null;
const DB_NAME = "ai-friends-db";
const STORE_NAME = "sqlite";
const KEY = "database";

// === IndexedDB 操作 ===
async function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE_NAME); };
  });
}
async function saveToIndexedDB(data: Uint8Array): Promise<void> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const request = idb.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// === 数据库初始化 ===
export async function initDb(): Promise<Database> {
  if (db) return db;
  const SQL = await initSqlJs({ 
    locateFile: f => f === "sql-wasm-browser.wasm" ? `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm` : `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${f}` 
  });
  const savedData = await loadFromIndexedDB();
  db = savedData ? new SQL.Database(savedData) : new SQL.Database();
  initSchema(db);
  return db;
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS friends (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT, personality TEXT,
      mood INTEGER DEFAULT 50, intimacy INTEGER DEFAULT 0, appearance TEXT,
      outfit TEXT, physical_condition TEXT, last_state_update INTEGER,
      auto_reply TEXT, created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY, friend_id TEXT NOT NULL, content TEXT NOT NULL,
      importance INTEGER DEFAULT 1, type TEXT DEFAULT 'fact', timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT, friend_ids TEXT NOT NULL,
      last_message TEXT, last_message_time INTEGER, created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL, content TEXT NOT NULL, timestamp INTEGER NOT NULL,
      status TEXT NOT NULL, images TEXT
    );
  `);
  // 迁移逻辑：确保列存在
  const columns = ['mood', 'intimacy', 'appearance', 'outfit', 'physical_condition', 'last_state_update', 'auto_reply'];
  columns.forEach(col => { try { db.run(`ALTER TABLE friends ADD COLUMN ${col} TEXT`); } catch(e) {} });
  saveDb();
}

export async function saveDb(): Promise<void> {
  if (db) await saveToIndexedDB(db.export());
}

// === 显式列名定义 ===
const FRIEND_COLS = `id, name, avatar, personality, mood, intimacy, appearance, outfit, physical_condition, last_state_update, auto_reply, created_at`;

export function getFriends(): Friend[] {
  const result = db!.exec(`SELECT ${FRIEND_COLS} FROM friends ORDER BY created_at DESC`);
  if (result.length === 0) return [];
  return result[0].values.map((row: any) => ({
    id: row[0], name: row[1], avatar: row[2], personality: row[3], mood: Number(row[4] || 50),
    intimacy: Number(row[5] || 0), appearance: row[6], outfit: row[7], physicalCondition: row[8],
    lastStateUpdate: Number(row[9] || Date.now()),
    autoReply: row[10] ? JSON.parse(row[10]) : { enabled: false, idleMinutes: 10 },
    createdAt: Number(row[11])
  }));
}

export function getFriend(id: string): Friend | null {
  const result = db!.exec(`SELECT ${FRIEND_COLS} FROM friends WHERE id = '${id}'`);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row: any = result[0].values[0];
  return {
    id: row[0], name: row[1], avatar: row[2], personality: row[3], mood: Number(row[4] || 50),
    intimacy: Number(row[5] || 0), appearance: row[6], outfit: row[7], physicalCondition: row[8],
    lastStateUpdate: Number(row[9] || Date.now()),
    autoReply: row[10] ? JSON.parse(row[10]) : { enabled: false, idleMinutes: 10 },
    createdAt: Number(row[11])
  };
}

export function createFriend(friend: any): void {
  const ts = Date.now();
  const ar = JSON.stringify({ enabled: false, idleMinutes: 10 });
  db!.run(`INSERT INTO friends (${FRIEND_COLS}) VALUES (
    '${friend.id}', '${friend.name.replace(/'/g, "''")}', '${(friend.avatar || "").replace(/'/g, "''")}', 
    '${(friend.personality || "").replace(/'/g, "''")}', 50, 0, '初次见面', '休闲装', '精力充沛', ${ts}, '${ar}', ${ts}
  )`);
  saveDb();
}

export function updateFriend(id: string, updates: Partial<Friend>): void {
  const cur = getFriend(id);
  if (!cur) return;
  const f = { ...cur, ...updates };
  db!.run(`UPDATE friends SET 
    name='${f.name.replace(/'/g, "''")}', avatar='${(f.avatar || "").replace(/'/g, "''")}', 
    personality='${f.personality.replace(/'/g, "''")}', mood=${f.mood}, intimacy=${f.intimacy}, 
    appearance='${f.appearance.replace(/'/g, "''")}', outfit='${f.outfit.replace(/'/g, "''")}', 
    physical_condition='${f.physicalCondition.replace(/'/g, "''")}', last_state_update=${f.lastStateUpdate}, 
    auto_reply='${JSON.stringify(f.autoReply).replace(/'/g, "''")}' WHERE id='${id}'`);
  saveDb();
}

// === 其他保持不变但显式列名的 CRUD ===
export function getMessages(cid: string, limit = 20, offset = 0): Message[] {
  const res = db!.exec(`SELECT id, conversation_id, sender_id, sender_name, content, timestamp, status, images FROM messages WHERE conversation_id='${cid}' ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`);
  if (res.length === 0) return [];
  return res[0].values.map((row: any) => ({
    id: row[0], conversationId: row[1], senderId: row[2], senderName: row[3], content: row[4], timestamp: row[5], status: row[6], images: row[7] ? JSON.parse(row[7]) : undefined
  })).reverse();
}

export function createMessage(msg: Omit<Message, "id">): Message {
  const id = `msg_${Date.now()}`;
  db!.run(`INSERT INTO messages (id, conversation_id, sender_id, sender_name, content, timestamp, status, images) VALUES (
    '${id}', '${msg.conversationId}', '${msg.senderId}', '${msg.senderName.replace(/'/g, "''")}', 
    '${msg.content.replace(/'/g, "''")}', ${msg.timestamp}, '${msg.status}', '${msg.images ? JSON.stringify(msg.images).replace(/'/g, "''") : ""}'
  )`);
  saveDb();
  return { ...msg, id };
}

// === 核心逻辑补充 ===
export function getAppConfig(): AppConfig {
  const s = localStorage.getItem("app_config");
  const def: AppConfig = { activeProvider: 'zhipu', imageProvider: 'zhipu', providers: { zhipu: { provider: 'zhipu', apiKey: '', chatModel: 'GLM-4.6V-Flash' }, google: { provider: 'google', apiKey: '', chatModel: 'gemma-3-27b-it' }, groq: { provider: 'groq', apiKey: '', chatModel: 'llama-3.3-70b-versatile' }, volcengine: { provider: 'volcengine', apiKey: '', chatModel: 'doubao-pro-32k' }, modelscope: { provider: 'modelscope', apiKey: '', chatModel: 'qwen-max' } }, imageGenerationEnabled: false };
  if (!s) return def;
  try { const p = JSON.parse(s); return { ...def, ...p, providers: { ...def.providers, ...p.providers } }; } catch { return def; }
}
export function setAppConfig(c: AppConfig) { localStorage.setItem("app_config", JSON.stringify(c)); }
export function getShowImages() { return localStorage.getItem("show_images") !== "false"; }
export function setShowImages(s: boolean) { localStorage.setItem("show_images", String(s)); }
export function updateFriendStats(id: string, i: number, m: number) { const f = getFriend(id); if (f) updateFriend(id, { intimacy: f.intimacy + i, mood: Math.max(0, Math.min(100, f.mood + m)) }); }
export function clearDatabase() { if (db) { db.run("DELETE FROM friends; DELETE FROM conversations; DELETE FROM messages; DELETE FROM memories;"); saveDb(); } }
export async function imageUrlToBase64(u: string): Promise<string> { try { const r = await fetch(u); const b = await r.blob(); return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(b); }); } catch { return u; } }
export function getConversations(): Conversation[] {
  const res = db!.exec(`SELECT id, type, name, friend_ids, last_message, last_message_time, created_at FROM conversations ORDER BY last_message_time DESC NULLS LAST, created_at DESC`);
  if (res.length === 0) return [];
  return res[0].values.map((row: any) => ({ id: row[0], type: row[1], name: row[2], friendIds: JSON.parse(row[3]), lastMessage: row[4], lastMessageTime: row[5], createdAt: row[6] }));
}
export function createConversation(c: any) { db!.run(`INSERT INTO conversations (id, type, name, friend_ids, created_at) VALUES ('${c.id}', '${c.type}', '${(c.name || "").replace(/'/g, "''")}', '${JSON.stringify(c.friendIds)}', ${Date.now()})`); saveDb(); }
export function updateConversationLastMessage(id: string, m: string) { db!.run(`UPDATE conversations SET last_message='${m.replace(/'/g, "''")}', last_message_time=${Date.now()} WHERE id='${id}'`); saveDb(); }
export function deleteFriend(id: string) { db!.run(`DELETE FROM friends WHERE id='${id}'`); saveDb(); }
export function deleteConversation(id: string) { db!.run(`DELETE FROM messages WHERE conversation_id='${id}'; DELETE FROM conversations WHERE id='${id}';`); saveDb(); }
export function getMemories(fid: string): Memory[] { const res = db!.exec(`SELECT id, friend_id, content, importance, type, timestamp FROM memories WHERE friend_id='${fid}' ORDER BY timestamp DESC`); if (res.length === 0) return []; return res[0].values.map((row: any) => ({ id: row[0], friendId: row[1], content: row[2], importance: row[3], type: row[4], timestamp: row[5] })); }
export function createMemory(m: any) { const id = `mem_${Date.now()}`; db!.run(`INSERT INTO memories VALUES ('${id}', '${m.friendId}', '${m.content.replace(/'/g, "''")}', ${m.importance}, '${m.type}', ${m.timestamp})`); saveDb(); return { ...m, id }; }
export function getLastMessage(cid: string): Message | null { const msgs = getMessages(cid, 1); return msgs.length > 0 ? msgs[0] : null; }
export function deleteMemory(id: string) { db!.run(`DELETE FROM memories WHERE id='${id}'`); saveDb(); }
export async function exportDatabase(): Promise<Blob> { const data = db!.export(); return new Blob([new Uint8Array(data)], { type: "application/octet-stream" }); }
export async function importDatabase(f: File) { 
  const buffer = await f.arrayBuffer(); 
  const SQL = await initSqlJs({ 
    locateFile: file => file === "sql-wasm-browser.wasm" ? `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm` : `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}` 
  }); 
  db = new SQL.Database(new Uint8Array(buffer)); 
  await saveToIndexedDB(new Uint8Array(buffer)); 
}
