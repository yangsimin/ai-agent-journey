// LangChain 版对话 API
// 与 api/chat/route.ts 功能等价，使用 LangChain.js 替代 Vercel AI SDK 的后端逻辑
// 前端 useChat hook 完全不变，通过 @ai-sdk/langchain 适配层桥接

// 必须在其他导入之前初始化 OpenTelemetry（用于 Langfuse 追踪）
import '@/instrumentation';

import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { after } from 'next/server';
import { createAgent, dynamicSystemPromptMiddleware } from 'langchain';
import { getModel } from '@/lib/llm';
import { lcTools } from '@/lib/tools-langchain';
import { getLcVectorStore, readLcStore } from '@/lib/vectorStore-langchain';
import { getMcpToolsAsLangChain, convertMcpToolToLangChain, type TransportType } from '@/lib/mcp-client';
import { createLangfuseCallbacks } from '@/lib/langfuse';
import { withApiHandler, errorResponse } from '@/lib/api-utils';
import { chatRequestSchema } from '@/lib/api-schemas';
import { createConversation, addMessage, generateTitle, getMessages } from '@/lib/conversations';

// 缓存 MCP 工具（避免每个请求都重新连接）
let cachedLcMcpTools: ReturnType<typeof convertMcpToolToLangChain>[] | null = null;

const getMcpTransportType = (): TransportType =>
  process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';

export const maxDuration = 30;

export const POST = withApiHandler(
  async (req, body) => {
    const { messages, modelId, systemPrompt, conversationId } = body;

    // ========= 对话持久化 =========
    let convId = conversationId as string | undefined;
    if (!convId) {
      const lastUserMsg = messages[messages.length - 1];
      const firstContent = lastUserMsg?.content
        || (lastUserMsg?.parts?.filter((p: { type: string; text?: string }) => p.type === 'text').map((p: { type: string; text?: string }) => p.text).join('\n'))
        || 'New Conversation';
      const modelName = modelId || process.env.DEFAULT_MODEL || process.env.GOOGLE_GENERATIVE_AI_MODEL;
      if (!modelName) {
        return errorResponse('PROVIDER_ERROR', 'No model configured. Set DEFAULT_MODEL or GOOGLE_GENERATIVE_AI_MODEL env var.');
      }
      const conversation = await createConversation({
        title: generateTitle(firstContent),
        backend: 'langchain',
        modelId: modelName,
        persona: systemPrompt ? 'custom' : undefined,
      });
      convId = conversation.id;
    }

    // 持久化用户消息
    const lastMsg = messages[messages.length - 1];
    const userContent = lastMsg?.content || (lastMsg?.parts?.filter((p: { type: string; text?: string }) => p.type === 'text').map((p: { type: string; text?: string }) => p.text).join('\n')) || '';
    await addMessage({
      conversationId: convId,
      role: 'user',
      content: userContent,
      parts: lastMsg?.parts,
    });

    // 构建 system prompt 基础部分
    const baseSystemPrompt = systemPrompt
      || '你是一个功能强大的 AI 助手。你可以帮助用户创建待办事项（提醒、任务、计划），也可以查询城市天气，还可以操作文件系统（读取、写入、列出目录、搜索文件等）。请根据用户需求主动调用相应的工具。';

    // 注入当前时间
    const currentDate = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const timePrompt = `[系统提示：当前北京时间是 ${currentDate}]`;

    // ========= RAG 检索（提前执行，middleware 延迟触发无法在 stream 前中断） =========
    const query = userContent;

    // 先检查知识库是否为空，避免空知识库时无意义的 embedding API 调用
    const knowledgeBase = readLcStore();
    let ragChunkCount = 0;
    let ragMaxSimilarity = 0;

    let ragContext = '';
    if (query && knowledgeBase.length > 0) {
      try {
        const vectorStore = await getLcVectorStore();

        // 使用 similaritySearchWithScore 获取相似度分数，以便过滤低相关度片段
        const docsWithScores = await vectorStore.similaritySearchWithScore(query, 10);

        // 过滤低相似度片段（与 AI SDK 路由保持一致）
        const SIMILARITY_THRESHOLD = 0.5;
        const filteredDocs = docsWithScores.filter(([, score]) => score >= SIMILARITY_THRESHOLD);
        ragChunkCount = filteredDocs.length;
        ragMaxSimilarity = filteredDocs.length > 0 ? Math.max(...filteredDocs.map(([, score]) => score)) : 0;

        if (filteredDocs.length > 0) {
          const contextText = filteredDocs
            .map(([doc, score], i) => `[内部文档片段 ${i + 1} | 相关度 ${(score * 100).toFixed(1)}%]:\n${doc.pageContent}`)
            .join('\n\n');

          ragContext = `
====================
【检索到的相关背景资料】
请务必优先基于以下我为你检索到的内部知识库资料来直接回答用户的问题。如果是询问外部常规问题不受此限制：

${contextText}
====================`;
        }
      } catch (e) {
        // RAG 检索失败时降级继续，记录日志但不中断请求
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[RAG] 检索失败，降级继续:', errMsg);
      }
    }

    // 获取 LangChain 模型实例
    const model = getModel(modelId);

    // 中间件：注入固定 system prompt（RAG 上下文已提前获取）
    const systemMiddleware = dynamicSystemPromptMiddleware(async () => {
      return baseSystemPrompt + '\n\n' + timePrompt + ragContext;
    });

    // ========= 获取并合并 MCP 工具 =========
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allLcTools: any[] = [...lcTools];
    try {
      if (!cachedLcMcpTools) {
        const transportType = getMcpTransportType();
        cachedLcMcpTools = await getMcpToolsAsLangChain({ transportType });
      }
      allLcTools = [...allLcTools, ...cachedLcMcpTools];
    } catch {
      // 加载失败时使用基础工具继续
      cachedLcMcpTools = null; // 重置缓存，下次请求重试
    }

    // 创建 LangChain Agent
    const agent = createAgent({
      model,
      tools: allLcTools,
      middleware: [systemMiddleware],
    });

    // 将 AI SDK 的 UIMessage[] 转换为 LangChain 的 BaseMessage[]
    let contextMessages = messages;
    if (conversationId) {
      const dbMessages = await getMessages(convId);
      // 排除最后一条（即刚持久化的用户消息），避免重复
      const historyMessages = dbMessages.slice(0, -1).map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: (Array.isArray(m.parts) ? m.parts : [{ type: 'text' as const, text: m.content }]) as UIMessage['parts'],
        createdAt: new Date(m.createdAt),
      }));
      contextMessages = [...historyMessages, ...messages];
    }
    const langchainMessages = await toBaseMessages(contextMessages);

    // 创建 Langfuse 追踪配置
    const langfuseConfig = createLangfuseCallbacks({
      sessionId: body.sessionId ?? convId,
      userId: body.userId,
      traceMetadata: {
        modelId,
        hasRagContext: !!ragContext,
        ragChunkCount,
        ragMaxSimilarity,
        toolCount: allLcTools.length,
        conversationId: convId,
      },
    });

    // 使用 Agent 的 stream 方法，传入 Langfuse 追踪
    const stream = await agent.stream(
      { messages: langchainMessages },
      {
        streamMode: ['values', 'messages'],
        ...langfuseConfig,
      },
    );

    // 在流传输过程中捕获最终的 assistant 内容（避免流被消费后无法再次遍历）
    let capturedAssistantContent = '';

    // 包装原始流：一边传给 toUIMessageStream，一边提取 assistant 消息
    async function* teeStream() {
      for await (const chunk of stream) {
        // LangGraph streamMode: ['values', 'messages'] 输出 [eventType, data] 元组
        if (Array.isArray(chunk) && chunk[0] === 'values' && chunk[1]?.messages) {
          const msgs = chunk[1].messages;
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg._getType?.() === 'ai') {
            if (typeof lastMsg.content === 'string') {
              capturedAssistantContent = lastMsg.content;
            } else if (Array.isArray(lastMsg.content)) {
              // Gemini 返回内容为数组格式 [{index, type, text}]，提取纯文本
              capturedAssistantContent = (lastMsg.content as { type?: string; text?: string }[])
                .filter(p => p.type === 'text')
                .map(p => p.text ?? '')
                .join('');
            }
          }
        }
        yield chunk;
      }
    }

    // 通过适配层转换为 AI SDK 的 UIMessageStream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uiStream = toUIMessageStream(teeStream() as any);

    // 流结束后持久化 assistant 回复
    after(async () => {
      try {
        if (capturedAssistantContent && convId) {
          await addMessage({
            conversationId: convId,
            role: 'assistant',
            content: capturedAssistantContent,
          });
        }
      } catch (e) {
        console.error('[Chat-LangChain] 持久化 assistant 消息失败:', e);
      }
    });

    const response = createUIMessageStreamResponse({
      stream: appendMetadataChunk(uiStream, { conversationId: convId }),
    });

    response.headers.set('X-Conversation-Id', convId);
    return response;
  },
  { schema: chatRequestSchema },
);

/** 在 UI message stream 末尾追加 message-metadata chunk，让前端能获取 conversationId */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function appendMetadataChunk(stream: ReadableStream<any>, metadata: Record<string, unknown>): ReadableStream<any> {
  const reader = stream.getReader();
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue({ type: 'message-metadata', messageMetadata: metadata });
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      reader.cancel();
    },
  });
}
