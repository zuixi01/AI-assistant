import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface PlanLimits {
  maxMessages: number;
  maxKnowledgeSources: number;
  maxProducts: number;
  maxAdmins: number;
  features: string[];
}

const PLAN_CONFIGS: Record<string, PlanLimits> = {
  free: {
    maxMessages: 100,
    maxKnowledgeSources: 5,
    maxProducts: 10,
    maxAdmins: 1,
    features: ['basic_chat', 'knowledge_base'],
  },
  basic: {
    maxMessages: 1000,
    maxKnowledgeSources: 20,
    maxProducts: 50,
    maxAdmins: 3,
    features: ['basic_chat', 'knowledge_base', 'product_recommend', 'lead_collection'],
  },
  pro: {
    maxMessages: 10000,
    maxKnowledgeSources: 100,
    maxProducts: 500,
    maxAdmins: 10,
    features: ['basic_chat', 'knowledge_base', 'product_recommend', 'lead_collection', 'doudian_integration', 'analytics'],
  },
  enterprise: {
    maxMessages: -1, // unlimited
    maxKnowledgeSources: -1,
    maxProducts: -1,
    maxAdmins: -1,
    features: ['all'],
  },
};

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; slug: string; type: string; plan?: string }) {
    return this.prisma.tenant.create({ data: { ...data, plan: data.plan || 'free' } });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(id: string, data: any) {
    return this.prisma.tenant.update({ where: { id }, data });
  }

  async updatePlan(id: string, plan: string) {
    if (!PLAN_CONFIGS[plan]) {
      throw new BadRequestException(`Invalid plan: ${plan}`);
    }
    return this.prisma.tenant.update({ where: { id }, data: { plan } });
  }

  async getPlanLimits(plan: string): Promise<PlanLimits> {
    return PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;
  }

  async getUsage(tenantId: string) {
    const [messages, knowledgeSources, products, admins] = await Promise.all([
      this.prisma.message.count({ where: { conversation: { tenantId } } }),
      this.prisma.knowledgeSource.count({ where: { tenantId } }),
      this.prisma.product.count({ where: { tenantId } }),
      this.prisma.admin.count({ where: { tenantId } }),
    ]);

    return { messages, knowledgeSources, products, admins };
  }

  async checkLimit(tenantId: string, resource: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const tenant = await this.findById(tenantId);
    const limits = await this.getPlanLimits(tenant.plan);
    const usage = await this.getUsage(tenantId);

    const limitMap: Record<string, { current: number; limit: number }> = {
      messages: { current: usage.messages, limit: limits.maxMessages },
      knowledgeSources: { current: usage.knowledgeSources, limit: limits.maxKnowledgeSources },
      products: { current: usage.products, limit: limits.maxProducts },
      admins: { current: usage.admins, limit: limits.maxAdmins },
    };

    const resourceLimit = limitMap[resource];
    if (!resourceLimit) return { allowed: true, current: 0, limit: -1 };

    return {
      allowed: resourceLimit.limit === -1 || resourceLimit.current < resourceLimit.limit,
      current: resourceLimit.current,
      limit: resourceLimit.limit,
    };
  }
}
