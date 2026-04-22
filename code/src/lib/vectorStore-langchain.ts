// LangChain 向量存储模块
// 与 vectorStore.ts 功能等价，使用 LangChain MemoryVectorStore
// 对比学习：自写 JSON + 余弦相似度 vs LangChain MemoryVectorStore 标准化 API
//
// 注意：MemoryVectorStore 是纯内存的，不持久化
// 为了解决 Next.js 开发模式下 API route 内存隔离问题，
// 这里将 Document 数据持久化到 JSON 文件，每次读取时重建 MemoryVectorStore

import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import path from 'path';
import { readJsonFile, writeJsonFile } from './vectorStore';
import { getLcEmbeddings } from './embeddings-langchain';

const STORE_PATH = path.join(process.cwd(), '.lc_vector_store.json');

interface StoredDoc {
  pageContent: string;
  metadata: Record<string, unknown>;
}

/**
 * 从 JSON 文件读取持久化的 Document 数据
 */
export function readLcStore(): StoredDoc[] {
  return readJsonFile<StoredDoc>(STORE_PATH);
}

/**
 * 获取或重建 MemoryVectorStore 单例
 * 每次调用都会从 JSON 文件读取数据并重建，确保跨 route 一致性
 */
export async function getLcVectorStore(): Promise<MemoryVectorStore> {
  const embeddings = getLcEmbeddings();
  const storedDocs = readLcStore();

  if (storedDocs.length === 0) {
    return new MemoryVectorStore(embeddings);
  }

  const docs: Document[] = storedDocs.map(d => new Document({
    pageContent: d.pageContent,
    metadata: d.metadata,
  }));

  return await MemoryVectorStore.fromDocuments(docs, embeddings);
}

/**
 * 添加文档到向量存储（同时持久化到 JSON 文件）
 */
export async function addDocumentsToStore(docs: Document[]): Promise<void> {
  const storedDocs = readLcStore();

  const newDocs: StoredDoc[] = docs.map(d => ({
    pageContent: d.pageContent,
    metadata: d.metadata ?? {},
  }));
  storedDocs.push(...newDocs);

  writeJsonFile(STORE_PATH, storedDocs);
}

/**
 * 清空向量存储
 */
export function clearLcStore(): void {
  writeJsonFile<StoredDoc>(STORE_PATH, []);
}
