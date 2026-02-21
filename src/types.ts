// === AI 配置 ===
export type AIProvider =
  | "zhipu"
  | "google"
  | "groq"
  | "volcengine"
  | "modelscope"
  | "tencent";

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  chatModel: string;
  imageModel?: string;
  baseUrl?: string;
  imageQuality?: "hd" | "standard";
  imageSize?: string;
}

export interface AppConfig {
  activeProvider: AIProvider;
  imageProvider: AIProvider; // 新增：专门用于生图的提供商
  providers: Record<AIProvider, AIProviderConfig>;
  imageGenerationEnabled: boolean;
}

// ... 保持 CHAT_MODELS 和 IMAGE_MODELS 不变 ...
export const CHAT_MODELS: Record<AIProvider, any[]> = {
  zhipu: [
    {
      id: "glm-4.6v-flash",
      name: "GLM-4.6V-Flash",
      desc: "视觉模型",
      supportsVision: true,
    },
    {
      id: "glm-4.7-flash",
      name: "GLM-4.7-Flash",
      desc: "最新文本",
      supportsVision: false,
    },
    {
      id: "glm-4v-flash",
      name: "GLM-4V-Flash",
      desc: "视觉模型",
      supportsVision: true,
    },
  ],
  google: [
    {
      id: "gemma-3-27b-it",
      name: "Gemma 3 27B",
      desc: "最新开源",
      supportsVision: true,
    },
    {
      id: "gemma-3-12b-it",
      name: "Gemma 3 12B",
      desc: "中等开源",
      supportsVision: true,
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      desc: "极速",
      supportsVision: true,
    },
  ],
  groq: [
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B",
      desc: "极速",
      supportsVision: false,
    },
  ],
  volcengine: [
    { id: "doubao-pro-32k", name: "豆包 Pro", supportsVision: false },
  ],
  modelscope: [{ id: "qwen-max", name: "通义千问", supportsVision: false }],
  tencent: [
    {
      id: "hunyuan-lite",
      name: "腾讯混元 Lite",
      desc: "免费额度",
      supportsVision: false,
    },
    {
      id: "hunyuan-standard",
      name: "腾讯混元 Standard",
      desc: "标准版",
      supportsVision: false,
    },
    {
      id: "hunyuan-pro",
      name: "腾讯混元 Pro",
      desc: "专业版",
      supportsVision: false,
    },
  ],
};

export const IMAGE_MODELS: Record<AIProvider, { id: string; name: string }[]> =
  {
    zhipu: [{ id: "cogview-3-flash", name: "Cogview-3-Flash" }],
    google: [],
    volcengine: [],
    groq: [],
    modelscope: [],
    tencent: [],
  };

// === 核心类型 ===
export interface AutoReplyConfig {
  enabled: boolean;
  idleMinutes: number;
}
export interface Memory {
  id: string;
  friendId: string;
  content: string;
  importance: number;
  type: "event" | "preference" | "fact";
  timestamp: number;
}
export interface Friend {
  id: string;
  name: string;
  avatar?: string;
  personality: string;
  mood: number;
  intimacy: number;
  appearance: string;
  outfit: string;
  physicalCondition: string;
  lastStateUpdate: number;
  autoReply: AutoReplyConfig;
  createdAt: number;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  images?: string[];
  timestamp: number;
  status: "pending" | "sent" | "failed";
}
export interface Conversation {
  id: string;
  type: "private" | "group";
  name?: string;
  friendIds: string[];
  lastMessage?: string;
  lastMessageTime?: number;
  createdAt: number;
}
