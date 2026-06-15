import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, email: string, password: string, name?: string, role?: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.admin.create({
      data: { tenantId, email, password: hashedPassword, name, role },
    });
  }

  async findByTenant(tenantId: string) {
    return this.prisma.admin.findMany({
      where: { tenantId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }
}
