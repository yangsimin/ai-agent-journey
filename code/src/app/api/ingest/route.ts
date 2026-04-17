import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { embedTexts } from '@/lib/embeddings';
import { addChunks, clearStore, DocumentChunk } from '@/lib/vectorStore';
import { addDocumentsToStore, clearLcStore } from '@/lib/vectorStore-langchain';
import { withApiHandler } from '@/lib/api-utils';
import { ingestRequestSchema } from '@/lib/api-schemas';
import { trace } from '@opentelemetry/api';

export const maxDuration = 60; // 文本切分和求 API 获取向量的过程可能稍长

export const POST = withApiHandler(
  async (req, body) => {
    const { text, filename } = body;

    const tracer = trace.getTracer('ai-agent-journey');
    const ingestSpan = tracer.startSpan('ingest.document');
    ingestSpan.setAttribute('filename', filename || 'unknown');
    ingestSpan.setAttribute('text_length', text.length);

    // 1. 初始化分块器
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
    });

    // 2. 将长文本切成碎块 (Chunks)
    const chunks = await splitter.createDocuments([text]);
    const chunkTexts = chunks.map(c => c.pageContent);

    if (chunkTexts.length === 0) {
      ingestSpan.setAttribute('error', 'no_chunks');
      ingestSpan.end();
      return Response.json(
        { error: { message: 'Text too short or failed to split', code: 'VALIDATION_ERROR' } },
        { status: 400 },
      );
    }

    // 3. 调用 Vercel AI SDK embedding 模型获取向量
    const embedSpan = tracer.startSpan('ingest.embedding');
    embedSpan.setAttribute('chunk_count', chunkTexts.length);
    const embeddings = await embedTexts(chunkTexts);
    embedSpan.end();

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

    ingestSpan.setAttribute('chunk_count', documentChunks.length);
    ingestSpan.end();

    return Response.json({
      success: true,
      message: `Successfully ingested ${documentChunks.length} chunks into both vector stores.`,
      chunkCount: documentChunks.length,
    });
  },
  { schema: ingestRequestSchema, timeout: 55000 },
);
