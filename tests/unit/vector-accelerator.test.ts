import { describe, expect, it, vi } from 'vitest';
import { RetrievalService } from '../../apps/api/src/knowledge/retrieval/retrieval.service';

const embedding = Array.from({ length: 1536 }, (_, index) => (index + 1) / 1536);

const row = (overrides: Record<string, any> = {}) => ({
  id: 'chunk-1',
  content: 'active tenant chunk',
  q: null,
  a: null,
  metadata: {},
  source_id: 'source-1',
  title: 'Shipping policy',
  title_path: ['FAQ'],
  content_type: 'text',
  page_number: 1,
  sheet_name: null,
  chunk_index: 0,
  hit_count: 0,
  score: 0.81,
  ...overrides,
});

describe('vector accelerator retrieval', () => {
  it('uses pgvector semantic search when the accelerator is disabled', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([row()]),
    };
    const embeddingService = {
      embed: vi.fn().mockResolvedValue({ embedding }),
      embedWithConfig: vi.fn().mockResolvedValue({ embedding }),
    };
    const accelerator = {
      isEnabled: false,
      search: vi.fn(),
    };
    const service = new (RetrievalService as any)(prisma, embeddingService, accelerator);

    const results = await service.retrieve('tenant-1', 'shipping', 'semantic', 1);

    expect(accelerator.search).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledOnce();
    expect(results[0]).toMatchObject({ chunkId: 'chunk-1', score: 0.81 });
  });

  it('uses tenant embedding configuration for semantic search', async () => {
    const tenantModelConfig = {
      llm: {
        provider: 'mock',
        apiKey: '',
        baseUrl: '',
        model: 'mock',
      },
      embedding: {
        provider: 'qwen',
        apiKey: 'tenant-embedding-key',
        baseUrl: 'https://tenant-embedding.example/v1',
        model: 'tenant-embedding-model',
      },
    };
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([row()]),
    };
    const embeddingService = {
      embed: vi.fn().mockResolvedValue({ embedding }),
      embedWithConfig: vi.fn().mockResolvedValue({ embedding }),
    };
    const accelerator = {
      isEnabled: false,
      search: vi.fn(),
    };
    const modelConfigService = {
      getConfig: vi.fn().mockResolvedValue(tenantModelConfig),
    };
    const service = new (RetrievalService as any)(prisma, embeddingService, accelerator);
    service.modelConfigService = modelConfigService;

    const results = await service.retrieve('tenant-1', 'shipping', 'semantic', 1);

    expect(modelConfigService.getConfig).toHaveBeenCalledWith('tenant-1');
    expect(embeddingService.embedWithConfig).toHaveBeenCalledWith('shipping', tenantModelConfig.embedding);
    expect(embeddingService.embed).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({ chunkId: 'chunk-1', score: 0.81 });
  });

  it('skips pgvector semantic search when query embedding dimensions do not match the database vector size', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([row()]),
    };
    const embeddingService = {
      embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2] }),
      embedWithConfig: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2] }),
    };
    const accelerator = {
      isEnabled: false,
      search: vi.fn(),
    };
    const service = new (RetrievalService as any)(prisma, embeddingService, accelerator);

    const results = await service.retrieve('tenant-1', 'shipping', 'semantic', 1);

    expect(results).toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(accelerator.search).not.toHaveBeenCalled();
  });

  it('treats keyword hits as answerable when semantic search is unavailable', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockImplementation(async (sql: string) => {
        const statement = String(sql);
        if (statement.includes('<=>')) {
          throw new Error('different vector dimensions 1536 and 1024');
        }
        if (statement.includes('ILIKE')) {
          return [row({ content: '榴莲售后和发货政策', priority: 10 })];
        }
        if (statement.includes('FROM knowledge_sources')) {
          return [{ id: 'source-1', title: 'Durian FAQ', category: null, priority: 10 }];
        }
        return [];
      }),
    };
    const embeddingService = {
      embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2] }),
      embedWithConfig: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2] }),
    };
    const accelerator = {
      isEnabled: false,
      search: vi.fn(),
    };
    const service = new (RetrievalService as any)(prisma, embeddingService, accelerator);

    const output = await service.retrieveWithRerank('tenant-1', '榴莲', 1);

    expect(output.results).toHaveLength(1);
    expect(output.answerStatus).not.toBe('no_answer');
    expect(output.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('uses the accelerator when enabled and rehydrates only active rows through Postgres', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([
        row({ id: 'chunk-2', content: 'accelerated active chunk', score: 0.1 }),
      ]),
    };
    const embeddingService = {
      embed: vi.fn().mockResolvedValue({ embedding }),
      embedWithConfig: vi.fn().mockResolvedValue({ embedding }),
    };
    const accelerator = {
      isEnabled: true,
      search: vi.fn().mockResolvedValue({
        success: true,
        provider: 'turbovec',
        indexVersion: 'v1',
        results: [
          { chunkId: 'chunk-2', vectorIndexId: 2, score: 0.94 },
          { chunkId: 'inactive-or-cross-tenant', vectorIndexId: 3, score: 0.93 },
        ],
      }),
    };
    const service = new (RetrievalService as any)(prisma, embeddingService, accelerator);

    const results = await service.retrieve('tenant-1', 'shipping', 'semantic', 2);
    const sql = String(prisma.$queryRawUnsafe.mock.calls[0][0]);

    expect(accelerator.search).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      embedding,
      topK: 2,
    });
    expect(sql).toContain('kc.tenant_id = $1::uuid');
    expect(sql).toContain("kc.status = 'active'");
    expect(sql).toContain("ks.status = 'active'");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      chunkId: 'chunk-2',
      content: 'accelerated active chunk',
      score: 0.94,
    });
  });

  it('falls back to pgvector when the accelerator search fails', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([row({ id: 'fallback-chunk', score: 0.72 })]),
    };
    const embeddingService = {
      embed: vi.fn().mockResolvedValue({ embedding }),
      embedWithConfig: vi.fn().mockResolvedValue({ embedding }),
    };
    const accelerator = {
      isEnabled: true,
      search: vi.fn().mockRejectedValue(new Error('sidecar timeout')),
    };
    const service = new (RetrievalService as any)(prisma, embeddingService, accelerator);

    const results = await service.retrieve('tenant-1', 'shipping', 'semantic', 1);

    expect(accelerator.search).toHaveBeenCalledOnce();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledOnce();
    expect(results[0]).toMatchObject({ chunkId: 'fallback-chunk', score: 0.72 });
  });
});
