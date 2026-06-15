import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KnowledgeUploadFieldsDto } from './dto/knowledge-upload.dto';

@ApiTags('admin/knowledge')
@Controller('admin/knowledge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeController {
  constructor(private knowledgeService: KnowledgeService) {}

  // ==================== Knowledge Base CRUD ====================

  @Post('bases')
  @ApiOperation({ summary: '创建知识库' })
  createKnowledgeBase(
    @Request() req,
    @Body() body: { name: string; description?: string; teamId?: string; workspaceId?: string; projectId?: string },
  ) {
    return this.knowledgeService.createKnowledgeBase(req.user.tenantId, body);
  }

  @Get('bases')
  @ApiOperation({ summary: '获取知识库列表' })
  getKnowledgeBases(
    @Request() req,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.knowledgeService.getKnowledgeBases(req.user.tenantId, +page, +pageSize);
  }

  @Get('bases/:id')
  @ApiOperation({ summary: '获取知识库详情' })
  getKnowledgeBase(@Request() req, @Param('id') id: string) {
    return this.knowledgeService.getKnowledgeBase(id, req.user.tenantId);
  }

  @Patch('bases/:id')
  @ApiOperation({ summary: '更新知识库' })
  updateKnowledgeBase(@Request() req, @Param('id') id: string, @Body() body: { name?: string; description?: string; status?: string }) {
    return this.knowledgeService.updateKnowledgeBase(req.user.tenantId, id, body);
  }

  @Delete('bases/:id')
  @ApiOperation({ summary: '删除知识库' })
  deleteKnowledgeBase(@Request() req, @Param('id') id: string) {
    return this.knowledgeService.deleteKnowledgeBase(req.user.tenantId, id);
  }

  // ==================== Knowledge Source CRUD ====================

  @Post()
  @ApiOperation({ summary: '创建知识库来源' })
  create(
    @Request() req,
    @Body() body: {
      title: string; type: string; category?: string; rawText?: string;
      sourceUrl?: string; knowledgeBaseId?: string;
    },
  ) {
    return this.knowledgeService.createSource(req.user.tenantId, body);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 30 * 1024 * 1024 }, // Increased to 30MB for multimodal docs
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '上传文档（PDF、DOCX、PPTX、XLSX、CSV、MD、TXT、图片）；可选 title、category、tags、priority、extraText、knowledgeBaseId',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'string', description: 'JSON array of tags' },
        priority: { type: 'number' },
        description: { type: 'string' },
        extraText: { type: 'string' },
        knowledgeBaseId: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: '上传文件（支持 PDF/DOCX/PPTX/XLSX/CSV/MD/TXT/图片），自动解析并索引' })
  uploadDocument(
    @Request() req: { user: { tenantId: string } },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: KnowledgeUploadFieldsDto,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }
    return this.knowledgeService.createFromUpload(req.user.tenantId, file, body);
  }

  @Get()
  @ApiOperation({ summary: '获取知识库列表' })
  findAll(
    @Request() req,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('knowledgeBaseId') knowledgeBaseId?: string,
  ) {
    return this.knowledgeService.findByTenant(req.user.tenantId, +page, +pageSize, {
      status, type, category, knowledgeBaseId,
    });
  }

  @Get('test-retrieval')
  @ApiOperation({ summary: '检索测试' })
  async testRetrieval(
    @Request() req,
    @Query('query') query: string,
    @Query('method') method?: string,
    @Query('topK') topK?: string,
  ) {
    if (!query) throw new BadRequestException('请提供测试查询');
    const results = await this.knowledgeService.search(req.user.tenantId, query, method as any, topK ? +topK : 5);
    return { query, method: method || 'hybrid', results };
  }

  @Get('rag-answer')
  @ApiOperation({ summary: 'RAG增强问答测试' })
  async ragAnswer(@Request() req, @Query('question') question: string) {
    if (!question) throw new BadRequestException('请提供问题');
    return this.knowledgeService.answerWithRAG(req.user.tenantId, question);
  }

  @Get('unknown-questions')
  @ApiOperation({ summary: '无法回答问题列表' })
  getUnknownQuestions(@Request() req, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.knowledgeService.getUnknownQuestions(req.user.tenantId, +page, +pageSize);
  }

  @Get('retrieval-logs')
  @ApiOperation({ summary: '检索日志' })
  getRetrievalLogs(@Request() req, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.knowledgeService.getRetrievalLogs(req.user.tenantId, +page, +pageSize);
  }

  /** 必须放在 @Get(':id') 之前 */
  @Get(':id/chunks')
  @ApiOperation({ summary: '获取知识源的切片列表' })
  getChunks(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    return this.knowledgeService.getChunks(id, +page, +pageSize, req.user.tenantId);
  }

  @Get(':id/sections')
  @ApiOperation({ summary: '获取文档解析出的多模态内容（表格、图片等）' })
  getSections(@Request() req, @Param('id') id: string) {
    return this.knowledgeService.getSections(req.user.tenantId, id);
  }

  @Get(':id/parse-jobs')
  @ApiOperation({ summary: '获取解析任务列表' })
  getParseJobs(@Request() req, @Param('id') id: string) {
    return this.knowledgeService.getParseJobs(req.user.tenantId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取知识库详情' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.knowledgeService.findById(id, req.user.tenantId);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: '启用/禁用知识源' })
  toggleStatus(@Request() req, @Param('id') id: string) {
    return this.knowledgeService.toggleStatus(req.user.tenantId, id);
  }

  @Patch('chunks/:chunkId')
  @ApiOperation({ summary: '编辑切片' })
  updateChunk(@Request() req, @Param('chunkId') chunkId: string, @Body() body: { content?: string; title?: string; status?: string; priority?: number }) {
    return this.knowledgeService.updateChunk(req.user.tenantId, chunkId, body);
  }

  @Post('unknown-questions/:id/convert-to-faq')
  @ApiOperation({ summary: '将无法回答问题转为FAQ' })
  convertToFAQ(@Request() req, @Param('id') id: string, @Body() body: { answer: string }) {
    return this.knowledgeService.convertToFAQ(req.user.tenantId, id, body.answer);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除知识库来源' })
  delete(@Request() req, @Param('id') id: string) {
    return this.knowledgeService.delete(req.user.tenantId, id);
  }

  @Post(':id/reindex')
  @ApiOperation({ summary: '重新索引知识库' })
  reindex(@Request() req, @Param('id') id: string) {
    return this.knowledgeService.reindex(req.user.tenantId, id);
  }

  @Post('search')
  @ApiOperation({ summary: '知识库检索测试' })
  search(@Request() req, @Body() body: { query: string; method?: string; topK?: number }) {
    return this.knowledgeService.search(req.user.tenantId, body.query, body.method as any, body.topK);
  }
}
