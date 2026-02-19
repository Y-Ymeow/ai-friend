---
name: ai-friend-chat
description: AI朋友聊天应用，使用Preact+Vite+sql.js。关键：自动回复需track lastAutoReplyTime防死循环；prompt用JSON messages格式；thinking模型只取content；好友数值每次回复后更新。修改AI逻辑、消息发送、好友交互时参考。
usage:
  created_at: 2026-02-19T05:09:27.898Z
  last_updated: 2026-02-19T05:39:59.352Z
  access_count: 2
  last_accessed: 2026-02-19T10:29:57.023Z
---

## 自动回复机制

必须使用 `lastAutoReplyTime` Map 防止死循环。触发条件：`lastMsg.senderId === 'user'` 且距离上次自动回复超过 idleMinutes。不要只检查消息时间，必须同时检查自动回复时间。

## Prompt格式

使用标准 JSON messages 格式：`[{role: 'user'|'assistant', name?: string, content: string}]`。用户消息 role='user'，AI回复 role='assistant' 并带 name 字段标识好友。Context 通过 `buildMessages()` 构建，限制 8000 字符。

## Thinking模型处理

GLM-4V-Flash 等免费模型会返回 `reasoning_content` 字段。只使用 `content` 字段作为最终回复，忽略 `reasoning_content`。若 content 为空则抛错重试。

## 好友数值更新

每次 AI 回复成功后调用 `updateFriendStats(friendId, intimacyGain, moodGain)`。intimacy +1~3（上限1000），mood +1~5（范围0-100）。

## 图片输入处理

输入框需显示已选图片预览，每张有删除按钮。发送后清空 images 数组。聊天消息图片显示受 `getShowImages()` 设置控制。

## 头像生成

使用 `generateAvatar(friend)` 调用 GLM Cogview-3-Flash 生成。返回 URL 存入 friend.avatar。各组件需读取 avatar 字段显示，fallback 为首字。

## Related files

- `src/ai/client.ts`
- `src/store.ts`
- `src/db/db.ts`
- `src/ui/components/chat-area.tsx`
- `src/ui/components/sidebar.tsx`
- `src/ui/pages/friend-detail.tsx`