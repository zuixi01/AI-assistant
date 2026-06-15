import { describe, expect, it, vi } from 'vitest';
import { ChatService } from '../../apps/api/src/chat/chat.service';
import { ChatTurnContextService } from '../../apps/api/src/chat/chat-turn-context.service';
import { ChatTurnAuditService } from '../../apps/api/src/chat/chat-turn-audit.service';

function createHarness(options?: {
  retrieval?: { results: any[]; confidence: number; answerStatus: 'answered' | 'cautious' | 'low_confidence' | 'no_answer' | 'transferred_to_human' };
  llmResponses?: string[];
  quota?: { allowed: boolean; current: number; limit: number };
}) {
  const llmResponses = [...(options?.llmResponses || ['rewritten query', 'AI response'])];
  const tenantModelConfig = {
    llm: {
      provider: 'deepseek',
      apiKey: 'tenant-llm-key',
      baseUrl: 'https://tenant-llm.example/v1',
      model: 'tenant-chat-model',
    },
    embedding: {
      provider: 'qwen',
      apiKey: 'tenant-embedding-key',
      baseUrl: 'https://tenant-embedding.example/v1',
      model: 'tenant-embedding-model',
    },
  };
  const llmService = {
    chat: vi.fn().mockImplementation(async () => ({ content: llmResponses.shift() || 'AI response' })),
    chatWithConfig: vi.fn().mockImplementation(async () => ({ content: llmResponses.shift() || 'AI response' })),
    chatStream: vi.fn(),
    getProvider: vi.fn(() => ({ name: 'mock-llm' })),
  };
  const promptsService = {
    getQueryRewritePrompt: vi.fn((message: string) => `rewrite:${message}`),
    getLowConfidenceResponse: vi.fn(() => '抱歉，我暂时没有找到可靠答案，已记录给人工客服处理。'),
    getHighRiskTransferResponse: vi.fn(() => '这个问题需要人工客服继续处理，我已为您转接。'),
    getDialogueSystemPrompt: vi.fn(() => '你是友好的客服。'),
    getDialogueRetrievalMissNote: vi.fn(() => '这是一句闲聊，不要因为没有知识库命中而拒答。'),
    getDialogueReferencePrompt: vi.fn(() => ''),
    getRagAnswerPrompt: vi.fn(() => '请基于知识库回答。'),
    getSystemPrompt: vi.fn(() => '系统提示词'),
  };
  const messagesService = {
    create: vi.fn().mockImplementation(async (_conversationId: string, role: string, content: string) => ({
      id: `${role}-${content.length}`,
      role,
      content,
    })),
    findByConversation: vi.fn().mockResolvedValue([{ role: 'user', content: 'current message' }]),
  };
  const conversationsService = {
    updateIntent: vi.fn().mockResolvedValue({}),
    markNeedsHuman: vi.fn().mockResolvedValue({ status: 'pending_human' }),
    markNeedsReview: vi.fn().mockResolvedValue({ status: 'needs_review' }),
  };
  const retrievalService = {
    retrieveWithRerank: vi.fn().mockResolvedValue(
      options?.retrieval || { results: [], confidence: 0, answerStatus: 'no_answer' },
    ),
  };
  const tenantsService = {
    checkLimit: vi.fn().mockResolvedValue(options?.quota || { allowed: true, current: 0, limit: -1 }),
  };
  const prisma = {
    product: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    message: {
      update: vi.fn().mockResolvedValue({ id: 'assistant-1' }),
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
    getConfig: vi.fn().mockResolvedValue(tenantModelConfig),
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

  const service = new ChatService(
    llmService as any,
    conversationsService as any,
    turnContextService,
    turnAuditService,
    modelConfigService as any,
  );

  return {
    service,
    llmService,
    promptsService,
    messagesService,
    conversationsService,
    retrievalService,
    tenantsService,
    prisma,
    modelConfigService,
    tenantModelConfig,
  };
}

describe('ChatService customer service workflow', () => {
  it('blocks chat turns before writing when tenant message quota is exhausted', async () => {
    const harness = createHarness({
      quota: { allowed: false, current: 100, limit: 100 },
    });

    await expect(harness.service.chat({
      conversationId: 'conversation-1',
      tenantId: 'tenant-1',
      userMessage: 'quota test',
    })).rejects.toThrow('Message quota exceeded');

    expect(harness.tenantsService.checkLimit).toHaveBeenCalledWith('tenant-1', 'messages');
    expect(harness.messagesService.create).not.toHaveBeenCalled();
  });

  it('forces high-risk after-sale requests into human handoff even when retrieval misses', async () => {
    const harness = createHarness({
      retrieval: { results: [], confidence: 0.1, answerStatus: 'no_answer' },
      llmResponses: ['我要退款，转人工'],
    });

    const response = await harness.service.chat({
      conversationId: 'conversation-1',
      tenantId: 'tenant-1',
      userMessage: '我要退款，转人工',
    });

    expect(response.answerStatus).toBe('transferred_to_human');
    expect(response.conversationStatus).toBe('pending_human');
    expect(harness.conversationsService.markNeedsHuman).toHaveBeenCalledWith('tenant-1', 'conversation-1');
    expect(harness.conversationsService.markNeedsReview).not.toHaveBeenCalled();
    expect(harness.prisma.unknownQuestion.create).not.toHaveBeenCalled();
    expect(harness.prisma.knowledgeRetrievalLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ answerStatus: 'transferred_to_human' }),
      }),
    );
  });

  it('records knowledge-track misses as unknown questions, calls LLM, and marks the conversation for review', async () => {
    const harness = createHarness({
      retrieval: { results: [], confidence: 0.12, answerStatus: 'low_confidence' },
      llmResponses: ['这个商品保修多久 rewritten', '保修政策需以商品详情页为准，建议联系人工确认。'],
    });

    const response = await harness.service.chat({
      conversationId: 'conversation-1',
      tenantId: 'tenant-1',
      userMessage: '这个商品保修多久',
    });

    expect(response.content).toBe('保修政策需以商品详情页为准，建议联系人工确认。');
    expect(response.answerStatus).toBe('low_confidence');
    expect(response.conversationStatus).toBe('needs_review');
    expect(harness.llmService.chatWithConfig).toHaveBeenCalled();
    expect(harness.conversationsService.markNeedsReview).toHaveBeenCalledWith('tenant-1', 'conversation-1');
    expect(harness.prisma.unknownQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          conversationId: 'conversation-1',
          messageId: 'user-8',
          question: '这个商品保修多久',
          failReason: 'low_confidence',
          status: 'pending',
        }),
      }),
    );
  });

  it('does not create unknown questions for low-confidence casual dialogue', async () => {
    const harness = createHarness({
      retrieval: { results: [], confidence: 0, answerStatus: 'no_answer' },
      llmResponses: ['你好', '您好！请问有什么可以帮您？'],
    });

    const response = await harness.service.chat({
      conversationId: 'conversation-1',
      tenantId: 'tenant-1',
      userMessage: '你好',
    });

    expect(response.answerStatus).toBe('no_answer');
    expect(response.conversationStatus).toBe('open');
    expect(harness.prisma.unknownQuestion.create).not.toHaveBeenCalled();
    expect(harness.conversationsService.markNeedsReview).not.toHaveBeenCalled();
    expect(harness.promptsService.getDialogueRetrievalMissNote).toHaveBeenCalled();
  });

  it('uses tenant LLM configuration for rewrite and answer generation', async () => {
    const harness = createHarness({
      retrieval: { results: [], confidence: 0, answerStatus: 'no_answer' },
      llmResponses: ['hello rewritten', 'Hello, how can I help?'],
    });

    const response = await harness.service.chat({
      conversationId: 'conversation-1',
      tenantId: 'tenant-1',
      userMessage: 'hello',
    });

    expect(response.content).toBe('Hello, how can I help?');
    expect(harness.modelConfigService.getConfig).toHaveBeenCalledWith('tenant-1');
    expect(harness.llmService.chatWithConfig).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ temperature: expect.any(Number) }),
      harness.tenantModelConfig.llm,
    );
    expect(harness.llmService.chat).not.toHaveBeenCalled();
  });
});
