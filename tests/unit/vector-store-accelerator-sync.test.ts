import { describe, expect, it, vi } from 'vitest';
import { VectorStoreService } from '../../apps/api/src/knowledge/services/vector-store.service';

const insertParams = {
  tenantId: 'tenant-1',
  sourceId: 'source-1',
  content: 'chunk text',
  contentType: 'text',
  embedding: [0.1, 0.2],
  chunkIndex: 0,
  metadata: { sectionIndex: 0 },
};

describe('vector store accelerator sync', () => {
  it('returns chunk and vector index IDs after inserting a chunk', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: 'chunk-1', vector_index_id: 42n }]),
    };
    const service = new VectorStoreService(prisma as any, {} as any);

    const inserted = await service.insertChunk(insertParams);

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledOnce();
    expect(String(prisma.$queryRawUnsafe.mock.calls[0][0])).toContain('RETURNING id, vector_index_id');
    expect(inserted).toEqual({ chunkId: 'chunk-1', vectorIndexId: 42 });
  });

  it('syncs inserted chunks to the vector accelerator in batches', async () => {
    const accelerator = {
      isEnabled: true,
      upsertBatch: vi.fn().mockResolvedValue(true),
    };
    const service = new (VectorStoreService as any)({} as any, {} as any, accelerator);

    await service.syncChunksToAccelerator({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      chunks: [
        {
          chunkId: 'chunk-1',
          vectorIndexId: 42,
          content: 'chunk text',
          contentType: 'text',
          embedding: [0.1, 0.2],
          metadata: { sectionIndex: 0 },
        },
      ],
    });

    expect(accelerator.upsertBatch).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      chunks: [
        expect.objectContaining({
          chunkId: 'chunk-1',
          vectorIndexId: 42,
          tenantId: 'tenant-1',
          sourceId: 'source-1',
          contentType: 'text',
          embedding: [0.1, 0.2],
        }),
      ],
    });
  });

  it('notifies the vector accelerator when chunks for a source are deleted', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([
        { id: 'chunk-1', vector_index_id: 42n },
        { id: 'chunk-2', vector_index_id: 43n },
      ]),
      knowledgeChunk: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const accelerator = {
      isEnabled: true,
      delete: vi.fn().mockResolvedValue(true),
    };
    const service = new (VectorStoreService as any)(prisma, {} as any, accelerator);

    await service.deleteChunks('source-1');

    expect(prisma.knowledgeChunk.deleteMany).toHaveBeenCalledWith({ where: { sourceId: 'source-1' } });
    expect(accelerator.delete).toHaveBeenCalledWith({
      sourceId: 'source-1',
      chunkIds: ['chunk-1', 'chunk-2'],
      vectorIndexIds: [42, 43],
    });
  });
});
