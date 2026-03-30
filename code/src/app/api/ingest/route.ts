import { NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { embedTexts } from '@/lib/embeddings';
import { addChunks, clearStore, DocumentChunk } from '@/lib/vectorStore';
import { addDocumentsToStore, clearLcStore } from '@/lib/vectorStore-langchain';

export const maxDuration = 60; // 文本切分和求 API 获取向量的过程可能稍长

export async function POST(req: Request) {
  try {
    const { text, filename } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // 1. 初始化分块器
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
    });

    // 2. 将长文本切成碎块 (Chunks)
    const chunks = await splitter.createDocuments([text]);
    const chunkTexts = chunks.map(c => c.pageContent);

    if (chunkTexts.length === 0) {
      return NextResponse.json({ error: 'Text too short or failed to split' }, { status: 400 });
    }

    // 3. 调用 Vercel AI SDK embedding 模型获取向量
    const embeddings = await embedTexts(chunkTexts);

    // 4. 写入 Vercel AI SDK 版向量存储
    clearStore();
    const documentChunks: DocumentChunk[] = chunkTexts.map((content, i) => ({
      id: `${filename || 'doc'}-chunk-${i}`,
      text: content,
      vector: embeddings[i],
    }));
    addChunks(documentChunks);

    // 5. 同步写入 LangChain 版向量存储（双写，两套后端可随时切换）
    clearLcStore();
    const lcDocs: Document[] = chunkTexts.map((content, i) => new Document({
      pageContent: content,
      metadata: { source: filename || 'doc', chunkIndex: i },
    }));
    await addDocumentsToStore(lcDocs);

    return NextResponse.json({
      success: true,
      message: `Successfully ingested ${documentChunks.length} chunks into both vector stores.`,
      chunkCount: documentChunks.length
    });
  } catch (error: unknown) {
    console.error('Ingestion error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
