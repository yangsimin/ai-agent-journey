// LangChain Embedding 模块
// 与 embeddings.ts 功能等价，使用 LangChain 的 Embeddings 接口
// 对比学习：Vercel AI SDK embed()/embedMany() vs LangChain GoogleGenerativeAIEmbeddings

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

// 全局单例
let embeddingsInstance: GoogleGenerativeAIEmbeddings | null = null;

export function getLcEmbeddings(): GoogleGenerativeAIEmbeddings {
  if (!embeddingsInstance) {
    embeddingsInstance = new GoogleGenerativeAIEmbeddings({
      model: 'text-embedding-004',
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
  }
  return embeddingsInstance;
}
