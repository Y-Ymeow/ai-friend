---
name: ai-friends-chat
description: AI朋友聊天应用核心架构。3秒延迟机制、自动回复服务、JSON消息格式、thinking模型处理。修改AI相关、消息发送、自动回复逻辑时使用。
usage:
  created_at: 2026-02-19T05:09:27.898Z
  last_updated: 2026-02-19T11:20:36.487Z
---

## 消息发送与3秒延迟机制

- `notifyTyping()`: 用户输入时触发，清除计时器防止AI过早回复
- `sendUserMessage()`: 消息立即入库并显示UI
- `startTimer()`: 发送后启动，3秒内无新动作则合并pendingContent发给AI
- `generateReplies`: 带onReply回调，每个好友回复完立即刷新UI

## 自动回复服务

- 定时轮询: 每60秒检查
- 触发条件: 最后消息来自用户 + 超过idleMinutes
- 防重复: lastAutoReplyTime Map
- **重要**: 必须从数据库直接读取，不能依赖signals（signal值可能未更新）
- 服务启动时立即检查一次

## 数据库查询规范

- sql.js环境下优先用字符串拼接（需转义`'`）
- 避免用`?`占位符，可能导致结果不稳定

## AI消息格式(JSON Messages)

- 使用OpenAI兼容格式: `{"role": "user/assistant", "name": "好友名", "content": "..."}`
- 优点: 支持群聊、省token、避免AI模仿对话格式
- System Prompt禁止`【xxx回复】`格式

## Thinking模型处理

- 请求body添加 `thinking: { type: "disabled" }` 禁用
- 返回时过滤 `reasoning_content`，只取 `content`
- 若只有reasoning_content无content则抛错重试

## 图片功能

- 输入框下方预览已选图片，每张可删除
- 设置中可控制聊天是否显示图片
- 无视觉能力的模型自动跳过图片（检查supportsVision）

## 好友数值系统

- intimacy: 每次对话成功 +1~3
- mood: 每次对话成功 +1~5
- 头像生成: GLM Cogview-3-Flash

## Related files

- `src/ai/client.ts`
- `src/db/db.ts`
- `src/ui/components/chat-area.tsx`
- `src/store.ts`
- `src/types.ts`
