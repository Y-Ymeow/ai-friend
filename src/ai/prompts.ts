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
- 自然地表达情感和想法
- 不要使用"AI"、"助手"、"模型"等词汇
- 不要说"作为 xxx"这类话

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

// 获取时段描述
function getTimeOfDay(hour: number): string {
  if (hour < 6) return "深夜"
  if (hour < 9) return "早晨"
  if (hour < 12) return "上午"
  if (hour < 14) return "中午"
  if (hour < 18) return "下午"
  if (hour < 22) return "晚上"
  return "深夜"
}

// 获取问候语
function getGreeting(hour: number): string {
  if (hour < 6) return "这么晚了还没睡呀"
  if (hour < 9) return "早上好呀"
  if (hour < 12) return "上午好"
  if (hour < 14) return "中午好"
  if (hour < 18) return "下午好"
  if (hour < 22) return "晚上好"
  return "这么晚了，早点休息吧"
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
    gender?: string
    height?: number
    weight?: number
    age?: number
    birthday?: string
  },
  userName: string = "用户",
  config: PromptConfig = DEFAULT_PROMPTS
): string {
  const now = new Date()
  
  // 详细时间信息
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()]
  const timeOfDay = getTimeOfDay(now.getHours())
  const greeting = getGreeting(now.getHours())
  
  // 格式化时间字符串
  const dateTime = `${year}年${month}月${day}日 星期${weekday} ${hours}:${minutes}`
  
  // 心情描述
  const moodText = friend.mood > 80 ? "特别好" : friend.mood > 40 ? "还不错" : "一般"
  const relationText = friend.intimacy > 500 ? "亲密朋友" : "朋友"
  
  // 构建角色信息
  let roleInfo = `【角色信息】
名字：${friend.name}
时间：${dateTime}（${timeOfDay}，${greeting}）
性格：${friend.personality}
当前心情：${moodText}
身体状况：${friend.physicalCondition}
穿着：${friend.outfit}
外貌：${friend.appearance}
与${userName}的关系：${relationText}`

  // 添加基本数据
  const basicInfo: string[] = []
  if (friend.gender) {
    basicInfo.push(`性别：${friend.gender === "female" ? "女" : friend.gender === "male" ? "男" : "其他"}`)
  }
  if (friend.height) {
    basicInfo.push(`身高：${friend.height}cm`)
  }
  if (friend.weight) {
    basicInfo.push(`体重：${friend.weight}kg`)
  }
  if (friend.age) {
    basicInfo.push(`年龄：${friend.age}岁`)
  }
  if (friend.birthday) {
    basicInfo.push(`生日：${friend.birthday}`)
  }
  
  if (basicInfo.length > 0) {
    roleInfo += `\n\n【基本数据】\n${basicInfo.join("\n")}`
  }

  return `${config.systemPrefix}${roleInfo}

${config.systemSuffix}`
}

// 构建记忆信息字符串
export function buildMemoryInfo(memories: Array<{
  content: string
  timestamp: number
  type?: string
}>): string {
  if (memories.length === 0) return ""
  
  const memoryLines = memories.map(m => {
    const date = new Date(m.timestamp)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const time = `${month}月${day}日`
    return `- [${time}] ${m.content}`
  })
  
  return `\n【记忆信息】\n${memoryLines.join("\n")}`
}
