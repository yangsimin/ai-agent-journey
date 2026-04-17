// LangChain 模型初始化模块
// 统一接口动态选择 Google Gemini / Anthropic Claude 模型
// 缓存模型实例，避免每次调用都创建新对象

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

const modelCache = new Map<string, BaseChatModel>();

/**
 * 根据模型名称获取 LangChain ChatModel 实例（带缓存）
 * - 模型名包含 "claude" 或环境变量 DEFAULT_PROVIDER=anthropic → Anthropic
 * - 否则 → Google Gemini
 */
export function getModel(modelId?: string): BaseChatModel {
  const modelName = modelId || process.env.DEFAULT_MODEL || process.env.GOOGLE_GENERATIVE_AI_MODEL;
  if (!modelName) {
    throw new Error('No model configured. Set DEFAULT_MODEL or GOOGLE_GENERATIVE_AI_MODEL env var.');
  }
  const cached = modelCache.get(modelName);
  if (cached) return cached;

  const isAnthropic = process.env.DEFAULT_PROVIDER === 'anthropic' || modelName.includes('claude');

  let model: BaseChatModel;
  if (isAnthropic) {
    // LangChain ChatAnthropic 会追加 /v1/messages，所以 baseURL 不应包含 /v1
    let anthropicBaseURL = process.env.ANTHROPIC_BASE_URL;
    if (anthropicBaseURL?.endsWith('/v1')) {
      anthropicBaseURL = anthropicBaseURL.slice(0, -3);
    }

    model = new ChatAnthropic({
      model: modelName,
      apiKey: process.env.ANTHROPIC_API_KEY,
      // 支持自定义 Anthropic API URL（如公司内部代理/网关）
      ...(anthropicBaseURL && {
        clientOptions: { baseURL: anthropicBaseURL },
      }),
    });
  } else {
    model = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
  }

  modelCache.set(modelName, model);
  return model;
}
