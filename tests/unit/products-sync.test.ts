import { describe, expect, it, vi } from 'vitest';
import { ProductsService } from '../../apps/api/src/products/products.service';
import { DoudianService } from '../../apps/api/src/integrations/doudian/doudian.service';

describe('product knowledge sync', () => {
  it('generates readable product knowledge with product values', async () => {
    const prisma = {
      knowledgeSource: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const knowledgeService = {
      createSource: vi.fn().mockResolvedValue({ id: 'source-1' }),
      reindex: vi.fn(),
    };
    const service = new ProductsService(prisma as any, knowledgeService as any);

    await service.syncProductKnowledge('tenant-1', {
      title: '泰国金枕榴莲',
      category: '水果',
      price: 12900,
      stock: 500,
      status: 'on_sale',
      aiSummary: '整果新鲜',
      skus: [{ skuName: '3-4斤', price: 12900, stock: 200 }],
    });

    expect(knowledgeService.createSource).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        title: '商品: 泰国金枕榴莲',
        category: '水果',
        rawText: expect.stringContaining('商品名称：泰国金枕榴莲'),
      }),
    );
    const rawText = knowledgeService.createSource.mock.calls[0][1].rawText;
    expect(rawText).toContain('价格：129.00元');
    expect(rawText).toContain('库存：500件');
    expect(rawText).toContain('3-4斤 129.00元 库存200件');
  });

  it('syncs knowledge after importing products from Doudian', async () => {
    const updatedProduct = {
      id: 'prod-1',
      tenantId: 'tenant-1',
      title: '泰国金枕榴莲',
      category: '水果',
      price: 12900,
      stock: 500,
      status: 'on_sale',
      skus: [],
    };
    const prisma = {
      doudianShop: {
        findFirst: vi.fn().mockResolvedValue({ shopId: 'shop-1', accessToken: 'token' }),
      },
      product: {
        upsert: vi.fn().mockResolvedValue(updatedProduct),
      },
    };
    const connectorFactory = {
      getConnector: vi.fn().mockReturnValue({
        getProducts: vi.fn().mockResolvedValue({
          items: [
            {
              productId: 'mock_prod_001',
              title: '泰国金枕榴莲',
              category: '水果',
              price: 12900,
              stock: 500,
              status: 'on_sale',
            },
          ],
        }),
      }),
    };
    const productsService = {
      syncProductKnowledge: vi.fn().mockResolvedValue(undefined),
    };
    const service = new DoudianService(prisma as any, connectorFactory as any, productsService as any);

    await service.syncProducts('tenant-1');

    expect(prisma.product.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_platform_externalProductId: {
            tenantId: 'tenant-1',
            platform: 'doudian',
            externalProductId: 'mock_prod_001',
          },
        },
        include: { skus: true },
      }),
    );
    expect(productsService.syncProductKnowledge).toHaveBeenCalledWith('tenant-1', updatedProduct);
  });
});
