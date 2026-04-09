// Langfuse 集成模块
// 为 LangChain 提供可观测性追踪
// 文档: https://langfuse.com/docs/integrations/frameworks/langchain

import { CallbackHandler } from '@langfuse/langchain';

/**
 * 检查 Langfuse 是否已配置
 */
export function isLangfuseConfigured(): boolean {
  return !!(
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_SECRET_KEY
  );
}

/**
 * 获取 Langfuse CallbackHandler 实例
 * 用于 LangChain 模型调用的追踪
 *
 * 注意：publicKey/secretKey/baseUrl 通过环境变量自动读取
 * 需要配置: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL
 *
 * @param options 可选配置
 * @param options.sessionId 会话 ID，用于关联同一会话的多轮对话
 * @param options.userId 用户 ID，用于标识用户
 * @param options.tags 标签数组
 * @param options.version 版本标识
 * @param options.traceMetadata 额外的元数据
 */
export function getLangfuseHandler(options?: {
  sessionId?: string;
  userId?: string;
  tags?: string[];
  version?: string;
  traceMetadata?: Record<string, unknown>;
}): CallbackHandler | undefined {
  if (!isLangfuseConfigured()) {
    console.warn('[Langfuse] 未配置 LANGFUSE_PUBLIC_KEY 或 LANGFUSE_SECRET_KEY，跳过追踪');
    return undefined;
  }

  return new CallbackHandler(options);
}

/**
 * 创建 Langfuse 追踪配置
 * 用于 Agent.invoke() 或 Agent.stream() 的 callbacks 参数
 */
export function createLangfuseCallbacks(options?: {
  sessionId?: string;
  userId?: string;
  tags?: string[];
  version?: string;
  traceMetadata?: Record<string, unknown>;
}): { callbacks: CallbackHandler[] } | Record<string, never> {
  const handler = getLangfuseHandler(options);
  if (!handler) {
    return {};
  }
  return { callbacks: [handler] };
}
