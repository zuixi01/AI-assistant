import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface PlatformStatus {
  channel: string;
  accountCount: number;
  activeAccounts: number;
  todayMessages: number;
  todayConversations: number;
  avgResponseTimeMs: number;
  autoReplyRate: number;
}

export interface PlatformDashboard {
  tenantId: string;
  platforms: PlatformStatus[];
  totalTodayMessages: number;
  totalActiveAccounts: number;
  generatedAt: string;
}

@Injectable()
export class PlatformMonitorService {
  private readonly logger = new Logger(PlatformMonitorService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboard(tenantId: string): Promise<PlatformDashboard> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get ChatGPT-On-CS accounts grouped by platform
    const accounts = await this.prisma.chatGptOnCsAccount.findMany({
      where: { tenantId },
    });

    const platformMap = new Map<string, { total: number; active: number }>();
    for (const acc of accounts) {
      const existing = platformMap.get(acc.platform) || { total: 0, active: 0 };
      existing.total++;
      if (acc.status === 'active') existing.active++;
      platformMap.set(acc.platform, existing);
    }

    // Get today's messages per channel
    const messagesByChannel = await this.prisma.message.groupBy({
      by: ['channel'],
      where: {
        conversation: { tenantId },
        createdAt: { gte: todayStart },
      },
      _count: { id: true },
    });

    // Get today's conversations per channel
    const conversationsByChannel = await this.prisma.conversation.groupBy({
      by: ['channel'],
      where: {
        tenantId,
        createdAt: { gte: todayStart },
      },
      _count: { id: true },
    });

    const msgMap = new Map<string, number>();
    for (const m of messagesByChannel) {
      if (m.channel && typeof m._count === 'object') msgMap.set(m.channel, m._count.id ?? 0);
    }

    const convMap = new Map<string, number>();
    for (const c of conversationsByChannel) {
      if (c.channel && typeof c._count === 'object') convMap.set(c.channel, c._count.id ?? 0);
    }

    const allChannels = new Set([
      ...platformMap.keys(),
      ...msgMap.keys(),
      ...convMap.keys(),
    ]);

    const platforms: PlatformStatus[] = [];
    for (const channel of allChannels) {
      const accInfo = platformMap.get(channel) || { total: 0, active: 0 };
      platforms.push({
        channel,
        accountCount: accInfo.total,
        activeAccounts: accInfo.active,
        todayMessages: msgMap.get(channel) || 0,
        todayConversations: convMap.get(channel) || 0,
        avgResponseTimeMs: 0,
        autoReplyRate: accInfo.active > 0 ? 1 : 0,
      });
    }

    return {
      tenantId,
      platforms,
      totalTodayMessages: platforms.reduce((s, p) => s + p.todayMessages, 0),
      totalActiveAccounts: platforms.reduce((s, p) => s + p.activeAccounts, 0),
      generatedAt: new Date().toISOString(),
    };
  }

  async getAccountHealth(tenantId: string) {
    const accounts = await this.prisma.chatGptOnCsAccount.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    return accounts.map(acc => ({
      id: acc.id,
      platform: acc.platform,
      platformUserId: acc.platformUserId,
      nickname: acc.platformNickname,
      status: acc.status,
      autoReply: acc.autoReply,
      lastActive: acc.updatedAt,
    }));
  }
}
