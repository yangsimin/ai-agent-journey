// OpenTelemetry 初始化（Langfuse 集成）
// 必须在其他模块之前导入，确保追踪生效
// 同时服务于 Vercel AI SDK 和 LangChain 后端

import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

// 导出 langfuseSpanProcessor，供 API 路由在流式响应后 forceFlush
export const langfuseSpanProcessor = new LangfuseSpanProcessor();

const tracerProvider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor],
});

tracerProvider.register();
