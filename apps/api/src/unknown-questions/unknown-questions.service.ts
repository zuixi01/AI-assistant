import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class UnknownQuestionsService {
  constructor(private prisma: PrismaService) {}

  async record(tenantId: string, data: { question: string; hitChunks?: any; aiResponse?: string; failReason?: string }) {
    // Check if question already exists
    const existing = await this.prisma.unknownQuestion.findFirst({
      where: { tenantId, question: data.question },
    });

    if (existing) {
      return this.prisma.unknownQuestion.update({
        where: { id: existing.id },
        data: { count: { increment: 1 } },
      });
    }

    return this.prisma.unknownQuestion.create({
      data: { tenantId, ...data },
    });
  }

  async findByTenant(tenantId: string, page = 1, pageSize = 20, resolved?: boolean) {
    const where: any = { tenantId };
    if (resolved !== undefined) where.resolved = resolved;

    const [items, total] = await Promise.all([
      this.prisma.unknownQuestion.findMany({
        where,
        orderBy: [{ count: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.unknownQuestion.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async resolve(tenantId: string, id: string, suggestion?: string) {
    const question = await this.prisma.unknownQuestion.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!question) throw new NotFoundException('Unknown question not found');

    return this.prisma.unknownQuestion.update({
      where: { id },
      data: {
        resolved: true,
        status: 'resolved',
        suggestion,
      },
    });
  }
}
