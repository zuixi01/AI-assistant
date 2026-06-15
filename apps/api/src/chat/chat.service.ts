import { Injectable, Logger, Optional } from '@nestjs/common';
import { LlmService } from '../ai/llm/llm.service';
import { CONVERSATION_STATUS, ConversationStatus, ConversationsService } from '../conversations/conversations.service';
import { ModelConfig, ModelConfigService, ProviderConfig } from '../ai/model-config/model-config.service';
import { ChatTurnContextService } from './chat-turn-context.service';
import { ChatTurnAuditService } from './chat-turn-audit.service';
import { ChatRequest, ChatResponse, ChatTurnPersistence, PreparedChatTurn, ResolvedChatTurn } from './chat.types';

export type { ChatRequest, ChatResponse } from './chat.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly conversationsService: ConversationsService,
    private readonly turnContextService: ChatTurnContextService,
    private readonly turnAuditService: ChatTurnAuditService,
    @Optional() private readonly modelConfigService?: ModelConfigService,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.runChatTurn(request, {
      persistUserMessage: true,
      persistAssistantMessage: true,
    });
  }

  async generateReplyForPersistedTurn(request: ChatRequest): Promise<ChatResponse> {
    return this.runChatTurn(request, {
      persistUserMessage: false,
      persistAssistantMessage: false,
    });
  }

  private async runChatTurn(request: ChatRequest, persistence: ChatTurnPersistence): Promise<ChatResponse> {
    const { conversationId, tenantId, userMessage } = request;
    const modelConfig = await this.getTenantModelConfig(tenantId);
    const prepared = await this.turnContextService.prepareTurn(request, persistence, modelConfig?.llm);
    const outcome = await this.resolveNonStreamingTurn(request, prepared, modelConfig?.llm);

    await this.turnAuditService.saveTurnArtifacts({
      tenantId,
      conversationId,
      originalQuery: userMessage,
      rewrittenQuery: prepared.rewrittenQuery,
      intent: prepared.intent,
      intentScore: prepared.intentScore,
      retrievalOutput: {
        ...prepared.retrievalOutput,
        answerStatus: outcome.answerStatus,
      },
    });

    const recommendedProducts = await this.turnAuditService.getRecommendedProducts(tenantId, outcome.aiResponse);

    if (persistence.persistAssistantMessage) {
      await this.turnAuditService.persistAssistantMessage({
        conversationId,
        content: outcome.aiResponse,
        llmConfig: modelConfig?.llm,
        intent: prepared.intent,
        intentScore: prepared.intentScore,
        confidence: prepared.retrievalOutput.confidence,
        answerStatus: outcome.answerStatus,
        conversationStatus: outcome.conversationStatus,
        products: recommendedProducts,
        rewrittenQuery: prepared.rewrittenQuery,
        citations: prepared.citations,
      });
    }

    return {
      content: outcome.aiResponse,
      citations: prepared.citations.length > 0 ? prepared.citations : undefined,
      intent: prepared.intent,
      intentScore: prepared.intentScore,
      confidence: prepared.retrievalOutput.confidence,
      answerStatus: outcome.answerStatus,
      conversationStatus: outcome.conversationStatus,
      requiresHuman: outcome.conversationStatus === CONVERSATION_STATUS.PENDING_HUMAN,
      products: recommendedProducts.length > 0 ? recommendedProducts : undefined,
    };
  }

  /**
   * Generate a suggested reply without sending it.
   * Stores the suggestion on the message for human review.
   */
  async suggest(request: ChatRequest): Promise<ChatResponse & { messageId?: string }> {
    const { conversationId, tenantId } = request;
    const modelConfig = await this.getTenantModelConfig(tenantId);
    const prepared = await this.turnContextService.prepareTurn(
      request,
      { persistUserMessage: true, persistAssistantMessage: false },
      modelConfig?.llm,
    );

    const { messages, temperature } = await this.buildMessagesForResolvedTurn(
      request,
      prepared,
      prepared.retrievalOutput.answerStatus,
      prepared.retrievalOutput.answerStatus === 'no_answer',
    );
    const result = await this.chatCompletion(messages as any, { temperature, maxTokens: 2048 }, modelConfig?.llm);
    const aiResponse = result.content;

    const savedMessage = await this.turnAuditService.persistSuggestedReply({
      conversationId,
      content: aiResponse,
      llmConfig: modelConfig?.llm,
      intent: prepared.intent,
      intentScore: prepared.intentScore,
      confidence: prepared.retrievalOutput.confidence,
      answerStatus: prepared.retrievalOutput.answerStatus,
      citations: prepared.citations,
    });

    await this.turnAuditService.saveTurnArtifacts({
      tenantId,
      conversationId,
      originalQuery: request.userMessage,
      rewrittenQuery: prepared.rewrittenQuery,
      intent: prepared.intent,
      intentScore: prepared.intentScore,
      retrievalOutput: prepared.retrievalOutput,
    });

    return {
      content: aiResponse,
      citations: prepared.citations.length > 0 ? prepared.citations : undefined,
      intent: prepared.intent,
      intentScore: prepared.intentScore,
      confidence: prepared.retrievalOutput.confidence,
      answerStatus: prepared.retrievalOutput.answerStatus,
      messageId: savedMessage?.id,
    };
  }

  async *chatStream(request: ChatRequest) {
    const { conversationId, tenantId, userMessage } = request;
    const modelConfig = await this.getTenantModelConfig(tenantId);
    const prepared = await this.turnContextService.prepareTurn(
      request,
      { persistUserMessage: true, persistAssistantMessage: true },
      modelConfig?.llm,
    );

    let outcome: ResolvedChatTurn;
    if (this.isHighRiskIntent(prepared.intent)) {
      outcome = await this.resolveHighRiskTurn(tenantId, conversationId);
      yield { content: outcome.aiResponse };
    } else {
      const streamConfig = await this.buildStreamGenerationConfig(request, prepared);
      let aiResponse = '';
      const stream = this.streamCompletion(
        streamConfig.messages as any,
        {
          temperature: streamConfig.temperature,
          maxTokens: streamConfig.maxTokens,
        },
        modelConfig?.llm,
      );
      for await (const chunk of stream) {
        aiResponse += chunk.content;
        yield chunk;
      }
      outcome = await this.finalizeLlmTurn(request, prepared, aiResponse);
    }

    await this.turnAuditService.saveTurnArtifacts({
      tenantId,
      conversationId,
      originalQuery: userMessage,
      rewrittenQuery: prepared.rewrittenQuery,
      intent: prepared.intent,
      intentScore: prepared.intentScore,
      retrievalOutput: {
        ...prepared.retrievalOutput,
        answerStatus: outcome.answerStatus,
      },
    });

    await this.turnAuditService.persistAssistantMessage({
      conversationId,
      content: outcome.aiResponse,
      llmConfig: modelConfig?.llm,
      intent: prepared.intent,
      intentScore: prepared.intentScore,
      confidence: prepared.retrievalOutput.confidence,
      answerStatus: outcome.answerStatus,
      conversationStatus: outcome.conversationStatus,
      rewrittenQuery: prepared.rewrittenQuery,
      citations: prepared.citations,
    });
  }

  private async getTenantModelConfig(tenantId: string): Promise<ModelConfig | undefined> {
    if (!this.modelConfigService) return undefined;
    return this.modelConfigService.getConfig(tenantId);
  }

  private async chatCompletion(
    messages: any[],
    options: Record<string, unknown>,
    llmConfig?: ProviderConfig,
  ) {
    if (llmConfig && typeof (this.llmService as any).chatWithConfig === 'function') {
      return (this.llmService as any).chatWithConfig(messages, options, llmConfig);
    }
    return this.llmService.chat(messages as any, options as any);
  }

  private streamCompletion(
    messages: any[],
    options: Record<string, unknown>,
    llmConfig?: ProviderConfig,
  ) {
    if (llmConfig && typeof (this.llmService as any).chatStreamWithConfig === 'function') {
      return (this.llmService as any).chatStreamWithConfig(messages, options, llmConfig);
    }
    return this.llmService.chatStream(messages as any, options as any);
  }

  private isHighRiskIntent(intent: string): boolean {
    return ['after_sale', 'transfer_human'].includes(intent);
  }

  private shouldReviewKnowledgeMiss(prepared: PreparedChatTurn) {
    return (
      (prepared.retrievalOutput.answerStatus === 'no_answer' ||
        prepared.retrievalOutput.answerStatus === 'low_confidence') &&
      prepared.conversationTrack === 'knowledge'
    );
  }

  private async resolveNonStreamingTurn(
    request: ChatRequest,
    prepared: PreparedChatTurn,
    llmConfig?: ProviderConfig,
  ): Promise<ResolvedChatTurn> {
    const { tenantId, conversationId } = request;

    if (this.isHighRiskIntent(prepared.intent)) {
      return this.resolveHighRiskTurn(tenantId, conversationId);
    }

    const generation = await this.buildNonStreamingGenerationConfig(request, prepared);
    const result = await this.chatCompletion(
      generation.messages as any,
      { temperature: generation.temperature, maxTokens: generation.maxTokens },
      llmConfig,
    );

    return this.finalizeLlmTurn(request, prepared, result.content);
  }

  private async finalizeLlmTurn(
    request: ChatRequest,
    prepared: PreparedChatTurn,
    aiResponse: string,
  ): Promise<ResolvedChatTurn> {
    if (this.shouldReviewKnowledgeMiss(prepared)) {
      await this.recordKnowledgeMissForReview(request, prepared);
      return {
        aiResponse,
        answerStatus: prepared.retrievalOutput.answerStatus,
        conversationStatus: CONVERSATION_STATUS.NEEDS_REVIEW,
      };
    }

    return {
      aiResponse,
      answerStatus: prepared.retrievalOutput.answerStatus,
      conversationStatus: CONVERSATION_STATUS.OPEN,
    };
  }

  private async recordKnowledgeMissForReview(request: ChatRequest, prepared: PreparedChatTurn) {
    await this.turnAuditService.markKnowledgeMissForReview({
      tenantId: request.tenantId,
      conversationId: request.conversationId,
      messageId: prepared.userMessageRecord?.id,
      question: request.userMessage,
      context: prepared.conversationContext,
      intent: prepared.intent,
      hitChunks: prepared.retrievalOutput.results,
      failReason: prepared.retrievalOutput.answerStatus,
    });
  }

  private async resolveHighRiskTurn(tenantId: string, conversationId: string): Promise<ResolvedChatTurn> {
    await this.conversationsService.markNeedsHuman(tenantId, conversationId);
    return {
      aiResponse: '这个问题涉及具体退款或售后处理结果，我不能直接承诺。建议你联系人工客服，并提供订单号、商品照片或相关凭证，由客服根据平台规则处理。',
      answerStatus: 'transferred_to_human',
      conversationStatus: CONVERSATION_STATUS.PENDING_HUMAN,
    };
  }

  private async buildNonStreamingGenerationConfig(request: ChatRequest, prepared: PreparedChatTurn) {
    const retrievalMiss =
      prepared.retrievalOutput.answerStatus === 'no_answer' ||
      prepared.retrievalOutput.answerStatus === 'low_confidence';

    const { messages, temperature } = await this.buildMessagesForResolvedTurn(
      request,
      prepared,
      prepared.retrievalOutput.answerStatus,
      retrievalMiss,
    );

    return {
      messages,
      temperature,
      maxTokens: retrievalMiss ? 1024 : 2048,
    };
  }

  private async buildStreamGenerationConfig(request: ChatRequest, prepared: PreparedChatTurn) {
    const retrievalMiss =
      prepared.retrievalOutput.answerStatus === 'no_answer' ||
      prepared.retrievalOutput.answerStatus === 'low_confidence';

    const { messages, temperature } = await this.buildMessagesForResolvedTurn(
      request,
      prepared,
      prepared.retrievalOutput.answerStatus,
      retrievalMiss,
    );

    return {
      messages,
      temperature,
      maxTokens: retrievalMiss ? 1024 : 2048,
    };
  }

  private buildMessagesForResolvedTurn(
    request: ChatRequest,
    prepared: PreparedChatTurn,
    answerStatus: string,
    retrievalMiss: boolean,
  ) {
    return this.turnContextService.buildMessagesForTurn({
      conversationTrack: prepared.conversationTrack,
      tenantType: request.tenantType,
      tenantName: request.tenantName,
      userMessage: request.userMessage,
      rewrittenQuery: prepared.rewrittenQuery,
      knowledge: prepared.knowledge,
      answerStatus,
      formattedHistory: prepared.formattedHistory,
      tenantId: request.tenantId,
      retrievalMiss,
    });
  }
}
