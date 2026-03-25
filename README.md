# AI Agent Journey (ai-agent-journey)

欢迎来到 **AI Agent Journey**！本项目旨在记录和沉淀从零开始系统性学习、开发 AI Agent (智能体) 应用的全过程。

## 🎯 项目目标
通过一份详实且由浅入深的路线图，一步步拆解 AI Agent 的核心概念与实战落地。我们将包含：
- **基础对话**：LLM API 与流式输出调用
- **记忆外挂 (RAG)**：掌握文档切块与向量搜索
- **行动能力**：Function / Tool Calling 结构化输出
- **大脑编排 (LangGraph)**：复杂状态机与节点执行工作流
- **前沿拓展 (MCP)**：对接 Model Context Protocol 测试标准生态

## 📂 项目结构
本项目采用 Monorepo 风格管理：
- `code/`: Next.js Web 应用核心代码（基于 Vercel AI SDK 和 Tailwind CSS）。
- `docs/`: 学习笔记与任务追踪。
  - [`todo.md`](./docs/todo.md) —— 详细的 Agent 学习进度跟踪表（含路线总览、防枯燥指南、各阶段知识点与实战 TODO）。
  - [`todo.md`](./docs/todo.md) —— 按周拆解的详细学习与开发打卡追踪清单。
  - [`qa.md`](./docs/qa.md) —— 记录开发和学习过程中遇到的 Q&A。
  - `slides/` —— 各个阶段学习总结的精美 HTML 幻灯片。

## 🌟 当前进度

### Level 1: 基础对话与上下文管理
目前我们已经完成了 Level 1 的开发：

**Stage 1: 基础对话与角色扮演**
- 实现了与 Google Gemini 模型的基础流式对话。
- 搭建了现代化的极简 Web 界面，支持切换不同提示词的“Persona（角色）”（万能助手、代码极客、中英翻译官、傲娇猫娘等）。
- 支持在前端切换不同的模型，实现了灵活的模型配置机制。

**Stage 2: 记忆外挂 (RAG)**
- 实现了纯前端交互的本地知识库（文件上传）吸收。
- 通过 `@ai-sdk/openai` 兼容接入 **LM Studio** 等本地模型提供商，或者直接使用 Google `text-embedding-004` 进行文档分块向量化（Embedding）。
- 基于完全本地化的 `fs` 文件系统充当 JSON 向量库，规避了 Next.js API Routes 运行沙箱隔离导致的内存丢失问题。
- 用户提问时自动检索相似度 Top-10 的文本切片进行增强生成（RAG），使模型能基于上传的资料进行精准回答。

## 🚀 快速启动

进入项目代码目录并安装依赖：

```bash
cd code
npm install
```

配置环境变量：
复制 `.env.example` 到 `.env.local`，并填入你的配置信息：
```env
# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
GOOGLE_GENERATIVE_AI_MODEL=gemini-2.5-flash

# (可选) 本地 Embedding 模型提供商，如 LM Studio
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_EMBEDDING_MODEL=nomic-embed-text-v1.5
```

运行开发服务器：

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可开始体验！
