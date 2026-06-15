import { describe, expect, it, vi } from 'vitest';
import { CustomerServiceRAGService } from '../../apps/api/src/knowledge/services/customer-service-rag.service';

describe('customer service RAG accelerator sync', () => {
  it('syncs chunks to the vector accelerator after ingesting a document', async () => {
    const documentParserService = {
      parseDocument: vi.fn().mockResolvedValue({
        sections: [{ type: 'text', content: 'policy', sectionIndex: 0 }],
      }),
      buildChunks: vi.fn().mockReturnValue([
        {
          content: 'policy chunk',
          contentType: 'text',
          metadata: { sectionIndex: 0 },
        },
      ]),
    };
    const vectorStore = {
      embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2]]),
      deleteChunks: vi.fn().mockResolvedValue(undefined),
      insertChunk: vi.fn().mockResolvedValue({ chunkId: 'chunk-1', vectorIndexId: 77 }),
      syncChunksToAccelerator: vi.fn().mockResolvedValue(undefined),
    };
    const service = new CustomerServiceRAGService(
      documentParserService as any,
      vectorStore as any,
      {} as any,
      {} as any,
    );

    await service.ingestDocument('source-1', Buffer.from('doc'), 'doc.md', 'tenant-1');

    expect(vectorStore.syncChunksToAccelerator).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      chunks: [
        expect.objectContaining({
          chunkId: 'chunk-1',
          vectorIndexId: 77,
          content: 'policy chunk',
          contentType: 'text',
          embedding: [0.1, 0.2],
        }),
      ],
    });
  });
});
