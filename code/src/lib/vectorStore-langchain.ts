// LangChain 向量存储模块
// 与 vectorStore.ts 功能等价，使用 LangChain MemoryVectorStore
// 对比学习：自写 JSON + 余弦相似度 vs LangChain MemoryVectorStore 标准化 API
//
// 注意：MemoryVectorStore 是纯内存的，不持久化
// 为了解决 Next.js 开发模式下 API route 内存隔离问题，
// 这里将 Document 数据持久化到 JSON 文件，每次读取时重建 MemoryVectorStore

import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import fs from 'fs';
import path from 'path';
import { getLcEmbeddings } from './embeddings-langchain';

const STORE_PATH = path.join(process.cwd(), '.lc_vector_store.json');

interface StoredDoc {
  pageContent: string;
  metadata: Record<string, unknown>;
}

/**
 * 从 JSON 文件读取持久化的 Document 数据
 */
function readStore(): StoredDoc[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取 LC 向量数据库失败:', e);
  }
  return [];
}

/**
 * 写回持久化
 */
function writeStore(docs: StoredDoc[]) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(docs, null, 2), 'utf-8');
}

/**
 * 获取或重建 MemoryVectorStore 单例
 * 每次调用都会从 JSON 文件读取数据并重建，确保跨 route 一致性
 */
export async function getLcVectorStore(): Promise<MemoryVectorStore> {
  const embeddings = getLcEmbeddings();
  const storedDocs = readStore();

  if (storedDocs.length === 0) {
    // 空库，直接返回新的 MemoryVectorStore
    return new MemoryVectorStore(embeddings);
  }

  // 从持久化数据重建
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
  // 先从持久化读取已有数据
  const storedDocs = readStore();

  // 合并新文档
  const newDocs: StoredDoc[] = docs.map(d => ({
    pageContent: d.pageContent,
    metadata: d.metadata ?? {},
  }));
  storedDocs.push(...newDocs);

  // 持久化
  writeStore(storedDocs);
}

/**
 * 清空向量存储
 */
export function clearLcStore(): void {
  writeStore([]);
}
