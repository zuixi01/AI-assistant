import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';

type ProductKnowledgeInput = {
  id?: string;
  title: string;
  category?: string | null;
  price?: number | null;
  stock?: number | null;
  status?: string | null;
  aiSummary?: string | null;
  skus?: { skuName?: string | null; price?: number | null; stock?: number | null }[];
};

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private knowledgeService: KnowledgeService,
  ) {}

  async findByTenant(tenantId: string, page = 1, pageSize = 20, filters?: { status?: string; category?: string }) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { skus: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findById(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { skus: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(tenantId: string, data: any) {
    const product = await this.prisma.product.create({
      data: { tenantId, ...data },
      include: { skus: true },
    });
    await this.syncProductKnowledge(tenantId, product);
    return product;
  }

  async update(tenantId: string, id: string, data: any) {
    const updated = await this.prisma.product.updateMany({
      where: { id, tenantId },
      data,
    });
    if (updated.count === 0) throw new NotFoundException('Product not found');
    const product = await this.findById(tenantId, id);
    await this.syncProductKnowledge(tenantId, product);
    return product;
  }

  async delete(tenantId: string, id: string) {
    const product = await this.findById(tenantId, id);
    const deleted = await this.prisma.product.deleteMany({ where: { id, tenantId } });
    if (deleted.count === 0) throw new NotFoundException('Product not found');
    return product;
  }

  async syncProductKnowledge(tenantId: string, product: ProductKnowledgeInput) {
    const title = `商品: ${product.title}`;
    const rawText = this.buildProductKnowledgeText(product);
    const existing = product.id
      ? await this.prisma.knowledgeSource.findFirst({
          where: {
            tenantId,
            type: 'product',
            sourceUrl: `product://${product.id}`,
          },
        })
      : null;

    if (existing) {
      const source = await this.prisma.knowledgeSource.update({
        where: { id: existing.id },
        data: {
          title,
          category: product.category || undefined,
          rawText,
          status: product.status === 'on_sale' ? 'active' : 'disabled',
        },
      });
      await this.knowledgeService.reindex(tenantId, source.id);
      return source;
    }

    return this.knowledgeService.createSource(tenantId, {
      title,
      type: 'product',
      category: product.category || undefined,
      sourceUrl: product.id ? `product://${product.id}` : undefined,
      rawText,
    });
  }

  private buildProductKnowledgeText(product: ProductKnowledgeInput) {
    const lines = [
      `商品名称：${product.title}`,
      product.category ? `分类：${product.category}` : '',
      product.price != null ? `价格：${this.formatPrice(product.price)}元` : '',
      product.stock != null ? `库存：${product.stock}件` : '',
      product.status ? `状态：${product.status}` : '',
      product.aiSummary ? `卖点：${product.aiSummary}` : '',
    ].filter(Boolean);

    const skuLines = (product.skus || [])
      .map((sku) => {
        const parts = [
          sku.skuName || '默认规格',
          sku.price != null ? `${this.formatPrice(sku.price)}元` : '',
          sku.stock != null ? `库存${sku.stock}件` : '',
        ].filter(Boolean);
        return parts.join(' ');
      })
      .filter(Boolean);

    if (skuLines.length > 0) {
      lines.push('规格：', ...skuLines.map((line) => `- ${line}`));
    }

    return lines.join('\n');
  }

  private formatPrice(priceInCents: number) {
    return (priceInCents / 100).toFixed(2);
  }
}
