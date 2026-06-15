import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ChatService, ChatRequest } from '../chat/chat.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessageAdapterService } from './message-adapter.service';
import { ReplyStrategyService } from '../reply-strategy/reply-strategy.service';

export interface PlatformMessage {
  channel: string;
  tenantId: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  messageType?: string;
  metadata?: Record<string, any>;
  accountId?: string;
  platformMessageId?: string;
}

export interface PlatformReplyResult {
  success: boolean;
  conversationId?: string;
  replyContent?: string;
  error?: string;
}

export interface ReplySender {
  channel: string;
  send(toUserId: string, content: string, options?: Record<string, any>): Promise<boolean>;
}

interface ChannelConfig {
  maxReplyLength: number;
  supportsMarkdown: boolean;
  replyDelayMs: number;
  style: 'concise' | 'detailed' | 'professional';
}

const CHANNEL_CONFIG: Record<string, ChannelConfig> = {
  wechat: { maxReplyLength: 600, supportsMarkdown: false, replyDelayMs: 1000, style: 'concise' },
  taobao: { maxReplyLength: 2000, supportsMarkdown: false, replyDelayMs: 800, style: 'detailed' },
  pdd: { maxReplyLength: 1500, supportsMarkdown: false, replyDelayMs: 800, style: 'concise' },
  bilibili: { maxReplyLength: 1000, supportsMarkdown: false, replyDelayMs: 1200, style: 'concise' },
  weibo: { maxReplyLength: 2000, supportsMarkdown: true, replyDelayMs: 1000, style: 'professional' },
  zhihu: { maxReplyLength: 5000, supportsMarkdown: true, replyDelayMs: 1000, style: 'detailed' },
  douyin_enterprise: { maxReplyLength: 800, supportsMarkdown: false, replyDelayMs: 800, style: 'concise' },
  xiaohongshu: { maxReplyLength: 1000, supportsMarkdown: false, replyDelayMs: 1000, style: 'concise' },
  juguang: { maxReplyLength: 1000, supportsMarkdown: false, replyDelayMs: 1000, style: 'concise' },
};

@Injectable()
export class PlatformRouterService {
  private readonly logger = new Logger(PlatformRouterService.name);
  private readonly senders = new Map<string, ReplySender>();

  constructor(
    private prisma: PrismaService,
    private chatService: ChatService,
    private conversationsService: ConversationsService,
    private messageAdapter: MessageAdapterService,
    private replyStrategy: ReplyStrategyService,
  ) {}

  registerSender(sender: ReplySender) {
    this.senders.set(sender.channel, sender);
    this.logger.log(`Reply sender registered for channel: ${sender.channel}`);
  }

  getChannelConfig(channel: string): ChannelConfig {
    return CHANNEL_CONFIG[channel] || {
      maxReplyLength: 2000,
      supportsMarkdown: false,
      replyDelayMs: 1000,
      style: 'detailed',
    };
  }

  async handleMessage(msg: PlatformMessage): Promise<PlatformReplyResult> {
    try {
      const conversation = await this.findOrCreateConversation(msg.tenantId, msg.channel, msg.fromUserId, msg.accountId);

      const incomingMessage = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: msg.content,
          channel: msg.channel,
          metadata: {
            platformUserId: msg.fromUserId,
            platformAccountId: msg.accountId || null,
            platformMessageId: msg.platformMessageId || null,
          },
        },
      });

      // Check if auto-reply is enabled for this channel/account
      if (msg.accountId) {
        const account = await this.prisma.chatGptOnCsAccount.findFirst({
          where: { id: msg.accountId, status: 'active' },
        });
        if (account && !account.autoReply) {
          this.logger.log(`Auto-reply disabled for account ${msg.accountId}, skipping`);
          return { success: true, conversationId: conversation.id };
        }
      }

      // Get AI response
      const chatRequest: ChatRequest = {
        conversationId: conversation.id,
        tenantId: msg.tenantId,
        userMessage: msg.content,
        persistedUserMessageId: incomingMessage.id,
      };

      const response = await this.chatService.generateReplyForPersistedTurn(chatRequest);

      // Adapt reply for the target channel
      const config = this.getChannelConfig(msg.channel);
      const adaptedContent = this.messageAdapter.adaptReply(response.content, {
        channel: msg.channel,
        maxLength: config.maxReplyLength,
        supportsMarkdown: config.supportsMarkdown,
        style: config.style,
      });

      // Store AI reply
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: adaptedContent,
          channel: msg.channel,
          metadata: {
            intent: response.intent,
            intentScore: response.intentScore,
            confidence: response.confidence,
            answerStatus: response.answerStatus,
            conversationStatus: response.conversationStatus,
            requiresHuman: response.requiresHuman,
            products: response.products || [],
          },
          citations: (response.citations as any) || undefined,
        },
      });

      // Send reply via channel sender with humanized delay
      const sender = this.senders.get(msg.channel);
      if (sender) {
        await this.replyStrategy.wait(msg.channel, adaptedContent);
        await sender.send(msg.fromUserId, adaptedContent, msg.metadata);
      }

      return {
        success: true,
        conversationId: conversation.id,
        replyContent: adaptedContent,
      };
    } catch (e: any) {
      this.logger.error(`PlatformRouter handleMessage failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  async findOrCreateConversation(tenantId: string, channel: string, userId: string, accountId?: string) {
    const baseWhere: Record<string, any> = {
      tenantId,
      channel,
      status: { in: ['open', 'pending_human', 'needs_review'] },
    };

    if (userId) {
      baseWhere.platformUserId = userId;
    }
    if (accountId !== undefined) {
      baseWhere.platformAccountId = accountId;
    }

    const existing = await this.prisma.conversation.findFirst({
      where: baseWhere,
      orderBy: { updatedAt: 'desc' },
    });

    if (existing && existing.updatedAt.getTime() > Date.now() - 24 * 3600 * 1000) {
      return existing;
    }

    const result = await this.conversationsService.create(tenantId, channel, undefined, {
      platformUserId: userId,
      platformAccountId: accountId,
    });
    return { id: result.id, tenantId, channel };
  }
}
