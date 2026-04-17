// 必须在其他导入之前初始化 OpenTelemetry（用于 Langfuse 追踪）
import '@/instrumentation';

import { google } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, stepCountIs, smoothStream, type UIMessage } from 'ai';
import { after } from 'next/server';
import { trace } from '@opentelemetry/api';
import { searchStore, readStore } from '@/lib/vectorStore';
import { embedText } from '@/lib/embeddings';
import { myTools } from '@/lib/tools';
import { getMcpToolsAsAiSdk, convertMcpToolToAiSdk, type TransportType } from '@/lib/mcp-client';
import { langfuseSpanProcessor } from '@/instrumentation';
import { withApiHandler, errorResponse } from '@/lib/api-utils';
import { chatRequestSchema } from '@/lib/api-schemas';
import { createConversation, addMessage, generateTitle, getMessages } from '@/lib/conversations';

export const maxDuration = 30;

// 中文分词器（用于 smoothStream 的平滑输出）
const chineseSegmenter = new Intl.Segmenter('zh', { granularity: 'word' });

// 缓存 MCP 工具（避免每个请求都重新连接）
let cachedMcpTools: Record<string, ReturnType<typeof convertMcpToolToAiSdk>> | null = null;

// MCP 传输方式：默认 stdio，可通过环境变量 MCP_TRANSPORT=http 切换
const getMcpTransportType = (): TransportType => {
  return process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';
};

export const POST = withApiHandler(
  async (req, body) => {
    const { messages, modelId, systemPrompt, conversationId } = body;

    // 前端 modelId 优先，其次环境变量 DEFAULT_MODEL / GOOGLE_GENERATIVE_AI_MODEL
    const modelName = modelId || process.env.DEFAULT_MODEL || process.env.GOOGLE_GENERATIVE_AI_MODEL;
    if (!modelName) {
      return errorResponse('PROVIDER_ERROR', 'No model configured. Set DEFAULT_MODEL or GOOGLE_GENERATIVE_AI_MODEL env var.');
    }

    // 动态选择 Provider，判断逻辑：
    // 1. 根据环境变量里的 DEFAULT_PROVIDER 配置
    // 2. 如果没配，但模型名字里带了 claude 或者配了 Anthropic 的 KEY，就走 Anthropic，否则走 Google
    const isAnthropic = process.env.DEFAULT_PROVIDER === 'anthropic' || modelName.includes('claude');

    // 支持 Anthropic 自定义 baseURL (如公司内部代理、网关)
    // Vercel AI SDK 会追加 /messages，所以 baseURL 需要包含 /v1
    let anthropicBaseURL = process.env.ANTHROPIC_BASE_URL;
    if (anthropicBaseURL && !anthropicBaseURL.endsWith('/v1')) {
      anthropicBaseURL = `${anthropicBaseURL}/v1`;
    }

    const anthropicProvider = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: anthropicBaseURL,
    });

    const modelInstance = isAnthropic ? anthropicProvider(modelName) : google(modelName);

    // ========= 对话持久化 =========
    // 如果没有 conversationId，创建新对话
    let convId = conversationId as string | undefined;
    if (!convId) {
      // 从最后一条用户消息生成标题
      const lastUserMsg = messages[messages.length - 1];
      const firstContent = lastUserMsg?.content
        || (lastUserMsg?.parts?.filter((p: { type: string; text?: string }) => p.type === 'text').map((p: { type: string; text?: string }) => p.text).join('\n'))
        || 'New Conversation';
      const conversation = await createConversation({
        title: generateTitle(firstContent),
        backend: 'vercel',
        modelId: modelName,
        persona: body.systemPrompt ? 'custom' : undefined,
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

    // 如果是已有对话，从 DB 加载历史消息作为上下文
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
      // 历史消息 + 前端当前消息，构成完整上下文
      contextMessages = [...historyMessages, ...messages];
    }

    // 使用官方工具函数将 UIMessage[] 转换为 ModelMessage[]
    const modelMessages = await convertToModelMessages(contextMessages);

    let enhancedSystemPrompt = systemPrompt
      || '你是一个功能强大的 AI 助手。你可以帮助用户创建待办事项（提醒、任务、计划），也可以查询城市天气，还可以操作文件系统（读取、写入、列出目录、搜索文件等）。请根据用户需求主动调用相应的工具。';

    // 注入当前时间，帮助模型理解"明天"、"下周"等相对时间概念
    const currentDate = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    enhancedSystemPrompt += `\n\n[系统提示：当前北京时间是 ${currentDate}]`;

    // ========= RAG 核心检索逻辑 =========
    // 先检查知识库是否为空，避免空知识库时无意义的 embedding API 调用
    const knowledgeBase = readStore();
    let ragChunkCount = 0;
    let ragMaxSimilarity = 0;

    if (userContent && knowledgeBase.length > 0) {
      const tracer = trace.getTracer('ai-agent-journey');
      const ragSpan = tracer.startSpan('rag.search');
      ragSpan.setAttribute('query_length', userContent.length);
      ragSpan.setAttribute('knowledge_base_size', knowledgeBase.length);

      try {
        // 1. 将用户的提问向量化（使用环境变量配置的 embedding 提供商）
        const embedding = await embedText(userContent);

        // 2. 去内存库中查询最相关的 Top-10 片段
        const results = searchStore(embedding, 10);

        // 3. 过滤低相似度片段
        const SIMILARITY_THRESHOLD = 0.5;
        const filteredResults = results.filter(r => r.similarity >= SIMILARITY_THRESHOLD);
        ragChunkCount = filteredResults.length;
        ragMaxSimilarity = filteredResults.length > 0 ? Math.max(...filteredResults.map(r => r.similarity)) : 0;
        ragSpan.setAttribute('results_count', ragChunkCount);
        ragSpan.setAttribute('max_similarity', ragMaxSimilarity);

        if (filteredResults.length > 0) {
          const contextText = filteredResults.map((r, i) => `[内部文档片段 ${i + 1} | 相关度 ${(r.similarity * 100).toFixed(1)}%]:\n${r.text}`).join('\n\n');

          enhancedSystemPrompt = `${enhancedSystemPrompt}\n\n====================\n【检索到的相关背景资料】\n请务必优先基于以下我为你检索到的内部知识库资料来直接回答用户的问题。如果是询问外部常规问题不受此限制：\n\n${contextText}\n====================`;
        }
      } catch (e) {
        // RAG 检索失败时降级继续（无 RAG context），记录日志但不中断请求
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[RAG] 检索失败，降级继续:', errMsg);
        ragSpan.setAttribute('error', errMsg);
      } finally {
        ragSpan.end();
      }
    }

    // ========= 获取并合并 MCP 工具 =========
    let allTools = { ...myTools };
    try {
      // 使用缓存的 MCP 工具，避免每次请求都重新连接
      if (!cachedMcpTools) {
        const transportType = getMcpTransportType();
        cachedMcpTools = await getMcpToolsAsAiSdk({ transportType });
      }
      allTools = { ...allTools, ...cachedMcpTools };
    } catch {
      // 加载失败时使用基础工具继续
      cachedMcpTools = null; // 重置缓存，下次请求重试
    }

    const result = streamText({
      model: modelInstance,
      messages: modelMessages,
      system: enhancedSystemPrompt,
      tools: allTools,
      stopWhen: stepCountIs(5),
      experimental_transform: smoothStream({
        chunking: chineseSegmenter,
        delayInMs: null, // 禁用延迟，让数据自然流动
      }),
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'chat',
        metadata: {
          sessionId: body.sessionId ?? '',
          userId: body.userId ?? '',
          ragChunkCount,
          ragMaxSimilarity,
          toolCount: Object.keys(allTools).length,
          modelProvider: isAnthropic ? 'anthropic' : 'google',
          conversationId: convId,
        },
      },
      onFinish: async ({ response, content }) => {
        // 持久化 assistant 回复
        const assistantText = response.messages
          .filter((m) => m.role === 'assistant')
          .map((m) => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
          .join('\n');

        if (assistantText && convId) {
          await addMessage({
            conversationId: convId,
            role: 'assistant',
            content: assistantText,
            parts: content.length > 0 ? content : undefined,
          });
        }
      },
    });

    // 确保流式响应结束后将追踪数据刷出到 Langfuse
    after(async () => {
      await langfuseSpanProcessor.forceFlush();
    });

    // 在流式响应中注入 conversationId（通过 messageMetadata 传给前端）
    const response = result.toUIMessageStreamResponse({
      messageMetadata: () => ({ conversationId: convId }),
    });
    response.headers.set('X-Conversation-Id', convId);
    return response;
  },
  { schema: chatRequestSchema },
);
