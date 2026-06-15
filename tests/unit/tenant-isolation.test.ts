import { describe, expect, it, vi } from 'vitest';
import { ProductsService } from '../../apps/api/src/products/products.service';
import { LeadsService } from '../../apps/api/src/leads/leads.service';
import { OrdersService } from '../../apps/api/src/orders/orders.service';
import { ConversationsService } from '../../apps/api/src/conversations/conversations.service';
import { MessagesService } from '../../apps/api/src/messages/messages.service';
import { UsersService } from '../../apps/api/src/users/users.service';
import { UnknownQuestionsService } from '../../apps/api/src/unknown-questions/unknown-questions.service';

describe('admin tenant isolation', () => {
  it('creates public conversations with an opaque session token and stores only its hash', async () => {
    const prisma = {
      conversation: {
        create: vi.fn().mockImplementation(async (args) => ({
          id: 'conversation-1',
          ...args.data,
          messages: [],
        })),
      },
    };
    const service = new ConversationsService(prisma as any);

    const conversation = await service.create('tenant-1', 'h5');

    expect(conversation.publicToken).toEqual(expect.any(String));
    expect(conversation.publicToken).toHaveLength(43);
    expect(conversation.publicTokenHash).toBeUndefined();
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          channel: 'h5',
          publicTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it('validates public conversation sessions by id and token hash', async () => {
    const prisma = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'conversation-1',
          tenantId: 'tenant-1',
          channel: 'h5',
          status: 'open',
        }),
      },
    };
    const service = new ConversationsService(prisma as any);

    const session = await service.findPublicSession('conversation-1', 'public-token');

    expect(session).toEqual(expect.objectContaining({ id: 'conversation-1', tenantId: 'tenant-1' }));
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'conversation-1',
          publicTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      }),
    );
  });

  it('rejects missing or mismatched public conversation tokens', async () => {
    const prisma = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new ConversationsService(prisma as any);

    await expect(service.findPublicSession('conversation-1', '')).rejects.toThrow('Invalid conversation session');
    await expect(service.findPublicSession('conversation-1', 'wrong-token')).rejects.toThrow('Invalid conversation session');
  });

  it('loads product details through tenant-scoped lookup', async () => {
    const prisma = { product: { findFirst: vi.fn().mockResolvedValue({ id: 'product-1' }) } };
    const service = new ProductsService(prisma as any, {} as any);

    await service.findById('tenant-1', 'product-1');

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'product-1', tenantId: 'tenant-1' } }),
    );
  });

  it('updates leads through tenant-scoped lookup before writing', async () => {
    const prisma = {
      lead: {
        findFirst: vi.fn().mockResolvedValue({ id: 'lead-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new LeadsService(prisma as any);

    await service.update('tenant-1', 'lead-1', { followStatus: 'contacted' });

    expect(prisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lead-1', tenantId: 'tenant-1' } }),
    );
    expect(prisma.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lead-1', tenantId: 'tenant-1' }, data: { followStatus: 'contacted' } }),
    );
  });

  it('loads order details through tenant-scoped lookup', async () => {
    const prisma = { order: { findFirst: vi.fn().mockResolvedValue({ id: 'order-1' }) } };
    const service = new OrdersService(prisma as any);

    await service.findById('tenant-1', 'order-1');

    expect(prisma.order.findFirst).toHaveBeenCalledWith({ where: { id: 'order-1', tenantId: 'tenant-1' } });
  });

  it('updates conversation status through tenant-scoped lookup before writing', async () => {
    const prisma = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'conversation-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new ConversationsService(prisma as any);

    await service.updateStatus('tenant-1', 'conversation-1', 'closed');

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conversation-1', tenantId: 'tenant-1' } }),
    );
  });

  it('marks conversations for human handoff through tenant-scoped status update', async () => {
    const prisma = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'conversation-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new ConversationsService(prisma as any);

    await service.markNeedsHuman('tenant-1', 'conversation-1');

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conversation-1', tenantId: 'tenant-1' } }),
    );
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conversation-1', tenantId: 'tenant-1' }, data: { status: 'pending_human' } }),
    );
  });

  it('resolves unknown questions through tenant-scoped lookup before writing', async () => {
    const prisma = {
      unknownQuestion: {
        findFirst: vi.fn().mockResolvedValue({ id: 'question-1' }),
        update: vi.fn().mockResolvedValue({ id: 'question-1', resolved: true }),
      },
    };
    const service = new UnknownQuestionsService(prisma as any);

    await service.resolve('tenant-1', 'question-1', '已补充知识库');

    expect(prisma.unknownQuestion.findFirst).toHaveBeenCalledWith({
      where: { id: 'question-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(prisma.unknownQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'question-1' },
        data: expect.objectContaining({ resolved: true, status: 'resolved', suggestion: '已补充知识库' }),
      }),
    );
  });

  it('creates admin conversation messages through tenant-scoped lookup before writing', async () => {
    const prisma = {
      conversation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'conversation-1' }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: 'message-1' }),
      },
    };
    const service = new MessagesService(prisma as any);

    await service.createForTenant('tenant-1', 'conversation-1', 'assistant', '人工回复', { sender: 'human' });

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          conversationId: 'conversation-1',
          role: 'assistant',
          content: '人工回复',
          metadata: { sender: 'human' },
          citations: undefined,
        },
      }),
    );
  });

  it('loads conversation messages through a bounded incremental cursor', async () => {
    const after = new Date('2026-06-09T00:00:00.000Z');
    const prisma = {
      message: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new MessagesService(prisma as any);

    await service.findByConversation('conversation-1', 999, after);

    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation-1', createdAt: { gt: after } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
    });
  });

  it('updates an existing public lead for the same tenant conversation instead of creating duplicates', async () => {
    const prisma = {
      lead: {
        upsert: vi.fn().mockResolvedValue({ id: 'lead-1' }),
      },
    };
    const service = new LeadsService(prisma as any);

    await service.createForConversation('tenant-1', 'conversation-1', {
      name: 'Ada',
      phone: '13800138000',
      source: 'chat',
    });

    expect(prisma.lead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conversation-1' },
        create: expect.objectContaining({
          tenantId: 'tenant-1',
          conversationId: 'conversation-1',
          name: 'Ada',
          phone: '13800138000',
          source: 'chat',
        }),
        update: expect.objectContaining({ name: 'Ada', phone: '13800138000', source: 'chat' }),
      }),
    );
  });

  it('loads user details through tenant-scoped lookup', async () => {
    const prisma = { user: { findFirst: vi.fn().mockResolvedValue({ id: 'user-1' }) } };
    const service = new UsersService(prisma as any);

    await service.findById('tenant-1', 'user-1');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { id: 'user-1', tenantId: 'tenant-1' } });
  });
});
