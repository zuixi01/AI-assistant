import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService, PUBLIC_CONVERSATION_TOKEN_HEADER } from './conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantsService } from '../tenants/tenants.service';
import { CreateConversationDto, UpdateConversationStatusDto } from './dto/conversation.dto';
import { WorkspaceService } from '../workspace/workspace.service';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(
    private conversationsService: ConversationsService,
    private tenantsService: TenantsService,
  ) {}

  @Post()
  @ApiOperation({ summary: '创建会话' })
  async create(@Body() body: CreateConversationDto) {
    if (!body.tenantSlug && !body.tenantId) {
      throw new BadRequestException('tenantSlug or tenantId is required');
    }
    const tenant = body.tenantSlug
      ? await this.tenantsService.findBySlug(body.tenantSlug)
      : await this.tenantsService.findById(body.tenantId!);
    return this.conversationsService.create(tenant.id, body.channel, body.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取会话详情' })
  findOne(@Param('id') id: string, @Headers(PUBLIC_CONVERSATION_TOKEN_HEADER) publicToken: string) {
    return this.conversationsService.findPublicByToken(id, publicToken);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新会话状态' })
  updateStatus(@Request() req, @Param('id') id: string, @Body() body: UpdateConversationStatusDto) {
    return this.conversationsService.updateStatus(req.user.tenantId, id, body.status);
  }
}

@ApiTags('admin/conversations')
@Controller('admin/conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminConversationsController {
  constructor(
    private conversationsService: ConversationsService,
    private workspaceService: WorkspaceService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取会话列表（管理后台）' })
  findAll(
    @Request() req,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
  ) {
    return this.conversationsService.findByTenant(req.user.tenantId, +page, +pageSize, { status });
  }

  @Get(':id')
  @ApiOperation({ summary: '获取会话详情（管理后台）' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.conversationsService.findById(req.user.tenantId, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '更新会话状态（管理后台）' })
  updateStatus(@Request() req, @Param('id') id: string, @Body() body: UpdateConversationStatusDto) {
    return this.workspaceService.updateStatus(id, req.user.tenantId, body.status);
  }

  @Patch(':id/assignment')
  @ApiOperation({ summary: '指派或取消指派会话（管理后台）' })
  updateAssignment(@Request() req, @Param('id') id: string, @Body() body: { assignedTo?: string | null }) {
    if (!body.assignedTo) {
      return this.workspaceService.unassignConversation(id, req.user.tenantId);
    }
    return this.workspaceService.assignConversation(id, req.user.tenantId, body.assignedTo);
  }

  @Post(':id/reply')
  @ApiOperation({ summary: '发送人工回复（管理后台）' })
  sendReply(@Request() req, @Param('id') id: string, @Body() body: { content: string }) {
    return this.workspaceService.sendManualReply(id, req.user.tenantId, body.content, req.user.id);
  }
}
