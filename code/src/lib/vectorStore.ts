// 本地向量存储 (Local Vector Store) 模块
// 在 Next.js App Router 开发模式下，不同的 API 路由可能运行在独立的沙箱进程或 Worker 中，
// 导致真正的内存单例（globalThis）无法被共享。
// 为此，这里将”内存”直接持久化为一个本地的 JSON 文件，100% 避免隔离问题！

import fs from 'fs';
import path from 'path';

export interface DocumentChunk {
  id: string;
  text: string;
  vector: number[];
}

const STORE_PATH = path.join(process.cwd(), '.vector_store.json');

// ========== 共享文件 I/O 工具（供 vectorStore-langchain.ts 复用）==========

export function readJsonFile<T>(filePath: string): T[] {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as T[];
    }
  } catch (e) {
    console.error(`读取文件失败 (${filePath}):`, e);
  }
  return [];
}

export function writeJsonFile<T>(filePath: string, data: T[]): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ========== AI SDK 向量存储操作 ==========

/**
 * 读取本地存储
 */
export function readStore(): DocumentChunk[] {
  return readJsonFile<DocumentChunk>(STORE_PATH);
}

/**
 * 助手函数：写回本地存储
 */
function writeStore(store: DocumentChunk[]): void {
  writeJsonFile(STORE_PATH, store);
}

/**
 * 添加分块及其向量到本地临时库中
 */
export function addChunks(chunks: DocumentChunk[]): void {
  const store = readStore();
  store.push(...chunks);
  writeStore(store);
}

/**
 * 清空整个知识库
 */
export function clearStore(): void {
  writeStore([]);
}

/**
 * 计算余弦相似度 (Cosine Similarity)
 * 核心数学原理：评估两个高维向量之间的夹角，夹角越小，相似度越接近 1
 */
function cosineSimilarity(A: number[], B: number[]): number {
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
export function searchStore(queryVector: number[], topK = 3): { text: string; similarity: number }[] {
  const store = readStore();
  if (store.length === 0) return [];

  const results = store.map(chunk => ({
    text: chunk.text,
    similarity: cosineSimilarity(queryVector, chunk.vector),
  }));

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}