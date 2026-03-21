# AI Agent 学习进度跟踪表 (前端开发者专属)

这份清单将你的学习路线拆解成了可执行的 `TODO` 项，方便你打卡和追踪进度。每次完成一项，即可在对应的框内打 `x`。

## 第一阶段：从“聊天框”开始 (第 1-2 周)
**目标：** 理解 LLM 调用、流式输出与 Prompt 基础。

- [x] **项目前置准备**
  - [x] 准备 Node.js 环境与包管理器 (pnpm/npm)
  - [x] 申请并配置好 OpenAI、Gemini 或 DeepSeek 等模型的 API Key 以及网络环境
- [x] **知识点突破**
  - [x] 阅读 [Vercel AI SDK 官方文档](https://sdk.vercel.ai/docs) (重点看核心概念与 UI Hooks)
  - [ ] 观看吴恩达的《Prompt Engineering for Developers》短时间精通提示词技巧
- [ ] **可视化与记录**
  - [x] 制作 Level 1 精美幻灯片 (`docs/slides/level1.html`)
  - [ ] 在 `docs/qa.md` 中记录学习过程中的第一批问题
- [x] **代码实战：Level 1 - 基础对话**
  - [x] 初始化 Next.js 项目并安装 `ai` (Vercel AI SDK) 相关依赖
  - [x] 创建后端 API Route (`app/api/chat/route.ts`), 调用模型并流式返回响应 (`streamText`)
  - [x] 前端页面使用 `useChat` hook 实现一个具有“打字机效果”的聊天界面
- [x] **代码实战：Level 2 - 上下文与人设**
  - [x] 完善前后端逻辑，把包含角色和历史消息的对话数组持续传给大模型后端
  - [x] 编写精确的 `System Prompt`，设定助手（如“代码极客”）的人设和边界

---

## 第二阶段：给 AI 装上“外挂硬盘” (第 3-4 周)
**目标：** 掌握 RAG (检索增强生成) 和向量数据库基础。

- [ ] **可视化与记录**
  - [ ] 制作 Level 2 精美幻灯片 (`docs/slides/level2.html`)
  - [ ] 在 `docs/qa.md` 中记录 RAG 相关的疑问
- [ ] **知识点突破**
  - [ ] 理解核心概念：Embedding (向量化), Chunking (文本切块)
  - [ ] 阅读 LangChain.js 官方文档中的 "Retrieval" (检索) 章节
  - [ ] 粗览一份云端向量数据库的快速入门文档 (推荐 Pinecone 或 Supabase pgvector)
- [ ] **代码实战：代码库问答助手**
  - [ ] 注册免费的云端向量数据库实例获取连接凭证
  - [ ] 编写脚本：提取一份本地 Markdown 文档或 PDF 的纯文本内容
  - [ ] **[核心]** 对文本进行合理断句切块 (Split)，调用 Embedding 模型将其转化为向量并存入数据库
  - [ ] **[核心]** 实现检索：当用户提问时，将问题向量化去数据库里查询相似度最高的 Top K 文本片段
  - [ ] 将查到的片段拼接到上下文中交由 AI 进行最后回答

---

## 第三阶段：给 AI 装上“手” (第 5-6 周)
**目标：** 掌握 Function Calling 与 结构化输出 (Structured Outputs)。

- [ ] **可视化与记录**
  - [ ] 制作 Level 3 精美幻灯片 (`docs/slides/level3.html`)
  - [ ] 在 `docs/qa.md` 中记录工具调用相关的思考
- [ ] **知识点突破**
  - [ ] 阅读并理解模型官方文档关于 Function Calling / Tool Calling 的运转逻辑
  - [ ] 学习使用 **Zod** 定义强类型 Schema（大模型生成稳定输出的前端利器）
- [ ] **代码实战：智能 TodoList**
  - [ ] 用纯 TS 编写两个本地函数：`createTodo` (存入本地数组 or localStorage) 和 `getWeather`
  - [ ] 利用 Zod 严格定义这两个工具函数的输入参数与结构的 JSON Schema
  - [ ] 在调用大模型时，通过 `tools` 参数把你的 Schema 提供给它
  - [ ] 解析模型基于对话内容生成的函数调用意图 (Tool Call)，在本地真正执行对应代码
  - [ ] 将函数执行结果回传给模型，总结成自然语言回复给用户

---

## 第四阶段：进阶“大脑编排” (第 7-8 周)
**目标：** 掌握状态机与 Agent 编排闭环工作流。

- [ ] **可视化与记录**
  - [ ] 制作 Level 4 精美幻灯片 (`docs/slides/level4.html`)
  - [ ] 在 `docs/qa.md` 中记录复杂 Agent 架构的疑问
- [ ] **知识点突破**
  - [ ] 了解经典 Agent 工作模式：如 ReAct (Reason + Act) 模式，思考过程与执行交替
  - [ ] 预研并阅读 **LangGraph.js** 官方教程的基础 State Graph 概念，理解图结构
- [ ] **代码实战：自主技术博文调研员**
  - [ ] 规划工作流并定义好状态机数据结构 (`StateState`)
  - [ ] 编写各个功能节点 (Nodes)：如搜索资料节点、提取摘要节点、写初稿节点
  - [ ] 设置核心的**条件判断连线** (Conditional Edges)：如果“摘要发现信息不足”则重新路由回搜索节点
  - [ ] 跑通完整的 LangGraph 闭环工作流，给出万字长文级别的最终输出

---

## 前沿拓展阶段：标准工具箱 (MCP)
**目标：** 开拓眼界，接入生态通用协议。

- [ ] **实践项目**
  - [ ] 了解 Anthropic 牵头推出的 **Model Context Protocol (MCP)** 标准化协议
  - [ ] 在本地尝试跑起一个开源现成的文件系统 MCP Server
  - [ ] 摸索如何在主流客户端或自己的代码中直接对接这个 Server，免手写工具代码直接读取你的本地代码仓库
