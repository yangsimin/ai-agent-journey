// LangChain 版对话 API
// 与 api/chat/route.ts 功能等价，使用 LangChain.js 替代 Vercel AI SDK 的后端逻辑
// 前端 useChat hook 完全不变，通过 @ai-sdk/langchain 适配层桥接

import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { createUIMessageStreamResponse } from 'ai';
import { createAgent, dynamicSystemPromptMiddleware } from 'langchain';
import { getModel } from '@/lib/llm';
import { lcTools } from '@/lib/tools-langchain';
import { getLcVectorStore } from '@/lib/vectorStore-langchain';

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, modelId, systemPrompt } = body;

  // 获取 LangChain 模型实例
  const model = getModel(modelId);

  // 构建 system prompt 基础部分
  const baseSystemPrompt = systemPrompt
    || '你是一个功能强大的 AI 助手。你可以帮助用户创建待办事项（提醒、任务、计划），也可以查询城市天气。请根据用户需求主动调用相应的工具。';

  // 注入当前时间
  const currentDate = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const timePrompt = `[系统提示：当前北京时间是 ${currentDate}]`;

  // 合并中间件：基础人设 + 时间 + RAG 上下文，用一个 dynamicSystemPromptMiddleware 完成
  // createAgent 的 systemPrompt 参数内部也会创建同名中间件，不能同时用，所以统一在这里处理
  const systemMiddleware = dynamicSystemPromptMiddleware(async (state) => {
    // 取用户最后一条消息作为 RAG 查询
    const lastMessage = state.messages[state.messages.length - 1];
    const query = typeof lastMessage.content === 'string' ? lastMessage.content : '';

    let ragContext = '';
    if (query) {
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
        console.warn('[RAG] 检索失败或知识库为空，跳过 RAG 注入。', e);
      }
    }

    return baseSystemPrompt + '\n\n' + timePrompt + ragContext;
  });

  // 创建 LangChain Agent — 对比 Vercel AI SDK 的 streamText + tools + maxSteps
  const agent = createAgent({
    model,
    tools: lcTools,
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
