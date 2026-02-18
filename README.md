# AI 朋友 (AI Friends) - 你的数字灵魂伴侣

这是一个基于 Preact + Vite 构建的、具有**深度记忆**和**情感系统**的 AI 聊天应用。它不仅是一个聊天机器人，更是一个会成长、有性格、能感知时间的数字伙伴。

![PWA Ready](https://img.shields.io/badge/PWA-Ready-orange)
![AI Model](https://img.shields.io/badge/Model-GLM--4-blue)
![Database](https://img.shields.io/badge/Database-SQLite%20WASM-green)

## ✨ 功能亮点

- **🧠 结构化记忆系统**：支持“深度记忆”存储。AI 会永远记住你告诉它的重要点滴，并在对话中自然提及。
- **🎭 动态情感看板**：每个朋友都有实时波动的心情指数、羁绊等级（亲密度）。
- **👗 每日状态刷新**：AI 会根据时间自动更新打扮（穿搭）和身体状况（如：有点感冒、精力充沛），每天打开都有新鲜感。
- **⌛ 3秒静默发送机制**：独创的输入防抖逻辑。支持连续多条发送，系统会在你停止输入 3 秒后自动合并消息并请求 AI，模拟真实的构思过程。
- **🔔 主动关怀系统**：如果你长时间（默认10分钟）没理它，AI 会根据性格主动发消息找你（需开启通知权限）。
- **📱 PWA 原生体验**：支持安装到桌面或手机，具备离线访问能力和后台系统通知。
- **🔒 私密且安全**：所有对话和数据均存储在本地浏览器数据库（IndexedDB），不上传任何服务器。

## 🛠️ 技术栈

- **前端**: Preact (轻量级 React 替代方案)
- **状态管理**: Preact Signals
- **数据库**: `sql.js` (SQLite WASM) + IndexedDB 持久化
- **UI 组件**: Tailwind CSS
- **AI 接口**: 智谱 AI (GLM-4V/Flash 系列)
- **离线支持**: Service Worker (PWA)

## 🚀 快速开始

### 前置要求
- Node.js 18+
- [智谱 AI API Key](https://open.bigmodel.cn/) (在应用“设置”中配置)

### 安装步骤
1. 克隆仓库
   ```bash
   git clone https://github.com/your-username/ai-friends-app.git
   cd ai-friends-app
   ```
2. 安装依赖
   ```bash
   npm install
   ```
3. 启动开发服务器
   ```bash
   npm run dev
   ```
4. 打开浏览器访问 `http://localhost:5173`，在**设置**中填入你的 API Key。

## 📖 工程说明

关于项目的深度技术实现逻辑（如 3 秒延迟逻辑、数据库拼接规范等），请参阅根目录下的 `GEMINI.md` 开发文档。

## 📜 许可证

MIT License
