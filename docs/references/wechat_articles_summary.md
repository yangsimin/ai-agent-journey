# 微信专栏：前端转 AI Agent 全栈通关秘籍

> 共 21 篇文章，系统讲解 AI Agent 开发从入门到工程化的完整路线。

---

## 🧭 第一阶段：基础概念与工具调用

### 1. AI Agent 开发要学什么？
**整体路线规划。** 介绍 AI Agent 的核心能力三要素：**Tool 调用**、**Memory**、**RAG**。作者以前端转全栈的视角，规划了以 Node.js/NestJS 为技术栈的学习路线：先用 LangChain 实现单 Agent 逻辑，再用 LangGraph 实现多 Agent 协作。强调核心概念和 API 模式具有跨语言通用性。

### 2. 从 Tool 开始：让大模型自动调工具读文件
**Tool 调用基础。** 以 Cursor 为例说明 LLM 如何通过生成 "tool call" 来触发外部函数（如文件读写、目录管理），从而从"被动回答"转变为"主动行动"。这是 Agent 能力的第一步——让模型"会用工具"而不只是"会说话"。

### 3. 实现 mini cursor：大模型自动调用 tool 执行命令
**实战：完整的 Agent 雏形。** 在前一篇基础上，给模型配备读写文件、管理目录、执行终端命令等完整工具集，实现一个能自主完成"创建项目并运行"等复杂任务的 mini Cursor。展示了如何将模块化工具组合，让 Agent 端到端完成从脚手架搭建到依赖安装的全流程任务。

### 4. MCP：可跨进程调用的 Tool
**Model Context Protocol 介绍。** MCP 是一套通过 stdio 或 HTTP 协议跨进程调用工具的标准化框架。使用 **Zod schema** 定义工具参数，让 LLM 能准确解析用户意图并提供正确输入。MCP 将工具逻辑从主 Agent 进程中解耦，是构建可扩展 Agent 的关键设计模式。

### 5. 高德 MCP + 浏览器 MCP：LangChain 复用别人的 MCP Server
**MCP 生态实战。** 演示如何接入第三方 MCP Server：**高德地图 MCP**（位置服务）、**Chrome DevTools MCP**（浏览器自动化：截图、元素交互）、**FileSystem MCP**（本地存储）。核心价值是"即插即用"——开发者无需重写通用工具，专注于高层编排即可快速扩展 Agent 能力。

---

## 📚 第二阶段：RAG 知识库构建

### 6. RAG：把文档向量化，基于向量实现真正的语义搜索
**RAG 原理入门。** 介绍 RAG（检索增强生成）作为解决 LLM 幻觉和数据时效性的核心方案，分三个阶段：**检索**（找相关数据）→ **增强**（将上下文注入 Prompt）→ **生成**（产生有据可依的答案）。重点讲解向量化原理：将文档转为数学 embedding，实现超越关键词匹配的语义搜索。

### 7. 知识库的 loader 和 splitter：从各种来源加载文档并分割成小块
**RAG 数据管道。** 介绍 **Document Loader**（从 PDF、HTML、Word 等格式提取文本）和 **Text Splitter**（将长文本切割为符合 token 限制的小块）。强调 **chunk overlap**（块重叠）的重要性——保留相邻块间的语义连续性，确保检索精准且上下文完整。

### 8. LangChain 全部 Splitter，其实只需要其中的一个
**Splitter 深度对比。** 分析了 LangChain 提供的所有分割器，结论是 **`RecursiveCharacterTextSplitter`** 是最通用的选择。它通过段落→换行→空格的层级分隔符优先级，在保留语义的前提下智能切割文本，chunk overlap 建议设置 10-20%。

### 9. 向量数据库 Milvus：做 AI Agent 开发必备技术
**Milvus 入门。** 将 Milvus 定位为 AI Agent 开发中的"MySQL"——专为高性能向量存储和检索设计，让 Agent 基于语义意图而非字面文本匹配来查找"知识"和"记忆"。介绍了 Milvus 的核心概念、部署方式，以及它为 Agent 提供持久化跨会话长期记忆的能力。

### 10. Milvus + RAG 实战：电子书语义检索助手
**完整 RAG 系统实战。** 构建一个电子书语义检索助手的全流程：加载多格式文件（PDF、Word、URL）→ 分块 → 向量化存入 Milvus → 基于余弦相似度检索最相关块。是前几篇理论的综合实践，给出了完整可用的 RAG 实现路径。

---

## 🧠 第三阶段：Memory、输出结构化与 Prompt 工程

### 11. Memory 管理的三大策略：截断、总结、检索
**对话记忆管理。** 随着对话历史增长，提出三种应对 token 超限的策略：
- **窗口截断**（丢弃旧消息，最简单）
- **Summary Buffer**（维护持续更新的历史摘要）
- **RAG 检索**（将历史存入向量库，按需取回相关内容）
并给出了各策略在 token 成本、性能、历史召回精度方面的权衡建议。

### 12. 结构化大模型输出：output parser 还是 tool？
**获取结构化数据的两种方式对比。** Output Parser 依赖 Prompt 指令 + 后处理解析；Tool Calling 利用模型原生能力直接返回符合 schema 的参数。对于现代模型（Gemini、GPT-4 等），强烈推荐 **Tool Calling**：更健壮、更少格式错误，本质上让 LLM 成为可靠的 API 处理器。

### 13. Output Parser 实战：智能录入 + 流式版 mini cursor
**Output Parser 进阶应用。** 演示两个实战场景：①用 Zod schema 将非结构化自然语言直接解析到复杂表单字段（"智能录入"）；②实现流式结构化输出的"流式版 mini cursor"，在 LLM 生成文本的同时实时提供格式化数据供 UI 渲染，实现低延迟体验。

### 14. Prompt Template：组件化管理 prompt
**Prompt 工程最佳实践。** 介绍 LangChain 的 `PromptTemplate` 和 `ChatPromptTemplate`，将硬编码字符串升级为动态可复用的组件。涵盖 Prompt 组合、few-shot 示例管理等技术，使模型指令可以独立维护和优化，不影响 Agent 逻辑其他部分。

---

## ⛓️ 第四阶段：LCEL Chain 编排

### 15. Runnable：把写逻辑变成组装 chain
**LCEL 核心抽象。** 介绍 LangChain 的 **Runnable 接口**——`PromptTemplate`、`OutputParser`、LLM 封装等核心组件均实现此接口。**LCEL（LangChain Expression Language）** 用 Runnable 以声明式方式构建 chain，提供标准化的 `invoke`（同步）、`batch`（并行）、`stream`（流式）执行方法，实现统一灵活的执行模型。

### 16. 实战练习 LCEL 组装 chain
**LCEL 实战。** 演示用 LCEL 构建生产级 Agent chain：包括绑定工具的模型（`bindTools`）、`RunnableBranch`（实现条件分支 if/else 逻辑）、`RunnableLambda`（将自定义 TypeScript 函数包装进 chain）。通过流水线式组合这些模块，构建可维护的 Agent 逻辑。

### 17. LangChain 整体总结：AI Agent 第一阶段学习完成
**第一阶段复盘。** 总结 LangChain 的核心价值：为 OpenAI、Anthropic Claude、Google Gemini 等不同接口和消息格式的 LLM 提供**统一抽象层**，使应用具备模型无关性。本篇作为理论阶段到工程实践阶段的过渡节点。

---

## 🏗️ 第五阶段：工程化实战（NestJS）

### 18. Nest + LangChain 实现基于 SSE 的流式 AI 接口
**脚本 → Web 服务。** 将 Agent 逻辑封装进 **NestJS** 框架，通过 **SSE（Server-Sent Events）** 实现 LLM 响应的实时流式传输，打造类似 ChatGPT 的"逐字出现"效果。介绍了 NestJS Controller 如何将 LangChain 流式输出直接管道到前端，大幅降低用户感知延迟。

### 19. Nest + tool 实现 OpenClaw 同款定时任务功能（上）
**自然语言驱动定时任务（上）。** 将"提醒"功能封装为 Agent 工具，让用户通过自然语言（如"晚上9点提醒我查邮件"）来管理定时任务。重点在于定义工具的"意图"识别，让 LLM 准确提取时间和内容等参数并触发对应工具调用。

### 20. Nest + tool 实现 OpenClaw 同款定时任务功能（下）
**自然语言驱动定时任务（下）。** 完成持久化层的实现：在 NestJS 中集成 **ORM 框架**，通过数据库 CRUD 操作可靠地存储、检索和删除定时任务。展示了结构化后端如何让 Agent 跨会话维持状态并自主执行长期定时功能。

---

## 🎙️ 第六阶段：语音交互

### 21. 给 Agent 加上语音交互：ASR + 流式 TTS
**为 Agent 加上声音。** 集成 **ASR（自动语音识别）** 将语音输入转为文字，以及 **TTS（文字转语音）** 将 Agent 回复转为语音输出。核心亮点是**流式 TTS**——在 LLM 仍在生成文本的同时即开始播放音频，创造低延迟的自然对话体验，适合打造免手动操作的语音 AI 助手。

---

## 📌 技术栈全景

| 层次 | 技术 |
|------|------|
| 框架 | NestJS + Next.js |
| AI 编排 | LangChain.js / LangGraph.js |
| LLM | Google Gemini / OpenAI / Claude |
| 向量数据库 | Milvus |
| 协议 | MCP (Model Context Protocol) |
| 流式传输 | SSE (Server-Sent Events) |
| 结构化验证 | Zod |
| 语音 | ASR + 流式 TTS |
