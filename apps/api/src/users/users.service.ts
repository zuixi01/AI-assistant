import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: { nickname?: string; phone?: string; source?: string; wechatOpenid?: string; douyinOpenid?: string; douyinUnionid?: string }) {
    return this.prisma.user.create({
      data: { tenantId, ...data },
    });
  }

  async findById(tenantId: string, id: string) {
    return this.prisma.user.findFirst({ where: { id, tenantId } });
  }

  async findByTenant(tenantId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);
    return { items, total, page, pageSize };
  }

  async findByWechatOpenid(openid: string) {
    return this.prisma.user.findUnique({ where: { wechatOpenid: openid } });
  }

  async findByDouyinOpenid(openid: string) {
    return this.prisma.user.findUnique({ where: { douyinOpenid: openid } });
  }

  async update(tenantId: string, id: string, data: any) {
    await this.findById(tenantId, id);
    return this.prisma.user.update({ where: { id }, data });
  }
}
