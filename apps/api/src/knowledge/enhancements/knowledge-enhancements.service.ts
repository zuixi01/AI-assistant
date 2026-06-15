import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface QAPair {
  question: string;
  answer: string;
  category?: string;
}

export interface KeywordTestResult {
  query: string;
  matches: { sourceId: string; title: string; content: string; score: number }[];
  method: string;
}

@Injectable()
export class KnowledgeEnhancementsService {
  private readonly logger = new Logger(KnowledgeEnhancementsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Batch import Q&A pairs as knowledge sources.
   */
  async batchImportQA(tenantId: string, pairs: QAPair[], knowledgeBaseId?: string) {
    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const pair of pairs) {
      try {
        if (!pair.question || !pair.answer) {
          results.skipped++;
          continue;
        }

        await this.prisma.knowledgeSource.create({
          data: {
            tenantId,
            title: pair.question.substring(0, 128),
            type: 'faq',
            category: pair.category || 'batch_import',
            rawText: 'Q: ' + pair.question + '\nA: ' + pair.answer,
            status: 'active',
            knowledgeBaseId: knowledgeBaseId || null,
          },
        });
        results.imported++;
      } catch (e: any) {
        results.errors.push('Failed to import: ' + pair.question.substring(0, 50) + ' - ' + e.message);
      }
    }

    this.logger.log('Batch import completed: ' + results.imported + ' imported, ' + results.skipped + ' skipped');
    return results;
  }

  /**
   * Extract Q&A pairs from conversation history.
   * Finds conversations where the AI gave good answers (not transferred to human).
   */
  async learnFromChatHistory(tenantId: string, options?: {
    minMessages?: number;
    maxConversations?: number;
    channel?: string;
  }) {
    const minMessages = options?.minMessages || 3;
    const maxConversations = options?.maxConversations || 50;

    // Find conversations with good AI responses
    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId,
        status: { in: ['open', 'closed'] },
        ...(options?.channel ? { channel: options.channel } : {}),
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
      take: maxConversations,
      orderBy: { updatedAt: 'desc' },
    });

    const extractedPairs: QAPair[] = [];

    for (const conv of conversations) {
      if (conv.messages.length < minMessages) continue;

      // Find user->assistant message pairs
      for (let i = 0; i < conv.messages.length - 1; i++) {
        const userMsg = conv.messages[i];
        const assistantMsg = conv.messages[i + 1];

        if (userMsg.role === 'user' && assistantMsg.role === 'assistant') {
          // Only extract if it looks like a knowledge Q&A (not chitchat)
          const question = userMsg.content.trim();
          const answer = assistantMsg.content.trim();

          if (question.length > 5 && answer.length > 10 && !this.isChitchat(question)) {
            extractedPairs.push({
              question,
              answer,
              category: 'learned_from_chat',
            });
          }
        }
      }
    }

    this.logger.log('Extracted ' + extractedPairs.length + ' Q&A pairs from chat history');
    return {
      totalExtracted: extractedPairs.length,
      conversationsAnalyzed: conversations.length,
      pairs: extractedPairs.slice(0, 100), // Return first 100 for review
    };
  }

  /**
   * Import extracted Q&A pairs into knowledge base.
   */
  async importLearnedPairs(tenantId: string, pairs: QAPair[], knowledgeBaseId?: string) {
    return this.batchImportQA(tenantId, pairs, knowledgeBaseId);
  }

  /**
   * Test keyword matching against knowledge base.
   */
  async testKeywordMatch(tenantId: string, query: string): Promise<KeywordTestResult> {
    const sources = await this.prisma.knowledgeSource.findMany({
      where: { tenantId, status: 'active' },
      take: 100,
    });

    const matches: { sourceId: string; title: string; content: string; score: number }[] = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 1);

    for (const source of sources) {
      const text = ((source.title || '') + ' ' + (source.rawText || '')).toLowerCase();
      let score = 0;

      // Exact match
      if (text.includes(queryLower)) {
        score = 1.0;
      } else {
        // Word overlap
        const matchedWords = queryWords.filter((w) => text.includes(w));
        score = matchedWords.length / queryWords.length;
      }

      if (score > 0.2) {
        matches.push({
          sourceId: source.id,
          title: source.title || '',
          content: (source.rawText || '').substring(0, 200),
          score,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);

    return {
      query,
      matches: matches.slice(0, 10),
      method: 'keyword',
    };
  }

  /**
   * Get Juguang-specific knowledge templates.
   */
  getJuguangTemplates() {
    return [
      {
        category: '聚光平台基础',
        pairs: [
          { question: '聚光平台是什么？', answer: '聚光平台是小红书商业化的一站式广告投放平台，支持信息流广告、搜索广告、私信营销等多种营销方式。' },
          { question: '如何开通聚光平台？', answer: '开通聚光平台需要：1. 注册小红书账号 2. 完成企业认证 3. 联系聚光商务开通广告账户 4. 充值后即可开始投放。' },
          { question: '聚光平台的计费方式有哪些？', answer: '聚光平台支持CPC（按点击计费）、CPM（按展示计费）、oCPC（按转化目标计费）等多种计费方式。' },
        ],
      },
      {
        category: '私信营销',
        pairs: [
          { question: '聚光私信怎么用？', answer: '聚光私信功能可以通过广告投放引导用户发送私信，实现1对1沟通。支持自动回复、话术模板、线索收集等功能。' },
          { question: '私信自动回复怎么设置？', answer: '在聚光平台-私信管理-自动回复中设置。可以设置关键词触发的自动回复，也可以设置欢迎语和常见问题自动回复。' },
          { question: '私信有字数限制吗？', answer: '私信消息单条字数上限为1000字，支持文字、图片、表情等形式。' },
        ],
      },
      {
        category: '线索管理',
        pairs: [
          { question: '怎么查看线索？', answer: '在聚光平台-线索管理中可以查看所有收集到的线索，支持按时间、来源、状态筛选，也可以导出Excel。' },
          { question: '线索如何跟进？', answer: '建议在线索产生后24小时内首次联系。可以通过电话、微信等方式跟进，并在系统中更新跟进状态和备注。' },
        ],
      },
      {
        category: '广告投放',
        pairs: [
          { question: '聚光广告怎么投放？', answer: '投放步骤：1. 创建广告计划 2. 设置预算和出价 3. 选择投放人群 4. 创作广告素材 5. 提交审核 6. 审核通过后自动投放。' },
          { question: '广告审核要多久？', answer: '一般审核时间为1-2个工作日，素材质量高的广告审核更快。审核不通过会提示具体原因，修改后可重新提交。' },
        ],
      },
    ];
  }

  private isChitchat(text: string): boolean {
    const chitchatPatterns = /^(你好|您好|在吗|谢谢|感谢|再见|拜拜|好的|嗯嗯|ok|哈哈)/i;
    return chitchatPatterns.test(text.trim()) || text.trim().length < 8;
  }
}
