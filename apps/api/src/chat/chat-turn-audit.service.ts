import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CONVERSATION_STATUS, ConversationStatus, ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { ProviderConfig } from '../ai/model-config/model-config.service';
import { ChatCitation } from './chat.types';

@Injectable()
export class ChatTurnAuditService {
  private readonly logger = new Logger(ChatTurnAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async markKnowledgeMissForReview(params: {
    tenantId: string;
    conversationId: string;
    messageId?: string;
    question: string;
    context: string;
    intent: string;
    hitChunks: any[];
    failReason: string;
  }) {
    await this.recordUnknownQuestion(params);
    await this.conversationsService.markNeedsReview(params.tenantId, params.conversationId);
  }

  async saveTurnArtifacts(params: {
    tenantId: string;
    conversationId: string;
    originalQuery: string;
    rewrittenQuery: string;
    intent: string;
    intentScore: number;
    retrievalOutput: { results: any[]; confidence: number; answerStatus: string };
  }) {
    const { tenantId, conversationId, originalQuery, rewrittenQuery, intent, intentScore, retrievalOutput } = params;

    await this.saveRetrievalLog(tenantId, conversationId, originalQuery, rewrittenQuery, intent, retrievalOutput);

    if (intent) {
      await this.conversationsService.updateIntent(tenantId, conversationId, intent, intentScore);
    }
  }

  async getRecommendedProducts(
    tenantId: string,
    response: string,
  ): Promise<{ id: string; title: string; price: number; reason: string }[]> {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: 'on_sale' },
      select: { id: true, title: true, price: true, aiSummary: true },
      take: 20,
    });

    const recommendations: { id: string; title: string; price: number; reason: string }[] = [];
    for (const product of products) {
      if (response.includes(product.title)) {
        recommendations.push({
          id: product.id,
          title: product.title,
          price: product.price || 0,
          reason: product.aiSummary || '推荐商品',
        });
      }
    }
    return recommendations.slice(0, 3);
  }

  async persistAssistantMessage(params: {
    conversationId: string;
    content: string;
    llmConfig?: ProviderConfig;
    intent: string;
    intentScore: number;
    confidence: number;
    answerStatus: string;
    conversationStatus: ConversationStatus;
    rewrittenQuery: string;
    citations?: ChatCitation[];
    products?: { id: string; title: string; price: number; reason: string }[];
  }) {
    const {
      conversationId,
      content,
      llmConfig,
      intent,
      intentScore,
      confidence,
      answerStatus,
      conversationStatus,
      rewrittenQuery,
      citations,
      products,
    } = params;

    return this.messagesService.create(
      conversationId,
      'assistant',
      content,
      {
        model: this.getLlmMetadata(llmConfig),
        intent,
        intentScore,
        confidence,
        answerStatus,
        conversationStatus,
        requiresHuman: conversationStatus === CONVERSATION_STATUS.PENDING_HUMAN,
        products,
        rewrittenQuery,
      },
      citations?.length ? citations : undefined,
    );
  }

  async persistSuggestedReply(params: {
    conversationId: string;
    content: string;
    llmConfig?: ProviderConfig;
    intent: string;
    intentScore: number;
    confidence: number;
    answerStatus: string;
    citations?: ChatCitation[];
  }) {
    const { conversationId, content, llmConfig, intent, intentScore, confidence, answerStatus, citations } = params;

    const savedMessage = await this.messagesService.create(
      conversationId,
      'assistant',
      content,
      {
        model: this.getLlmMetadata(llmConfig),
        intent,
        intentScore,
        confidence,
        answerStatus,
        replyStatus: 'pending',
        isSuggestion: true,
      },
      citations?.length ? citations : undefined,
    );

    if (savedMessage?.id) {
      await this.prisma.message.update({
        where: { id: savedMessage.id },
        data: { suggestedReply: content, replyStatus: 'pending' },
      });
    }

    return savedMessage;
  }

  private getLlmMetadata(config?: ProviderConfig): string {
    if (config?.provider) {
      return config.model ? `${config.provider}:${config.model}` : config.provider;
    }
    return 'unknown';
  }

  private async recordUnknownQuestion(params: {
    tenantId: string;
    conversationId: string;
    messageId?: string;
    question: string;
    context: string;
    intent: string;
    hitChunks: any[];
    failReason: string;
  }) {
    const { tenantId, conversationId, messageId, question, intent, hitChunks, failReason } = params;
    try {
      const existing = await this.prisma.unknownQuestion.findFirst({
        where: {
          tenantId,
          question: { contains: question.substring(0, 50) },
          status: 'pending',
        },
      });

      if (existing) {
        await this.prisma.unknownQuestion.update({
          where: { id: existing.id },
          data: { count: { increment: 1 }, lastSeenAt: new Date() },
        });
      } else {
        await this.prisma.unknownQuestion.create({
          data: {
            tenantId,
            question,
            normalizedQuestion: question.trim().toLowerCase(),
            scene: 'unknown',
            intent,
            conversationId,
            messageId,
            hitChunks: hitChunks.map((r) => ({
              chunkId: r.chunkId,
              sourceId: r.sourceId,
              sourceTitle: r.sourceTitle,
              score: r.finalScore ?? r.score,
            })),
            failReason,
            status: 'pending',
          },
        });
      }
    } catch (e: any) {
      this.logger.warn(`Failed to record unknown question: ${e.message}`);
    }
  }

  private async saveRetrievalLog(
    tenantId: string,
    conversationId: string,
    originalQuery: string,
    rewrittenQuery: string,
    intent: string,
    retrievalOutput: { results: any[]; confidence: number; answerStatus: string },
  ) {
    try {
      await this.prisma.knowledgeRetrievalLog.create({
        data: {
          tenantId,
          conversationId,
          originalQuery,
          rewrittenQuery: rewrittenQuery !== originalQuery ? rewrittenQuery : null,
          intent,
          retrievedChunkIds: retrievalOutput.results.map((r) => r.chunkId),
          rerankedChunkIds: retrievalOutput.results.map((r) => r.chunkId),
          topScore: retrievalOutput.results[0]?.finalScore || 0,
          confidence: retrievalOutput.confidence,
          answerStatus: retrievalOutput.answerStatus,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Failed to save retrieval log: ${e.message}`);
    }
  }
}
