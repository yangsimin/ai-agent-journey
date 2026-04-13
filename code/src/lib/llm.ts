// LangChain 模型初始化模块
// 统一接口动态选择 Google Gemini / Anthropic Claude 模型

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * 根据模型名称获取 LangChain ChatModel 实例
 * - 模型名包含 "claude" 或环境变量 DEFAULT_PROVIDER=anthropic → Anthropic
 * - 否则 → Google Gemini
 */
export function getModel(modelId?: string): BaseChatModel {
  const modelName = modelId || process.env.DEFAULT_MODEL || process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-2.5-flash';
  const isAnthropic = process.env.DEFAULT_PROVIDER === 'anthropic' || modelName.includes('claude');

  if (isAnthropic) {
    // LangChain ChatAnthropic 会追加 /v1/messages，所以 baseURL 不应包含 /v1
    let anthropicBaseURL = process.env.ANTHROPIC_BASE_URL;
    if (anthropicBaseURL?.endsWith('/v1')) {
      anthropicBaseURL = anthropicBaseURL.slice(0, -3);
    }

    return new ChatAnthropic({
      model: modelName,
      apiKey: process.env.ANTHROPIC_API_KEY,
      // 支持自定义 Anthropic API URL（如公司内部代理/网关）
      ...(anthropicBaseURL && {
        clientOptions: { baseURL: anthropicBaseURL },
      }),
    });
  }

  return new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
}
