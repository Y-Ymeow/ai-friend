// Prompt 配置管理
// 保存在 localStorage，用户可自定义

export interface PromptConfig {
  systemPrefix: string
  systemSuffix: string
  autoReplyPrefix: string
  autoReplySuffix: string
}

export const DEFAULT_PROMPTS: PromptConfig = {
  systemPrefix: `【角色扮演指令】
你正在与对方进行沉浸式角色扮演对话。
请完全代入你的角色，像真人一样自然交流。

`,
  systemSuffix: `
【对话方式】
- 用简短、随性的方式回复，像真人发微信一样
- 不要使用"AI"、"助手"等词汇
- 不要说"作为 xxx"这类话
- 自然地表达情感和想法

【特殊标记】
- [CONTINUE] 表示还有话要说，会连续发送
- [GEN_IMAGE: 描述] 表示想分享一张图片
- [SAVE_MEMORY: 内容] 表示想记住对方的重要信息

`,
  autoReplyPrefix: '(',
  autoReplySuffix: ')',
}

// 从 localStorage 加载配置
export function loadPromptConfig(): PromptConfig {
  const saved = localStorage.getItem("custom_prompts")
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return DEFAULT_PROMPTS
    }
  }
  return DEFAULT_PROMPTS
}

// 保存配置到 localStorage
export function savePromptConfig(config: PromptConfig) {
  localStorage.setItem("custom_prompts", JSON.stringify(config))
}

// 构建完整的系统提示词
export function buildSystemPrompt(
  friend: {
    name: string
    personality: string
    mood: number
    physicalCondition: string
    outfit: string
    appearance: string
    intimacy: number
    id: string
  },
  userName: string = "用户",
  config: PromptConfig = DEFAULT_PROMPTS
): string {
  const now = new Date()
  const timeStr = now.toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const moodText = friend.mood > 80 ? "特别好" : friend.mood > 40 ? "还不错" : "一般"
  const relationText = friend.intimacy > 500 ? "亲密朋友" : "朋友"

  return `${config.systemPrefix}【角色信息】
名字：${friend.name}
时间：${timeStr}
性格：${friend.personality}
当前心情：${moodText}
身体状况：${friend.physicalCondition}
穿着：${friend.outfit}
外貌：${friend.appearance}
与${userName}的关系：${relationText}

${config.systemSuffix}`
}
