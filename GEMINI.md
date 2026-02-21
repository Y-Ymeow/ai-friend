# AI 朋友聊天程序 - 项目技术文档

## 核心架构
- **前端框架**: Preact + Vite
- **包管理器**: Bun (首选，执行速度更快)
- **状态管理**: `@preact/signals` (见 `src/store.ts`)
- **数据库**: `sql.js` (SQLite WASM) + IndexedDB 持久化 (见 `src/db/db.ts`)
- **UI 组件**: Tailwind CSS (通过 `src/ui/lib/utils.ts` 辅助)
- **Prompt 管理**: 独立的 `src/ai/prompts.ts` 模块

## 关键业务逻辑

### 1. 消息发送与 3 秒延迟机制 (Debounce Logic)
为了实现"多条发送"且不让 AI 频繁打断，采用了以下逻辑：
- **`notifyTyping()`**: 用户在 `textarea` 输入时触发。它会 **彻底清除** 当前的 3 秒计时器，防止 AI 在用户还在输入时就回复。
- **`sendUserMessage()`**: 用户点击发送后，消息立即入库并显示在 UI 上。
- **`startTimer()`**: 在发送消息后启动。如果在 3 秒内没有新的输入或发送动作，则将积压的消息（`pendingContent`）合并发送给 AI。
- **AI 实时反馈**: `generateReplies` 带有 `onReply` 回调，每当一个 AI 朋友回复完成，UI 会立即刷新，无需等待所有朋友回复完。

### 2. 自动回复机制 (Auto Reply)
- **定时轮询**: 每 60 秒检查是否有需要回复的会话
- **触发条件**: 最后一条消息来自用户，且距离上次消息超过 `idleMinutes`（可在好友详情页配置：5 分钟/10 分钟/30 分钟/1 小时/2 小时/5 小时）
- **防重复触发**: 使用 `lastAutoReplyTime` Map 记录每个好友的最后回复时间
- **Prompt 配置**: 使用设置页配置的 `autoReplyPrefix` 和 `autoReplySuffix` 包裹提示词

### 3. 数据库查询规范
- **重要**: 由于 `sql.js` 环境下的某些限制，执行查询时应优先使用 **字符串拼接**（需进行简单的 `'` 转义），避免使用 `?` 占位符绑定参数，以确保查询结果的稳定性。

### 4. AI 消息格式 (JSON Messages)
- **格式**: 使用标准 OpenAI 兼容的 messages 数组格式
- **结构**: 
  ```javascript
  [
    { role: "user", content: "[用户昵称]: 内容" },
    { role: "assistant", name: "好友名", content: "内容" },
    { role: "assistant", name: "其他角色", content: "[其他角色]: 内容" }
  ]
  ```
- **优点**: 支持群聊、节省 token、避免 AI 模仿对话格式
- **重复检测**: `buildMessages` 函数会检查最后 3 条用户消息，避免重复添加

### 5. AI 提示词 (System Prompt) & Token 控制

#### Prompt 结构 (`src/ai/prompts.ts`)
```javascript
{
  systemPrefix: "【角色扮演】\n你正在与对方进行沉浸式角色扮演对话。...",
  systemSuffix: "\n【对话方式】\n- 简短、随性，像真人发微信\n- 每次回复一两句即可...",
  autoReplyPrefix: "(",
  autoReplySuffix: ")"
}
```

#### 动态生成的角色信息
```
【角色信息】
名字：赵敏
时间：2025 年 01 月 15 日 星期三 14:30（下午，下午好）
性格：直率幽默
当前心情：特别好
身体状况：精力充沛
穿着：休闲装
外貌：喜欢扎马尾，身高 173...
与用户的关系：朋友

【基本数据】
性别：女性
身高：165cm
体重：50kg
年龄：20 岁
生日：2000-01-15

【记忆信息】
- [01 月 15 日] 对方喜欢喝奶茶
- [01 月 14 日] 对方对猫毛过敏
```

#### Token 控制策略
- **滑动窗口模式**: 限制历史记录约 10,000 字符
- **消息数量限制**: 最多 50 条消息（防止 AI 陷入循环）
- **时效性**: `buildSystemPrompt` 注入详细时间信息（年月日时分、星期、时段、问候语）
- **状态注入**: System Prompt 包含好友实时状态（心情、穿搭、身体状况）

### 6. 好友数值系统
- **亲密度 (Intimacy)**: 每次对话成功后 +1~3
- **心情 (Mood)**: 每次对话成功后 +1~5，每日随机波动 ±20
- **头像生成**: 使用 GLM Cogview-3-Flash，Prompt 包含角色的性别、身高、体重、年龄信息

### 7. 图片功能
- **图片预览**: 输入框下方显示已选图片预览
- **删除功能**: 每张图片可单独删除
- **显示开关**: 设置中可控制是否显示聊天中的图片
- **AI 主动发图**: 支持 `[GEN_IMAGE: 描述词]` 指令，AI 可主动分享图片

### 8. 429 错误重试机制
- **触发条件**: API 返回 429 状态码（请求过多）
- **重试策略**: 指数退避（Exponential Backoff）
  - 第 1 次重试：等待 1 秒
  - 第 2 次重试：等待 2 秒
  - 第 3 次重试：等待 4 秒
- **配置项**: `maxRetries`（默认 3 次，可在设置页配置 0-10 次）
- **实现**: `callAI` 函数递归调用，传递 `retryCount` 参数

### 9. 自定义模型系统

#### 自定义 Provider
```typescript
interface CustomProvider {
  id: string;        // 例如："openai-sb"
  name: string;      // 例如："OpenAI-SB"
  baseUrl: string;   // 例如："https://api.openai-sb.com/v1/chat/completions"
  apiKey: string;    // 例如："sb-xxx"
  models: CustomModel[];
  chatModel?: string;
}
```

#### 自定义模型
```typescript
interface CustomModel {
  id: string;           // 例如："gpt-4"
  name: string;         // 例如："GPT-4"
  supportsVision: boolean;
}
```

#### 默认 Provider 的自定义模型
- 每个官方 Provider（智谱/Google/Groq/火山/魔搭）都支持添加自定义模型
- 自定义模型共享 Provider 的 API Key 和 Base URL
- 只需填写：模型 ID、名称、是否支持视觉

### 10. Google Gemma 适配
- **问题**: Gemma 模型不支持 `role: "system"`
- **解决方案**: 检测到 Gemma 模型时，使用 `role: "user"` 代替，并添加前缀 `System instruction:`
- **代码位置**: `src/ai/client.ts` 的 `callAI` 函数

## 开发规范
- 修改 `store.ts` 后，确保相关状态（Signals）在 `App.tsx` 或组件中正确透传
- 所有的 AI 相关操作必须在 `isGenerating` 和 `generatingFriendIds` 状态下体现
- Thinking 模型返回的 `reasoning_content` 会被过滤，只显示最终 `content`
- Prompt 修改后需要同时更新 `src/ai/prompts.ts` 的默认值

## 文件结构说明
```
src/
├── ai/
│   ├── client.ts       # AI 调用核心逻辑（callAI、generateReplies 等）
│   └── prompts.ts      # Prompt 配置管理（新增）
├── db/
│   └── db.ts           # 数据库操作（IndexedDB + sql.js）
├── ui/
│   ├── components/
│   │   ├── chat-area.tsx      # 聊天区域（消息列表、操作按钮）
│   │   └── sidebar.tsx        # 侧边栏（会话列表）
│   └── pages/
│       ├── settings.tsx       # 设置页（Tab 导航：基础/模型/Prompts/数据）
│       └── friend-detail.tsx  # 好友详情页（基本数据、自动回复）
├── store.ts          # 状态管理和业务逻辑
└── types.ts          # TypeScript 类型定义
```

## 常见问题

### Q: AI 陷入自说自话循环？
A: 已优化：
1. 减少消息数量到 50 条
2. 简化 Prompt，减少冗余说明
3. 添加"每次回复一两句即可"指令

### Q: 同一条消息显示两次？
A: 已修复：`buildMessages` 函数检查最后 3 条用户消息，避免重复添加

### Q: 429 错误频繁出现？
A: 在设置页增加最大重试次数（建议 3-5 次），使用指数退避策略自动重试

### Q: Gemma 模型不回复？
A: 已自动适配：检测到 Gemma 模型时使用 `role: "user"` 代替 `role: "system"`
