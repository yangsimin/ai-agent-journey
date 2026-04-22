// Langfuse 集成模块
// 为 AI SDK 和 LangChain 提供可观测性追踪
// 文档: https://langfuse.com/docs/integrations/frameworks/langchain

import { CallbackHandler } from '@langfuse/langchain';

export function createLangfuseCallbacks(options?: {
  sessionId?: string;
  userId?: string;
  tags?: string[];
  version?: string;
  traceMetadata?: Record<string, unknown>;
}): CallbackHandler[] {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.warn('[Langfuse] 未配置 LANGFUSE_PUBLIC_KEY 或 LANGFUSE_SECRET_KEY，跳过追踪');
    return [];
  }
  return [new CallbackHandler(options)];
}
