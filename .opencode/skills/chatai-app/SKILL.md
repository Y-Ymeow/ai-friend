---
name: chatai-app-conventions
description: Development conventions and patterns for chatai-app project
---

# Project Knowledge

> Project knowledge index. Read this first to understand available domain knowledge, then read relevant module SKILLs as needed.

### ai-friend-chat
AI朋友聊天应用，使用Preact+Vite+sql.js。关键：自动回复需track lastAutoReplyTime防死循环；prompt用JSON messages格式；thinking模型只取content；好友数值每次回复后更新。修改AI逻辑、消息发送、好友交互时参考。
- **Location**: `modules/src.md`
