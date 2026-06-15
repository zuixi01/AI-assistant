import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

type PeriodBounds = {
  days: number;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
};

type DailyBucket = {
  userMessages: number;
  assistantMessages: number;
  conversations: number;
  leads: number;
  correctedReplies: number;
};

const AFTER_SALE_RULES: Array<{ type: string; pattern: RegExp }> = [
  { type: '退款', pattern: /退款|退钱|退货|仅退款/i },
  { type: '换货', pattern: /换货|换一个|更换|补发/i },
  { type: '质量问题', pattern: /质量|坏了|损坏|腐坏|压坏|裂开|异常/i },
  { type: '物流问题', pattern: /物流|快递|发货|没到|延迟|签收|配送/i },
];

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private clampDays(days?: number): number {
    if (!days || Number.isNaN(days)) return 30;
    return Math.min(90, Math.max(7, days));
  }

  private buildPeriodBounds(days?: number): PeriodBounds {
    const safeDays = this.clampDays(days);
    const end = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - safeDays + 1);

    const previousEnd = new Date(start);
    previousEnd.setMilliseconds(-1);

    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - safeDays);

    return { days: safeDays, start, end, previousStart, previousEnd };
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private percentage(part: number, total: number, digits = 1): number {
    if (!total) return 0;
    return Number(((part / total) * 100).toFixed(digits));
  }

  private delta(current: number, previous: number, digits = 1): number {
    if (!previous) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(digits));
  }

  async getDashboard(tenantId: string, days?: number) {
    const { days: safeDays, start, previousStart, previousEnd } = this.buildPeriodBounds(days);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalConversations,
      currentConversations,
      previousConversations,
      todayConversations,
      totalMessages,
      currentMessages,
      previousMessages,
      todayMessages,
      totalLeads,
      currentLeads,
      previousLeads,
      todayLeads,
      totalProducts,
      totalUnknownQuestions,
      totalAiReplies,
      currentAiReplies,
      previousAiReplies,
      currentCorrections,
      previousCorrections,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { tenantId } }),
      this.prisma.conversation.count({ where: { tenantId, createdAt: { gte: start } } }),
      this.prisma.conversation.count({ where: { tenantId, createdAt: { gte: previousStart, lte: previousEnd } } }),
      this.prisma.conversation.count({ where: { tenantId, createdAt: { gte: today } } }),
      this.prisma.message.count({ where: { conversation: { tenantId } } }),
      this.prisma.message.count({ where: { conversation: { tenantId }, createdAt: { gte: start } } }),
      this.prisma.message.count({ where: { conversation: { tenantId }, createdAt: { gte: previousStart, lte: previousEnd } } }),
      this.prisma.message.count({ where: { conversation: { tenantId }, createdAt: { gte: today } } }),
      this.prisma.lead.count({ where: { tenantId } }),
      this.prisma.lead.count({ where: { tenantId, createdAt: { gte: start } } }),
      this.prisma.lead.count({ where: { tenantId, createdAt: { gte: previousStart, lte: previousEnd } } }),
      this.prisma.lead.count({ where: { tenantId, createdAt: { gte: today } } }),
      this.prisma.product.count({ where: { tenantId } }),
      this.prisma.unknownQuestion.count({ where: { tenantId, resolved: false } }),
      this.prisma.message.count({ where: { conversation: { tenantId }, role: 'assistant' } }),
      this.prisma.message.count({ where: { conversation: { tenantId }, role: 'assistant', createdAt: { gte: start } } }),
      this.prisma.message.count({ where: { conversation: { tenantId }, role: 'assistant', createdAt: { gte: previousStart, lte: previousEnd } } }),
      this.prisma.platformReplyFeedback.count({ where: { tenantId, createdAt: { gte: start } } }),
      this.prisma.platformReplyFeedback.count({ where: { tenantId, createdAt: { gte: previousStart, lte: previousEnd } } }),
    ]);

    const currentAccuracy = this.percentage(currentAiReplies - currentCorrections, currentAiReplies);
    const previousAccuracy = this.percentage(previousAiReplies - previousCorrections, previousAiReplies);
    const currentCorrectionRate = this.percentage(currentCorrections, currentAiReplies);

    return {
      range: {
        days: safeDays,
        startDate: this.toDateKey(start),
        endDate: this.toDateKey(new Date()),
      },
      summary: {
        conversations: {
          total: totalConversations,
          current: currentConversations,
          today: todayConversations,
          delta: this.delta(currentConversations, previousConversations),
        },
        messages: {
          total: totalMessages,
          current: currentMessages,
          today: todayMessages,
          delta: this.delta(currentMessages, previousMessages),
        },
        leads: {
          total: totalLeads,
          current: currentLeads,
          today: todayLeads,
          delta: this.delta(currentLeads, previousLeads),
        },
        aiReplies: {
          total: totalAiReplies,
          current: currentAiReplies,
          delta: this.delta(currentAiReplies, previousAiReplies),
        },
        unresolvedQuestions: totalUnknownQuestions,
        products: totalProducts,
        avgMessagesPerConversation: currentConversations > 0 ? Number((currentMessages / currentConversations).toFixed(1)) : 0,
        leadCaptureRate: this.percentage(currentLeads, currentConversations),
        aiAccuracyRate: currentAccuracy,
        accuracyDelta: Number((currentAccuracy - previousAccuracy).toFixed(1)),
        correctionRate: currentCorrectionRate,
      },
    };
  }

  async getIntentDistribution(tenantId: string, days?: number) {
    const { start } = this.buildPeriodBounds(days);

    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId, createdAt: { gte: start }, intent: { not: null } },
      select: { intent: true },
    });

    const distribution: Record<string, number> = {};
    for (const conversation of conversations) {
      const intent = conversation.intent || 'general_inquiry';
      distribution[intent] = (distribution[intent] || 0) + 1;
    }

    return Object.entries(distribution)
      .map(([intent, count]) => ({
        intent,
        count,
        percentage: this.percentage(count, conversations.length),
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getAfterSaleAnalysis(tenantId: string, days?: number) {
    const { start } = this.buildPeriodBounds(days);

    const afterSaleConversations = await this.prisma.conversation.findMany({
      where: { tenantId, intent: 'after_sale', createdAt: { gte: start } },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 8,
          select: { content: true },
        },
      },
    });

    const categories = new Map<string, number>([
      ['退款', 0],
      ['换货', 0],
      ['质量问题', 0],
      ['物流问题', 0],
      ['其他售后', 0],
    ]);

    for (const conversation of afterSaleConversations) {
      const text = conversation.messages.map((message) => message.content).join(' ');
      const matched = AFTER_SALE_RULES.find((rule) => rule.pattern.test(text));
      const type = matched?.type ?? '其他售后';
      categories.set(type, (categories.get(type) || 0) + 1);
    }

    return Array.from(categories.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: this.percentage(count, afterSaleConversations.length),
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getPlatformComparison(tenantId: string, days?: number) {
    const { start } = this.buildPeriodBounds(days);

    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId, createdAt: { gte: start } },
      select: {
        channel: true,
        status: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    const totalConversations = conversations.length;
    const channelMap = new Map<string, { conversations: number; messages: number; resolved: number }>();

    for (const conversation of conversations) {
      const channel = conversation.channel || 'web';
      const current = channelMap.get(channel) || { conversations: 0, messages: 0, resolved: 0 };
      current.conversations += 1;
      current.messages += conversation._count.messages;
      if (conversation.status === 'closed') current.resolved += 1;
      channelMap.set(channel, current);
    }

    return Array.from(channelMap.entries())
      .map(([channel, stats]) => ({
        channel,
        conversations: stats.conversations,
        messages: stats.messages,
        avgMessages: stats.conversations > 0 ? Number((stats.messages / stats.conversations).toFixed(1)) : 0,
        resolutionRate: this.percentage(stats.resolved, stats.conversations),
        share: this.percentage(stats.conversations, totalConversations),
      }))
      .sort((a, b) => b.conversations - a.conversations);
  }

  async getAgentPerformance(tenantId: string, days?: number) {
    const { start } = this.buildPeriodBounds(days);

    const assignedConversations = await this.prisma.conversation.findMany({
      where: { tenantId, assignedTo: { not: null }, createdAt: { gte: start } },
      select: { assignedTo: true, status: true },
    });

    const agentMap = new Map<string, { conversations: number; resolved: number; pending: number; open: number }>();

    for (const conversation of assignedConversations) {
      const agentId = conversation.assignedTo!;
      const current = agentMap.get(agentId) || { conversations: 0, resolved: 0, pending: 0, open: 0 };
      current.conversations += 1;
      if (conversation.status === 'closed') current.resolved += 1;
      if (conversation.status === 'pending_human') current.pending += 1;
      if (conversation.status === 'open') current.open += 1;
      agentMap.set(agentId, current);
    }

    return Array.from(agentMap.entries())
      .map(([agentId, stats]) => ({
        agentId,
        ...stats,
        resolutionRate: this.percentage(stats.resolved, stats.conversations),
      }))
      .sort((a, b) => b.conversations - a.conversations);
  }

  async getAiAccuracy(tenantId: string, days?: number) {
    const { start } = this.buildPeriodBounds(days);

    const [totalReplies, correctedReplies] = await Promise.all([
      this.prisma.message.count({
        where: {
          conversation: { tenantId },
          role: 'assistant',
          createdAt: { gte: start },
        },
      }),
      this.prisma.platformReplyFeedback.count({
        where: {
          tenantId,
          createdAt: { gte: start },
        },
      }),
    ]);

    return {
      totalReplies,
      correctedReplies,
      accuracyRate: this.percentage(totalReplies - correctedReplies, totalReplies),
      correctionRate: this.percentage(correctedReplies, totalReplies),
    };
  }

  async getTrend(tenantId: string, days?: number) {
    const { days: safeDays, start } = this.buildPeriodBounds(days);

    const [messages, conversations, leads, corrections] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversation: { tenantId }, createdAt: { gte: start } },
        select: { createdAt: true, role: true },
      }),
      this.prisma.conversation.findMany({
        where: { tenantId, createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      this.prisma.lead.findMany({
        where: { tenantId, createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      this.prisma.platformReplyFeedback.findMany({
        where: { tenantId, createdAt: { gte: start } },
        select: { createdAt: true },
      }),
    ]);

    const dailyData: Record<string, DailyBucket> = {};
    for (let index = 0; index < safeDays; index += 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (safeDays - index - 1));
      dailyData[this.toDateKey(date)] = {
        userMessages: 0,
        assistantMessages: 0,
        conversations: 0,
        leads: 0,
        correctedReplies: 0,
      };
    }

    for (const message of messages) {
      const key = this.toDateKey(message.createdAt);
      if (!dailyData[key]) continue;
      if (message.role === 'assistant') dailyData[key].assistantMessages += 1;
      else if (message.role === 'user') dailyData[key].userMessages += 1;
    }

    for (const conversation of conversations) {
      const key = this.toDateKey(conversation.createdAt);
      if (dailyData[key]) dailyData[key].conversations += 1;
    }

    for (const lead of leads) {
      const key = this.toDateKey(lead.createdAt);
      if (dailyData[key]) dailyData[key].leads += 1;
    }

    for (const feedback of corrections) {
      const key = this.toDateKey(feedback.createdAt);
      if (dailyData[key]) dailyData[key].correctedReplies += 1;
    }

    return Object.entries(dailyData).map(([date, counts]) => ({
      date,
      ...counts,
      totalMessages: counts.userMessages + counts.assistantMessages,
    }));
  }
}
