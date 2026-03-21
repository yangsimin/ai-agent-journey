// 本地向量存储 (Local Vector Store) 模块
// 在 Next.js App Router 开发模式下，不同的 API 路由可能运行在独立的沙箱进程或 Worker 中，
// 导致真正的内存单例（globalThis）无法被共享。
// 为此，这里将“内存”直接持久化为一个本地的 JSON 文件，100% 避免隔离问题！

import fs from 'fs';
import path from 'path';

export interface DocumentChunk {
  id: string;
  text: string;
  vector: number[];
}

const STORE_PATH = path.join(process.cwd(), '.vector_store.json');

/**
 * 助手函数：读取本地存储
 */
export function readStore(): DocumentChunk[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取向量数据库失败:', e);
  }
  return [];
}

/**
 * 助手函数：写回本地存储
 */
function writeStore(store: DocumentChunk[]) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * 添加分块及其向量到本地临时库中
 */
export function addChunks(chunks: DocumentChunk[]) {
  const store = readStore();
  store.push(...chunks);
  writeStore(store);
}

/**
 * 清空整个知识库
 */
export function clearStore() {
  writeStore([]);
}

/**
 * 计算余弦相似度 (Cosine Similarity)
 * 核心数学原理：评估两个高维向量之间的夹角，夹角越小，相似度越接近 1
 */
function cosineSimilarity(A: number[], B: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 遍历本地库，检索与查询向量最相似的 Top-K 文档块
 */
export function searchStore(queryVector: number[], topK = 3) {
  const store = readStore();
  if (store.length === 0) return [];
  
  const results = store.map(chunk => ({
    text: chunk.text,
    similarity: cosineSimilarity(queryVector, chunk.vector)
  }));
  
  // 按照相似度降序排序
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

