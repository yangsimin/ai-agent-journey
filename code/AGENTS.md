<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 项目概览

**AI Agent Journey** — 系统性学习 AI Agent 开发的学习项目（非生产软件）。

**Monorepo 结构：**
- `code/` — Next.js 应用（本目录）
- `mcp-server/` — 独立 MCP 文件系统 Server（npm 项目）
- `docs/` — 学习笔记、任务追踪 (`todo.md`)、Q&A (`qa.md`)、幻灯片 (`slides/`)
- `.mcp.json` — MCP 服务器配置（根目录）

## 构建 & 运行

**包管理器: pnpm**（不要用 npm）

```bash
pnpm install
pnpm db:generate                      # 生成 Prisma 客户端
docker compose up -d                  # 启动 PostgreSQL（首次需运行 pnpm db:push 创建表）
pnpm dev       # 开发服务器 http://localhost:3000
pnpm build     # 生产构建
pnpm lint      # ESLint
pnpm start     # 生产服务器
```

Prisma 数据库管理：

```bash
pnpm db:push     # 推送 schema 到数据库（开发用，无需迁移文件）
pnpm db:migrate  # 创建迁移（正式环境推荐）
pnpm db:studio   # 打开 Prisma Studio 可视化管理
```

MCP Server（独立项目，使用 npm）：

```bash
cd mcp-server && npm install
cd mcp-server && npm run build
cd mcp-server && npm run dev:stdio   # stdio 模式
cd mcp-server && npm run dev:http    # HTTP 模式，端口 3001
```

无测试框架。

## 环境变量

在 `code/` 下创建 `.env.local`（不提交）：

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_key       # 必填 — 对话、模型列表、Embedding
GOOGLE_GENERATIVE_AI_MODEL=gemini-2.5-flash # 可选 — 覆盖默认对话模型
ANTHROPIC_API_KEY=your_key                  # 可选 — 启用 Claude 模型
ANTHROPIC_BASE_URL=https://your-proxy       # 可选 — Anthropic 网关代理
DEFAULT_PROVIDER=google                     # 可选 — "google" 或 "anthropic"
DEFAULT_MODEL=gemini-2.5-flash              # 可选 — 默认模型覆盖
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1 # 可选 — LM Studio 本地 Embedding
LM_STUDIO_EMBEDDING_MODEL=nomic-embed-text  # 可选 — LM Studio 模型名
LANGFUSE_PUBLIC_KEY=your_key                # 可选 — 可观测性
LANGFUSE_SECRET_KEY=your_key                # 可选 — 可观测性
LANGFUSE_BASE_URL=https://cloud.langfuse.com # 可选 — 自托管 Langfuse
MCP_TRANSPORT=stdio                         # 可选 — "stdio" 或 "http"（默认 stdio）
DATABASE_URL=postgresql://aiagent:aiagent@localhost:5432/ai_agent_journey  # 必填 — Prisma 数据库连接
```

同时设置 `LM_STUDIO_BASE_URL` 和 `LM_STUDIO_EMBEDDING_MODEL` 时，Embedding 使用本地 LM Studio（`@ai-sdk/openai` 兼容客户端），否则回退到 Google `text-embedding-004`（768 维）。

## 技术栈

- **框架:** Next.js 16 (App Router) + React 19
- **AI SDK:** Vercel AI SDK 6 (`ai`, `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/react`, `@ai-sdk/langchain`)
- **LangChain:** `langchain`, `@langchain/langgraph`, `@langchain/core`, `@langchain/textsplitters`
- **验证:** Zod 4
- **ORM:** Prisma 7 + PostgreSQL（PrismaPg 驱动适配器）
- **样式:** Tailwind CSS v4 + shadcn/ui (base-nova 风格)
- **MCP:** `@modelcontextprotocol/sdk`
- **可观测性:** OpenTelemetry + Langfuse
- **LLM:** Google Gemini（默认 `gemini-2.5-flash`）或 Anthropic Claude

---

## 目录结构

```
code/src/
  app/
    page.tsx                         # 首页 — AI 对话助手（Client Component）
    rpg/page.tsx                     # RPG 文字冒险游戏页面
    todos/page.tsx                   # 学习进度查看页面
    layout.tsx                       # 根布局（lang="zh-CN"）
    globals.css                      # Tailwind v4 + CSS 变量
    api/
      chat/route.ts                  # AI SDK 对话 API（流式 + RAG + MCP 工具 + 对话持久化）
      chat-langchain/route.ts        # LangChain 对话 API（功能等价，对比学习用）
      ingest/route.ts                # 知识库文档摄入 API（双写两套向量存储）
      models/route.ts                # 模型列表查询 API（Google + Anthropic）
      rpg/route.ts                   # RPG 游戏 API（start/resume，SSE 流式）
      conversations/route.ts        # 对话列表/创建 API（Prisma）
      conversations/[id]/route.ts   # 单对话详情/删除 API
      reminders/route.ts            # 提醒列表/创建 API（Prisma）
      reminders/[id]/route.ts       # 提醒更新/删除 API
      todos/route.ts                 # 提醒事项查询 API（兼容旧前端，读取 DB）
      todo-md/route.ts               # 学习进度 CRUD API（读取/切换 checkbox）
  components/
    ai-elements/                     # AI 对话 UI 组件
      message.tsx                    #   消息气泡（Markdown 渲染 streamdown + shiki）
      conversation.tsx               #   对话滚动容器（use-stick-to-bottom）
      prompt-input.tsx               #   输入框（文件附件/语音/命令面板）
      tool.tsx                       #   工具调用展示（可折叠卡片）
      shimmer.tsx                    #   加载闪烁动画（motion）
      code-block.tsx                 #   代码块（shiki 高亮 + 复制）
    conversation-list.tsx            # 对话列表侧边栏组件（Prisma 数据源）
    todos/                           # 学习进度 UI 组件
      todo-viewer.tsx                #   Todo 文档查看器（阶段/进度条/任务组）
      todo-checkbox.tsx              #   Todo 复选框（乐观更新）
    ui/                              # shadcn/ui 基础组件
  lib/
    api-utils.ts                     # 统一错误处理包装器（withApiHandler/withGetHandler）
    api-schemas.ts                   # 共享 Zod 校验 schema（各路由请求体）
    db.ts                            # Prisma Client 单例（PrismaPg 适配器）
    conversations.ts                 # 对话 CRUD 操作（Prisma）
    embeddings.ts                    # AI SDK Embedding（LM Studio / Google 双提供商）
    embeddings-langchain.ts          # LangChain Embedding（EmbeddingsInterface 单例）
    vectorStore.ts                   # AI SDK 向量存储（JSON 文件 + 手写余弦相似度）
    vectorStore-langchain.ts         # LangChain 向量存储（MemoryVectorStore）
    tools.ts                         # AI SDK 工具定义（create/list/complete_reminder, get_weather，Zod schema）
    tools-langchain.ts               # LangChain 工具定义（等价 Reminder 三件套）
    mcp-client.ts                    # MCP 客户端（stdio/HTTP 双传输，工具发现，JSON Schema→Zod）
    model.ts                         # 动态 Provider 选择（Google/Anthropic）
    llm.ts                           # LangChain 模型选择器（BaseChatModel）
    langfuse.ts                      # Langfuse 集成（CallbackHandler + session metadata）
    todo-parser.ts                   # Markdown 解析器（todo.md → 结构化数据）
    utils.ts                         # 通用工具（cn）
    rpg/                             # RPG 游戏引擎
      types.ts                       #   状态 Schema（RpgState: messages, scene, playerHp, inventory, npcMemory...）
      graph.ts                       #   LangGraph 状态图构建（7 节点 + 2 条件路由 + MemorySaver）
      nodes.ts                       #   游戏节点函数（sceneNarrator, waitForPlayer, actionParser...）
      prompts.ts                     #   各节点 Prompt 模板（6 个）
      initial-state.ts               #   游戏初始状态（幽暗森林, 100HP, 3 初始物品）
  instrumentation.ts                 # OpenTelemetry 初始化（LangfuseSpanProcessor）
  generated/prisma/                  # Prisma 7 生成的客户端代码（自动生成，勿手动编辑）
prisma/
  schema.prisma                      # Prisma 数据模型（Conversation/Message/Reminder）
prisma.config.ts                     # Prisma 7 配置文件（数据库连接 URL）
docker-compose.yml                   # PostgreSQL 16 Docker 配置
```

```
mcp-server/src/
  server.ts                          # MCP Server 核心（注册 7 个文件系统工具 + 路径安全校验）
  stdio.ts                           # stdio 传输入口
  http.ts                            # HTTP 传输入口（端口 3001）
```

---

## 核心架构

### 双后端对比学习（核心设计）

项目用 Vercel AI SDK 和 LangChain **并行实现同一功能**，用于对比学习：

```
                    ┌─ /api/chat            (AI SDK: streamText, tool(), smoothStream)
前端 (useChat) ────┤
                    └─ /api/chat-langchain  (LangChain: createAgent, tool(), @ai-sdk/langchain 适配)
```

两套后端共用前端 `useChat` hook，各自有独立的工具、Embedding、向量存储：

| 组件 | AI SDK 版 | LangChain 版 |
|------|----------|-------------|
| 工具 | `src/lib/tools.ts` | `src/lib/tools-langchain.ts` |
| Embedding | `src/lib/embeddings.ts` | `src/lib/embeddings-langchain.ts` |
| 向量存储 | `src/lib/vectorStore.ts`（JSON + 余弦相似度） | `src/lib/vectorStore-langchain.ts`（MemoryVectorStore） |
| 存储文件 | `.vector_store.json` | `.lc_vector_store.json` |

摄入 API **双写**两套存储。

### 对话数据流（AI SDK 版）

```
page.tsx (useChat hook)
  → POST /api/chat { messages, modelId, systemPrompt }
    → convertToModelMessages()     [UIMessage[] → ModelMessage[]]
    → readStore()                  [检查知识库是否为空]
    → embedText(lastMessage)       [embeddings.ts]
    → searchStore(embedding, 10)   [vectorStore.ts，暴力余弦相似度]
    → 过滤低于 0.5 阈值的片段
    → RAG context 拼入 systemPrompt
    → getMcpToolsAsAiSdk()         [获取 MCP 文件系统工具]
    → streamText() + smoothStream + telemetry
    → stopWhen: stepCountIs(5)     [工具调用最多 5 步]
    → toUIMessageStreamResponse()
```

### RAG 数据流

```
page.tsx (文件上传)
  → POST /api/ingest { text, filename }
    → RecursiveCharacterTextSplitter (chunkSize=800, overlap=150)
    → embedTexts()                     [embeddings.ts]
    → clearStore() + addChunks()       [→ .vector_store.json]
    → clearLcStore() + addDocuments()  [→ .lc_vector_store.json，双写]
```

### LangGraph RPG 游戏

基于 `@langchain/langgraph` 的文字冒险游戏：

```
START → scene_narrator → wait_for_player (interrupt!) → action_parser → consequence_evaluator
                                                                              │
                                      ┌───────────────────────────────────────┤
                                      ↓                  ↓                    ↓
                                scene_narrator    npc_responder          end_death
```

关键模式：
- `interrupt()` 暂停图执行，等待人类输入
- `Command({ resume: playerInput })` 恢复执行
- `MemorySaver` 作为 checkpointer
- NPC 拥有独立记忆 (`npcMemory`) 和性格

### MCP 集成

`src/lib/mcp-client.ts` 封装了与独立 `mcp-server/` 的通信：
- 支持 **stdio** 和 **HTTP** 传输（通过 `MCP_TRANSPORT` 环境变量切换）
- 自动发现工具并转换为 AI SDK / LangChain 格式
- JSON Schema → Zod Schema 自动转换
- 工具缓存（避免每次请求重新连接）

MCP Server（`mcp-server/`）提供 7 个文件系统工具：`read_file`, `write_file`, `list_directory`, `create_directory`, `delete_file`, `search_files`, `get_file_info`

### 模型选择逻辑

1. 如果 `DEFAULT_PROVIDER=anthropic` 或模型名包含 `claude` → Anthropic
2. 否则 → Google Gemini
3. 支持自定义 Anthropic baseURL（公司代理/网关）
4. 优先级：前端 `modelId` > `DEFAULT_MODEL` 环境变量 > `GOOGLE_GENERATIVE_AI_MODEL` > fallback

### Persona 系统

硬编码在 `page.tsx` 的 `PERSONAS` 数组。选择持久化到 `localStorage`。选中的 prompt 作为 `systemPrompt` 发送，RAG context 拼接在其下方。

---

## 关键架构决策

- **向量存储使用 JSON 文件**（`.vector_store.json`）而非内存单例，规避 Next.js App Router worker 隔离导致的状态丢失
- **无 ANN 索引** — `searchStore()` 暴力 O(n) 余弦相似度，仅适合学习规模数据
- **替换式上传** — 每次文档上传 `clearStore()` + `addChunks()`，无增量索引
- **摄入双写** — 文档同时写入两套向量存储
- **工具步数限制** — `stopWhen: stepCountIs(5)` 限制工具调用最多 5 步
- **MCP 工具缓存** — 避免每次请求重新连接 MCP Server
- **smoothStream 中文分词** — 使用 `Intl.Segmenter('zh')` 实现中文友好的流式输出
- **OpenTelemetry + Langfuse** — 统一可观测性，覆盖双后端（AI SDK 通过 `experimental_telemetry`，LangChain 通过 `CallbackHandler`）

## 开发约定

- 使用 `'use client'` 标记客户端组件
- 使用 `@/*` 路径别名导入（映射到 `./src/*`）
- API 路由导出具名 HTTP 方法函数（`export async function POST() {}`）
- 通过 `process.env` 访问环境变量，禁止硬编码密钥
- 每个 API 路由设置 `export const maxDuration` 用于 Vercel serverless 超时
- Turbopack (Next.js 16) 无法正确解析复杂模板字符串 className 中的 JSX `&&` 运算符，应使用纯字符串拼接或将 className 提取为变量
