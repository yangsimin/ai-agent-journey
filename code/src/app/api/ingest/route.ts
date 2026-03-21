import { NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { embedTexts } from '@/lib/embeddings';
import { addChunks, clearStore, DocumentChunk } from '@/lib/vectorStore';

export const maxDuration = 60; // 文本切分和求 API 获取向量的过程可能稍长

export async function POST(req: Request) {
  try {
    const { text, filename } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // 1. 初始化分块器
    // 假设是普通文本或者 Markdown，按字符层级进行智能拆分
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

    // 3. 调用 embedding 模型获取向量（由环境变量决定使用 LM Studio 还是 Google）
    const embeddings = await embedTexts(chunkTexts);

    // 4. 清理旧库并装载新知识（由于我们做的是随用随抛的学习版，所以每次上传都覆盖旧的）
    clearStore();
    
    const documentChunks: DocumentChunk[] = chunkTexts.map((content, i) => ({
      id: `${filename || 'doc'}-chunk-${i}`,
      text: content,
      vector: embeddings[i],
    }));

    // 压入内存数组
    addChunks(documentChunks);

    return NextResponse.json({
      success: true,
      message: `Successfully ingested ${documentChunks.length} chunks into memory vector store.`,
      chunkCount: documentChunks.length
    });
  } catch (error: any) {
    console.error('Ingestion error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
