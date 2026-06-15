import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface WorkspaceConversation {
  id: string;
  channel: string;
  status: string;
  intent: string | null;
  intentScore: number;
  assignedTo: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  userName: string | null;
  createdAt: Date;
}

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  private readonly allowedStatuses = new Set(['open', 'pending_human', 'needs_review', 'closed']);

  constructor(private prisma: PrismaService) {}

  async getConversations(tenantId: string, filters?: {
    channel?: string;
    status?: string;
    assignedTo?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters?.channel) where.channel = filters.channel;
    if (filters?.status) where.status = filters.status;
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, createdAt: true, role: true },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    const items = conversations.map((c) => ({
      id: c.id,
      channel: c.channel,
      status: c.status,
      intent: c.intent,
      intentScore: c.intentScore,
      assignedTo: c.assignedTo,
      lastMessage: c.messages[0]?.content || null,
      lastMessageAt: c.messages[0]?.createdAt || null,
      lastMessageRole: c.messages[0]?.role || null,
      createdAt: c.createdAt,
    }));

    return { items, total, page, limit };
  }

  async getMessages(conversationId: string, tenantId: string, limit?: number) {
    await this.findTenantConversationOrThrow(conversationId, tenantId);

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit || 200,
    });
  }

  async assignConversation(conversationId: string, tenantId: string, assignedTo: string) {
    await this.findTenantConversationOrThrow(conversationId, tenantId);
    await this.updateTenantConversationOrThrow(conversationId, tenantId, { assignedTo });
    return this.findTenantConversationOrThrow(conversationId, tenantId);
  }

  async unassignConversation(conversationId: string, tenantId: string) {
    await this.findTenantConversationOrThrow(conversationId, tenantId);
    await this.updateTenantConversationOrThrow(conversationId, tenantId, { assignedTo: null });
    return this.findTenantConversationOrThrow(conversationId, tenantId);
  }

  async updateStatus(conversationId: string, tenantId: string, status: string) {
    if (!this.allowedStatuses.has(status)) {
      throw new BadRequestException(`Unsupported conversation status: ${status}`);
    }
    await this.findTenantConversationOrThrow(conversationId, tenantId);
    await this.updateTenantConversationOrThrow(conversationId, tenantId, { status });
    return this.findTenantConversationOrThrow(conversationId, tenantId);
  }

  async sendManualReply(conversationId: string, tenantId: string, content: string, adminId: string) {
    const conv = await this.findTenantConversationOrThrow(conversationId, tenantId);
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new BadRequestException('Reply content is required');
    }

    // Save the manual reply
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: trimmedContent,
        channel: conv.channel,
        metadata: { manualReply: true, adminId },
      },
    });

    // Update conversation status to open (human is handling)
    await this.updateTenantConversationOrThrow(conversationId, tenantId, {
      status: 'open',
      assignedTo: adminId,
    });

    return message;
  }

  async getStats(tenantId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [openCount, pendingCount, todayMessages, todayConversations] = await Promise.all([
      this.prisma.conversation.count({ where: { tenantId, status: 'open' } }),
      this.prisma.conversation.count({ where: { tenantId, status: 'pending_human' } }),
      this.prisma.message.count({
        where: { conversation: { tenantId }, createdAt: { gte: todayStart } },
      }),
      this.prisma.conversation.count({
        where: { tenantId, createdAt: { gte: todayStart } },
      }),
    ]);

    return { openCount, pendingCount, todayMessages, todayConversations };
  }

  async exportConversations(tenantId: string, filters?: {
    channel?: string;
    startDate?: string;
    endDate?: string;
    format?: 'csv' | 'json';
  }) {
    const where: any = { tenantId };
    if (filters?.channel) where.channel = filters.channel;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        lead: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    if (filters?.format === 'csv') {
      return this.toCsv(conversations);
    }

    return conversations.map((c) => ({
      id: c.id,
      channel: c.channel,
      status: c.status,
      intent: c.intent,
      messageCount: c.messages.length,
      leadName: c.lead?.name || null,
      leadPhone: c.lead?.phone || null,
      createdAt: c.createdAt,
      messages: c.messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    }));
  }

  private toCsv(conversations: any[]): string {
    const header = 'ID,Channel,Status,Intent,Message Count,Lead Name,Created At\n';
    const rows = conversations.map((c) =>
      [c.id, c.channel, c.status, c.intent || '', c.messages.length, c.lead?.name || '', c.createdAt.toISOString()].join(',')
    ).join('\n');
    return header + rows;
  }

  private async findTenantConversationOrThrow(conversationId: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true, channel: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async updateTenantConversationOrThrow(
    conversationId: string,
    tenantId: string,
    data: { assignedTo?: string | null; status?: string },
  ) {
    const updated = await this.prisma.conversation.updateMany({
      where: { id: conversationId, tenantId },
      data,
    });

    if (updated.count === 0) {
      throw new NotFoundException('Conversation not found');
    }
  }
}
