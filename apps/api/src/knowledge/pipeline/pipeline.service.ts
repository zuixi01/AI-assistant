import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmbeddingService } from '../../ai/embedding/embedding.service';
import { ChunkerFactory } from '../chunkers/chunker.factory';
import { VectorStoreService } from '../services/vector-store.service';
import { extractKeywords } from '../utils/text-cleaner';
import type { ContentSection } from '../parsers/parser.interface';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    private chunkerFactory: ChunkerFactory,
    private vectorStore: VectorStoreService,
  ) {}

  async processDocument(sourceId: string): Promise<{ chunksCreated: number }> {
    const source = await this.prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException(`Knowledge source ${sourceId} not found`);

    await this.prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { parseStatus: 'processing', indexStatus: 'indexing' },
    });

    const job = await this.prisma.knowledgeParseJob.create({
      data: {
        tenantId: source.tenantId,
        sourceId,
        jobType: 'parse',
        status: 'processing',
        startedAt: new Date(),
      },
    });

    try {
      const content = source.rawText || '';
      if (!content.trim()) {
        throw new BadRequestException('No content to process');
      }

      // Check for multimodal sections stored from DocumentParserService
      const contentSections = (source.contentSections as unknown as ContentSection[]) || [];

      // Update job progress
      await this.prisma.knowledgeParseJob.update({
        where: { id: job.id },
        data: { progress: 20, currentStep: '文本切片中' },
      });

      // Chunk with modality awareness
      const strategy = this.chooseChunkStrategy(source.type);
      let allChunks: Array<{
        content: string;
        contentType: string;
        metadata: Record<string, any>;
      }> = [];

      if (contentSections.length > 0) {
        // Multimodal chunking: process each section type appropriately
        allChunks = this.chunkMultimodal(contentSections, strategy);
      } else {
        // Fallback: plain text chunking
        const chunks = this.chunkerFactory.chunk(content, strategy, {
          chunkSize: 500,
          chunkOverlap: 50,
        });
        allChunks = chunks.map((c) => ({
          content: c.content,
          contentType: c.metadata?.content_type || 'text',
          metadata: c.metadata || {},
        }));
      }

      // Update job progress
      await this.prisma.knowledgeParseJob.update({
        where: { id: job.id },
        data: { progress: 40, currentStep: '生成向量中' },
      });

      // Generate embeddings
      const category = source.category || '';
      const titlePrefix = category ? `[${category}] ` : '';
      const embeddingTexts = allChunks.map((c) => {
        const chunkTitle = c.metadata?.title_path?.join(' > ') || '';
        const typePrefix = c.contentType !== 'text' ? `[${c.contentType.toUpperCase()}] ` : '';
        const prefix = typePrefix + (chunkTitle ? `${titlePrefix}${chunkTitle}: ` : titlePrefix);
        return `${prefix}${c.content}`;
      });

      const embeddings = await this.embeddingService.embedBatch(embeddingTexts);

      // Update job progress
      await this.prisma.knowledgeParseJob.update({
        where: { id: job.id },
        data: { progress: 70, currentStep: '写入数据库中' },
      });

      // Delete existing chunks
      await this.vectorStore.deleteChunks(sourceId);

      // Insert chunks with modality-aware metadata
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

      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        const keywords = extractKeywords(chunk.content);

        if (chunk.contentType === 'table') tableIdx++;
        if (chunk.contentType === 'image') imageIdx++;

        const inserted = await this.vectorStore.insertChunk({
          tenantId: source.tenantId,
          sourceId,
          content: chunk.content,
          contentType: chunk.contentType,
          embedding: embeddings[i].embedding,
          chunkIndex: i,
          title: chunk.metadata?.title,
          titlePath: chunk.metadata?.title_path,
          pageNumber: chunk.metadata?.page_number || chunk.metadata?.pageNumber,
          sheetName: chunk.metadata?.sheet_name || chunk.metadata?.sheetName,
          rowNumber: chunk.metadata?.row_number,
          tableNumber: chunk.contentType === 'table' ? tableIdx : undefined,
          imageNumber: chunk.contentType === 'image' ? imageIdx : undefined,
          imageUrl: chunk.metadata?.imageUrl,
          latex: chunk.metadata?.latex,
          keywords,
          metadata: chunk.metadata,
          priority: source.priority || 0,
        });
        acceleratorChunks.push({
          chunkId: inserted.chunkId,
          vectorIndexId: inserted.vectorIndexId,
          content: chunk.content,
          contentType: chunk.contentType,
          embedding: embeddings[i].embedding,
          metadata: chunk.metadata,
        });
      }

      await this.vectorStore.syncChunksToAccelerator({
        tenantId: source.tenantId,
        sourceId,
        chunks: acceleratorChunks,
      });

      // Update source status
      await this.prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { parseStatus: 'completed', indexStatus: 'completed' },
      });

      // Complete job
      await this.prisma.knowledgeParseJob.update({
        where: { id: job.id },
        data: { status: 'completed', progress: 100, currentStep: '完成', finishedAt: new Date() },
      });

      const stats = {
        text: allChunks.filter((c) => c.contentType === 'text').length,
        table: tableIdx,
        image: imageIdx,
      };
      this.logger.log(
        `Processed source ${sourceId}: ${allChunks.length} chunks ` +
        `(text:${stats.text}, tables:${stats.table}, images:${stats.image})`,
      );
      return { chunksCreated: allChunks.length };
    } catch (error: any) {
      await this.prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { parseStatus: 'failed', indexStatus: 'failed', parseError: error.message },
      });
      await this.prisma.knowledgeParseJob.update({
        where: { id: job.id },
        data: { status: 'failed', errorMessage: error.message, finishedAt: new Date() },
      });
      this.logger.error(`Failed to process source ${sourceId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Chunk multimodal content sections, preserving type metadata.
   */
  private chunkMultimodal(
    sections: ContentSection[],
    baseStrategy: string,
  ): Array<{ content: string; contentType: string; metadata: Record<string, any> }> {
    const result: Array<{ content: string; contentType: string; metadata: Record<string, any> }> = [];

    for (const section of sections) {
      switch (section.type) {
        case 'text': {
          // Use chunker for long text sections
          if (section.content.length > 500) {
            const chunks = this.chunkerFactory.chunk(section.content, baseStrategy, {
              chunkSize: 500,
              chunkOverlap: 50,
            });
            result.push(...chunks.map((c) => ({
              content: c.content,
              contentType: 'text',
              metadata: {
                ...c.metadata,
                pageNumber: section.metadata?.pageNumber,
                sectionIndex: section.sectionIndex,
              },
            })));
          } else {
            result.push({
              content: section.content,
              contentType: 'text',
              metadata: {
                pageNumber: section.metadata?.pageNumber,
                sectionIndex: section.sectionIndex,
              },
            });
          }
          break;
        }

        case 'table':
          // Tables are kept as single chunks with structured format
          result.push({
            content: section.content,
            contentType: 'table',
            metadata: {
              tableHeaders: section.metadata?.tableHeaders,
              tableRows: section.metadata?.tableRows,
              pageNumber: section.metadata?.pageNumber,
              sectionIndex: section.sectionIndex,
              caption: section.metadata?.caption,
              sheetName: section.metadata?.sheetName,
            },
          });
          break;

        case 'image':
          result.push({
            content: section.metadata?.imageDescription || section.content,
            contentType: 'image',
            metadata: {
              imageBase64: section.metadata?.imageBase64,
              imageMime: section.metadata?.imageMime,
              pageNumber: section.metadata?.pageNumber,
              sectionIndex: section.sectionIndex,
              caption: section.metadata?.caption,
            },
          });
          break;

        case 'formula':
          result.push({
            content: section.content,
            contentType: 'formula',
            metadata: {
              latex: section.metadata?.latex,
              formulaType: section.metadata?.formulaType,
              pageNumber: section.metadata?.pageNumber,
              sectionIndex: section.sectionIndex,
            },
          });
          break;

        case 'chart':
          result.push({
            content: section.content,
            contentType: 'chart',
            metadata: {
              chartType: section.metadata?.chartType,
              chartData: section.metadata?.chartData,
              pageNumber: section.metadata?.pageNumber,
              sectionIndex: section.sectionIndex,
            },
          });
          break;
      }
    }

    return result;
  }

  async processText(tenantId: string, text: string, sourceId: string, chunkStrategy?: string): Promise<number> {
    const chunks = this.chunkerFactory.chunk(text, chunkStrategy, {
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const embeddingTexts = chunks.map((c) => c.content);
    const embeddings = await this.embeddingService.embedBatch(embeddingTexts);

    await this.vectorStore.deleteChunks(sourceId);
    const acceleratorChunks: Array<{
      chunkId: string;
      vectorIndexId?: number;
      content: string;
      contentType: string;
      embedding: number[];
      metadata: Record<string, any>;
    }> = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const keywords = extractKeywords(chunk.content);
      const contentType = chunk.metadata?.content_type || 'text';

      const inserted = await this.vectorStore.insertChunk({
        tenantId,
        sourceId,
        content: chunk.content,
        contentType,
        embedding: embeddings[i].embedding,
        chunkIndex: i,
        keywords,
        metadata: chunk.metadata || {},
      });
      acceleratorChunks.push({
        chunkId: inserted.chunkId,
        vectorIndexId: inserted.vectorIndexId,
        content: chunk.content,
        contentType,
        embedding: embeddings[i].embedding,
        metadata: chunk.metadata || {},
      });
    }

    await this.vectorStore.syncChunksToAccelerator({
      tenantId,
      sourceId,
      chunks: acceleratorChunks,
    });

    return chunks.length;
  }

  private chooseChunkStrategy(sourceType: string): string {
    switch (sourceType) {
      case 'faq':
        return 'qa-pair';
      case 'document':
      default:
        return 'recursive';
    }
  }
}
