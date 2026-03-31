// LangChain 版对话 API
// 与 api/chat/route.ts 功能等价，使用 LangChain.js 替代 Vercel AI SDK 的后端逻辑
// 前端 useChat hook 完全不变，通过 @ai-sdk/langchain 适配层桥接

import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { createUIMessageStreamResponse } from 'ai';
import { createAgent, dynamicSystemPromptMiddleware } from 'langchain';
import { getModel } from '@/lib/llm';
import { lcTools } from '@/lib/tools-langchain';
import { getLcVectorStore, readLcStore } from '@/lib/vectorStore-langchain';
import { getMcpToolsAsLangChain, convertMcpToolToLangChain, type TransportType } from '@/lib/mcp-client';

// 缓存 MCP 工具（避免每个请求都重新连接）
let cachedLcMcpTools: ReturnType<typeof convertMcpToolToLangChain>[] | null = null;

const getMcpTransportType = (): TransportType =>
  process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, modelId, systemPrompt } = body;

  // 构建 system prompt 基础部分
  const baseSystemPrompt = systemPrompt
    || '你是一个功能强大的 AI 助手。你可以帮助用户创建待办事项（提醒、任务、计划），也可以查询城市天气，还可以操作文件系统（读取、写入、列出目录、搜索文件等）。请根据用户需求主动调用相应的工具。';

  // 注入当前时间
  const currentDate = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const timePrompt = `[系统提示：当前北京时间是 ${currentDate}]`;

  // ========= RAG 检索（提前执行，middleware 延迟触发无法在 stream 前中断） =========
  const lastMsg = messages[messages.length - 1];
  const query = lastMsg?.content || (lastMsg?.parts?.filter((p: { type: string; text?: string }) => p.type === 'text').map((p: { type: string; text?: string }) => p.text).join('\n')) || '';

  // 先检查知识库是否为空，避免空知识库时无意义的 embedding API 调用
  const knowledgeBase = readLcStore();

  let ragContext = '';
  if (query && knowledgeBase.length > 0) {
    try {
      const vectorStore = await getLcVectorStore();
      const retriever = vectorStore.asRetriever({ k: 10 });
      const docs = await retriever.invoke(query);

      if (docs.length > 0) {
        const contextText = docs
          .map((doc, i) => `[内部文档片段 ${i + 1}]:\n${doc.pageContent}`)
          .join('\n\n');

        ragContext = `
====================
【检索到的相关背景资料】
请务必优先基于以下我为你检索到的内部知识库资料来直接回答用户的问题。如果是询问外部常规问题不受此限制：

${contextText}
====================`;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('[RAG] 检索失败:', errMsg);
      return Response.json({ error: `知识库检索失败: ${errMsg}` }, { status: 503 });
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
  const langchainMessages = await toBaseMessages(messages);

  // 使用 Agent 的 stream 方法
  const stream = await agent.stream(
    { messages: langchainMessages },
    { streamMode: ['values', 'messages'] },
  );

  // 通过适配层转换为 AI SDK 的 UIMessageStream
  return createUIMessageStreamResponse({
    stream: toUIMessageStream(stream),
  });
}
