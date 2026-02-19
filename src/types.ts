export interface AutoReplyConfig {
  enabled: boolean
  idleMinutes: number // 多少分钟不说话触发回复
  lastCheckTime?: number
}

// === 记忆片段 ===
export interface Memory {
  id: string
  friendId: string
  content: string
  importance: number // 1-10
  type: 'event' | 'preference' | 'fact'
  timestamp: number
}

// === AI 朋友 ===
export interface Friend {
  id: string
  name: string
  avatar?: string
  personality: string
  mood: number // 0-100
  intimacy: number // 0-1000
  appearance: string // 外观描述
  outfit: string // 今天的打扮
  physicalCondition: string // 身体状态（如：有点感冒、精力充沛）
  lastStateUpdate: number // 上次状态自动刷新的时间
  autoReply: AutoReplyConfig
  createdAt: number
}

// === 消息 ===
export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  content: string
  images?: string[]
  timestamp: number
  status: 'pending' | 'sent' | 'failed'
}

// === 会话 ===
export interface Conversation {
  id: string
  type: 'private' | 'group'
  name?: string
  friendIds: string[]
  lastMessage?: string
  lastMessageTime?: number
  createdAt: number
}

// === 智谱配置 ===
export interface ZhipuConfig {
  apiKey: string
  chatModel: 'GLM-4.6V-Flash' | 'GLM-4.7-Flash' | 'GLM-4V-Flash'
  imageModel: 'Cogview-3-Flash'
}

// 可用模型（supportsVision 表示是否支持图片）
export const CHAT_MODELS = [
  { id: 'GLM-4.6V-Flash', name: 'GLM-4.6V-Flash', desc: '128K上下文，视觉模型', supportsVision: true },
  { id: 'GLM-4.7-Flash', name: 'GLM-4.7-Flash', desc: '最新文本模型，速度快', supportsVision: false },
  { id: 'GLM-4V-Flash', name: 'GLM-4V-Flash', desc: '经典视觉模型', supportsVision: true }
] as const

export const IMAGE_MODELS = [
  { id: 'Cogview-3-Flash', name: 'Cogview-3-Flash', desc: '快速生图' }
] as const
