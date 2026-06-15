import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService, PUBLIC_CONVERSATION_TOKEN_HEADER } from '../conversations/conversations.service';
import { CreatePublicLeadDto, UpdateLeadDto } from './dto/leads.dto';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(
    private leadsService: LeadsService,
    private conversationsService: ConversationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: '提交留资' })
  async create(
    @Headers(PUBLIC_CONVERSATION_TOKEN_HEADER) publicToken: string,
    @Body() body: CreatePublicLeadDto,
  ) {
    const conversation = await this.conversationsService.findPublicSession(
      body.conversationId,
      body.conversationToken || publicToken,
    );
    return this.leadsService.createForConversation(conversation.tenantId, body.conversationId, {
      name: body.name,
      phone: body.phone,
      source: body.source || 'chat',
    });
  }
}

@ApiTags('admin/leads')
@Controller('admin/leads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminLeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: '获取线索列表' })
  findAll(
    @Request() req,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('followStatus') followStatus?: string,
    @Query('source') source?: string,
    @Query('search') search?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.leadsService.findByTenant(req.user.tenantId, +page, +pageSize, { followStatus, source, search, ownerId });
  }

  @Get('reminders')
  @ApiOperation({ summary: '超时未跟进线索提醒' })
  getFollowUpReminders(@Request() req, @Query('hours') hours?: string) {
    return this.leadsService.getFollowUpReminders(req.user.tenantId, hours ? parseInt(hours) : undefined);
  }

  @Get('source-stats')
  @ApiOperation({ summary: '线索来源统计' })
  getSourceStats(@Request() req) {
    return this.leadsService.getSourceStats(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取线索详情' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.leadsService.findById(req.user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新线索' })
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateLeadDto) {
    return this.leadsService.update(req.user.tenantId, id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '流转线索状态' })
  updateStatus(@Request() req, @Param('id') id: string, @Body('status') status: string) {
    return this.leadsService.updateStatus(req.user.tenantId, id, status);
  }

  // --- Tags ---

  @Get('tags')
  @ApiOperation({ summary: '获取所有标签' })
  getTags(@Request() req) {
    return this.leadsService.getTags(req.user.tenantId);
  }

  @Post('tags')
  @ApiOperation({ summary: '创建标签' })
  createTag(@Request() req, @Body() body: { name: string; color?: string }) {
    return this.leadsService.createTag(req.user.tenantId, body.name, body.color);
  }

  @Delete('tags/:tagId')
  @ApiOperation({ summary: '删除标签' })
  deleteTag(@Request() req, @Param('tagId') tagId: string) {
    return this.leadsService.deleteTag(req.user.tenantId, tagId);
  }

  @Post(':id/tags/:tagId')
  @ApiOperation({ summary: '给线索添加标签' })
  addTagToLead(@Request() req, @Param('id') id: string, @Param('tagId') tagId: string) {
    return this.leadsService.addTagToLead(req.user.tenantId, id, tagId);
  }

  @Delete(':id/tags/:tagId')
  @ApiOperation({ summary: '移除线索标签' })
  removeTagFromLead(@Request() req, @Param('id') id: string, @Param('tagId') tagId: string) {
    return this.leadsService.removeTagFromLead(req.user.tenantId, id, tagId);
  }

  @Get('tags/:tagId/leads')
  @ApiOperation({ summary: '按标签获取线索' })
  getLeadsByTag(
    @Request() req,
    @Param('tagId') tagId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.leadsService.getLeadsByTag(req.user.tenantId, tagId, +page, +pageSize);
  }
}
