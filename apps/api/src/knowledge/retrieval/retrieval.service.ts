import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmbeddingService } from '../../ai/embedding/embedding.service';
import { ModelConfigService } from '../../ai/model-config/model-config.service';
import { tokenizeRetrievalQuery } from './query-tokenizer';
import {
  VectorAcceleratorClient,
  VectorAcceleratorSearchResult,
} from '../services/vector-accelerator.client';

export interface RetrievalResult {
  chunkId: string;
  content: string;
  score: number;
  sourceId?: string;
  title?: string;
  titlePath?: string[];
  contentType?: string;
  pageNumber?: number;
  sheetName?: string;
  chunkIndex?: number;
  hitCount?: number;
  q?: string;
  a?: string;
  metadata?: any;
}

export interface RerankedResult extends RetrievalResult {
  vectorScore: number;
  keywordScore: number;
  categoryScore: number;
  titleScore: number;
  modalityScore: number;
  finalScore: number;
  sourceTitle?: string;
  sourceCategory?: string;
  sourcePriority?: number;
}

export interface RetrievalOutput {
  results: RerankedResult[];
  confidence: number;
  answerStatus: 'answered' | 'cautious' | 'low_confidence' | 'no_answer' | 'transferred_to_human';
  semanticProvider?: 'turbovec' | 'pgvector' | 'none';
  retrievalMode?: 'hybrid' | 'keyword_only' | 'no_hits';
  fallbackReason?: string;
}

export type RetrievalMethod = 'semantic' | 'fulltext' | 'hybrid' | 'keyword';

interface SemanticSearchOutput {
  results: RetrievalResult[];
  provider: 'turbovec' | 'pgvector' | 'none';
  fallbackReason?: string;
}

const DEFAULT_VECTOR_DIMENSIONS = 1536;

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly vectorDimensions = Number(process.env.KNOWLEDGE_VECTOR_DIMENSIONS || DEFAULT_VECTOR_DIMENSIONS);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    @Optional() private vectorAccelerator?: VectorAcceleratorClient,
    @Optional() private modelConfigService?: ModelConfigService,
  ) {}

  /**
   * Enhanced retrieval with rerank and confidence scoring.
   */
  async retrieveWithRerank(
    tenantId: string,
    query: string,
    topK = 5,
    category?: string,
  ): Promise<RetrievalOutput> {
    // Step 1: Hybrid retrieval (get more candidates for reranking)
    const candidateK = topK * 4; // retrieve 4x candidates
    const [semanticSearch, keywordResults] = await Promise.all([
      this.semanticSearch(tenantId, query, candidateK),
      this.keywordSearch(tenantId, query, candidateK),
    ]);
    const semanticResults = semanticSearch.results;

    // Step 2: Merge and deduplicate
    const merged = this.mergeResults(semanticResults, keywordResults, candidateK);

    // Step 3: Rerank with multi-factor scoring
    const reranked = await this.rerank(tenantId, merged, query, category);

    // Step 4: Take top K
    const topResults = reranked.slice(0, topK);

    // Step 5: Calculate confidence
    const confidence = this.calculateConfidence(topResults);
    const answerStatus = this.getAnswerStatus(confidence);
    const retrievalMode =
      topResults.length === 0
        ? 'no_hits'
        : semanticResults.length === 0 && keywordResults.length > 0
          ? 'keyword_only'
          : 'hybrid';

    if (retrievalMode === 'keyword_only') {
      this.logger.warn(
        `Retrieval fell back to keyword-only tenant=${tenantId} reason=${semanticSearch.fallbackReason || 'semantic unavailable'} query="${query}"`,
      );
    } else if (retrievalMode === 'no_hits') {
      this.logger.warn(`Retrieval returned no active hits tenant=${tenantId} query="${query}"`);
    } else {
      this.logger.debug(
        `Retrieval tenant=${tenantId} mode=${retrievalMode} semanticProvider=${semanticSearch.provider} ` +
        `semanticHits=${semanticResults.length} keywordHits=${keywordResults.length} topHits=${topResults.length} confidence=${confidence.toFixed(2)}`,
      );
    }

    return {
      results: topResults,
      confidence,
      answerStatus,
      semanticProvider: semanticSearch.provider,
      retrievalMode,
      fallbackReason: semanticSearch.fallbackReason,
    };
  }

  /**
   * Original retrieve method for backward compatibility.
   */
  async retrieve(
    tenantId: string,
    query: string,
    method: RetrievalMethod = 'hybrid',
    topK = 5,
  ): Promise<RetrievalResult[]> {
    switch (method) {
      case 'semantic':
        return (await this.semanticSearch(tenantId, query, topK)).results;
      case 'fulltext':
        return this.fulltextSearch(tenantId, query, topK);
      case 'keyword':
        return this.keywordSearch(tenantId, query, topK);
      case 'hybrid':
      default:
        const [semantic, keyword] = await Promise.all([
          this.semanticSearch(tenantId, query, topK),
          this.keywordSearch(tenantId, query, topK),
        ]);
        return this.mergeResults(semantic.results, keyword, topK);
    }
  }

  private async semanticSearch(tenantId: string, query: string, topK: number): Promise<SemanticSearchOutput> {
    let embedding: number[];
    try {
      const modelConfig = await this.modelConfigService?.getConfig(tenantId);
      const result = await this.embeddingService.embedWithConfig(query, modelConfig?.embedding);
      embedding = result.embedding;
      if (!this.hasCompatibleVectorDimensions(embedding)) {
        const fallbackReason =
          `embedding dimension ${embedding.length} does not match pgvector dimension ${this.vectorDimensions}`;
        this.logger.warn(`Semantic search skipped tenant=${tenantId}: ${fallbackReason}`);
        return { results: [], provider: 'none', fallbackReason };
      }
    } catch (error: any) {
      const fallbackReason = `embedding failed: ${error.message}`;
      this.logger.warn(`Semantic search skipped tenant=${tenantId}: ${fallbackReason}`);
      return { results: [], provider: 'none', fallbackReason };
    }

    const accelerated = await this.tryAcceleratedSemanticSearch(tenantId, embedding, topK);
    if (accelerated?.results.length) return accelerated;

    const pgvector = await this.pgvectorSemanticSearch(tenantId, embedding, topK);
    if (pgvector.results.length > 0) {
      return {
        ...pgvector,
        fallbackReason: accelerated?.fallbackReason,
      };
    }

    return {
      results: [],
      provider: pgvector.provider,
      fallbackReason: pgvector.fallbackReason || accelerated?.fallbackReason,
    };
  }

  private async tryAcceleratedSemanticSearch(
    tenantId: string,
    embedding: number[],
    topK: number,
  ): Promise<SemanticSearchOutput | null> {
    if (!this.vectorAccelerator?.isEnabled) return null;

    const startedAt = Date.now();
    try {
      const response = await this.vectorAccelerator.search({
        tenantId,
        embedding,
        topK: this.getAcceleratorTopK(topK),
      });
      if (!response?.success || response.stale || response.results.length === 0) {
        const fallbackReason =
          `vector accelerator unavailable (success=${response?.success}, stale=${response?.stale}, results=${response?.results?.length || 0})`;
        this.logger.warn(`Semantic search fallback tenant=${tenantId}: ${fallbackReason}`);
        return { results: [], provider: 'none', fallbackReason };
      }

      const results = await this.rehydrateAcceleratedResults(tenantId, response.results, topK);
      if (results.length === 0) {
        const fallbackReason = 'vector accelerator returned no active tenant rows';
        this.logger.warn(`Semantic search fallback tenant=${tenantId}: ${fallbackReason}`);
        return { results: [], provider: 'none', fallbackReason };
      }

      this.logger.debug(
        `Semantic search provider=turbovec tenant=${tenantId} topK=${topK} ` +
        `results=${results.length} durationMs=${Date.now() - startedAt}`,
      );
      return { results, provider: 'turbovec' };
    } catch (error: any) {
      const fallbackReason = `vector accelerator failed: ${error.message}`;
      this.logger.warn(`Semantic search fallback tenant=${tenantId}: ${fallbackReason}`);
      return { results: [], provider: 'none', fallbackReason };
    }
  }

  private getAcceleratorTopK(topK: number): number {
    const multiplier = Number(process.env.TURBOVEC_TOPK_MULTIPLIER || 1);
    if (!Number.isFinite(multiplier) || multiplier <= 1) return topK;
    return Math.ceil(topK * multiplier);
  }

  private async rehydrateAcceleratedResults(
    tenantId: string,
    acceleratedResults: VectorAcceleratorSearchResult[],
    topK: number,
  ): Promise<RetrievalResult[]> {
    const chunkIds = [...new Set(acceleratedResults.map((r) => r.chunkId).filter(Boolean))];
    if (chunkIds.length === 0) return [];

    const scoreByChunkId = new Map(acceleratedResults.map((r) => [r.chunkId, r.score]));

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT kc.id, kc.content, kc.q, kc.a, kc.metadata, kc.source_id, kc.title, kc.title_path,
              kc.content_type, kc.page_number, kc.sheet_name, kc.chunk_index, kc.hit_count
       FROM knowledge_chunks kc
       JOIN knowledge_sources ks ON kc.source_id = ks.id
       WHERE kc.tenant_id = $1::uuid
         AND kc.id = ANY($2::uuid[])
         AND kc.embedding IS NOT NULL
         AND kc.status = 'active'
         AND ks.status = 'active'
       LIMIT $3`,
      tenantId,
      chunkIds,
      Math.max(topK, chunkIds.length),
    );

    const rowsById = new Map(rows.map((r: any) => [r.id, r]));
    return acceleratedResults
      .map((hit) => {
        const row = rowsById.get(hit.chunkId);
        if (!row) return null;
        return this.mapRetrievalRow(row, Number(scoreByChunkId.get(hit.chunkId) || hit.score));
      })
      .filter((r): r is RetrievalResult => Boolean(r))
      .slice(0, topK);
  }

  private async pgvectorSemanticSearch(
    tenantId: string,
    embedding: number[],
    topK: number,
  ): Promise<SemanticSearchOutput> {
    const startedAt = Date.now();
    try {
      const vectorStr = `[${embedding.join(',')}]`;

      const results: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT kc.id, kc.content, kc.q, kc.a, kc.metadata, kc.source_id, kc.title, kc.title_path,
                kc.content_type, kc.page_number, kc.sheet_name, kc.chunk_index, kc.hit_count,
                1 - (kc.embedding <=> $1::vector) as score
         FROM knowledge_chunks kc
         JOIN knowledge_sources ks ON kc.source_id = ks.id
         WHERE kc.tenant_id = $2::uuid
           AND kc.embedding IS NOT NULL
           AND kc.status = 'active'
           AND ks.status = 'active'
         ORDER BY kc.embedding <=> $1::vector
         LIMIT $3`,
        vectorStr,
        tenantId,
        topK,
      );

      this.logger.debug(
        `Semantic search provider=pgvector tenant=${tenantId} topK=${topK} ` +
        `results=${results.length} durationMs=${Date.now() - startedAt}`,
      );
      return {
        results: results.map((r: any) => this.mapRetrievalRow(r, Number(r.score))),
        provider: 'pgvector',
      };
    } catch (error: any) {
      const fallbackReason = `pgvector failed: ${error.message}`;
      this.logger.warn(`Semantic search failed tenant=${tenantId}: ${fallbackReason}`);
      return { results: [], provider: 'none', fallbackReason };
    }
  }

  private hasCompatibleVectorDimensions(embedding: number[]) {
    return embedding.length === this.vectorDimensions;
  }

  private mapRetrievalRow(row: any, score: number): RetrievalResult {
    return {
      chunkId: row.id,
      content: row.content,
      score,
      sourceId: row.source_id,
      title: row.title,
      titlePath: row.title_path,
      contentType: row.content_type,
      pageNumber: row.page_number,
      sheetName: row.sheet_name,
      chunkIndex: row.chunk_index,
      hitCount: row.hit_count,
      q: row.q,
      a: row.a,
      metadata: row.metadata,
    };
  }

  private async fulltextSearch(tenantId: string, query: string, topK: number): Promise<RetrievalResult[]> {
    try {
      const results: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, content, q, a, metadata, source_id, title, title_path,
                content_type, page_number, sheet_name, chunk_index, hit_count,
                ts_rank(to_tsvector('simple', content), plainto_tsquery('simple', $1)) as score
         FROM knowledge_chunks
         WHERE tenant_id = $2::uuid AND status = 'active'
           AND to_tsvector('simple', content) @@ plainto_tsquery('simple', $1)
         ORDER BY score DESC
         LIMIT $3`,
        query,
        tenantId,
        topK,
      );

      return results.map((r: any) => ({
        chunkId: r.id,
        content: r.content,
        score: Number(r.score),
        sourceId: r.source_id,
        title: r.title,
        titlePath: r.title_path,
        contentType: r.content_type,
        pageNumber: r.page_number,
        sheetName: r.sheet_name,
        chunkIndex: r.chunk_index,
        hitCount: r.hit_count,
        q: r.q,
        a: r.a,
        metadata: r.metadata,
      }));
    } catch (error: any) {
      this.logger.warn(`Fulltext search failed: ${error.message}`);
      return [];
    }
  }

  private async keywordSearch(tenantId: string, query: string, topK: number): Promise<RetrievalResult[]> {
    const keywords = tokenizeRetrievalQuery(query);
    if (keywords.length === 0) return [];

    // Search in content, keyword_text, title, and q/a fields
    const conditions = keywords.map((_: string, i: number) => {
      const paramIdx = i + 2;
      return `(content ILIKE $${paramIdx} OR keyword_text ILIKE $${paramIdx} OR title ILIKE $${paramIdx})`;
    }).join(' OR ');
    const params = keywords.map((k: string) => `%${k}%`);

    try {
      const results: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, content, q, a, metadata, source_id, title, title_path,
                content_type, page_number, sheet_name, chunk_index, hit_count, priority, 0.5 as score
         FROM knowledge_chunks
         WHERE tenant_id = $1::uuid AND status = 'active' AND (${conditions})
         ORDER BY priority DESC, hit_count DESC
         LIMIT $${keywords.length + 2}`,
        tenantId,
        ...params,
        topK,
      );

      return results.map((r: any) => ({
        chunkId: r.id,
        content: r.content,
        score: Number(r.score),
        sourceId: r.source_id,
        title: r.title,
        titlePath: r.title_path,
        contentType: r.content_type,
        pageNumber: r.page_number,
        sheetName: r.sheet_name,
        chunkIndex: r.chunk_index,
        hitCount: r.hit_count,
        q: r.q,
        a: r.a,
        metadata: { ...(r.metadata || {}), priority: r.priority },
      }));
    } catch (error: any) {
      this.logger.warn(`Keyword search failed: ${error.message}`);
      return [];
    }
  }

  private mergeResults(semantic: RetrievalResult[], keyword: RetrievalResult[], topK: number): RetrievalResult[] {
    const merged = new Map<string, RetrievalResult & { vectorScore: number; keywordScore: number }>();

    for (const r of semantic) {
      merged.set(r.chunkId, { ...r, vectorScore: r.score, keywordScore: 0 });
    }

    for (const r of keyword) {
      const existing = merged.get(r.chunkId);
      if (existing) {
        existing.keywordScore = r.score;
      } else {
        merged.set(r.chunkId, { ...r, vectorScore: 0, keywordScore: r.score });
      }
    }

    return [...merged.values()]
      .sort((a, b) => (b.vectorScore * 0.7 + b.keywordScore * 0.3) - (a.vectorScore * 0.7 + a.keywordScore * 0.3))
      .slice(0, topK);
  }

  /**
   * Multi-factor rerank: vector*0.40 + keyword*0.20 + category*0.08 + title*0.08 + modality*0.08 + priority*0.05 + freshness*0.05
   * modality factor boosts content types matching query intent (e.g., table query → table chunks)
   */
  private async rerank(
    tenantId: string,
    candidates: RetrievalResult[],
    query: string,
    category?: string,
  ): Promise<RerankedResult[]> {
    if (candidates.length === 0) return [];

    // Get source info for category/priority scoring
    const sourceIds = [...new Set(candidates.map((c) => c.sourceId).filter(Boolean))];
    let sourceMap = new Map<string, { title: string; category: string | null; priority: number }>();
    if (sourceIds.length > 0) {
      try {
        const sources: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT id, title, category, priority FROM knowledge_sources WHERE id = ANY($1::uuid[])`,
          sourceIds,
        );
        for (const s of sources) {
          sourceMap.set(s.id, { title: s.title, category: s.category, priority: s.priority || 0 });
        }
      } catch (e: any) {
        this.logger.warn(`Failed to fetch source info: ${e.message}`);
      }
    }

    const queryLower = query.toLowerCase();

    return candidates.map((c) => {
      const vectorScore = (c as any).vectorScore || 0;
      const keywordScore = (c as any).keywordScore || 0;

      // Category match: +0.10 if source category matches query context
      let categoryScore = 0;
      const sourceInfo = sourceMap.get(c.sourceId || '');
      if (sourceInfo?.category && category) {
        categoryScore = sourceInfo.category === category ? 1.0 : 0;
      }

      // Title match: +0.10 if query keywords appear in title/title_path
      let titleScore = 0;
      const titleText = (c.title || '') + ' ' + (c.titlePath || []).join(' ');
      if (titleText) {
        const titleLower = titleText.toLowerCase();
        const queryWords = tokenizeRetrievalQuery(queryLower);
        const matchCount = queryWords.filter((w) => titleLower.includes(w)).length;
        titleScore = queryWords.length > 0 ? matchCount / queryWords.length : 0;
      }

      // Priority score: normalize to 0-1
      const priorityScore = Math.min((sourceInfo?.priority || 0) / 10, 1);

      // Modality match: boost content types matching query intent
      let modalityScore = 0;
      const queryIntent = this.detectQueryModality(queryLower);
      const chunkContentType = c.contentType || 'text';
      if (queryIntent === 'table' && chunkContentType === 'table') modalityScore = 1.0;
      else if (queryIntent === 'image' && chunkContentType === 'image') modalityScore = 1.0;
      else if (queryIntent === 'formula' && chunkContentType === 'formula') modalityScore = 1.0;
      else if (queryIntent === 'mixed' && chunkContentType !== 'text') modalityScore = 0.5;
      else if (queryIntent === 'text' && chunkContentType === 'text') modalityScore = 0.3;
      else modalityScore = 0;

      // Freshness score: recent chunks get slight boost
      const freshnessScore = 0.5; // neutral default

      const weightedScore =
        vectorScore * 0.40 +
        keywordScore * 0.20 +
        categoryScore * 0.08 +
        titleScore * 0.08 +
        modalityScore * 0.08 +
        priorityScore * 0.05 +
        freshnessScore * 0.05;
      const keywordOnlyScore =
        vectorScore === 0 && keywordScore > 0
          ? Math.min(
              0.62 +
                keywordScore * 0.25 +
                titleScore * 0.08 +
                priorityScore * 0.05 +
                modalityScore * 0.05,
              0.92,
            )
          : 0;
      const finalScore = Math.max(weightedScore, keywordOnlyScore);

      return {
        ...c,
        vectorScore,
        keywordScore,
        categoryScore,
        titleScore,
        modalityScore,
        finalScore,
        sourceTitle: sourceInfo?.title,
        sourceCategory: sourceInfo?.category || undefined,
        sourcePriority: sourceInfo?.priority,
      } as RerankedResult;
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Calculate confidence based on top results.
   */
  private calculateConfidence(results: RerankedResult[]): number {
    if (results.length === 0) return 0;

    const topScore = results[0].finalScore;

    // If top score is very high, high confidence
    if (topScore >= 0.78) return topScore;

    // If top score is moderate but has good supporting results, boost slightly
    if (results.length >= 2 && results[1].finalScore >= 0.5) {
      return Math.min(topScore + 0.05, 1);
    }

    return topScore;
  }

  /**
   * Detect the modality intent of a query.
   * Returns the content type the query is likely targeting.
   */
  private detectQueryModality(query: string): 'text' | 'table' | 'image' | 'formula' | 'mixed' {
    const tableKeywords = /表格|表|数据|统计|汇总|明细|清单|对比|比例|占比|价格表|报价/i;
    const imageKeywords = /图片|图|照片|截图|示意图|流程图|架构图|图表|设计图/i;
    const formulaKeywords = /公式|计算|算式|方程|推导|证明|定理|数学|函数/i;

    const hasTable = tableKeywords.test(query);
    const hasImage = imageKeywords.test(query);
    const hasFormula = formulaKeywords.test(query);

    const matches = [hasTable, hasImage, hasFormula].filter(Boolean).length;
    if (matches >= 2) return 'mixed';
    if (hasTable) return 'table';
    if (hasImage) return 'image';
    if (hasFormula) return 'formula';
    return 'text';
  }

  /**
   * Determine answer status based on confidence.
   */
  private getAnswerStatus(confidence: number): 'answered' | 'cautious' | 'low_confidence' | 'no_answer' {
    if (confidence >= 0.78) return 'answered';
    if (confidence >= 0.60) return 'cautious';
    if (confidence >= 0.30) return 'low_confidence';
    return 'no_answer';
  }
}
