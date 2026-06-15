import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmbeddingService } from '../../ai/embedding/embedding.service';
import {
  VectorAcceleratorClient,
  VectorAcceleratorUpsertChunk,
} from './vector-accelerator.client';

export interface VectorSearchResult {
  chunkId: string;
  content: string;
  contentType: string;
  score: number;
  sourceId: string;
  sourceTitle?: string;
  pageNumber?: number;
  tableNumber?: number;
  imageNumber?: number;
  metadata: Record<string, any>;
}

export interface VectorIndexOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  contentType?: string;
}

export interface InsertedVectorChunk {
  chunkId: string;
  vectorIndexId?: number;
}

export interface PendingVectorAcceleratorChunk {
  chunkId: string;
  vectorIndexId?: number;
  content: string;
  contentType: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    @Optional() private vectorAccelerator?: VectorAcceleratorClient,
  ) {}

  /**
   * Generate embedding vector from text.
   */
  async embed(text: string): Promise<number[]> {
    const { embedding } = await this.embeddingService.embed(text);
    return embedding;
  }

  /**
   * Generate embeddings for a batch of texts.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results = await this.embeddingService.embedBatch(texts);
    return results.map((r) => r.embedding);
  }

  /**
   * Delete all chunks for a given source.
   */
  async deleteChunks(sourceId: string): Promise<void> {
    const existingChunks = await this.getAcceleratorIdsForSource(sourceId);
    await this.prisma.knowledgeChunk.deleteMany({ where: { sourceId } });
    if (existingChunks.length > 0) {
      await this.notifyAcceleratorDelete(sourceId, existingChunks);
    }
  }

  /**
   * Insert a chunk with its embedding vector.
   */
  async insertChunk(params: {
    tenantId: string;
    sourceId: string;
    content: string;
    contentType: string;
    embedding: number[];
    chunkIndex: number;
    title?: string;
    titlePath?: string[];
    pageNumber?: number;
    sheetName?: string;
    rowNumber?: number;
    tableNumber?: number;
    imageNumber?: number;
    imageUrl?: string;
    latex?: string;
    keywords?: string[];
    metadata?: Record<string, any>;
    priority?: number;
  }): Promise<InsertedVectorChunk> {
    const vectorStr = `[${params.embedding.join(',')}]`;
    const tokenCount = Math.ceil(params.content.length / 2);

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `INSERT INTO knowledge_chunks (
        id, tenant_id, source_id, title, title_path, content, content_type,
        keywords, keyword_text, page_number, sheet_name, row_number,
        table_number, image_number, image_url, latex,
        chunk_index, token_count, embedding, metadata, priority, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1::uuid, $2::uuid, $3, $4::jsonb, $5, $6,
        $7::jsonb, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18::vector, $19::jsonb, $20, 'active', NOW(), NOW()
      )
      RETURNING id, vector_index_id`,
      params.tenantId,
      params.sourceId,
      params.title || null,
      params.titlePath ? JSON.stringify(params.titlePath) : null,
      params.content,
      params.contentType,
      JSON.stringify(params.keywords || []),
      (params.keywords || []).join(' '),
      params.pageNumber || null,
      params.sheetName || null,
      params.rowNumber || null,
      params.tableNumber || null,
      params.imageNumber || null,
      params.imageUrl || null,
      params.latex || null,
      params.chunkIndex,
      tokenCount,
      vectorStr,
      JSON.stringify(params.metadata || {}),
      params.priority || 0,
    );

    const inserted = rows[0] || {};
    return {
      chunkId: inserted.id,
      vectorIndexId: this.toOptionalNumber(inserted.vector_index_id),
    };
  }

  async syncChunksToAccelerator(params: {
    tenantId: string;
    sourceId: string;
    chunks: PendingVectorAcceleratorChunk[];
  }): Promise<void> {
    if (!this.vectorAccelerator?.isEnabled || params.chunks.length === 0) return;

    const chunks: VectorAcceleratorUpsertChunk[] = params.chunks
      .filter((chunk) => chunk.vectorIndexId !== undefined)
      .map((chunk) => ({
        chunkId: chunk.chunkId,
        vectorIndexId: chunk.vectorIndexId as number,
        tenantId: params.tenantId,
        sourceId: params.sourceId,
        contentType: chunk.contentType,
        embedding: chunk.embedding,
        metadata: chunk.metadata || {},
      }));

    if (chunks.length === 0) return;

    const ok = await this.vectorAccelerator.upsertBatch({
      tenantId: params.tenantId,
      sourceId: params.sourceId,
      chunks,
    });
    if (!ok) {
      this.logger.warn(`Vector accelerator upsert returned false for source ${params.sourceId}`);
    }
  }

  /**
   * Semantic search using vector similarity (cosine distance via pgvector).
   */
  async semanticSearch(
    tenantId: string,
    queryEmbedding: number[],
    topK: number,
    filterContentTypes?: string[],
  ): Promise<VectorSearchResult[]> {
    try {
      const vectorStr = `[${queryEmbedding.join(',')}]`;

      let typeFilter = '';
      let typeParams: string[] = [];
      if (filterContentTypes?.length) {
        const allowed = new Set(['text', 'table', 'image', 'formula', 'chart']);
        typeParams = filterContentTypes.filter((t) => allowed.has(t));
        if (typeParams.length) {
          const placeholders = typeParams.map((_, i) => `$${i + 4}`).join(',');
          typeFilter = `AND content_type IN (${placeholders})`;
        }
      }

      const results: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT kc.id, kc.content, kc.content_type, kc.source_id, kc.title,
                kc.page_number, kc.table_number, kc.image_number, kc.metadata,
                1 - (kc.embedding <=> $1::vector) as score,
                ks.title as source_title
         FROM knowledge_chunks kc
         JOIN knowledge_sources ks ON kc.source_id = ks.id
         WHERE kc.tenant_id = $2::uuid
           AND kc.embedding IS NOT NULL
           AND kc.status = 'active'
           AND ks.status = 'active'
           ${typeFilter}
         ORDER BY kc.embedding <=> $1::vector
         LIMIT $3`,
        vectorStr,
        tenantId,
        topK,
        ...typeParams,
      );

      return results.map((r: any) => ({
        chunkId: r.id,
        content: r.content,
        contentType: r.content_type,
        score: Number(r.score),
        sourceId: r.source_id,
        sourceTitle: r.source_title,
        pageNumber: r.page_number,
        tableNumber: r.table_number,
        imageNumber: r.image_number,
        metadata: r.metadata || {},
      }));
    } catch (error: any) {
      this.logger.warn(`Semantic search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Count chunks for a source.
   */
  async countChunks(sourceId: string): Promise<number> {
    return this.prisma.knowledgeChunk.count({ where: { sourceId } });
  }

  /**
   * Get chunks for a source with pagination.
   */
  async getChunks(sourceId: string, page = 1, pageSize = 50) {
    const [items, total] = await Promise.all([
      this.prisma.knowledgeChunk.findMany({
        where: { sourceId },
        orderBy: { chunkIndex: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.knowledgeChunk.count({ where: { sourceId } }),
    ]);
    return { items, total, page, pageSize };
  }

  private async getAcceleratorIdsForSource(sourceId: string): Promise<Array<{ id: string; vector_index_id?: any }>> {
    if (!this.vectorAccelerator?.isEnabled) return [];
    try {
      return await this.prisma.$queryRawUnsafe(
        `SELECT id, vector_index_id FROM knowledge_chunks WHERE source_id = $1::uuid`,
        sourceId,
      );
    } catch (error: any) {
      this.logger.warn(`Failed to fetch accelerator ids for source ${sourceId}: ${error.message}`);
      return [];
    }
  }

  private async notifyAcceleratorDelete(
    sourceId: string,
    chunks: Array<{ id: string; vector_index_id?: any }>,
  ): Promise<void> {
    if (!this.vectorAccelerator?.isEnabled) return;
    const ok = await this.vectorAccelerator.delete({
      sourceId,
      chunkIds: chunks.map((chunk) => chunk.id),
      vectorIndexIds: chunks
        .map((chunk) => this.toOptionalNumber(chunk.vector_index_id))
        .filter((id): id is number => id !== undefined),
    });
    if (!ok) {
      this.logger.warn(`Vector accelerator delete returned false for source ${sourceId}`);
    }
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }
}
