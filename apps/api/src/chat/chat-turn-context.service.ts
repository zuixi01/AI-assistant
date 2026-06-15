import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../ai/llm/llm.service';
import { PromptsService } from '../ai/prompts/prompts.service';
import { MessagesService } from '../messages/messages.service';
import { RetrievalService } from '../knowledge/retrieval/retrieval.service';
import { TenantsService } from '../tenants/tenants.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderConfig } from '../ai/model-config/model-config.service';
import { ChatRequest, ChatTurnPersistence, FormattedHistoryMessage, PreparedChatTurn } from './chat.types';

@Injectable()
export class ChatTurnContextService {
  private readonly logger = new Logger(ChatTurnContextService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly promptsService: PromptsService,
    private readonly messagesService: MessagesService,
    private readonly retrievalService: RetrievalService,
    private readonly tenantsService: TenantsService,
    private readonly prisma: PrismaService,
  ) {}

  async prepareTurn(
    request: ChatRequest,
    persistence: ChatTurnPersistence,
    llmConfig?: ProviderConfig,
  ): Promise<PreparedChatTurn> {
    const { conversationId, tenantId, userMessage } = request;

    await this.ensureMessageQuota(tenantId);

    const userMessageRecord = persistence.persistUserMessage
      ? await this.messagesService.create(conversationId, 'user', userMessage)
      : request.persistedUserMessageId
        ? { id: request.persistedUserMessageId }
        : undefined;

    const history = await this.messagesService.findByConversation(conversationId, 20);
    const formattedHistory = history.slice(0, -1).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const intent = this.analyzeIntent(userMessage);
    const intentScore = this.calculateIntentScore(userMessage, formattedHistory);
    const conversationContext = formattedHistory.slice(-4).map((m) => `${m.role}: ${m.content}`).join('\n');

    let rewrittenQuery = userMessage;
    try {
      rewrittenQuery = await this.rewriteQuery(userMessage, conversationContext, llmConfig);
    } catch (e: any) {
      this.logger.warn(`Query rewriting failed, using original: ${e.message}`);
    }

    const retrievalOutput = await this.retrievalService.retrieveWithRerank(tenantId, rewrittenQuery, 5);

    return {
      userMessageRecord,
      formattedHistory,
      conversationContext,
      intent,
      intentScore,
      rewrittenQuery,
      retrievalOutput,
      citations: this.buildCitations(retrievalOutput.results),
      knowledge: this.buildKnowledgeBlock(retrievalOutput.results),
      conversationTrack: this.classifyConversationTrack(userMessage),
    };
  }

  async buildMessagesForTurn(params: {
    conversationTrack: 'dialogue' | 'knowledge';
    tenantType?: string;
    tenantName?: string;
    userMessage: string;
    rewrittenQuery: string;
    knowledge: string;
    answerStatus: string;
    formattedHistory: FormattedHistoryMessage[];
    tenantId: string;
    retrievalMiss: boolean;
  }): Promise<{
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    temperature: number;
  }> {
    const {
      conversationTrack,
      tenantType,
      tenantName,
      userMessage,
      rewrittenQuery,
      knowledge,
      answerStatus,
      formattedHistory,
      tenantId,
      retrievalMiss,
    } = params;

    const products = await this.prisma.product.findMany({
      where: { tenantId, status: 'on_sale' },
      select: { id: true, title: true, price: true, category: true, aiSummary: true },
      take: 20,
    });
    let productContext = '';
    if (products.length > 0) {
      productContext =
        '\n\n当前在售商品列表：\n' +
        products
          .map((p) =>
            `- ${p.title} | 价格: ${p.price ? (p.price / 100).toFixed(2) + '元' : '待定'} | ${p.category || ''} | ${p.aiSummary || ''}`,
          )
          .join('\n');
    }

    const knowledgeTrim = knowledge?.trim() ?? '';
    const refBlock = [knowledgeTrim, productContext].filter(Boolean).join('');
    const historySlice = formattedHistory.slice(-6);

    if (conversationTrack === 'dialogue') {
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: this.promptsService.getDialogueSystemPrompt({ tenantType, tenantName }) },
      ];
      if (retrievalMiss) {
        messages.push({ role: 'system', content: this.promptsService.getDialogueRetrievalMissNote() });
      } else {
        const refPrompt = this.promptsService.getDialogueReferencePrompt(refBlock);
        if (refPrompt) messages.push({ role: 'system', content: refPrompt });
      }
      messages.push(...historySlice, { role: 'user', content: userMessage });
      return { messages, temperature: retrievalMiss ? 0.85 : 0.75 };
    }

    const ragPrompt = this.promptsService.getRagAnswerPrompt(
      userMessage,
      rewrittenQuery,
      knowledge,
      tenantName,
      answerStatus,
    );
    const systemPrompt = this.promptsService.getSystemPrompt({
      tenantType,
      tenantName,
      knowledge: knowledge + productContext,
    });
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: ragPrompt },
      ...historySlice,
      { role: 'user', content: userMessage },
    ];
    return { messages, temperature: 0.7 };
  }

  private buildCitations(results: any[]) {
    return results.map((r) => ({
      source: r.sourceTitle || r.sourceId || 'knowledge',
      content: r.content.substring(0, 300),
      titlePath: r.titlePath,
      pageNumber: r.pageNumber,
    }));
  }

  private buildKnowledgeBlock(results: any[]) {
    return results
      .map((r, i) => {
        let ref = `[${i + 1}]`;
        if (r.sourceTitle) ref += ` 来源:《${r.sourceTitle}》`;
        if (r.titlePath?.length) ref += ` ${r.titlePath.join(' > ')}`;
        if (r.pageNumber) ref += ` 第${r.pageNumber}页`;
        return `${ref}\n${r.content}`;
      })
      .join('\n\n');
  }

  private async rewriteQuery(
    userMessage: string,
    conversationContext: string,
    llmConfig?: ProviderConfig,
  ): Promise<string> {
    const prompt = this.promptsService.getQueryRewritePrompt(userMessage, conversationContext);
    const messages = [{ role: 'user' as const, content: prompt }];
    const result = await this.chatCompletion(messages, { temperature: 0.3, maxTokens: 200 }, llmConfig);
    const rewritten = result.content.trim();
    if (!rewritten || rewritten.length < 2) return userMessage;
    return rewritten;
  }

  private async chatCompletion(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options: Record<string, unknown>,
    llmConfig?: ProviderConfig,
  ) {
    if (llmConfig && typeof (this.llmService as any).chatWithConfig === 'function') {
      return (this.llmService as any).chatWithConfig(messages, options, llmConfig);
    }
    return this.llmService.chat(messages as any, options as any);
  }

  private async ensureMessageQuota(tenantId: string) {
    const quota = await this.tenantsService.checkLimit(tenantId, 'messages');
    const requiredMessagesForTurn = 2;
    const overTurnCapacity = quota.limit !== -1 && quota.current + requiredMessagesForTurn > quota.limit;
    if (!quota.allowed || overTurnCapacity) {
      throw new HttpException('Message quota exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private analyzeIntent(message: string): string {
    const lower = message.toLowerCase();
    if (/推荐|有什么|哪些|什么好|建议/.test(lower)) return 'product_inquiry';
    if (/价格|多少钱|便宜|贵|优惠|折扣/.test(lower)) return 'price_inquiry';
    if (/发货|快递|物流|什么时候到|几天/.test(lower)) return 'logistics_inquiry';
    if (/退|换|坏|质量|售后|投诉/.test(lower)) return 'after_sale';
    if (/下单|买|购买|付款|支付/.test(lower)) return 'purchase_intent';
    if (/人工|客服|转/.test(lower)) return 'transfer_human';
    return 'general_inquiry';
  }

  private calculateIntentScore(message: string, history: FormattedHistoryMessage[]): number {
    let score = 30;
    const lower = message.toLowerCase();
    if (/买|购买|下单|付款/.test(lower)) score += 40;
    if (/多少钱|价格/.test(lower)) score += 20;
    if (/推荐|有什么好/.test(lower)) score += 15;
    if (/发货|快递/.test(lower)) score += 10;
    score += Math.min(history.length * 3, 15);
    return Math.min(score, 100);
  }

  private hasStrongBusinessSignals(t: string): boolean {
    return /价格|多少钱|怎么|如何|为什么|为何|发货|物流|订单|单号|退|换|规格|尺码|库存|优惠|活动|券|报名|课程|学费|政策|保修|发票|下单|购买|買|推荐|有没有|哪些|区别|能否|支持|查一下|帮忙看|咨询|申请|几天到|多久|保修期/.test(
      t,
    );
  }

  private classifyConversationTrack(message: string): 'dialogue' | 'knowledge' {
    const t = message.trim();
    if (!t) return 'knowledge';

    if (this.hasStrongBusinessSignals(t)) {
      return 'knowledge';
    }
    if (/[？?]/.test(t) && /什么|哪|几|多少|谁|是不是|能不能|可以吗/.test(t)) {
      return 'knowledge';
    }

    if (
      /^(你好|您好|在吗|在么|嗨|哈喽|hi|hello|谢谢|多谢|感谢|辛苦了|再见|拜拜|早上好|下午好|晚上好|晚安)([！!。.…~、,\s]*)?$/i.test(
        t,
      )
    ) {
      return 'dialogue';
    }
    if (/^(好的|好哒|嗯嗯|噢|哦|明白了|知道了|OK|ok)([！!。.…~、,\s]*)?$/i.test(t)) {
      return 'dialogue';
    }

    if (
      t.length <= 28 &&
      /谢谢|感谢|多谢|谢了|谢你|谢啦|辛苦了|没谢|帮了大忙|帮了我|你的帮助|的帮助/.test(t) &&
      !this.hasStrongBusinessSignals(t)
    ) {
      return 'dialogue';
    }

    if (
      t.length <= 28 &&
      /^我想(要|吃|来点)/.test(t) &&
      !/买|订|链接|包邮|退款|发货|商品|型号|订单|单号|价格|多少钱|咨询/.test(t)
    ) {
      return 'dialogue';
    }

    if (/天气|聊聊|聊聊天|无聊|讲个笑话|你是谁/.test(t) && !/价格|订单|退|货/.test(t)) {
      return 'dialogue';
    }

    if (t.length <= 8 && !/[？?]/.test(t) && !/问|查|看|找|买|订|退|货|款/.test(t)) {
      if (/^(哈哈|嘿嘿|嗯|哦|喔|555|呜呜)/.test(t)) return 'dialogue';
    }

    return 'knowledge';
  }
}
