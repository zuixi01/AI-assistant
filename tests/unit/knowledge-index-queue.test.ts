import { describe, expect, it, vi } from 'vitest';
import { KnowledgeIndexQueueService } from '../../apps/api/src/knowledge/pipeline/knowledge-index-queue.service';

describe('knowledge index queue', () => {
  it('enqueues source indexing jobs with a deterministic job id', async () => {
    const queue = {
      add: vi.fn().mockResolvedValue({ id: 'source-1:index' }),
    };
    const service = new KnowledgeIndexQueueService(queue as any);

    await service.enqueueSourceIndex('source-1');

    expect(queue.add).toHaveBeenCalledWith(
      'index-source',
      { sourceId: 'source-1' },
      expect.objectContaining({ jobId: 'source-1:index', attempts: 3 }),
    );
  });
});
