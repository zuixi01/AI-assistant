import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const LEAD_STATUS_FLOW: Record<string, string[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['converted', 'lost'],
  converted: [],
  lost: ['new'],
};

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: { userId?: string; conversationId?: string; name?: string; phone?: string; source?: string; intentScore?: number }) {
    return this.prisma.lead.create({
      data: { tenantId, ...data },
    });
  }

  async createForConversation(
    tenantId: string,
    conversationId: string,
    data: { name?: string; phone?: string; source?: string; intentScore?: number },
  ) {
    const leadData = {
      name: data.name,
      phone: data.phone,
      source: data.source,
      intentScore: data.intentScore,
    };

    return this.prisma.lead.upsert({
      where: { conversationId },
      create: {
        tenantId,
        conversationId,
        ...leadData,
      },
      update: leadData,
    });
  }

  async findByTenant(
    tenantId: string,
    page = 1,
    pageSize = 20,
    filters?: { followStatus?: string; source?: string; search?: string; ownerId?: string },
  ) {
    const where: any = { tenantId };
    if (filters?.followStatus) where.followStatus = filters.followStatus;
    if (filters?.source) where.source = filters.source;
    if (filters?.ownerId) where.ownerId = filters.ownerId;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { remark: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: { user: true, conversation: true, leadTags: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findById(tenantId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId },
      include: {
        user: true,
        conversation: { include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } } },
        leadTags: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(tenantId: string, id: string, data: { followStatus?: string; ownerId?: string; remark?: string; tags?: any }) {
    const updated = await this.prisma.lead.updateMany({
      where: { id, tenantId },
      data,
    });
    if (updated.count === 0) throw new NotFoundException('Lead not found');
    return this.findById(tenantId, id);
  }

  async updateStatus(tenantId: string, id: string, newStatus: string) {
    const lead = await this.findById(tenantId, id);
    const currentStatus = lead.followStatus;
    const allowed = LEAD_STATUS_FLOW[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }
    const updated = await this.prisma.lead.updateMany({
      where: { id, tenantId },
      data: { followStatus: newStatus },
    });
    if (updated.count === 0) throw new NotFoundException('Lead not found');
    return this.findById(tenantId, id);
  }

  async getFollowUpReminders(tenantId: string, staleHours = 24) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - staleHours);

    return this.prisma.lead.findMany({
      where: {
        tenantId,
        followStatus: { in: ['new', 'contacted', 'qualified'] },
        updatedAt: { lt: cutoff },
      },
      include: { user: true, leadTags: true },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
  }

  async getSourceStats(tenantId: string) {
    const grouped = await this.prisma.lead.groupBy({
      by: ['source'],
      where: { tenantId },
      _count: { id: true },
    });
    return grouped
      .map((g) => ({ source: g.source || 'unknown', count: g._count.id }))
      .sort((a, b) => b.count - a.count);
  }

  // --- Tag CRUD ---

  async createTag(tenantId: string, name: string, color?: string) {
    return this.prisma.leadTag.create({
      data: { tenantId, name, color },
    });
  }

  async getTags(tenantId: string) {
    return this.prisma.leadTag.findMany({
      where: { tenantId },
      include: { _count: { select: { leads: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async deleteTag(tenantId: string, tagId: string) {
    const tag = await this.prisma.leadTag.findFirst({ where: { id: tagId, tenantId } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.prisma.leadTag.deleteMany({ where: { id: tagId, tenantId } });
  }

  // --- Tag-Lead operations ---

  async addTagToLead(tenantId: string, leadId: string, tagId: string) {
    const [lead, tag] = await Promise.all([
      this.prisma.lead.findFirst({ where: { id: leadId, tenantId } }),
      this.prisma.leadTag.findFirst({ where: { id: tagId, tenantId } }),
    ]);
    if (!lead) throw new NotFoundException('Lead not found');
    if (!tag) throw new NotFoundException('Tag not found');

    return this.prisma.lead.update({
      where: { id: leadId },
      data: { leadTags: { connect: { id: tagId } } },
      include: { leadTags: true },
    });
  }

  async removeTagFromLead(tenantId: string, leadId: string, tagId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.prisma.lead.update({
      where: { id: leadId },
      data: { leadTags: { disconnect: { id: tagId } } },
      include: { leadTags: true },
    });
  }

  async getLeadsByTag(tenantId: string, tagId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        where: { tenantId, leadTags: { some: { id: tagId } } },
        include: { user: true, leadTags: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where: { tenantId, leadTags: { some: { id: tagId } } } }),
    ]);
    return { items, total, page, pageSize };
  }
}
