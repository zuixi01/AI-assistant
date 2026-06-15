import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ParserFactory } from './parsers/parser.factory';
import { DocumentParserService } from './services/document-parser.service';
import { CustomerServiceRAGService } from './services/customer-service-rag.service';
import { RetrievalService, RetrievalResult, RetrievalMethod } from './retrieval/retrieval.service';
import type { KnowledgeUploadFieldsDto } from './dto/knowledge-upload.dto';
import { decodeMultipartUtf8 } from './utils/multipart-encoding';
import { cleanText } from './utils/text-cleaner';
import { KnowledgeIndexQueueService } from './pipeline/knowledge-index-queue.service';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private prisma: PrismaService,
    private retrieval: RetrievalService,
    private parserFactory: ParserFactory,
    private documentParser: DocumentParserService,
    private customerServiceRAG: CustomerServiceRAGService,
    private indexQueue: KnowledgeIndexQueueService,
  ) {}

  // ==================== Knowledge Base CRUD ====================

  async createKnowledgeBase(tenantId: string, data: {
    name: string;
    description?: string;
    teamId?: string;
    workspaceId?: string;
    projectId?: string;
    config?: Record<string, any>;
  }) {
    return this.prisma.knowledgeBase.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        teamId: data.teamId,
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        config: data.config || undefined,
      },
    });
  }

  async getKnowledgeBases(tenantId: string, page = 1, pageSize = 20) {
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.knowledgeBase.findMany({
        where,
        include: { _count: { select: { sources: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.knowledgeBase.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getKnowledgeBase(id: string, tenantId?: string) {
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: { _count: { select: { sources: true } } },
    });
    if (!kb) throw new NotFoundException('Knowledge base not found');
    return kb;
  }

  async updateKnowledgeBase(
    tenantId: string,
    id: string,
    data: { name?: string; description?: string; status?: string; config?: Record<string, any> },
  ) {
    await this.getKnowledgeBase(id, tenantId);
    return this.prisma.knowledgeBase.update({ where: { id }, data });
  }

  async deleteKnowledgeBase(tenantId: string, id: string) {
    await this.getKnowledgeBase(id, tenantId);
    // Unlink sources first
    await this.prisma.knowledgeSource.updateMany({
      where: { knowledgeBaseId: id, tenantId },
      data: { knowledgeBaseId: null },
    });
    return this.prisma.knowledgeBase.delete({ where: { id } });
  }

  // ==================== Knowledge Source CRUD ====================

  /** Upload and parse a file with multimodal extraction */
  async createFromUpload(
    tenantId: string,
    file: Express.Multer.File,
    body: KnowledgeUploadFieldsDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const rawOriginalName = decodeMultipartUtf8(file.originalname) || file.originalname || '';
    const ext = rawOriginalName.split('.').pop()?.toLowerCase() || '';

    const basename = rawOriginalName.replace(/\.[^.]+$/, '').trim();
    const titleDecoded = decodeMultipartUtf8(body.title)?.trim();
    const categoryDecoded = decodeMultipartUtf8(body.category)?.trim();
    const descriptionDecoded = decodeMultipartUtf8(body.description)?.trim();
    const title = titleDecoded || basename || '上传文档';

    // Create source record
    const source = await this.prisma.knowledgeSource.create({
      data: {
        tenantId,
        title,
        type: 'document',
        category: categoryDecoded || undefined,
        tags: body.tags ? (typeof body.tags === 'string' ? JSON.parse(body.tags) : body.tags) : undefined,
        priority: body.priority ? parseInt(body.priority as any, 10) : 0,
        description: descriptionDecoded || undefined,
        fileName: rawOriginalName || undefined,
        fileType: ext,
        fileSize: file.size ? BigInt(file.size) : undefined,
        parseStatus: 'processing',
        indexStatus: 'pending',
      },
    });

    // Parse with multimodal extraction
    try {
      const parseResult = await this.documentParser.parseDocument(
        source.id,
        file.buffer,
        rawOriginalName,
        { extractTables: true, extractImages: true },
      );

      // Update rawText with the parsed content
      const indexText = this.documentParser.buildIndex(parseResult);
      let rawText = cleanText(parseResult.fullText);
      const extraDecoded = decodeMultipartUtf8(body.extraText);
      if (extraDecoded?.trim()) {
        rawText = rawText ? `${rawText}\n\n---\n\n${cleanText(extraDecoded)}` : cleanText(extraDecoded);
      }

      await this.prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { rawText, contentSections: JSON.parse(JSON.stringify(parseResult.sections)) },
      });

      if (!rawText) {
        await this.prisma.knowledgeSource.update({
          where: { id: source.id },
          data: { parseStatus: 'completed', indexStatus: 'completed' },
        });
      } else {
        await this.indexQueue.enqueueSourceIndex(source.id);
      }

      return this.prisma.knowledgeSource.findUnique({
        where: { id: source.id },
        include: { _count: { select: { chunks: true } } },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '文件解析失败';
      await this.prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { parseStatus: 'failed', parseError: msg },
      });
      throw new BadRequestException(msg);
    }
  }

  async createSource(tenantId: string, data: {
    title: string;
    type: string;
    category?: string;
    tags?: string[];
    priority?: number;
    rawText?: string;
    sourceUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: bigint;
    description?: string;
    knowledgeBaseId?: string;
  }) {
    const source = await this.prisma.knowledgeSource.create({
      data: {
        tenantId,
        knowledgeBaseId: data.knowledgeBaseId,
        title: data.title,
        type: data.type,
        category: data.category,
        tags: data.tags || undefined,
        priority: data.priority || 0,
        rawText: data.rawText,
        sourceUrl: data.sourceUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        description: data.description,
        parseStatus: data.rawText ? 'processing' : 'pending',
        indexStatus: data.rawText ? 'indexing' : 'pending',
      },
    });

    if (data.rawText) {
      await this.indexQueue.enqueueSourceIndex(source.id);
    }

    return this.prisma.knowledgeSource.findUnique({
      where: { id: source.id },
      include: { _count: { select: { chunks: true } } },
    });
  }

  async findByTenant(tenantId: string, page = 1, pageSize = 20, filters?: {
    status?: string; type?: string; category?: string; knowledgeBaseId?: string;
  }) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.category) where.category = filters.category;
    if (filters?.knowledgeBaseId) where.knowledgeBaseId = filters.knowledgeBaseId;

    const [items, total] = await Promise.all([
      this.prisma.knowledgeSource.findMany({
        where,
        include: { _count: { select: { chunks: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.knowledgeSource.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId?: string) {
    const source = await this.prisma.knowledgeSource.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: { chunks: true, _count: { select: { chunks: true } } },
    });
    if (!source) throw new NotFoundException('Knowledge source not found');
    return source;
  }

  async delete(tenantId: string, id: string) {
    await this.findById(id, tenantId);
    await this.prisma.knowledgeChunk.deleteMany({ where: { sourceId: id } });
    return this.prisma.knowledgeSource.delete({ where: { id } });
  }

  async reindex(tenantId: string, id: string) {
    await this.findById(id, tenantId);
    await this.prisma.knowledgeSource.update({
      where: { id },
      data: { indexStatus: 'indexing', indexError: null },
    });
    await this.indexQueue.enqueueSourceIndex(id);
    return { accepted: true, message: '已开始重建索引，完成后状态将更新' };
  }

  async search(tenantId: string, query: string, method?: RetrievalMethod, topK?: number): Promise<RetrievalResult[]> {
    return this.retrieval.retrieve(tenantId, query, method, topK);
  }

  async getChunks(sourceId: string, page = 1, pageSize = 50, tenantId?: string) {
    if (tenantId) {
      const belongs = await this.prisma.knowledgeSource.findFirst({
        where: { id: sourceId, tenantId },
        select: { id: true },
      });
      if (!belongs) throw new NotFoundException('Knowledge source not found');
    }

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

  async updateChunk(tenantId: string, chunkId: string, data: { content?: string; title?: string; status?: string; priority?: number }) {
    const chunk = await this.prisma.knowledgeChunk.findFirst({
      where: { id: chunkId, tenantId },
      select: { id: true },
    });
    if (!chunk) throw new NotFoundException('Knowledge chunk not found');
    return this.prisma.knowledgeChunk.update({
      where: { id: chunkId },
      data,
    });
  }

  async toggleStatus(tenantId: string, id: string) {
    const source = await this.prisma.knowledgeSource.findFirst({ where: { id, tenantId } });
    if (!source) throw new NotFoundException('Knowledge source not found');
    const newStatus = source.status === 'active' ? 'disabled' : 'active';
    return this.prisma.knowledgeSource.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  async getParseJobs(tenantId: string, sourceId: string) {
    await this.findById(sourceId, tenantId);
    return this.prisma.knowledgeParseJob.findMany({
      where: { sourceId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  // Get chunk sections (multimodal content extracted from the document)
  async getSections(tenantId: string, sourceId: string) {
    const source = await this.prisma.knowledgeSource.findFirst({
      where: { id: sourceId, tenantId },
      select: { contentSections: true },
    });
    if (!source) throw new NotFoundException('Knowledge source not found');
    return source?.contentSections || [];
  }

  // ==================== Unknown Questions ====================

  async getUnknownQuestions(tenantId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.prisma.unknownQuestion.findMany({
        where: { tenantId },
        orderBy: { count: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.unknownQuestion.count({ where: { tenantId } }),
    ]);
    return { items, total, page, pageSize };
  }

  async convertToFAQ(tenantId: string, questionId: string, answer: string) {
    const question = await this.prisma.unknownQuestion.findFirst({ where: { id: questionId, tenantId } });
    if (!question) throw new NotFoundException('Unknown question not found');

    const source = await this.createSource(question.tenantId, {
      title: `FAQ: ${question.question.substring(0, 100)}`,
      type: 'faq',
      rawText: `Q: ${question.question}\nA: ${answer}`,
    });

    await this.prisma.unknownQuestion.update({
      where: { id: questionId },
      data: {
        status: 'converted_to_faq',
        suggestedAnswer: answer,
        suggestion: answer,
        resolved: true,
      },
    });

    return source;
  }

  async getRetrievalLogs(tenantId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.prisma.knowledgeRetrievalLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.knowledgeRetrievalLog.count({ where: { tenantId } }),
    ]);
    return { items, total, page, pageSize };
  }

  // ==================== RAG-Enhanced Customer Service ====================

  /** Answer a customer question with RAG */
  async answerWithRAG(tenantId: string, question: string) {
    const result = await this.customerServiceRAG.answerQuestion({
      question,
      tenantId,
    });

    // Build a formatted answer with sources
    const sourceList = result.sources
      .filter((s) => s.fileName || s.sourceTitle)
      .map((s) => {
        let ref = '';
        if (s.fileName) ref += `《${s.fileName}》`;
        if (s.pageNumber) ref += ` 第${s.pageNumber}页`;
        if (s.contentType && s.contentType !== 'text') ref += ` [${s.contentType}]`;
        return ref;
      })
      .filter(Boolean);

    return {
      ...result,
      sourceSummary: sourceList.length > 0 ? `参考资料来源: ${sourceList.join(', ')}` : '未找到相关资料来源',
    };
  }
}
