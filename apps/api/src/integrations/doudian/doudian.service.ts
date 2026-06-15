import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductsService } from '../../products/products.service';
import { DoudianConnectorFactory } from './doudian-connector.factory';

@Injectable()
export class DoudianService {
  constructor(
    private prisma: PrismaService,
    private connectorFactory: DoudianConnectorFactory,
    private productsService: ProductsService,
  ) {}

  async syncProducts(tenantId: string) {
    const shop = await this.prisma.doudianShop.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!shop) throw new NotFoundException('Doudian shop not found');

    const connector = this.connectorFactory.getConnector();
    const response = await connector.getProducts({ shopId: shop.shopId, accessToken: shop.accessToken });
    const products = response.items || [];
    const synced: any[] = [];

    for (const item of products) {
      const product = await this.prisma.product.upsert({
        where: {
          tenantId_platform_externalProductId: {
            tenantId,
            platform: 'doudian',
            externalProductId: item.productId,
          },
        },
        create: {
          tenantId,
          platform: 'doudian',
          externalProductId: item.productId,
          shopId: shop.shopId,
          title: item.title,
          category: item.category || undefined,
          price: item.price ?? undefined,
          stock: item.stock ?? undefined,
          status: item.status || 'on_sale',
          imageUrl: item.imageUrl || undefined,
          detailUrl: item.detailUrl || undefined,
        },
        update: {
          title: item.title,
          category: item.category || undefined,
          price: item.price ?? undefined,
          stock: item.stock ?? undefined,
          status: item.status || 'on_sale',
          imageUrl: item.imageUrl || undefined,
          detailUrl: item.detailUrl || undefined,
        },
        include: { skus: true },
      });
      await this.productsService.syncProductKnowledge(tenantId, product);
      synced.push(product);
    }

    return { count: synced.length, items: synced };
  }
}
