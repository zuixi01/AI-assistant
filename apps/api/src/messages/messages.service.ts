import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async create(conversationId: string, role: string, content: string, metadata?: any, citations?: any) {
    return this.prisma.message.create({
      data: { conversationId, role, content, metadata, citations },
    });
  }

  async createForTenant(
    tenantId: string,
    conversationId: string,
    role: string,
    content: string,
    metadata?: any,
    citations?: any,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return this.create(conversationId, role, content, metadata, citations);
  }

  async findByConversation(conversationId: string, limit = 50, after?: Date) {
    const take = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
    const where: any = { conversationId };
    if (after) where.createdAt = { gt: after };

    return this.prisma.message.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  async findRecentByConversation(conversationId: string, limit = 10) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
