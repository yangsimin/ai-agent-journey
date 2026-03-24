import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { searchStore } from '@/lib/vectorStore';
import { embedText } from '@/lib/embeddings';
import { myTools } from '@/lib/tools';

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, modelId, systemPrompt } = body;

  // 优先使用前端传入的 modelId，否则从环境变量读取，最后 fallback 到默认
  const modelName = modelId || process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-2.0-flash';

  // 使用官方工具函数将 UIMessage[] 转换为 ModelMessage[]
  const modelMessages = await convertToModelMessages(messages);

  let enhancedSystemPrompt = systemPrompt
    || '你是一个功能强大的 AI 助手。你可以帮助用户创建待办事项（提醒、任务、计划），也可以查询城市天气。请根据用户需求主动调用相应的工具。';
  
  // 兼容直接传递的 content 和 Vercel AI SDK 3.x 传递的 parts 数组
  const lastMsg = messages[messages.length - 1];
  const latestMessage = lastMsg?.content || (lastMsg?.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')) || '';

  // ========= RAG 核心检索逻辑 =========
  if (latestMessage) {
    try {
      // 1. 将用户的提问向量化（使用环境变量配置的 embedding 提供商）
      const embedding = await embedText(latestMessage);

      // 2. 去内存库中查询最相关的 Top-10 片段（适当放宽召回数量，防止特定章节号等关键词在语义向量中相似度偏低而被漏掉）
      const results = searchStore(embedding, 10);
      
      console.log(`[RAG DEBUG] 检索结果:`, results.map(r => ({ sim: r.similarity, text: r.text.substring(0, 50) + '...' })));

      // 3. 拦截有效片段（不过滤，确保能命中相关章节标题等内容）
      if (results.length > 0) {
        const contextText = results.map((r, i) => `[内部文档片段 ${i + 1} | 相关度 ${(r.similarity * 100).toFixed(1)}%]:\n${r.text}`).join('\n\n');
        
        enhancedSystemPrompt = `${enhancedSystemPrompt}\n\n====================\n【检索到的相关背景资料】\n请务必优先基于以下我为你检索到的内部知识库资料来直接回答用户的问题。如果是询问外部常规问题不受此限制：\n\n${contextText}\n====================`;
      }
    } catch (e) {
      console.warn("RAG retrieval failed or store is empty, skipping.", e);
    }
  }

  const result = streamText({
    model: google(modelName),
    messages: modelMessages,
    system: enhancedSystemPrompt,
    tools: myTools,
    stopWhen: stepCountIs(5),
    onStepFinish({ stepNumber, toolCalls }) {
      if (toolCalls.length > 0) {
        console.log(`[Tool Call] Step ${stepNumber}:`, toolCalls.map(t => `${t.toolName}(${JSON.stringify(t.input)})`));
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
