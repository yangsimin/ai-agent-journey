# AI Agent Journey - Q&A 记录

本文件旨在记录在学习 AI Agent 过程中的疑问、深度思考以及 AI 的补充解答。

---

## 📅 第一阶段：从“聊天框”开始 (第 1-2 周)

### Q: [在这里记录你的第一个问题]
**A:** [在这里记录 AI 的解答或你的学习心得]

---

## 📅 第二阶段：给 AI 装上“外挂硬盘” (第 3-4 周)

### Q: 为什么本地 RAG 无法回答“谈判力第二章讲什么”？明明相关的文档块已经存在了。
**A:** 这涉及到了两个导致检索失败的坑点：
1. **语义向量的局限性与 Top-K 截断：**
   纯语义的 Embedding 检索擅长匹配具有相似长文本或同义词的段落。当询问“讲什么”时，模型更倾向于去匹配包含解释性、步骤性文字的片段。而在较长的文本块（Chunk）中，“第二章”这个明确的标识词所占的 token 权重很低，被稀释了。这导致包含该章节标题的核心文本块相似度排名靠后（比如排在了第 6 名），而代码中只截取了 `Top-5`（`searchStore(embedding, 5)`），从而完美过滤掉了正确答案。**快速解决方案**是将 Top-K 扩大（如调至 10）。在更成熟的架构中，应该使用结合了关键字检索（BM25）与向量检索的**混合检索 (Hybrid Search)**。

2. **Vercel AI SDK 3.x 消息结构的变动：**
   最新版的前端 `useChat` 传递给后端的消息结构，把用户的输入放到了 `parts` 数组中（`{ "role": "user", "parts": [{ "type": "text", "text": "..." }] }`），而不再是原先单一的 `content` 字段。后端代码如果是直接用 `const latestMessage = messages[...].content` 取值，就会取到空字符串 `""`，从而直接绕过了基于这段话生成的后续所有 RAG 查询逻辑。**解决方案**是兼容读取：`const latestMessage = lastMsg?.content || (lastMsg?.parts?.filter(p => p.type === 'text').map(p => p.text).join('\n')) || '';`

---

## 📅 第三阶段：给 AI 装上“手” (第 5-6 周)

### Q: AI 工具调用的错误处理与降级策略有哪些？
**A:** 核心原则是**不要让 AI 工具的单点故障影响用户体验**，主要策略包括：

1. **重试策略 (Retry)**：遇到 429（限流）或 5xx 错误时使用指数退避重试（1s → 2s → 4s），配合最大重试次数限制（通常 3-5 次）和幂等性保障。

2. **超时控制 (Timeout)**：设置请求级超时、流式响应首字节超时和整体任务超时，避免无限等待。

3. **降级策略 (Fallback)**：
   - 模型降级：GPT-4o → GPT-4o-mini → Claude Haiku（高级模型不可用或成本过高时）
   - 功能降级：AI 生成 → 规则/模板兜底（AI 服务完全不可用时）
   - 缓存降级：实时调用 → 返回缓存结果（历史相似请求的缓存命中）
   - 队列降级：同步调用 → 异步队列（高峰期削峰填谷）

4. **输入校验与防护**：参数白名单、输出解析容错（LLM 格式异常时的 partial parse）、上下文长度预检。

5. **优雅降级模式**：
   - Circuit Breaker（熔断器）：连续失败 N 次后暂停调用，冷却后半开探测恢复
   - Bulkhead（舱壁隔离）：限制并发调用数，防止单个工具故障拖垮全局
   - Feature Flag：可动态关闭不稳定的 AI 功能，不影响核心流程

6. **可观测性**：结构化日志记录调用参数、耗时、错误码；监控成功率、延迟 P99、降级触发率；异常时及时告警。

7. **用户侧处理**：提供重试按钮、长时间调用的进度反馈、AI 不可用时的明确提示。

---

## 📅 第四阶段：LangChain 重构——换一种方式说同一件事 (第 7 周)

### Q: Vercel AI SDK vs LangChain.js，各自的优劣势和适用场景是什么？

**A:** 经过完整的"同一功能两种实现"重构后，核心对比结论如下：

#### 1. 开发体验
| 维度 | Vercel AI SDK | LangChain.js |
|------|---------------|--------------|
| **学习曲线** | 低。API 设计直觉友好，几行代码就能跑通 | 高。概念多（Runnable、Middleware、StateGraph），需要理解抽象层 |
| **代码量** | 少。`streamText()` 一个函数搞定流式+工具+RAG | 多。需要分别创建 model、agent、middleware、tool，再组合 |
| **调试体验** | 好。`onStepFinish` 回调直接拿到结构化结果 | 复杂。`streamEvents` 事件流语义丰富但信息密度高 |
| **类型安全** | 强。Zod schema 直接绑定 tool 参数，类型推导完整 | 中等。`tool()` 函数支持 Zod，但部分 API 的类型推导不够精确 |

#### 2. 核心映射关系
| 功能 | Vercel AI SDK | LangChain.js |
|------|---------------|--------------|
| 流式对话 | `streamText()` → `toUIMessageStreamResponse()` | `model.stream()` / `agent.stream()` → `toUIMessageStream()` |
| 工具定义 | `tool({ description, inputSchema, execute })` | `tool(fn, { name, description, schema })` |
| 工具调用循环 | `stopWhen: stepCountIs(5)` 自动循环 | `createAgent()` 内置 ReAct 循环 |
| 消息转换 | `convertToModelMessages()` | `toBaseMessages()` (from `@ai-sdk/langchain`) |
| RAG 检索 | 手动 embed → searchStore → 拼接 systemPrompt | `dynamicSystemPromptMiddleware` 声明式注入 |

#### 3. 生态丰富度
| 维度 | Vercel AI SDK | LangChain.js |
|------|---------------|--------------|
| 模型 Provider | 原生支持 OpenAI/Anthropic/Google/Mistral 等 | 更多 Provider（包括本地模型 Ollama） |
| 向量数据库 | 需要自己接入 | 50+ 官方集成（Pinecone/FAISS/Chroma/PGVector...） |
| 文档处理 | 需要自行组合 | 内置 Document Loader、Text Splitter 等 |
| Agent 编排 | 简单的 step loop | LangGraph 状态机（复杂工作流的核心优势） |
| 可观测性 | 基础日志 | LangSmith/Langfuse 完整追踪 |

#### 适用场景总结
- **Vercel AI SDK 更适合**：Next.js 全栈项目、快速原型、前端开发者、简单到中等复杂度的 AI 功能
- **LangChain.js 更适合**：复杂的 Agent 工作流（多步推理、条件分支）、需要对接多种向量数据库、需要 LangGraph 编排的复杂场景

#### 关键收获：桥接方案
`@ai-sdk/langchain` 适配层是一个"两全其美"的方案——前端保持 `useChat()` 不变，后端自由选择 Vercel AI SDK 或 LangChain。这对学习项目特别有价值：**同一套前端，随时切换两套后端对比学习。**

---

### Q: LangChain.js 的 MemoryVectorStore 有什么局限性？

**A:** 三个主要问题：
1. **纯内存，不持久化**：服务重启数据丢失。本项目通过 JSON 文件持久化 Document 数据来缓解。
2. **不适合生产环境**：全量扫描计算相似度，数据量大时性能差。生产应用应使用 FAISS（本地持久化）或 Pinecone/Chroma（云端）。
3. **无删除操作**：只能添加和查询，不支持按条件删除。

下一步计划：先用 FAISS 替代实现本地持久化，再尝试 Pinecone 云端方案。
