import { describe, expect, it, vi } from 'vitest';
import { PipelineService } from '../../apps/api/src/knowledge/pipeline/pipeline.service';

describe('pipeline vector accelerator sync', () => {
  it('syncs inserted text chunks after processText completes', async () => {
    const chunkerFactory = {
      chunk: vi.fn().mockReturnValue([
        { content: 'first chunk', metadata: { sectionIndex: 0 } },
        { content: 'second chunk', metadata: { sectionIndex: 1 } },
      ]),
    };
    const embeddingService = {
      embedBatch: vi.fn().mockResolvedValue([
        { embedding: [0.1, 0.2] },
        { embedding: [0.3, 0.4] },
      ]),
    };
    const vectorStore = {
      deleteChunks: vi.fn().mockResolvedValue(undefined),
      insertChunk: vi.fn()
        .mockResolvedValueOnce({ chunkId: 'chunk-1', vectorIndexId: 41 })
        .mockResolvedValueOnce({ chunkId: 'chunk-2', vectorIndexId: 42 }),
      syncChunksToAccelerator: vi.fn().mockResolvedValue(undefined),
    };
    const service = new PipelineService({} as any, embeddingService as any, chunkerFactory as any, vectorStore as any);

    const count = await service.processText('tenant-1', 'text', 'source-1');

    expect(count).toBe(2);
    expect(vectorStore.syncChunksToAccelerator).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      chunks: [
        expect.objectContaining({
          chunkId: 'chunk-1',
          vectorIndexId: 41,
          content: 'first chunk',
          contentType: 'text',
          embedding: [0.1, 0.2],
        }),
        expect.objectContaining({
          chunkId: 'chunk-2',
          vectorIndexId: 42,
          content: 'second chunk',
          contentType: 'text',
          embedding: [0.3, 0.4],
        }),
      ],
    });
  });
});
