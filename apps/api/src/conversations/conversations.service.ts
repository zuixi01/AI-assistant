import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export const CONVERSATION_STATUS = {
  OPEN: 'open',
  PENDING_HUMAN: 'pending_human',
  NEEDS_REVIEW: 'needs_review',
  CLOSED: 'closed',
} as const;

export type ConversationStatus = (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS];

const ALLOWED_CONVERSATION_STATUSES = new Set<string>(Object.values(CONVERSATION_STATUS));
const PUBLIC_TOKEN_BYTES = 32;

export const PUBLIC_CONVERSATION_TOKEN_HEADER = 'x-conversation-token';

export function createPublicConversationToken() {
  return randomBytes(PUBLIC_TOKEN_BYTES).toString('base64url');
}

export function hashPublicConversationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    tenantId: string,
    channel: string,
    userId?: string,
    options?: { platformUserId?: string; platformAccountId?: string },
  ) {
    const publicToken = createPublicConversationToken();
    const conversation = await this.prisma.conversation.create({
      data: {
        tenantId,
        channel,
        userId,
        platformUserId: options?.platformUserId,
        platformAccountId: options?.platformAccountId,
        publicTokenHash: hashPublicConversationToken(publicToken),
      },
      include: { messages: true },
    });
    return { ...this.stripPublicTokenHash(conversation), publicToken };
  }

  async findById(id: string): Promise<any>;
  async findById(tenantId: string, id: string): Promise<any>;
  async findById(tenantIdOrId: string, id?: string) {
    const where = id ? { id, tenantId: tenantIdOrId } : { id: tenantIdOrId };
    const conversation = await this.prisma.conversation.findFirst({
      where,
      include: { messages: { orderBy: { createdAt: 'asc' } }, user: true, lead: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return this.stripPublicTokenHash(conversation);
  }

  async findPublicSession(id: string, publicToken: string) {
    const publicTokenHash = this.requirePublicTokenHash(publicToken);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, publicTokenHash },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        channel: true,
        intent: true,
        intentScore: true,
        status: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!conversation) throw new UnauthorizedException('Invalid conversation session');
    return conversation;
  }

  async findPublicByToken(id: string, publicToken: string) {
    const publicTokenHash = this.requirePublicTokenHash(publicToken);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, publicTokenHash },
      include: { messages: { orderBy: { createdAt: 'asc' } }, user: true, lead: true },
    });
    if (!conversation) throw new UnauthorizedException('Invalid conversation session');
    return this.stripPublicTokenHash(conversation);
  }

  async findByTenant(tenantId: string, page = 1, pageSize = 20, filters?: { status?: string }) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: { user: true, lead: true, _count: { select: { messages: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return { items: items.map((item) => this.stripPublicTokenHash(item)), total, page, pageSize };
  }

  async updateStatus(tenantId: string, id: string, status: ConversationStatus) {
    this.assertValidStatus(status);
    const updated = await this.prisma.conversation.updateMany({
      where: { id, tenantId },
      data: { status },
    });
    if (updated.count === 0) throw new NotFoundException('Conversation not found');
    return this.findById(tenantId, id);
  }

  async markNeedsHuman(tenantId: string, id: string) {
    return this.updateStatus(tenantId, id, CONVERSATION_STATUS.PENDING_HUMAN);
  }

  async markNeedsReview(tenantId: string, id: string) {
    return this.updateStatus(tenantId, id, CONVERSATION_STATUS.NEEDS_REVIEW);
  }

  async updateIntent(tenantId: string, id: string, intent: string, intentScore: number) {
    const updated = await this.prisma.conversation.updateMany({
      where: { id, tenantId },
      data: { intent, intentScore },
    });
    if (updated.count === 0) throw new NotFoundException('Conversation not found');
    return this.findById(tenantId, id);
  }

  private assertValidStatus(status: string) {
    if (!ALLOWED_CONVERSATION_STATUSES.has(status)) {
      throw new BadRequestException(`Unsupported conversation status: ${status}`);
    }
  }

  private requirePublicTokenHash(publicToken?: string) {
    const token = publicToken?.trim();
    if (!token) throw new UnauthorizedException('Invalid conversation session');
    return hashPublicConversationToken(token);
  }

  private stripPublicTokenHash<T extends Record<string, any>>(conversation: T): Omit<T, 'publicTokenHash'> {
    const { publicTokenHash: _publicTokenHash, ...safeConversation } = conversation;
    return safeConversation;
  }
}
