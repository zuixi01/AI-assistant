import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlatformRouterService, PlatformMessage } from '../../platform/platform-router.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { LeadsService } from '../../leads/leads.service';

@Injectable()
export class ChatGptOnCsService {
  private readonly logger = new Logger(ChatGptOnCsService.name);

  constructor(
    private prisma: PrismaService,
    private platformRouter: PlatformRouterService,
    private conversationsService: ConversationsService,
    private leadsService: LeadsService,
  ) {}

  async handleMessage(payload: {
    platform: string;
    fromUserId: string;
    fromNickname?: string;
    toUserId: string;
    content: string;
    messageType?: string;
    platformMessageId?: string;
    accountId?: string;
    metadata?: Record<string, any>;
  }) {
    const { platform, fromUserId, toUserId, content, messageType, platformMessageId, accountId, metadata } = payload;

    // Idempotency check
    if (platformMessageId) {
      const existing = await this.prisma.webhookEvent.findFirst({
        where: { externalEventId: platformMessageId, platform: `chatgpt-on-cs-${platform}` },
      });
      if (existing) {
        this.logger.log(`ChatGPT-On-CS message ${platformMessageId} already processed, skipping`);
        return { success: true, duplicate: true };
      }
    }

    // Resolve tenant from account or metadata
    const tenantId = await this.resolveTenantId(payload);
    if (!tenantId) {
      return { success: false, error: 'Cannot resolve tenant' };
    }

    // Record webhook event for idempotency
    if (platformMessageId) {
      await this.prisma.webhookEvent.create({
        data: {
          platform: `chatgpt-on-cs-${platform}`,
          externalEventId: platformMessageId,
          eventType: "message",
          payload: payload as any,
          processed: true,
        },
      });
    }

    // Route through unified platform router
    const msg: PlatformMessage = {
      channel: platform,
      tenantId,
      fromUserId,
      toUserId,
      content,
      messageType: messageType || 'text',
      metadata,
      accountId,
      platformMessageId,
    };

    return this.platformRouter.handleMessage(msg);
  }

  async handleBindAccount(tenantId: string, data: {
    platform: string;
    platformUserId: string;
    platformNickname?: string;
    accessToken?: string;
    config?: Record<string, any>;
    autoReply?: boolean;
  }) {
    const account = await this.prisma.chatGptOnCsAccount.upsert({
      where: {
        tenantId_platform_platformUserId: {
          tenantId,
          platform: data.platform,
          platformUserId: data.platformUserId,
        },
      },
      create: {
        tenantId,
        platform: data.platform,
        platformUserId: data.platformUserId,
        platformNickname: data.platformNickname,
        accessToken: data.accessToken,
        config: data.config as any,
        autoReply: data.autoReply ?? true,
        status: 'active',
      },
      update: {
        platformNickname: data.platformNickname,
        accessToken: data.accessToken,
        config: data.config as any,
        autoReply: data.autoReply,
        status: 'active',
      },
    });

    this.logger.log(`ChatGPT-On-CS account bound: ${data.platform}/${data.platformUserId} -> tenant ${tenantId}`);
    return account;
  }

  async unbindAccount(tenantId: string, platform: string, platformUserId: string) {
    await this.prisma.chatGptOnCsAccount.updateMany({
      where: { tenantId, platform, platformUserId },
      data: { status: 'inactive' },
    });
    return { success: true };
  }

  async getAccounts(tenantId: string, platform?: string) {
    return this.prisma.chatGptOnCsAccount.findMany({
      where: { tenantId, ...(platform ? { platform } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAccount(id: string, tenantId: string, data: {
    platformNickname?: string;
    accessToken?: string;
    config?: Record<string, any>;
    autoReply?: boolean;
    status?: string;
  }) {
    return this.prisma.chatGptOnCsAccount.update({
      where: { id, tenantId },
      data,
    });
  }

  async deleteAccount(id: string, tenantId: string) {
    return this.prisma.chatGptOnCsAccount.delete({
      where: { id, tenantId },
    });
  }

  async getPlatformStatus() {
    return {
      connected: true,
      supportedPlatforms: ['wechat', 'taobao', 'pdd', 'bilibili', 'weibo', 'zhihu', 'douyin_enterprise'],
    };
  }

  private async resolveTenantId(payload: any): Promise<string | null> {
    if (payload.tenantId) return payload.tenantId;

    if (payload.accountId) {
      const account = await this.prisma.chatGptOnCsAccount.findFirst({
        where: { id: payload.accountId, status: 'active' },
      });
      if (account) return account.tenantId;
    }

    if (payload.toUserId) {
      const account = await this.prisma.chatGptOnCsAccount.findFirst({
        where: { platformUserId: payload.toUserId, status: 'active' },
      });
      if (account) return account.tenantId;
    }

    // Fallback: use first active tenant (single-tenant deployments)
    const tenant = await this.prisma.tenant.findFirst({ where: { status: 'active' } });
    return tenant?.id || null;
  }
}
