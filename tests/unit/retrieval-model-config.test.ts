import { describe, expect, it, vi } from 'vitest';
import { RetrievalService } from '../../apps/api/src/knowledge/retrieval/retrieval.service';

describe('RetrievalService tenant model configuration', () => {
  it('uses tenant embedding configuration for semantic retrieval', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    };
    const embeddingService = {
      embed: vi.fn(),
      embedWithConfig: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3] }),
    };
    const tenantConfig = {
      embedding: {
        provider: 'qwen',
        apiKey: 'tenant-embedding-key',
        baseUrl: 'https://tenant-embedding.example/v1',
        model: 'tenant-embedding-model',
      },
    };
    const modelConfigService = {
      getConfig: vi.fn().mockResolvedValue(tenantConfig),
    };

    const service = new RetrievalService(
      prisma as any,
      embeddingService as any,
      undefined,
      modelConfigService as any,
    );

    await service.retrieve('tenant-1', '发货多久', 'semantic', 5);

    expect(modelConfigService.getConfig).toHaveBeenCalledWith('tenant-1');
    expect(embeddingService.embedWithConfig).toHaveBeenCalledWith('发货多久', tenantConfig.embedding);
    expect(embeddingService.embed).not.toHaveBeenCalled();
  });
});
