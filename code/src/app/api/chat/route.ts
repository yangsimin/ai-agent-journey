import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, modelId } = body;

  // 优先使用前端传入的 modelId，否则从环境变量读取，最后 fallback 到默认
  const modelName = modelId || process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-2.0-flash';

  // 使用官方工具函数将 UIMessage[] 转换为 ModelMessage[]
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google(modelName),
    messages: modelMessages,
    system: '你是一个乐于助人的 AI 助手，精通各种编程开发问题。',
  });

  return result.toUIMessageStreamResponse();
}
