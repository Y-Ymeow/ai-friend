# AI 朋友聊天程序 - 项目技术文档

## 核心架构
- **前端框架**: Preact + Vite
- **包管理器**: Bun (首选，执行速度更快)
- **状态管理**: `@preact/signals` (见 `src/store.ts`)
- **数据库**: `sql.js` (SQLite WASM) + IndexedDB 持久化 (见 `src/db/db.ts`)
- **UI 组件**: Tailwind CSS (通过 `src/ui/lib/utils.ts` 辅助)

## 关键业务逻辑

### 1. 消息发送与 3 秒延迟机制 (Debounce Logic)
为了实现“多条发送”且不让 AI 频繁打断，采用了以下逻辑：
- **`notifyTyping()`**: 用户在 `textarea` 输入时触发。它会 **彻底清除** 当前的 3 秒计时器，防止 AI 在用户还在输入时就回复。
- **`sendUserMessage()`**: 用户点击发送后，消息立即入库并显示在 UI 上。
- **`startTimer()`**: 在发送消息后启动。如果在 3 秒内没有新的输入或发送动作，则将积压的消息（`pendingContent`）合并发送给 AI。
- **AI 实时反馈**: `generateReplies` 带有 `onReply` 回调，每当一个 AI 朋友回复完成，UI 会立即刷新，无需等待所有朋友回复完。

### 2. 数据库查询规范
- **重要**: 由于 `sql.js` 环境下的某些限制，执行查询时应优先使用 **字符串拼接**（需进行简单的 `'` 转义），避免使用 `?` 占位符绑定参数，以确保查询结果的稳定性。

### 3. AI 提示词 (System Prompt) & Token 控制
- **Token 控制策略**: 为了节省成本和提高响应速度，系统采用“滑动窗口”模式。`buildContext` 限制历史记录总长度为 10,000 字符（约 5k-8k Tokens），优先保留最近的消息。
- **时效性**: `buildSystemPrompt` 会在 Prompt 中注入当前时间。
- **状态注入**: System Prompt 包含好友的实时状态（打扮、心情、体感）。

## 已知待优化点
- **默认选中会话**: 有用户反馈程序偶尔会默认选中第一个会话。经过排查，`currentConversationId` 初始为 `null`，且代码中无强制选中逻辑。需持续观察是否为 UI 点击区域误触或浏览器 Hash 导致。

## 开发规范
- 修改 `store.ts` 后，确保相关状态（Signals）在 `App.tsx` 或组件中正确透传。
- 所有的 AI 相关操作必须在 `isGenerating` 和 `generatingFriendIds` 状态下体现，以维持“正在输入中”的 UI 提示。
