// OpenTelemetry 初始化
// 必须在其他模块之前导入，确保追踪生效

import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

export { sdk };
