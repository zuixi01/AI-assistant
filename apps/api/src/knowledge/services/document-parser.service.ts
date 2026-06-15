import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ParserFactory } from '../parsers/parser.factory';
import { ParsedDocument, ContentSection } from '../parsers/parser.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cleanText } from '../utils/text-cleaner';
import { PythonSidecarClient, SidecarParseResult } from './python-sidecar.client';

export interface ParseResult {
  sourceId: string;
  fullText: string;
  sections: ContentSection[];
  metadata: Record<string, any>;
  parseDurationMs: number;
}

export interface ParseOptions {
  /** Max retry attempts on failure */
  maxRetries?: number;
  /** Whether to extract tables */
  extractTables?: boolean;
  /** Whether to extract images */
  extractImages?: boolean;
  /** Whether to extract formulas */
  extractFormulas?: boolean;
}

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  constructor(
    private parserFactory: ParserFactory,
    private prisma: PrismaService,
    private sidecar?: PythonSidecarClient,
  ) {}

  /**
   * Parse a file buffer and extract multimodal content.
   * Saves parsed sections to the knowledge source record.
   */
  async parseDocument(
    sourceId: string,
    buffer: Buffer,
    filename: string,
    options: ParseOptions = {},
  ): Promise<ParseResult> {
    const { maxRetries = 2 } = options;
    const startedAt = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const sidecarResult = await this.tryParseWithSidecar(buffer, filename, options);
        if (sidecarResult) {
          await this.prisma.knowledgeSource.update({
            where: { id: sourceId },
            data: { contentSections: JSON.parse(JSON.stringify(sidecarResult.sections)) },
          });
          return {
            sourceId,
            fullText: cleanText(sidecarResult.fullText),
            sections: sidecarResult.sections,
            metadata: sidecarResult.metadata || {},
            parseDurationMs: sidecarResult.parseDurationMs,
          };
        }

        const parsed = await this.parserFactory.parse(buffer, filename);
        const fullText = cleanText(parsed.content ?? '');
        const sections = parsed.sections || [];

        // Extract additional multimodal content
        const parser = this.parserFactory.getParser(filename);

        if (options.extractTables !== false && parser.extractTables) {
          try {
            const tables = await parser.extractTables(buffer, filename);
            sections.push(...tables);
          } catch (e: any) {
            this.logger.warn(`Table extraction failed for ${filename}: ${e.message}`);
          }
        }

        if (options.extractImages !== false && parser.extractImages) {
          try {
            const images = await parser.extractImages(buffer, filename);
            sections.push(...images);
          } catch (e: any) {
            this.logger.warn(`Image extraction failed for ${filename}: ${e.message}`);
          }
        }

        if (options.extractFormulas && parser.extractFormulas) {
          try {
            const formulas = await parser.extractFormulas(buffer, filename);
            sections.push(...formulas);
          } catch (e: any) {
            this.logger.warn(`Formula extraction failed for ${filename}: ${e.message}`);
          }
        }

        // Sort sections by index
        sections.sort((a, b) => a.sectionIndex - b.sectionIndex);

        // Save sections to the database
        await this.prisma.knowledgeSource.update({
          where: { id: sourceId },
          data: { contentSections: JSON.parse(JSON.stringify(sections)) },
        });

        const duration = Date.now() - startedAt;
        this.logger.log(
          `Parsed ${filename}: ${sections.length} sections (${duration}ms) ` +
          `[${sections.filter((s) => s.type === 'text').length} text, ` +
          `${sections.filter((s) => s.type === 'table').length} tables, ` +
          `${sections.filter((s) => s.type === 'image').length} images]`,
        );

        return {
          sourceId,
          fullText,
          sections,
          metadata: parsed.metadata || {},
          parseDurationMs: duration,
        };
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Parse attempt ${attempt + 1}/${maxRetries + 1} failed for ${filename}: ${error.message}`,
        );

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
        }
      }
    }

    throw new BadRequestException(
      `Document parsing failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }

  private async tryParseWithSidecar(
    buffer: Buffer,
    filename: string,
    options: ParseOptions,
  ): Promise<Pick<ParseResult, 'fullText' | 'sections' | 'metadata' | 'parseDurationMs'> | null> {
    if (!this.sidecar?.isEnabled) return null;

    const result: SidecarParseResult | null = await this.sidecar.parseDocument(buffer, filename, {
      extractTables: options.extractTables,
      extractImages: options.extractImages,
      extractFormulas: options.extractFormulas,
    });
    if (!result?.success) {
      if (result?.error) this.logger.warn(`Sidecar parse returned failure for ${filename}: ${result.error}`);
      return null;
    }

    return {
      fullText: result.fullText,
      sections: result.sections.map((section, index) => ({
        type: section.type as ContentSection['type'],
        content: section.content,
        sectionIndex: section.sectionIndex ?? index,
        metadata: {
          pageNumber: section.pageNumber,
          caption: section.caption,
          tableHeaders: section.tableHeaders,
          tableRows: section.tableRows,
          imageDescription: section.imageDescription,
          imageMime: section.imageMime,
          latex: section.latex,
          formulaType: section.formulaType,
          chartType: section.chartType,
          sheetName: section.sheetName,
        },
      })),
      metadata: result.metadata || {},
      parseDurationMs: result.parseDurationMs,
    };
  }

  /**
   * Extract only text content from a document.
   */
  async extractText(buffer: Buffer, filename: string): Promise<string> {
    const parsed = await this.parserFactory.parse(buffer, filename);
    return cleanText(parsed.content ?? '');
  }

  /**
   * Extract tables from a document as structured data.
   */
  async extractTables(buffer: Buffer, filename: string): Promise<ContentSection[]> {
    const parsed = await this.parserFactory.parse(buffer, filename);
    return (parsed.sections || []).filter((s) => s.type === 'table');
  }

  /**
   * Extract image references from a document.
   */
  async extractImages(buffer: Buffer, filename: string): Promise<ContentSection[]> {
    const parsed = await this.parserFactory.parse(buffer, filename);
    return (parsed.sections || []).filter((s) => s.type === 'image');
  }

  /**
   * Build chunk-ready content from parsed sections.
   * Returns an array of text segments with metadata, ready for the chunking pipeline.
   */
  buildChunks(parseResult: ParseResult): Array<{ content: string; contentType: string; metadata: Record<string, any> }> {
    const chunks: Array<{ content: string; contentType: string; metadata: Record<string, any> }> = [];

    for (const section of parseResult.sections) {
      const baseMeta: Record<string, any> = {
        sourceId: parseResult.sourceId,
        pageNumber: section.metadata?.pageNumber,
        sectionIndex: section.sectionIndex,
      };

      switch (section.type) {
        case 'text':
          chunks.push({
            content: section.content,
            contentType: 'text',
            metadata: baseMeta,
          });
          break;

        case 'table':
          chunks.push({
            content: section.content,
            contentType: 'table',
            metadata: {
              ...baseMeta,
              tableHeaders: section.metadata?.tableHeaders,
              tableRows: section.metadata?.tableRows,
              caption: section.metadata?.caption,
            },
          });
          break;

        case 'image':
          chunks.push({
            content: section.metadata?.imageDescription || section.content,
            contentType: 'image',
            metadata: {
              ...baseMeta,
              imageBase64: section.metadata?.imageBase64,
              imageMime: section.metadata?.imageMime,
              caption: section.metadata?.caption,
            },
          });
          break;

        case 'formula':
          chunks.push({
            content: section.content,
            contentType: 'formula',
            metadata: {
              ...baseMeta,
              latex: section.metadata?.latex,
              formulaType: section.metadata?.formulaType,
            },
          });
          break;

        case 'chart':
          chunks.push({
            content: section.content,
            contentType: 'chart',
            metadata: {
              ...baseMeta,
              chartType: section.metadata?.chartType,
              chartData: section.metadata?.chartData,
            },
          });
          break;

        default:
          chunks.push({
            content: section.content,
            contentType: 'text',
            metadata: baseMeta,
          });
      }
    }

    return chunks;
  }

  /**
   * Build index-ready content from parsed document.
   * Combines text + structured representation of tables/images/formulas.
   */
  buildIndex(parseResult: ParseResult): string {
    const parts: string[] = [];

    // Add full text
    if (parseResult.fullText) {
      parts.push(parseResult.fullText);
    }

    // Add structured table representations
    const tables = parseResult.sections.filter((s) => s.type === 'table');
    for (const table of tables) {
      const headers = table.metadata?.tableHeaders?.join(' | ') || '';
      const rows = (table.metadata?.tableRows || [])
        .map((r: string[]) => r.join(' | '))
        .join('\n');
      if (headers || rows) {
        parts.push(`[TABLE] ${headers}\n${rows}`);
      }
    }

    // Add image descriptions
    const images = parseResult.sections.filter((s) => s.type === 'image');
    for (const img of images) {
      if (img.metadata?.imageDescription) {
        parts.push(`[IMAGE] ${img.metadata.imageDescription}`);
      }
    }

    return parts.join('\n\n');
  }
}
