# AI Agent 学习进度跟踪表 (前端开发者专属)

针对前端（TS/JS）背景，这是一条"从零到一"的 Agent 学习路线。以"项目迭代"为主线，"查阅文档"为辅助，从聊天框到全链路 Agent，逐步掌握 RAG、Function Calling、LangChain、LangGraph、MCP 等核心能力。

**路线速览：** 聊天框 (1-2周) → RAG 外挂硬盘 (3-4周) → Function Calling (5-6周) → LangChain 重构 (7周) → 整合实战 (8周) → LangGraph 编排 (9-10周) → MCP 协议 (11周) → 终局项目 (12-13周)

---

### 学习方法建议（防枯燥指南）

1. **"不要"从头读 LangChain 文档：** LangChain 的文档像迷宫。正确的做法是：**先想好项目功能 -> 遇到实现瓶颈 -> 去搜"LangChain.js how to use tool calling" -> 只看那一部分代码。**

2. **利用"工具人"优势：** 你是前端，在学 AI 逻辑时，**UI 尽量写简单点（甚至用现成的模版）**，把精力全放在后端的 `Node.js` 逻辑层。

3. **书怎么看？**
    * 不要买那种《AI 从入门到精通》的大厚书，过时极快。
    * **推荐看：** 《Generative AI with LangChain》（有电子版就搜电子版，把它当成字典，用到哪查到哪）。

4. **每天必刷：**
    在 Twitter/X 上关注几个 TS 领域的 AI 大佬（比如 Vercel 的开发者关系、LangChain 的创始人）。他们经常发一段十几行的代码 Demo，那比看书有用得多。

---

这份清单将你的学习路线拆解成了可执行的 `TODO` 项，方便你打卡和追踪进度。每次完成一项，即可在对应的框内打 `x`。

## 第一阶段：从"聊天框"开始 (第 1-2 周)

**目标：** 理解 LLM 调用、流式输出与 Prompt 基础。

- [x] **项目前置准备**
  - [x] 准备 Node.js 环境与包管理器 (pnpm/npm)
  - [x] 申请并配置好 OpenAI、Gemini 或 DeepSeek 等模型的 API Key 以及网络环境
- [ ] **知识点突破**
  - [x] 阅读 [Vercel AI SDK 官方文档](https://sdk.vercel.ai/docs) (重点看核心概念与 UI Hooks)
  - [ ] 观看吴恩达的《Prompt Engineering for Developers》 ([DeepLearning.AI 免费课程](https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/))
- [x] **可视化与记录**
  - [x] 制作 Level 1 精美幻灯片 (`docs/slides/level1.html`)
  - [x] 在 `docs/qa.md` 中记录学习过程中的第一批问题
- [x] **代码实战：Level 1 - 基础对话**
  - [x] 初始化 Next.js 项目并安装 `ai` (Vercel AI SDK) 相关依赖
  - [x] 创建后端 API Route (`app/api/chat/route.ts`), 调用模型并流式返回响应 (`streamText`)
  - [x] 前端页面使用 `useChat` hook 实现一个具有"打字机效果"的聊天界面
- [x] **代码实战：Level 2 - 上下文与人设**
  - [x] 完善前后端逻辑，把包含角色和历史消息的对话数组持续传给大模型后端
  - [x] 编写精确的 `System Prompt`，设定助手（如"代码极客"）的人设和边界

---

## 第二阶段：给 AI 装上"外挂硬盘" (第 3-4 周)

**目标：** 掌握 RAG (检索增强生成) 和向量数据库基础。

- [x] **可视化与记录**
  - [x] 制作 Level 2 精美幻灯片 (`docs/slides/level2.html`)
  - [x] 在 `docs/qa.md` 中记录 RAG 相关的疑问
- [ ] **知识点突破**
  - [x] 理解核心概念：Embedding (向量化), Chunking (文本切块) 以及 Cosine Similarity (余弦相似度)（参考 [OpenAI Embeddings 指南](https://platform.openai.com/docs/guides/embeddings)）
  - [x] 对比本地内存向量检索与云端向量数据库架构的差异
  - [ ] 粗览一份云端向量数据库的快速入门文档（推荐 [Pinecone Quickstart](https://docs.pinecone.io/guides/get-started/quickstart) 或 [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)）
- [x] **代码实战（步骤一）：全栈内存 RAG 知识库**
  - [x] 核心数据结构：编写 `src/lib/vectorStore.ts` 实现全局单例的内存向量检索器（余弦相似度算法）
  - [x] 知识库上传模块 (UI & API)：在 `page.tsx` 增加可视化上传按钮，编写 `api/ingest/route.ts` 处理文件并调用 LangChain 切块与 Embedding
  - [x] 检索增强核心逻辑 (Retrieval & Synthesis)：改造 `api/chat/route.ts`，拦截提问进行 KNN 搜索并无缝组装至 System Prompt 中
  - [x] 万物联动验证：上传冷门测试文档并提问，验证 RAG 系统的实际信息召回率和幻觉抑制能力
---

## 第三阶段：给 AI 装上"手" (第 5-6 周)

**目标：** 掌握 Function Calling、结构化输出 (Structured Outputs) 与多工具协同。

- [x] **可视化与记录**
  - [x] 制作 Level 3 精美幻灯片 (`docs/slides/level3.html`)
  - [ ] 在 `docs/qa.md` 中记录工具调用相关的思考
- [ ] **知识点突破**
  - [x] 阅读并理解模型官方文档关于 Function Calling / Tool Calling 的运转逻辑（参考 [OpenAI Function Calling 指南](https://platform.openai.com/docs/guides/function-calling)）
  - [x] 学习使用 **Zod** 定义强类型 Schema（大模型生成稳定输出的前端利器）（参考 [Zod 官方文档](https://zod.dev/)）
  - [ ] 了解 Streaming + Tool Call 的前端 UX 处理方式（工具执行中 Loading 状态、中间步骤可视化）（参考 [Vercel AI SDK Tool Calling 文档](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)）
  - [ ] 思考工具调用的错误处理与降级策略（调用失败、超时、模型拒绝执行时怎么办）（参考 [Vercel AI SDK Tool Calling 文档](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) 中错误处理部分）
- [x] **代码实战：智能 TodoList（单工具调用）**
  - [x] 用纯 TS 编写两个本地函数：`createTodo` (存入本地数组 or localStorage) 和 `getWeather`
  - [x] 利用 Zod 严格定义这两个工具函数的输入参数与结构的 JSON Schema
  - [x] 在调用大模型时，通过 `tools` 参数把你的 Schema 提供给它
  - [x] 解析模型基于对话内容生成的函数调用意图 (Tool Call)，在本地真正执行对应代码
  - [x] 将函数执行结果回传给模型，总结成自然语言回复给用户
- [ ] **代码实战：多工具链与容错**
  - [ ] 改造现有代码，让 AI 在一次对话中连续调用多个工具（如"创建待办并查天气"组合指令）
  - [ ] 为工具函数添加错误处理逻辑（try-catch 包裹、超时控制、失败时返回友好信息给模型）
  - [ ] 在前端展示工具执行的中间状态（如"正在创建待办..."、"正在查询天气..."的步骤指示器）

---

## 第四阶段：LangChain 重构——换一种方式说同一件事 (第 7 周)

**目标：** 将 Phase 1-3 基于 Vercel AI SDK 构建的后端逻辑用 LangChain.js 重写，通过"同一功能两种实现"深入理解框架抽象的设计哲学。

- [ ] **可视化与记录**
  - [ ] 在 `docs/qa.md` 中记录重构过程中的对比思考（Vercel AI SDK vs LangChain 各自的优劣势与适用场景）
- [ ] **知识点突破**
  - [ ] 了解 LangChain.js 核心抽象概览：Document Loader、Text Splitter、Embedding、Vector Store 各自的职责与边界（参考 [LangChain.js Overview](https://docs.langchain.com/oss/javascript/langchain/overview)）
  - [x] 精读 LangChain.js 的 **Text Splitters** 模块（理解 chunkSize / chunkOverlap 参数的影响）（参考 [LangChain.js Overview](https://docs.langchain.com/oss/javascript/langchain/overview)）
  - [x] 理解 LangChain Retrieval Pipeline 的标准组件与数据流（已阅读官方文档 "Retrieval" 章节）（参考 [LangChain.js Overview](https://docs.langchain.com/oss/javascript/langchain/overview)）
  - [x] 对比 LangChain Vector Store 抽象与自实现的差异（何时用封装、何时手写更灵活）（参考 [LangChain.js Vector Store 集成列表](https://docs.langchain.com/oss/javascript/integrations/vectorstores)）
  - [ ] 了解 LangChain.js 的 **Dynamic Tool / StructuredTool** 封装模式，对比手写 Tool Definition 的优劣（参考 [LangChain.js Agents 文档](https://docs.langchain.com/oss/javascript/langchain/agents)）
  - [ ] 梳理两套框架的核心映射关系：`streamText` ↔ `.stream()`、`tool()` ↔ `DynamicTool`、`useChat` ↔ LangChain streaming response（参考 [Vercel AI SDK 文档](https://sdk.vercel.ai/docs) + [LangChain.js Overview](https://docs.langchain.com/oss/javascript/langchain/overview)）
  - [ ] 了解 LangChain 的模型抽象层（`ChatOpenAI`、`ChatGoogleGenerativeAI`），理解如何通过统一接口切换底层模型（参考 [LangChain.js Chat Model 集成列表](https://docs.langchain.com/oss/javascript/integrations/chat)）
  - [ ] 了解 LangChain 的 **Retrieval Chain** 封装（`createRetrievalChain` / `RunnablePassthrough`），对比手动拼接 System Prompt 的方式（参考 [LangChain.js Overview](https://docs.langchain.com/oss/javascript/langchain/overview)）
  - [ ] 了解 LangChain **Agent Executor** 的工具调度机制，对比 Vercel AI SDK 的 `maxSteps` 自动循环（参考 [LangChain.js Agents 文档](https://docs.langchain.com/oss/javascript/langchain/agents)）
- [ ] **代码实战：对话层重构**
  - [ ] 用 LangChain Chat Model 替换 Vercel AI SDK 的 `streamText`，实现等价的流式对话输出
  - [ ] 适配前端 `useChat` hook（保持前端不变，仅改造后端 API 的响应格式使其兼容）
  - [ ] 验证上下文管理与 System Prompt 在 LangChain 下的等价实现（`SystemMessage`、`HumanMessage`、`AIMessage`）
- [ ] **代码实战：RAG 层重构（含云端迁移）**
  - [ ] 用 LangChain `Embeddings` 接口替换自写的 `embeddings.ts`（统一向量生成逻辑）
  - [ ] 用 LangChain `MemoryVectorStore`（或 `FAISS`）替换自写的 `vectorStore.ts`，先在本地跑通
  - [ ] 注册免费的云端向量数据库实例并获取连接凭证（推荐 Pinecone）
  - [ ] 将 LangChain Vector Store 从本地内存切换为云端 Pinecone，实现数据持久化（不再随服务重启丢失）
  - [ ] 用 LangChain Retrieval Chain 替换手动 KNN 搜索 + System Prompt 拼接逻辑
  - [ ] 验证重构后 RAG 的召回效果与原版一致，并确认服务重启后数据不丢失
- [ ] **代码实战：工具层重构**
  - [ ] 用 LangChain `DynamicTool` / `StructuredTool` 封装 `createTodo` 和 `getWeather`
  - [ ] 用 LangChain Agent（`.bindTools()` + Agent Executor）替换 Vercel AI SDK 的 `tools` 参数 + 手动解析 Tool Call
  - [ ] 验证多工具连续调用在 LangChain 下的行为一致性
- [ ] **重构总结**
  - [ ] 梳理两套框架在"开发体验"、"类型安全"、"生态丰富度"三个维度的对比结论

---

## 第五阶段：整合实战——RAG + 工具调用联动 (第 8 周)

**目标：** 将前四个阶段的能力串联，在 LangChain 基础上打造一个既能检索知识、又能执行任务的复合型助手。

- [ ] **可视化与记录**
  - [ ] 制作阶段整合幻灯片，梳理前四个阶段的知识脉络图
  - [ ] 在 `docs/qa.md` 中记录整合过程中遇到的跨阶段问题
- [ ] **知识点突破**
  - [ ] 理解 RAG 检索结果如何作为工具调用的上下文输入
  - [ ] 思考"先检索再行动" vs "先行动再检索"两种策略的适用场景
- [ ] **代码实战：复合型知识助手**
  - [ ] 构建一个同时挂载 RAG 检索和 Function Calling 工具的聊天系统
  - [ ] 实现场景：用户上传技术文档后，不仅能问答检索，还能让 AI 基于文档内容执行操作（如提取关键概念并创建学习待办）
  - [ ] 验证 RAG 检索与工具调用在同一轮对话中的协作能力

---

## 第六阶段：进阶"大脑编排" (第 9-10 周)

**目标：** 掌握状态机与 Agent 编排闭环工作流。

- [ ] **可视化与记录**
  - [ ] 制作 Level 4 精美幻灯片 (`docs/slides/level4.html`)
  - [ ] 在 `docs/qa.md` 中记录复杂 Agent 架构的疑问
- [ ] **知识点突破**
  - [ ] 了解经典 Agent 工作模式：如 ReAct (Reason + Act) 模式，思考过程与执行交替（参考 [ReAct 原始论文](https://arxiv.org/abs/2210.03629)）
  - [ ] 了解 **LCEL** (LangChain Expression Language) 的核心思想——Runnable 链式组合，理解 `pipe()` 与 `RunnableSequence` 如何将 LLM、Retriever、Parser 串联（参考 [LangChain.js Concepts](https://docs.langchain.com/oss/javascript/concepts)）
  - [ ] 预研并阅读 **LangGraph.js** 官方教程的基础 State Graph 概念，理解图结构（State、Node、Edge）（参考 [LangGraph.js Quickstart](https://docs.langchain.com/oss/javascript/langgraph/quickstart)）
  - [ ] 了解 LangChain **Callbacks / Tracing** 机制，理解如何在链式调用中插入日志、计时和自定义钩子（参考 [LangChain.js Concepts](https://docs.langchain.com/oss/javascript/concepts)）
  - [ ] 了解 Agent 可观测性工具（如 [LangSmith](https://docs.langchain.com/langsmith/home) 或 [Langfuse](https://langfuse.com/docs)），学会追踪和调试多步工作流
  - [ ] 初步思考 Agent 输出质量评估方法（RAG 召回率、工具调用准确率、最终输出可用性）（参考 [LangSmith 评估文档](https://docs.langchain.com/langsmith/evaluation-quickstart)）
- [ ] **代码实战：自主技术博文调研员**
  - [ ] 规划工作流并定义好状态机数据结构 (`State`)
  - [ ] 编写各个功能节点 (Nodes)：如搜索资料节点、提取摘要节点、写初稿节点
  - [ ] 设置核心的**条件判断连线** (Conditional Edges)：如果"摘要发现信息不足"则重新路由回搜索节点
  - [ ] 跑通完整的 LangGraph 闭环工作流，给出万字长文级别的最终输出
- [ ] **进阶实践：可观测性与调优**
  - [ ] 接入 LangSmith 或 Langfuse，追踪 Agent 每一步的输入输出与耗时
  - [ ] 根据追踪数据优化工作流（如调整检索 Top-K、修改 Prompt、增加/减少节点）

---

## 第七阶段：接入标准化工具箱——MCP (第 11 周)

**目标：** 开拓眼界，接入生态通用协议，理解工具标准化趋势。

- [ ] **可视化与记录**
  - [ ] 制作 Level 5 精美幻灯片 (`docs/slides/level5.html`)
  - [ ] 在 `docs/qa.md` 中记录 MCP 协议的理解与思考
- [ ] **知识点突破**
  - [ ] 阅读 Anthropic 的 [MCP 规范文档](https://modelcontextprotocol.io/)，理解 Server/Client 架构与通信机制
  - [ ] 对比 MCP 与手写 Function Calling 的差异（标准化 vs 灵活性、接入成本、生态复用）
  - [ ] 了解主流 MCP Server 生态（参考 [MCP 官方 GitHub](https://github.com/modelcontextprotocol/servers) 与 [MCP Registry](https://registry.modelcontextprotocol.io/)）
- [ ] **代码实战：接入 MCP Server**
  - [ ] 在本地尝试跑起一个开源现成的文件系统 MCP Server
  - [ ] 摸索如何在主流客户端或自己的代码中直接对接这个 Server，免手写工具代码直接读取本地代码仓库
  - [ ] 尝试将 MCP Server 的能力接入到之前构建的聊天助手项目中

---

## 终局项目：全链路 Agent (第 12-13 周)

**目标：** 贯穿所有阶段能力，打造一个完整的、可展示的 Agent 应用。

- [ ] **项目规划**
  - [ ] 确定一个综合性场景（如"技术周报自动生成器"或"个人知识库管理 Agent"）
  - [ ] 设计系统架构图，标明 RAG、工具调用、LangGraph 编排各自承担的职责
- [ ] **开发与集成**
  - [ ] 整合 RAG 知识检索 + Function Calling + LangGraph 编排 + MCP 工具接入
  - [ ] 实现端到端工作流：用户输入 → Agent 自主规划 → 调用工具 → 循环优化 → 输出结果
- [ ] **完善与打磨**
  - [ ] 接入可观测性工具，确保全链路可追踪
  - [ ] 添加必要的错误处理与降级逻辑
  - [ ] 优化前端交互体验（流式输出、步骤可视化、异常提示）
  - [ ] 思考基本的安全防护（如用户输入过滤、工具调用权限控制）
- [ ] **总结与输出**
  - [ ] 撰写项目总结文档，回顾各阶段技术要点
  - [ ] 更新 `docs/qa.md` 完成全阶段知识沉淀
