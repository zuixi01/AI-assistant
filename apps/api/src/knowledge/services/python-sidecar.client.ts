import { Injectable, Logger } from '@nestjs/common';

export interface SidecarParseResult {
  success: boolean;
  fullText: string;
  sections: Array<{
    type: string;
    content: string;
    sectionIndex: number;
    pageNumber?: number;
    caption?: string;
    tableHeaders?: string[];
    tableRows?: string[][];
    imageDescription?: string;
    imageMime?: string;
    latex?: string;
    formulaType?: string;
    chartType?: string;
    sheetName?: string;
  }>;
  metadata: Record<string, any>;
  parseDurationMs: number;
  error?: string;
}

export interface SidecarHealth {
  status: string;
  multimodalAvailable: boolean;
  graphAvailable: boolean;
  parserBackend: string;
  parserMode?: string;
  graphMode?: string;
  capabilities?: Record<string, any>;
  vector?: Record<string, any>;
}

/**
 * Client for the Python RAG-Anything sidecar service.
 * Provides access to advanced multimodal document parsing.
 *
 * When the sidecar is unavailable, operations gracefully degrade
 * to the TypeScript fallback parsers.
 */
@Injectable()
export class PythonSidecarClient {
  private readonly logger = new Logger(PythonSidecarClient.name);
  private readonly baseUrl: string;
  private readonly enabled: boolean;
  private readonly sidecarToken: string;

  constructor() {
    this.baseUrl = process.env.RAG_SIDECAR_URL || 'http://localhost:8001';
    this.enabled = process.env.RAG_SIDECAR_ENABLED === 'true';
    this.sidecarToken = process.env.RAG_SIDECAR_SHARED_TOKEN || process.env.SIDECAR_SHARED_TOKEN || '';
    if (this.enabled) {
      this.logger.log(`Python sidecar enabled at ${this.baseUrl}`);
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  async health(): Promise<SidecarHealth | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      const data: any = await res.json();
      return {
        status: data.status || 'unknown',
        multimodalAvailable: Boolean(data.multimodalAvailable ?? data.multimodal_available),
        graphAvailable: Boolean(data.graphAvailable ?? data.graph_available),
        parserBackend: data.parserBackend ?? data.parser_backend ?? 'unknown',
        parserMode: data.parserMode ?? data.parser_mode,
        graphMode: data.graphMode ?? data.graph_mode,
        capabilities: data.capabilities,
        vector: data.vector,
      };
    } catch {
      return null;
    }
  }

  async parseDocument(
    buffer: Buffer,
    filename: string,
    options?: { extractTables?: boolean; extractImages?: boolean; extractFormulas?: boolean },
  ): Promise<SidecarParseResult | null> {
    if (!this.enabled) return null;
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)]);
      formData.append('file', blob, filename);
      if (options?.extractTables !== undefined) formData.append('extract_tables', String(options.extractTables));
      if (options?.extractImages !== undefined) formData.append('extract_images', String(options.extractImages));
      if (options?.extractFormulas !== undefined) formData.append('extract_formulas', String(options.extractFormulas));

      const res = await fetch(`${this.baseUrl}/parse`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: formData,
        signal: AbortSignal.timeout(120_000),
      });
      const data: any = await res.json();
      return {
        success: Boolean(data.success),
        fullText: data.fullText ?? data.full_text ?? '',
        sections: (data.sections || []).map((section: any, index: number) => ({
          type: section.type,
          content: section.content || '',
          sectionIndex: section.sectionIndex ?? section.section_index ?? index,
          pageNumber: section.pageNumber ?? section.page_number,
          caption: section.caption,
          tableHeaders: section.tableHeaders ?? section.table_headers,
          tableRows: section.tableRows ?? section.table_rows,
          imageDescription: section.imageDescription ?? section.image_description,
          imageMime: section.imageMime ?? section.image_mime,
          latex: section.latex,
          formulaType: section.formulaType ?? section.formula_type,
          chartType: section.chartType ?? section.chart_type,
          sheetName: section.sheetName ?? section.sheet_name,
        })),
        metadata: data.metadata || {},
        parseDurationMs: data.parseDurationMs ?? data.parse_duration_ms ?? 0,
        error: data.error,
      };
    } catch (e: any) {
      this.logger.warn(`Sidecar parse failed: ${e.message}`);
      return null;
    }
  }

  async describeImage(buffer: Buffer, filename: string): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(buffer)]), filename);
      formData.append('filename', filename);

      const res = await fetch(`${this.baseUrl}/image/describe`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: formData,
        signal: AbortSignal.timeout(60_000),
      });
      const data = await res.json();
      return data.description || null;
    } catch (e: any) {
      this.logger.warn(`Sidecar image description failed: ${e.message}`);
      return null;
    }
  }

  async extractEntities(text: string, sourceId: string): Promise<Array<{ id: string; name: string; type: string }>> {
    if (!this.enabled) return [];
    try {
      const res = await fetch(`${this.baseUrl}/entities/extract`, {
        method: 'POST',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text, source_id: sourceId }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json();
      return data.entities || [];
    } catch (e: any) {
      this.logger.warn(`Sidecar entity extraction failed: ${e.message}`);
      return [];
    }
  }

  async searchGraph(query: string, topK = 5): Promise<Record<string, any>> {
    if (!this.enabled) return { entities: [], relations: [], mode: 'unavailable' };
    try {
      const res = await fetch(`${this.baseUrl}/graph/search`, {
        method: 'POST',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query, top_k: topK }),
        signal: AbortSignal.timeout(30_000),
      });
      return await res.json();
    } catch (e: any) {
      this.logger.warn(`Sidecar graph search failed: ${e.message}`);
      return { entities: [], relations: [], mode: 'error' };
    }
  }

  private buildHeaders(headers: Record<string, string> = {}) {
    if (!this.sidecarToken) return headers;
    return { ...headers, 'X-Sidecar-Token': this.sidecarToken };
  }
}
