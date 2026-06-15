import { Injectable, Logger } from '@nestjs/common';

export interface VectorAcceleratorSearchRequest {
  tenantId: string;
  embedding: number[];
  topK: number;
  allowIds?: number[];
  contentTypes?: string[];
}

export interface VectorAcceleratorSearchResult {
  chunkId: string;
  vectorIndexId?: number;
  score: number;
}

export interface VectorAcceleratorSearchResponse {
  success: boolean;
  provider: string;
  indexVersion?: string;
  stale?: boolean;
  error?: string;
  results: VectorAcceleratorSearchResult[];
}

export interface VectorAcceleratorUpsertChunk {
  chunkId: string;
  vectorIndexId: number;
  tenantId: string;
  sourceId: string;
  contentType: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface VectorAcceleratorDeleteRequest {
  sourceId?: string;
  chunkIds?: string[];
  vectorIndexIds?: number[];
}

@Injectable()
export class VectorAcceleratorClient {
  private readonly logger = new Logger(VectorAcceleratorClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly sidecarToken: string;

  constructor() {
    this.baseUrl = process.env.TURBOVEC_BASE_URL || process.env.RAG_SIDECAR_URL || 'http://localhost:8001';
    this.timeoutMs = Number(process.env.TURBOVEC_SEARCH_TIMEOUT_MS || 800);
    this.sidecarToken = process.env.RAG_SIDECAR_SHARED_TOKEN || process.env.SIDECAR_SHARED_TOKEN || '';
  }

  get isEnabled(): boolean {
    return process.env.TURBOVEC_ENABLED === 'true' && process.env.VECTOR_SEARCH_PROVIDER === 'turbovec';
  }

  async health(): Promise<Record<string, any> | null> {
    if (!this.isEnabled) return null;
    try {
      const res = await fetch(`${this.baseUrl}/vector/health`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (error: any) {
      this.logger.warn(`Vector accelerator health check failed: ${error.message}`);
      return null;
    }
  }

  async search(request: VectorAcceleratorSearchRequest): Promise<VectorAcceleratorSearchResponse | null> {
    if (!this.isEnabled) return null;

    try {
      const data = await this.post('/vector/search', {
        tenant_id: request.tenantId,
        embedding: request.embedding,
        top_k: request.topK,
        allow_ids: request.allowIds,
        content_types: request.contentTypes,
      });

      return {
        success: Boolean(data?.success),
        provider: data?.provider || 'turbovec',
        indexVersion: data?.index_version || data?.indexVersion,
        stale: Boolean(data?.stale),
        error: data?.error,
        results: (data?.results || [])
          .map((r: any) => ({
            chunkId: r.chunk_id || r.chunkId,
            vectorIndexId: this.toOptionalNumber(r.vector_index_id ?? r.vectorIndexId),
            score: Number(r.score),
          }))
          .filter((r: VectorAcceleratorSearchResult) => r.chunkId && Number.isFinite(r.score)),
      };
    } catch (error: any) {
      this.logger.warn(`Vector accelerator search failed: ${error.message}`);
      return null;
    }
  }

  async upsertBatch(params: {
    tenantId: string;
    sourceId: string;
    chunks: VectorAcceleratorUpsertChunk[];
  }): Promise<boolean> {
    if (!this.isEnabled || params.chunks.length === 0) return false;

    try {
      const data = await this.post('/vector/upsert-batch', {
        tenant_id: params.tenantId,
        source_id: params.sourceId,
        chunks: params.chunks.map((chunk) => ({
          chunk_id: chunk.chunkId,
          vector_index_id: chunk.vectorIndexId,
          tenant_id: chunk.tenantId,
          source_id: chunk.sourceId,
          content_type: chunk.contentType,
          embedding: chunk.embedding,
          metadata: chunk.metadata || {},
        })),
      }, Math.max(this.timeoutMs, 5000));
      return Boolean(data?.success);
    } catch (error: any) {
      this.logger.warn(`Vector accelerator upsert failed: ${error.message}`);
      return false;
    }
  }

  async delete(request: VectorAcceleratorDeleteRequest): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const data = await this.post('/vector/delete', {
        source_id: request.sourceId,
        chunk_ids: request.chunkIds,
        vector_index_ids: request.vectorIndexIds,
      }, Math.max(this.timeoutMs, 5000));
      return Boolean(data?.success);
    } catch (error: any) {
      this.logger.warn(`Vector accelerator delete failed: ${error.message}`);
      return false;
    }
  }

  private async post(path: string, body: Record<string, any>, timeoutMs = this.timeoutMs): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private buildHeaders(headers: Record<string, string>) {
    if (!this.sidecarToken) return headers;
    return { ...headers, 'X-Sidecar-Token': this.sidecarToken };
  }
}
