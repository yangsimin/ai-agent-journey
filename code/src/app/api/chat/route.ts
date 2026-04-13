// 必须在其他导入之前初始化 OpenTelemetry（用于 Langfuse 追踪）
import '@/instrumentation';

import { google } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, stepCountIs, smoothStream } from 'ai';
import { after } from 'next/server';
import { searchStore, readStore } from '@/lib/vectorStore';
import { embedText } from '@/lib/embeddings';
import { myTools } from '@/lib/tools';
import { getMcpToolsAsAiSdk, convertMcpToolToAiSdk, type TransportType } from '@/lib/mcp-client';
import { langfuseSpanProcessor } from '@/instrumentation';

export const maxDuration = 30;

// 中文分词器（用于 smoothStream 的平滑输出）
const chineseSegmenter = new Intl.Segmenter('zh', { granularity: 'word' });

// 缓存 MCP 工具（避免每个请求都重新连接）
let cachedMcpTools: Record<string, ReturnType<typeof convertMcpToolToAiSdk>> | null = null;

// MCP 传输方式：默认 stdio，可通过环境变量 MCP_TRANSPORT=http 切换
const getMcpTransportType = (): TransportType => {
  return process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';
};

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, modelId, systemPrompt } = body;

  // 前端 modelId 优先，其次环境变量 DEFAULT_MODEL，最后 fallback
  const modelName = modelId || process.env.DEFAULT_MODEL || process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-2.0-flash';
  
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

  // 使用官方工具函数将 UIMessage[] 转换为 ModelMessage[]
  const modelMessages = await convertToModelMessages(messages);

  let enhancedSystemPrompt = systemPrompt
    || '你是一个功能强大的 AI 助手。你可以帮助用户创建待办事项（提醒、任务、计划），也可以查询城市天气，还可以操作文件系统（读取、写入、列出目录、搜索文件等）。请根据用户需求主动调用相应的工具。';
  
  // 注入当前时间，帮助模型理解“明天”、“下周”等相对时间概念
  const currentDate = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  enhancedSystemPrompt += `\n\n[系统提示：当前北京时间是 ${currentDate}]`;

  // 兼容直接传递的 content 和 Vercel AI SDK 3.x 传递的 parts 数组
  const lastMsg = messages[messages.length - 1];
  const latestMessage = lastMsg?.content || (lastMsg?.parts?.filter((p: { type: string; text?: string }) => p.type === 'text').map((p: { type: string; text?: string }) => p.text).join('\n')) || '';

  // ========= RAG 核心检索逻辑 =========
  // 先检查知识库是否为空，避免空知识库时无意义的 embedding API 调用
  const knowledgeBase = readStore();
  
  if (latestMessage && knowledgeBase.length > 0) {
    try {
      // 1. 将用户的提问向量化（使用环境变量配置的 embedding 提供商）
      const embedding = await embedText(latestMessage);

      // 2. 去内存库中查询最相关的 Top-10 片段（适当放宽召回数量，防止特定章节号等关键词在语义向量中相似度偏低而被漏掉）
      const results = searchStore(embedding, 10);

      // 3. 过滤低相似度片段（低于阈值的片段与问题无关，拼入反而干扰模型）
      const SIMILARITY_THRESHOLD = 0.5;
      const filteredResults = results.filter(r => r.similarity >= SIMILARITY_THRESHOLD);

      if (filteredResults.length > 0) {
        const contextText = filteredResults.map((r, i) => `[内部文档片段 ${i + 1} | 相关度 ${(r.similarity * 100).toFixed(1)}%]:\n${r.text}`).join('\n\n');
        
        enhancedSystemPrompt = `${enhancedSystemPrompt}\n\n====================\n【检索到的相关背景资料】\n请务必优先基于以下我为你检索到的内部知识库资料来直接回答用户的问题。如果是询问外部常规问题不受此限制：\n\n${contextText}\n====================`;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('[RAG] 检索失败:', errMsg);
      return Response.json({ error: `知识库检索失败: ${errMsg}` }, { status: 503 });
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
        sessionId: body.sessionId,
        userId: body.userId,
      },
    },
  });

  // 确保流式响应结束后将追踪数据刷出到 Langfuse
  after(async () => {
    await langfuseSpanProcessor.forceFlush();
  });

  return result.toUIMessageStreamResponse();
}
