import { Injectable, Logger } from '@nestjs/common';
import { DocumentParserService } from './document-parser.service';
import { VectorStoreService } from './vector-store.service';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { RetrievalService } from '../retrieval/retrieval.service';

export interface CustomerQuestion {
  question: string;
  tenantId: string;
  knowledgeBaseId?: string;
  conversationContext?: string;
}

export interface RAGAnswer {
  answer: string;
  confidence: number;
  answerStatus: 'answered' | 'cautious' | 'low_confidence' | 'no_answer' | 'transferred_to_human';
  sources: Array<{
    fileName?: string;
    sourceTitle?: string;
    pageNumber?: number;
    tableNumber?: number;
    contentType?: string;
    excerpt: string;
  }>;
  graphContext?: string;
}

@Injectable()
export class CustomerServiceRAGService {
  private readonly logger = new Logger(CustomerServiceRAGService.name);

  constructor(
    private documentParserService: DocumentParserService,
    private vectorStoreService: VectorStoreService,
    private knowledgeGraphService: KnowledgeGraphService,
    private retrievalService: RetrievalService,
  ) {}

  /**
   * Answer a customer question using RAG-enhanced retrieval.
   * This is the main entry point for the customer service flow.
   */
  async answerQuestion(question: CustomerQuestion): Promise<RAGAnswer> {
    const { tenantId, question: userQuestion, knowledgeBaseId } = question;

    // Step 1: Enhanced retrieval with rerank
    const retrievalOutput = await this.retrievalService.retrieveWithRerank(
      tenantId,
      userQuestion,
      5,
    );

    // Step 2: Try graph-enhanced retrieval (if available)
    let graphContext: string | undefined;
    try {
      graphContext = (await this.knowledgeGraphService.buildGraphContext(tenantId, userQuestion)) || undefined;
    } catch (e: any) {
      this.logger.warn(`Graph context failed: ${e.message}`);
    }

    // Step 3: Build source citations
    const sources = retrievalOutput.results.map((r) => ({
      fileName: r.sourceTitle || undefined,
      sourceTitle: r.sourceTitle || undefined,
      pageNumber: r.pageNumber || undefined,
      tableNumber: (r.metadata as any)?.tableNumber,
      contentType: r.contentType,
      excerpt: r.content.substring(0, 300),
    }));

    // Step 4: Format knowledge context for LLM
    const knowledgeContext = retrievalOutput.results
      .map((r, i) => {
        let ref = `[${i + 1}]`;
        if (r.sourceTitle) ref += ` 来源:《${r.sourceTitle}》`;
        if (r.pageNumber) ref += ` 第${r.pageNumber}页`;
        const typeTag = r.contentType && r.contentType !== 'text' ? ` [${r.contentType}]` : '';
        return `${ref}${typeTag}\n${r.content}`;
      })
      .join('\n\n');

    return {
      answer: knowledgeContext, // The actual LLM call is done by ChatService
      confidence: retrievalOutput.confidence,
      answerStatus: retrievalOutput.answerStatus,
      sources,
      graphContext,
    };
  }

  /**
   * Parse and index a document into the knowledge base for customer service use.
   */
  async ingestDocument(
    sourceId: string,
    buffer: Buffer,
    filename: string,
    tenantId: string,
    options?: { knowledgeBaseId?: string },
  ): Promise<{ sourceId: string; chunkCount: number; sections: number }> {
    // Parse with full multimodal extraction
    const parseResult = await this.documentParserService.parseDocument(
      sourceId,
      buffer,
      filename,
      { extractTables: true, extractImages: true },
    );

    // Build chunks from multimodal sections
    const rawChunks = this.documentParserService.buildChunks(parseResult);

    // Generate embeddings
    const texts = rawChunks.map((c) => c.content);
    const embeddings = await this.vectorStoreService.embedBatch(texts);

    // Delete existing chunks
    await this.vectorStoreService.deleteChunks(sourceId);

    // Insert chunks with embeddings
    let tableIdx = 0;
    let imageIdx = 0;
    const acceleratorChunks: Array<{
      chunkId: string;
      vectorIndexId?: number;
      content: string;
      contentType: string;
      embedding: number[];
      metadata: Record<string, any>;
    }> = [];

    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];
      const isTable = chunk.contentType === 'table';
      const isImage = chunk.contentType === 'image';

      if (isTable) tableIdx++;
      if (isImage) imageIdx++;

      const inserted = await this.vectorStoreService.insertChunk({
        tenantId,
        sourceId,
        content: chunk.content,
        contentType: chunk.contentType,
        embedding: embeddings[i],
        chunkIndex: i,
        pageNumber: chunk.metadata.pageNumber,
        sheetName: chunk.metadata.sheetName,
        tableNumber: isTable ? tableIdx : undefined,
        imageNumber: isImage ? imageIdx : undefined,
        imageUrl: chunk.metadata.imageUrl,
        latex: chunk.metadata.latex,
        metadata: chunk.metadata,
      });
      acceleratorChunks.push({
        chunkId: inserted.chunkId,
        vectorIndexId: inserted.vectorIndexId,
        content: chunk.content,
        contentType: chunk.contentType,
        embedding: embeddings[i],
        metadata: chunk.metadata,
      });
    }

    await this.vectorStoreService.syncChunksToAccelerator({
      tenantId,
      sourceId,
      chunks: acceleratorChunks,
    });

    this.logger.log(
      `Ingested document ${filename}: ${rawChunks.length} chunks ` +
      `(${tableIdx} tables, ${imageIdx} images)`,
    );

    return {
      sourceId,
      chunkCount: rawChunks.length,
      sections: parseResult.sections.length,
    };
  }

  /**
   * Check if RAG can confidently answer a question.
   * Returns false if the knowledge base lacks relevant content.
   */
  canAnswer(ragResult: RAGAnswer): boolean {
    return ragResult.answerStatus === 'answered' || ragResult.answerStatus === 'cautious';
  }

  /**
   * Generate a disclaimer for low-confidence answers.
   */
  getLowConfidenceDisclaimer(): string {
    return '根据现有资料，该问题未能找到明确答案。建议您联系客服人员获取更准确的信息。';
  }
}
