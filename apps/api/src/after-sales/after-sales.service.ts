import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AfterSalesService {
  constructor(private prisma: PrismaService) {}

  async findByTenant(tenantId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId, aftersaleStatus: { not: null } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where: { tenantId, aftersaleStatus: { not: null } } }),
    ]);
    return { items, total, page, pageSize };
  }

  async findByOrderId(tenantId: string, orderId: string) {
    return this.prisma.order.findFirst({ where: { id: orderId, tenantId } });
  }
}
