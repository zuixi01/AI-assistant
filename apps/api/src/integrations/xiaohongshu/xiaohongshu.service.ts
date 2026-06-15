import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatService, ChatRequest } from '../../chat/chat.service';
import { ConversationsService, CONVERSATION_STATUS } from '../../conversations/conversations.service';
import { LeadsService } from '../../leads/leads.service';
import { XhsApiClient } from './xhs-api.client';
import { XhsCrypto } from './xhs-crypto';

@Injectable()
export class XiaohongshuService {
  private readonly logger = new Logger(XiaohongshuService.name);

  constructor(
    private prisma: PrismaService,
    private chatService: ChatService,
    private conversationsService: ConversationsService,
    private leadsService: LeadsService,
    private xhsApiClient: XhsApiClient,
    private xhsCrypto: XhsCrypto,
    private configService: ConfigService,
  ) {}

  // ─── Webhook Handlers ──────────────────────────────────────────

  async handleMessage(payload: any) {
    const { message_id, message_type, message_source, from_user_id, to_user_id, timestamp, content, user_info } = payload;

    // Idempotency: skip if already processed
    const existing = await this.prisma.xhsMessage.findUnique({ where: { messageId: message_id } });
    if (existing) {
      this.logger.log(`XHS message ${message_id} already processed, skipping`);
      return { success: true, duplicate: true };
    }

    // Find the bound XHS account for the recipient (to_user_id is the merchant/agent)
    const account = await this.prisma.xhsAccount.findFirst({
      where: { userId: to_user_id, status: 'active' },
    });
    if (!account) {
      this.logger.warn(`No active XHS account found for to_user_id=${to_user_id}`);
      return { success: false, error: 'No active account' };
    }

    // Decrypt content
    let decryptedContent: string | null = null;
    try {
      decryptedContent = content ? this.xhsCrypto.decrypt(content) : null;
    } catch (e: any) {
      this.logger.warn(`Failed to decrypt XHS message ${message_id}: ${e.message}`);
      decryptedContent = content; // store raw if decryption fails
    }
    const messageText = this.extractTextContent(decryptedContent);

    // Find or create conversation
    const conversation = await this.findOrCreateConversation(account.tenantId, from_user_id, account.id, user_info);

    // Store message
    await this.prisma.xhsMessage.create({
      data: {
        tenantId: account.tenantId,
        accountId: account.id,
        conversationId: conversation.id,
        messageId: message_id,
        messageType: message_type,
        messageSource: message_source,
        fromUserId: from_user_id,
        toUserId: to_user_id,
        content: messageText || decryptedContent,
        rawContent: content,
        timestamp: new Date(timestamp),
        userInfo: user_info || null,
        processed: true,
      },
    });

    // Only auto-reply to user messages (source=1 is C2B user message)
    if (message_source === 1 && (messageText || decryptedContent)) {
      await this.autoReply(account, conversation, from_user_id, to_user_id, messageText || decryptedContent || '');
    }

    return { success: true, conversationId: conversation.id };
  }

  async handleBindAccount(payload: any) {
    const data = this.decryptEnvelopePayload(payload);
    const tokenData = this.decodeBindToken(data.token);

    const { user_id, nick_name } = data;
    if (!user_id) return { success: false, error: 'Missing user_id' };

    const tenantId = tokenData?.tenant_id || tokenData?.tenantId || await this.resolveTenantId(data);
    if (!tenantId) return { success: false, error: 'Cannot resolve tenant' };
    const accountCode = data.account_code || data.accountCode || tokenData?.account_code || tokenData?.accountCode || '';
    const appId = String(data.app_id ?? data.appId ?? tokenData?.app_id ?? this.configService.get<string>('XHS_APP_ID', ''));
    const accessToken = data.access_token || data.accessToken || null;

    await this.prisma.xhsAccount.upsert({
      where: { tenantId_userId: { tenantId, userId: user_id } },
      create: {
        tenantId,
        userId: user_id,
        appId,
        accountCode,
        nickName: nick_name,
        accessToken,
        status: 'active',
      },
      update: {
        appId,
        accountCode,
        nickName: nick_name,
        accessToken: accessToken ?? undefined,
        status: 'active',
      },
    });

    this.logger.log(`XHS account bound: user_id=${user_id}, tenant=${tenantId}`);
    return { success: true };
  }

  async handleUnbindAccount(payload: any) {
    const data = this.decryptEnvelopePayload(payload);
    const { user_id, account_code } = data;
    if (!user_id && !account_code) return { success: false, error: 'Missing user_id' };

    await this.prisma.xhsAccount.updateMany({
      where: { ...(user_id ? { userId: user_id } : { accountCode: account_code }), status: 'active' },
      data: { status: 'inactive' },
    });

    this.logger.log(`XHS account unbound: user_id=${user_id}`);
    return { success: true };
  }

  async handleKosBindEvent(payload: any) {
    const data = this.decryptEnvelopePayload(payload);
    const { user_id, auth_status, kos_user_id } = data;
    if (!user_id) return { success: false, error: 'Missing user_id' };

    const status = auth_status === 2 ? 'active' : 'inactive';

    const account = await this.prisma.xhsAccount.findFirst({ where: { userId: user_id } });
    if (account) {
      await this.prisma.xhsAccount.update({
        where: { id: account.id },
        data: { status, kosUserId: kos_user_id || account.kosUserId, accountType: 'kos' },
      });
    }

    this.logger.log(`XHS KOS bind event: user_id=${user_id}, status=${status}`);
    return { success: true };
  }

  async handleIntentComment(payload: any) {
    const data = this.decryptEnvelopePayload(payload);
    this.logger.log(`XHS intent comment received: ${JSON.stringify(data).substring(0, 200)}`);
    const tenantId = await this.resolveTenantId(data);
    if (tenantId && data.user_id) {
      await this.leadsService.create(tenantId, {
        source: 'xiaohongshu_comment',
        name: data.user_info?.nickname || data.user_id,
      }).catch(e => this.logger.warn(`Failed to create lead from intent comment: ${e.message}`));
    }
    return { success: true };
  }

  async handleLeadData(payload: any) {
    const data = this.decryptEnvelopePayload(payload);
    this.logger.log(`XHS lead data received: ${JSON.stringify(data).substring(0, 200)}`);
    const tenantId = await this.resolveTenantId(data);
    if (tenantId) {
      await this.leadsService.create(tenantId, {
        source: 'xiaohongshu_lead',
        name: data.name || data.user_info?.nickname,
        phone: data.phone,
      }).catch(e => this.logger.warn(`Failed to create lead from XHS data: ${e.message}`));
    }
    return { success: true };
  }

  // ─── Admin Methods ─────────────────────────────────────────────

  async getAccounts(tenantId: string) {
    return this.prisma.xhsAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generate the documented Juguang account binding URL.
   * Admin shows this URL as a QR code; XHS posts bind_account after binding.
   */
  async generateAuthUrl(tenantId: string): Promise<{ url: string; state: string; accountCode: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    const accountCode = tenant?.slug || tenantId;
    const token = this.xhsCrypto.encrypt(JSON.stringify({
      tenant_id: tenantId,
      account_code: accountCode,
    }));
    const url = this.xhsApiClient.getBindingUrl(token);
    return { url, state: tenantId, accountCode };
  }

  /**
   * Handle OAuth callback: exchange code for token, auto-create account.
   */
  async handleOAuthCallback(code: string, state: string): Promise<{
    success: boolean;
    accountId?: string;
    error?: string;
  }> {
    const tenantId = state.split(':')[0];
    if (!tenantId) {
      return { success: false, error: 'Invalid state parameter' };
    }

    try {
      const tokenData = await this.xhsApiClient.exchangeCode(code);
      const { access_token, user_id, third_account_id, nick_name } = tokenData;

      if (!user_id || !access_token) {
        return { success: false, error: 'OAuth response missing user_id or access_token' };
      }

      const account = await this.prisma.xhsAccount.upsert({
        where: { tenantId_userId: { tenantId, userId: user_id } },
        create: {
          tenantId,
          userId: user_id,
          appId: this.configService.get<string>('XHS_APP_ID', ''),
          accountCode: third_account_id || '',
          nickName: nick_name || null,
          accountType: 'enterprise',
          accessToken: access_token,
          status: 'active',
        },
        update: {
          accessToken: access_token,
          accountCode: third_account_id || undefined,
          nickName: nick_name || undefined,
          status: 'active',
        },
      });

      this.logger.log(`XHS OAuth account created/updated: userId=${user_id}, tenant=${tenantId}`);
      return { success: true, accountId: account.id };
    } catch (e: any) {
      this.logger.error(`XHS OAuth callback failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  async createAccount(tenantId: string, data: {
    userId: string;
    appId: string;
    accountCode: string;
    nickName?: string;
    accountType?: string;
    accessToken?: string;
  }) {
    return this.prisma.xhsAccount.create({
      data: {
        tenantId,
        userId: data.userId,
        appId: data.appId,
        accountCode: data.accountCode,
        nickName: data.nickName || null,
        accountType: data.accountType || 'enterprise',
        accessToken: data.accessToken || null,
        status: 'active',
      },
    });
  }

  async updateAccount(id: string, tenantId: string, data: {
    nickName?: string;
    accountType?: string;
    accessToken?: string;
    status?: string;
  }) {
    return this.prisma.xhsAccount.update({
      where: { id, tenantId },
      data,
    });
  }

  async deleteAccount(id: string, tenantId: string) {
    return this.prisma.xhsAccount.delete({
      where: { id, tenantId },
    });
  }

  async getMessages(tenantId: string, conversationId?: string) {
    return this.prisma.xhsMessage.findMany({
      where: { tenantId, ...(conversationId ? { conversationId } : {}) },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async sendManualReply(tenantId: string, accountId: string, toUserId: string, content: string) {
    const account = await this.prisma.xhsAccount.findFirst({
      where: { id: accountId, tenantId, status: 'active' },
    });
    if (!account) throw new NotFoundException('Account not found or inactive');

    const encrypted = this.encryptTextContent(content);
    const result = await this.xhsApiClient.sendMessage({
      userId: account.userId,
      requestId: randomUUID(),
      messageType: 'TEXT',
      fromUserId: account.userId,
      toUserId,
      thirdAccountId: account.accountCode,
      timestamp: Date.now(),
      contentEncrypted: encrypted,
    }, account.accessToken || undefined);

    return result;
  }

  // ─── Internal Helpers ──────────────────────────────────────────

  private async autoReply(
    account: any,
    conversation: any,
    fromUserId: string,
    toUserId: string,
    userMessage: string,
  ) {
    try {
      const chatRequest: ChatRequest = {
        conversationId: conversation.id,
        tenantId: account.tenantId,
        userMessage,
      };

      const response = await this.chatService.chat(chatRequest);

      if (response.content) {
        const encrypted = this.encryptTextContent(response.content);
        await this.xhsApiClient.sendMessage({
          userId: account.userId,
          requestId: randomUUID(),
          messageType: 'TEXT',
          fromUserId: toUserId,
          toUserId: fromUserId,
          thirdAccountId: account.accountCode,
          timestamp: Date.now(),
          contentEncrypted: encrypted,
        }, account.accessToken || undefined);

        this.logger.log(`XHS auto-reply sent for conversation ${conversation.id}`);
      }

      if (response.requiresHuman) {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: CONVERSATION_STATUS.PENDING_HUMAN },
        });
        this.logger.log(`XHS conversation ${conversation.id} transferred to human`);
      }
    } catch (e: any) {
      this.logger.error(`XHS auto-reply failed for conversation ${conversation.id}: ${e.message}`);
    }
  }

  private async findOrCreateConversation(tenantId: string, xhsUserId: string, accountId: string, userInfo?: any) {
    // Find or create a system User record for this XHS user
    const systemUser = await this.prisma.user.upsert({
      where: { xhsOpenid: xhsUserId },
      create: {
        tenantId,
        xhsOpenid: xhsUserId,
        nickname: userInfo?.nickname || null,
        avatarUrl: userInfo?.avatar || userInfo?.header_image || null,
        source: 'xiaohongshu',
      },
      update: {
        nickname: userInfo?.nickname || undefined,
        avatarUrl: userInfo?.avatar || userInfo?.header_image || undefined,
      },
    });

    // Find existing active conversation for this specific XHS user
    const existing = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        userId: systemUser.id,
        channel: 'xiaohongshu',
        status: { in: ['open', 'pending_human', 'needs_review'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing && existing.updatedAt.getTime() > Date.now() - 24 * 3600 * 1000) {
      return existing;
    }

    const result = await this.conversationsService.create(tenantId, 'xiaohongshu', systemUser.id);
    return { id: result.id, tenantId, channel: 'xiaohongshu' };
  }

  private async resolveTenantId(data: any): Promise<string | null> {
    const tokenData = this.decodeBindToken(data?.token);
    if (tokenData?.tenant_id || tokenData?.tenantId) return tokenData.tenant_id || tokenData.tenantId;

    if (data.tenant_id) return data.tenant_id;
    if (data.tenantId) return data.tenantId;

    if (data.user_id) {
      const account = await this.prisma.xhsAccount.findFirst({
        where: { userId: data.user_id, status: 'active' },
      });
      if (account) return account.tenantId;
    }

    if (data.app_id) {
      const account = await this.prisma.xhsAccount.findFirst({
        where: { appId: String(data.app_id), status: 'active' },
      });
      if (account) return account.tenantId;
    }

    return null;
  }

  private decryptEnvelopePayload(payload: any): any {
    if (typeof payload?.content !== 'string') return payload?.data || payload;

    try {
      return JSON.parse(this.xhsCrypto.decrypt(payload.content));
    } catch (e: any) {
      this.logger.warn(`Failed to decrypt XHS envelope payload: ${e.message}`);
      return payload?.data || payload;
    }
  }

  private decodeBindToken(token?: string): any | null {
    if (!token || typeof token !== 'string') return null;

    try {
      return JSON.parse(this.xhsCrypto.decrypt(token));
    } catch {
      return null;
    }
  }

  private extractTextContent(decryptedContent: string | null): string | null {
    if (!decryptedContent) return null;

    try {
      const parsed = JSON.parse(decryptedContent);
      return typeof parsed?.text === 'string' ? parsed.text : decryptedContent;
    } catch {
      return decryptedContent;
    }
  }

  private encryptTextContent(content: string): string {
    return this.xhsCrypto.encrypt(JSON.stringify({ text: content }));
  }
}
