import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService, PUBLIC_CONVERSATION_TOKEN_HEADER } from '../conversations/conversations.service';
import { CreateHumanReplyDto, CreatePublicMessageDto, PublicMessagesQueryDto } from './dto/messages.dto';

@ApiTags('messages')
@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private conversationsService: ConversationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: '发送消息' })
  async create(
    @Param('conversationId') conversationId: string,
    @Headers(PUBLIC_CONVERSATION_TOKEN_HEADER) publicToken: string,
    @Body() _body: CreatePublicMessageDto,
  ) {
    await this.conversationsService.findPublicSession(conversationId, publicToken);
    throw new BadRequestException('Public direct message creation is disabled. Use /api/chat to create a chat turn.');
  }

  @Get()
  @ApiOperation({ summary: '获取会话消息列表' })
  async findByConversation(
    @Param('conversationId') conversationId: string,
    @Headers(PUBLIC_CONVERSATION_TOKEN_HEADER) publicToken: string,
    @Query() query: PublicMessagesQueryDto,
  ) {
    await this.conversationsService.findPublicSession(conversationId, publicToken);
    return this.messagesService.findByConversation(
      conversationId,
      query.limit ?? 50,
      query.after ? new Date(query.after) : undefined,
    );
  }
}

@ApiTags('admin/messages')
@Controller('admin/conversations/:conversationId/messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminMessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: '人工客服回复会话' })
  createHumanReply(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Body() body: CreateHumanReplyDto,
  ) {
    return this.messagesService.createForTenant(
      req.user.tenantId,
      conversationId,
      'assistant',
      body.content,
      { sender: 'human', source: 'admin' },
    );
  }
}
