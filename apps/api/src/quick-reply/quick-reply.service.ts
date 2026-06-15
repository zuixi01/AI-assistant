import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class QuickReplyService {
  private readonly logger = new Logger(QuickReplyService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, category?: string) {
    return this.prisma.quickReply.findMany({
      where: { tenantId, ...(category ? { category } : {}) },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { usageCount: 'desc' }],
    });
  }

  async findOne(id: string, tenantId: string) {
    return this.prisma.quickReply.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, data: { title: string; content: string; category?: string; sortOrder?: number }) {
    return this.prisma.quickReply.create({
      data: { tenantId, ...data },
    });
  }

  async update(id: string, tenantId: string, data: { title?: string; content?: string; category?: string; sortOrder?: number }) {
    return this.prisma.quickReply.update({
      where: { id, tenantId },
      data,
    });
  }

  async delete(id: string, tenantId: string) {
    await this.prisma.quickReply.delete({ where: { id, tenantId } });
    return { success: true };
  }

  async incrementUsage(id: string) {
    await this.prisma.quickReply.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }

  async search(tenantId: string, query: string) {
    return this.prisma.quickReply.findMany({
      where: {
        tenantId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { usageCount: 'desc' },
    });
  }

  async getCategories(tenantId: string) {
    const results = await this.prisma.quickReply.groupBy({
      by: ['category'],
      where: { tenantId },
      _count: { id: true },
    });
    return results.map((r) => ({ category: r.category || '未分类', count: r._count.id }));
  }

  async batchCreate(tenantId: string, items: { title: string; content: string; category?: string }[]) {
    const created = await this.prisma.quickReply.createMany({
      data: items.map((item, i) => ({ tenantId, sortOrder: i, ...item })),
    });
    return { count: created.count };
  }
}
