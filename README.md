# AI 朋友 (AI Friends) - 你的数字灵魂伴侣

这是一个基于 Preact + Vite 构建的、具有**深度记忆**和**情感系统**的 AI 聊天应用。它不仅是一个聊天机器人，更是一个会成长、有性格、能感知时间的数字伙伴。

![PWA Ready](https://img.shields.io/badge/PWA-Ready-orange)
![AI Model](https://img.shields.io/badge/Model-Multi--Model-blue)
![Database](https://img.shields.io/badge/Database-SQLite%20WASM-green)

## ✨ 功能亮点

- **🧠 结构化记忆系统**：支持"深度记忆"存储。AI 会永远记住你告诉它的重要点滴，并在对话中自然提及。
- **🎭 动态情感看板**：每个朋友都有实时波动的心情指数、羁绊等级（亲密度），每次对话都会提升。
- **👗 每日状态刷新**：AI 会根据时间自动更新打扮（穿搭）和身体状况（如：有点感冒、精力充沛），每天打开都有新鲜感。
- **⌛ 3 秒静默发送机制**：独创的输入防抖逻辑。支持连续多条发送，系统会在你停止输入 3 秒后自动合并消息并请求 AI，模拟真实的构思过程。
- **🔔 主动关怀系统**：如果你长时间（默认 10 分钟）没理它，AI 会根据性格主动发消息找你（需开启通知权限）。
- **🖼️ 图片支持**：发送图片给 AI，支持预览和删除。可设置是否显示聊天中的图片。
- **🎨 AI 头像生成**：使用 GLM 生图模型为好友生成独特头像，支持清晰度和尺寸设置。
- **📱 PWA 原生体验**：支持安装到桌面或手机，具备离线访问能力和后台系统通知。
- **🔒 私密且安全**：所有对话和数据均存储在本地浏览器数据库（IndexedDB），不上传任何服务器。
- **🎭 沉浸式角色扮演**：AI 完全代入角色，使用 [我]: 格式对话，不再出戏说自己是 AI 助手。
- **👥 群聊支持**：多个 AI 朋友可在同一群聊中互动，每个角色有独立标识，AI 能看到完整对话上下文。
- **🌐 多模型支持**：支持智谱 AI、Google、Groq、火山引擎、魔搭、腾讯混元等多种 AI 模型。
- **⚙️ 自定义 Base URL**：支持配置代理地址或私有部署 endpoint，方便访问受限模型。
- **👤 用户昵称设置**：可自定义用户在聊天中的显示名称，让对话更加真实。

## 🛠️ 技术栈

- **前端**: Preact (轻量级 React 替代方案)
- **状态管理**: Preact Signals
- **数据库**: `sql.js` (SQLite WASM) + IndexedDB 持久化
- **UI 组件**: Tailwind CSS
- **AI 接口**: 支持多模型
  - 智谱 AI (GLM-4V/Flash 系列)
  - Google (Gemma/Gemini)
  - Groq (Llama)
  - 火山引擎 (豆包)
  - 魔搭 (通义千问)
  - 腾讯混元 (免费额度)
- **离线支持**: Service Worker (PWA)

## 🚀 快速开始

### 前置要求
- Node.js 18+
- AI API Key (在应用"设置"中配置，支持多家提供商)
  - [智谱 AI](https://open.bigmodel.cn/)
  - [Google AI](https://aistudio.google.com/)
  - [Groq](https://console.groq.com/)
  - [腾讯混元](https://cloud.tencent.com/product/hunyuan)

### 安装步骤
1. 克隆仓库
   ```bash
   git clone https://github.com/your-username/ai-friends-app.git
   cd ai-friends-app
   ```
2. 安装依赖
   ```bash
   bun install
   ```
3. 启动开发服务器
   ```bash
   bun run dev
   ```
4. 打开浏览器访问 `http://localhost:5173`，在**设置**中填入你的 API Key。

## 📖 工程说明

关于项目的深度技术实现逻辑（如 3 秒延迟逻辑、数据库拼接规范等），请参阅根目录下的 `GEMINI.md` 开发文档。

## 📝 更新日志

### 最新版本更新
- **角色扮演优化**：重构系统提示词，AI 完全代入角色，使用 [我]: 格式对话
- **群聊体验升级**：聊天记录添加角色标识，AI 能识别对话上下文和其他角色发言
- **用户昵称系统**：支持自定义用户在聊天中的显示名称
- **多模型扩展**：新增腾讯混元 Lite 模型（免费额度）、火山引擎、魔搭支持
- **配置增强**：开放 Base URL 和图像清晰度设置，支持代理和私有部署
- **上下文扩容**：聊天记录上下文限制提升至 2000 条

## 📜 许可证

MIT License
