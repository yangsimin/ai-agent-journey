// LangChain Embedding 模块
// 与 embeddings.ts 功能等价，使用 LangChain 的 Embeddings 接口
// 对比学习：Vercel AI SDK embed()/embedMany() vs LangChain Embeddings
//
// 支持根据环境变量自动选择：
//   LM_STUDIO_BASE_URL + LM_STUDIO_EMBEDDING_MODEL → 本地 LM Studio
//   否则 → Google text-embedding-004

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { OpenAIEmbeddings } from '@langchain/openai';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { getLmStudioConfig } from './embeddings';

let embeddingsInstance: EmbeddingsInterface | null = null;

function createEmbeddings(): EmbeddingsInterface {
  const lmStudio = getLmStudioConfig();
  if (lmStudio) {
    return new OpenAIEmbeddings({
      model: lmStudio.model,
      configuration: { baseURL: lmStudio.baseURL },
      apiKey: 'lm-studio', // LM Studio 不校验 key
    });
  }

  return new GoogleGenerativeAIEmbeddings({
    model: 'text-embedding-004',
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
}

export function getLcEmbeddings(): EmbeddingsInterface {
  if (!embeddingsInstance) {
    embeddingsInstance = createEmbeddings();
  }
  return embeddingsInstance;
}
