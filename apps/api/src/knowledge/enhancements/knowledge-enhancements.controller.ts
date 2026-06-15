import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { KnowledgeEnhancementsService, QAPair } from './knowledge-enhancements.service';

@ApiTags('admin/knowledge/enhancements')
@Controller('admin/knowledge/enhancements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeEnhancementsController {
  constructor(private readonly service: KnowledgeEnhancementsService) {}

  @Post('batch-import')
  async batchImport(@Req() req: any, @Body() body: { pairs: QAPair[]; knowledgeBaseId?: string }) {
    return this.service.batchImportQA(req.user.tenantId, body.pairs, body.knowledgeBaseId);
  }

  @Post('learn-from-chat')
  async learnFromChat(@Req() req: any, @Body() body: { minMessages?: number; maxConversations?: number; channel?: string }) {
    return this.service.learnFromChatHistory(req.user.tenantId, body);
  }

  @Post('import-learned')
  async importLearned(@Req() req: any, @Body() body: { pairs: QAPair[]; knowledgeBaseId?: string }) {
    return this.service.importLearnedPairs(req.user.tenantId, body.pairs, body.knowledgeBaseId);
  }

  @Get('keyword-test')
  async keywordTest(@Req() req: any, @Query('query') query: string) {
    return this.service.testKeywordMatch(req.user.tenantId, query);
  }

  @Get('juguang-templates')
  getJuguangTemplates() {
    return this.service.getJuguangTemplates();
  }

  @Post('import-juguang-templates')
  async importJuguangTemplates(@Req() req: any, @Body() body: { categories?: string[]; knowledgeBaseId?: string }) {
    const templates = this.service.getJuguangTemplates();
    const pairs: QAPair[] = [];
    for (const tpl of templates) {
      if (body.categories && !body.categories.includes(tpl.category)) continue;
      for (const pair of tpl.pairs) {
        pairs.push({ ...pair, category: tpl.category });
      }
    }
    return this.service.batchImportQA(req.user.tenantId, pairs, body.knowledgeBaseId);
  }
}
