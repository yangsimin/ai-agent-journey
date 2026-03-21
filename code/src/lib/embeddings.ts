// Embedding 工具模块：根据环境变量自动选择向量化提供商
// 
// 如果配置了 LM_STUDIO_BASE_URL 和 LM_STUDIO_EMBEDDING_MODEL，则使用本地 LM Studio
// 否则回退到 Google text-embedding-004

import { embed, embedMany } from 'ai';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

function getEmbeddingModel() {
  const lmStudioBaseUrl = process.env.LM_STUDIO_BASE_URL;
  const lmStudioModel = process.env.LM_STUDIO_EMBEDDING_MODEL;

  if (lmStudioBaseUrl && lmStudioModel) {
    // 使用 LM Studio 兼容 OpenAI 的本地 embedding 端点
    const lmStudio = createOpenAI({
      baseURL: lmStudioBaseUrl,
      apiKey: 'lm-studio', // LM Studio 不校验 key，随便填一个非空字符串
    });
    return lmStudio.textEmbeddingModel(lmStudioModel);
  }

  // 回退到 Google text-embedding-004（768 维）
  return google.textEmbeddingModel('text-embedding-004');
}

/**
 * 对单条文本生成 Embedding 向量
 */
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: text,
  });
  return embedding;
}

/**
 * 对多条文本批量生成 Embedding 向量（用于文档摄入）
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: getEmbeddingModel(),
    values: texts,
  });
  return embeddings;
}
