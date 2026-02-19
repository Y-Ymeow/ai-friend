# AI 朋友聊天程序 - 项目技术文档

## 核心架构
- **前端框架**: Preact + Vite
- **包管理器**: Bun (首选，执行速度更快)
- **状态管理**: `@preact/signals` (见 `src/store.ts`)
- **数据库**: `sql.js` (SQLite WASM) + IndexedDB 持久化 (见 `src/db/db.ts`)
- **UI 组件**: Tailwind CSS (通过 `src/ui/lib/utils.ts` 辅助)

## 关键业务逻辑

### 1. 消息发送与 3 秒延迟机制 (Debounce Logic)
为了实现"多条发送"且不让 AI 频繁打断，采用了以下逻辑：
- **`notifyTyping()`**: 用户在 `textarea` 输入时触发。它会 **彻底清除** 当前的 3 秒计时器，防止 AI 在用户还在输入时就回复。
- **`sendUserMessage()`**: 用户点击发送后，消息立即入库并显示在 UI 上。
- **`startTimer()`**: 在发送消息后启动。如果在 3 秒内没有新的输入或发送动作，则将积压的消息（`pendingContent`）合并发送给 AI。
- **AI 实时反馈**: `generateReplies` 带有 `onReply` 回调，每当一个 AI 朋友回复完成，UI 会立即刷新，无需等待所有朋友回复完。

### 2. 自动回复机制 (Auto Reply)
- **定时轮询**: 每 60 秒检查是否有需要回复的会话
- **触发条件**: 最后一条消息来自用户，且距离上次消息超过 `idleMinutes`（默认 10 分钟）
- **防重复触发**: 使用 `lastAutoReplyTime` Map 记录每个好友的最后回复时间

### 3. 数据库查询规范
- **重要**: 由于 `sql.js` 环境下的某些限制，执行查询时应优先使用 **字符串拼接**（需进行简单的 `'` 转义），避免使用 `?` 占位符绑定参数，以确保查询结果的稳定性。

### 4. AI 消息格式 (JSON Messages)
- **格式**: 使用标准 OpenAI 兼容的 messages 数组格式
- **结构**: `[{"role": "user", "content": "..."}, {"role": "assistant", "name": "好友名", "content": "..."}]`
- **优点**: 支持群聊、节省 token、避免 AI 模仿对话格式

### 5. AI 提示词 (System Prompt) & Token 控制
- **Token 控制策略**: 滑动窗口模式，限制历史记录约 10,000 字符
- **时效性**: `buildSystemPrompt` 注入当前时间
- **状态注入**: System Prompt 包含好友实时状态
- **防对话延续**: 明确禁止 AI 使用 `【xxx回复】` 格式

### 6. 好友数值系统
- **亲密度 (Intimacy)**: 每次对话成功后 +1~3
- **心情 (Mood)**: 每次对话成功后 +1~5，每日随机波动 ±20
- **头像生成**: 使用 GLM Cogview-3-Flash 生成好友头像

### 7. 图片功能
- **图片预览**: 输入框下方显示已选图片预览
- **删除功能**: 每张图片可单独删除
- **显示开关**: 设置中可控制是否显示聊天中的图片

## 开发规范
- 修改 `store.ts` 后，确保相关状态（Signals）在 `App.tsx` 或组件中正确透传
- 所有的 AI 相关操作必须在 `isGenerating` 和 `generatingFriendIds` 状态下体现
- Thinking 模型返回的 `reasoning_content` 会被过滤，只显示最终 `content`
