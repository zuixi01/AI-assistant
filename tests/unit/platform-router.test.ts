import { describe, expect, it, vi } from 'vitest';
import { ChatService } from '../../apps/api/src/chat/chat.service';
import { ChatTurnAuditService } from '../../apps/api/src/chat/chat-turn-audit.service';
import { ChatTurnContextService } from '../../apps/api/src/chat/chat-turn-context.service';
import { PlatformRouterService } from '../../apps/api/src/platform/platform-router.service';
import { MessageAdapterService } from '../../apps/api/src/platform/message-adapter.service';
import { ReplyStrategyService } from '../../apps/api/src/reply-strategy/reply-strategy.service';

type SavedMessage = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  channel?: string | null;
  metadata?: any;
  citations?: any;
  createdAt: Date;
};

function createPlatformHarness() {
  const savedMessages: SavedMessage[] = [];
  let nextMessageId = 1;

  const saveMessage = async (data: any) => {
    const row = {
      id: `message-${nextMessageId++}`,
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      channel: data.channel ?? null,
      metadata: data.metadata,
      citations: data.citations,
      createdAt: new Date(Date.now() + nextMessageId),
    };
    savedMessages.push(row);
    return row;
  };

  const llmResponses = ['shipping policy', 'AI response **bold**'];
  const llmService = {
    chat: vi.fn().mockImplementation(async () => ({ content: llmResponses.shift() || 'AI response' })),
    chatStream: vi.fn(),
    getProvider: vi.fn(() => ({ name: 'mock-llm' })),
  };
  const promptsService = {
    getQueryRewritePrompt: vi.fn((message: string) => `rewrite:${message}`),
    getLowConfidenceResponse: vi.fn(() => 'low confidence'),
    getHighRiskTransferResponse: vi.fn(() => 'human transfer'),
    getDialogueSystemPrompt: vi.fn(() => 'dialogue system'),
    getDialogueRetrievalMissNote: vi.fn(() => 'dialogue miss'),
    getDialogueReferencePrompt: vi.fn(() => ''),
    getRagAnswerPrompt: vi.fn(() => 'rag prompt'),
    getSystemPrompt: vi.fn(() => 'system prompt'),
  };
  const messagesService = {
    create: vi.fn().mockImplementation((conversationId: string, role: string, content: string, metadata?: any, citations?: any) => (
      saveMessage({ conversationId, role, content, metadata, citations })
    )),
    findByConversation: vi.fn().mockImplementation(async (conversationId: string) => (
      savedMessages.filter((message) => message.conversationId === conversationId)
    )),
  };
  const conversationsService = {
    create: vi.fn().mockResolvedValue({
      id: 'conversation-1',
      tenantId: 'tenant-1',
      channel: 'juguang',
    }),
    updateIntent: vi.fn().mockResolvedValue({}),
    markNeedsHuman: vi.fn().mockResolvedValue({ status: 'pending_human' }),
    markNeedsReview: vi.fn().mockResolvedValue({ status: 'needs_review' }),
  };
  const retrievalService = {
    retrieveWithRerank: vi.fn().mockResolvedValue({
      results: [
        {
          chunkId: 'chunk-1',
          content: 'Shipping takes 3 days.',
          score: 0.92,
          vectorScore: 0.92,
          keywordScore: 0.5,
          categoryScore: 0,
          titleScore: 0,
          modalityScore: 0,
          finalScore: 0.92,
          sourceId: 'source-1',
          sourceTitle: 'Shipping FAQ',
        },
      ],
      confidence: 0.92,
      answerStatus: 'answered',
    }),
  };
  const tenantsService = {
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: -1 }),
  };
  const prisma = {
    message: {
      create: vi.fn().mockImplementation(({ data }: any) => saveMessage(data)),
      update: vi.fn().mockResolvedValue({}),
    },
    conversation: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    chatGptOnCsAccount: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    unknownQuestion: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'unknown-1' }),
      update: vi.fn().mockResolvedValue({ id: 'unknown-1' }),
    },
    knowledgeRetrievalLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    },
  };
  const modelConfigService = {
    getConfig: vi.fn().mockResolvedValue(undefined),
  };
  const turnContextService = new ChatTurnContextService(
    llmService as any,
    promptsService as any,
    messagesService as any,
    retrievalService as any,
    tenantsService as any,
    prisma as any,
  );
  const turnAuditService = new ChatTurnAuditService(
    prisma as any,
    messagesService as any,
    conversationsService as any,
  );

  const chatService = new ChatService(
    llmService as any,
    conversationsService as any,
    turnContextService,
    turnAuditService,
    modelConfigService as any,
  );
  const router = new PlatformRouterService(
    prisma as any,
    chatService,
    conversationsService as any,
    new MessageAdapterService(),
    new ReplyStrategyService(),
  );

  return { router, savedMessages, messagesService, prisma };
}

describe('PlatformRouterService', () => {
  it('persists one user message and one adapted assistant message for an inbound platform turn', async () => {
    const { router, savedMessages, messagesService, prisma } = createPlatformHarness();

    const result = await router.handleMessage({
      channel: 'juguang',
      tenantId: 'tenant-1',
      fromUserId: 'external-user-1',
      toUserId: 'merchant-1',
      content: 'How long does shipping take?',
    });

    expect(result.success).toBe(true);
    expect(savedMessages).toHaveLength(2);
    expect(savedMessages.map((message) => [message.role, message.content, message.channel])).toEqual([
      ['user', 'How long does shipping take?', 'juguang'],
      ['assistant', 'AI response bold', 'juguang'],
    ]);
    expect(messagesService.create).not.toHaveBeenCalled();
    expect(prisma.message.create).toHaveBeenCalledTimes(2);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          channel: 'juguang',
          platformUserId: 'external-user-1',
        }),
      }),
    );
    expect(prisma.message.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            platformUserId: 'external-user-1',
            platformAccountId: null,
          }),
        }),
      }),
    );
  });

  it('creates conversations with platform-scoped identifiers when no recent match exists', async () => {
    const { router, prisma, savedMessages } = createPlatformHarness();

    await router.handleMessage({
      channel: 'juguang',
      tenantId: 'tenant-1',
      fromUserId: 'external-user-2',
      toUserId: 'merchant-1',
      accountId: 'account-9',
      content: 'Need help with my order',
    });

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          channel: 'juguang',
          platformUserId: 'external-user-2',
          platformAccountId: 'account-9',
        }),
      }),
    );
    expect(savedMessages[0]?.metadata).toMatchObject({
      platformUserId: 'external-user-2',
      platformAccountId: 'account-9',
    });
  });
});
