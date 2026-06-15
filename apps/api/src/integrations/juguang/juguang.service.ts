import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlatformRouterService, PlatformMessage } from '../../platform/platform-router.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { LeadsService } from '../../leads/leads.service';

@Injectable()
export class JuguangService {
  private readonly logger = new Logger(JuguangService.name);

  constructor(
    private prisma: PrismaService,
    private platformRouter: PlatformRouterService,
    private conversationsService: ConversationsService,
    private leadsService: LeadsService,
  ) {}

  async handleWebhook(payload: any) {
    const eventType = payload.event_type || payload.type;
    switch (eventType) {
      case 'im.send':
      case 'message':
        return this.handleMessage(payload);
      case 'im.bind_account':
        return this.handleBindAccount(payload);
      case 'im.unbind_account':
        return this.handleUnbindAccount(payload);
      case 'lead.submit':
      case 'lead.data':
        return this.handleLeadData(payload);
      default:
        this.logger.warn('Unknown Juguang event type: ' + eventType);
        return { success: false, error: 'Unknown event type: ' + eventType };
    }
  }

  async handleMessage(payload: any) {
    const data = payload.data || payload;
    const message_id = data.message_id;
    const from_user_id = data.from_user_id;
    const to_user_id = data.to_user_id;
    const content = data.content;
    const message_type = data.message_type || 'text';
    const user_info = data.user_info;
    const app_id = data.app_id;

    if (message_id) {
      const existing = await this.prisma.webhookEvent.findFirst({
        where: { externalEventId: message_id, platform: 'juguang' },
      });
      if (existing) {
        this.logger.log('Juguang message ' + message_id + ' already processed, skipping');
        return { success: true, duplicate: true };
      }
    }

    const account = await this.resolveAccount(app_id, to_user_id, payload.tenantId);
    if (!account) {
      return { success: false, error: 'Cannot resolve tenant account' };
    }

    if (message_id) {
      await this.prisma.webhookEvent.create({
        data: {
          platform: 'juguang',
          externalEventId: message_id,
          eventType: 'message',
          payload: payload as any,
          processed: true,
        },
      });
    }

    const msg: PlatformMessage = {
      channel: 'juguang',
      tenantId: account.tenantId,
      fromUserId: from_user_id,
      toUserId: to_user_id,
      content: content || '',
      messageType: message_type,
      metadata: { userInfo: user_info, appId: app_id },
      accountId: account.id,
      platformMessageId: message_id,
    };

    return this.platformRouter.handleMessage(msg);
  }

  async handleLeadData(payload: any) {
    const data = payload.data || payload;
    const account = await this.resolveAccount(data.app_id, data.to_user_id, payload.tenantId);
    if (!account) {
      return { success: false, error: 'Cannot resolve tenant account' };
    }

    const lead = await this.leadsService.create(account.tenantId, {
      name: data.name || '聚光线索',
      phone: data.phone,
      source: data.source || 'juguang',
    });

    this.logger.log('Juguang lead created: ' + lead.id + ' for tenant ' + account.tenantId);
    return { success: true, leadId: lead.id };
  }

  async handleBindAccount(payload: any) {
    const data = payload.data || payload;
    const tenantId = payload.tenantId || data.tenantId;
    if (!tenantId) return { success: false, error: 'tenantId required' };
    return this.createAccount(tenantId, data);
  }

  async handleUnbindAccount(payload: any) {
    const data = payload.data || payload;
    const tenantId = payload.tenantId || data.tenantId;
    if (!tenantId) return { success: false, error: 'tenantId required' };
    const account = await this.prisma.juguangAccount.findFirst({
      where: { tenantId, appId: data.app_id || data.appId },
    });
    if (!account) return { success: false, error: 'Account not found' };
    return this.deleteAccount(account.id, tenantId);
  }

  async createAccount(tenantId: string, data: {
    appId: string;
    appSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    accountName?: string;
    autoReply?: boolean;
    config?: Record<string, any>;
  }) {
    const account = await this.prisma.juguangAccount.upsert({
      where: { tenantId_appId: { tenantId, appId: data.appId } },
      create: {
        tenantId,
        appId: data.appId,
        appSecret: data.appSecret,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        accountName: data.accountName,
        autoReply: data.autoReply ?? true,
        config: data.config as any,
        status: 'active',
      },
      update: {
        appSecret: data.appSecret,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        accountName: data.accountName,
        autoReply: data.autoReply,
        config: data.config as any,
        status: 'active',
      },
    });
    this.logger.log('Juguang account bound: ' + data.appId + ' -> tenant ' + tenantId);
    return account;
  }

  async getAccounts(tenantId: string) {
    return this.prisma.juguangAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAccount(id: string, tenantId: string) {
    const account = await this.prisma.juguangAccount.findFirst({ where: { id, tenantId } });
    if (!account) {
      throw new NotFoundException('Juguang account not found');
    }
    return account;
  }

  async updateAccount(id: string, tenantId: string, data: {
    appSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    accountName?: string;
    autoReply?: boolean;
    status?: string;
    config?: Record<string, any>;
  }) {
    await this.getAccount(id, tenantId);
    await this.prisma.juguangAccount.updateMany({
      where: { id, tenantId },
      data,
    });
    return this.getAccount(id, tenantId);
  }

  async deleteAccount(id: string, tenantId: string) {
    const deleted = await this.prisma.juguangAccount.deleteMany({ where: { id, tenantId } });
    if (deleted.count === 0) {
      throw new NotFoundException('Juguang account not found');
    }
    return { success: true };
  }

  async refreshToken(id: string, tenantId: string) {
    const account = await this.prisma.juguangAccount.findFirst({ where: { id, tenantId } });
    if (!account || !account.refreshToken) {
      throw new BadRequestException('No refresh token available');
    }
    this.logger.log('Token refresh requested for account ' + id);
    return { success: true, message: 'Token refresh initiated' };
  }

  private async resolveAccount(appId?: string, toUserId?: string, tenantId?: string) {
    if (tenantId && appId) {
      return this.prisma.juguangAccount.findFirst({ where: { tenantId, appId, status: 'active' } });
    }
    if (appId) {
      return this.prisma.juguangAccount.findFirst({ where: { appId, status: 'active' } });
    }
    const tenant = await this.prisma.tenant.findFirst({ where: { status: 'active' } });
    if (!tenant) return null;
    return this.prisma.juguangAccount.findFirst({ where: { tenantId: tenant.id, status: 'active' } });
  }
}
