import { afterEach, describe, expect, it, vi } from 'vitest';
import { VectorAcceleratorClient } from '../../apps/api/src/knowledge/services/vector-accelerator.client';
import { PythonSidecarClient } from '../../apps/api/src/knowledge/services/python-sidecar.client';

describe('sidecar shared token propagation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SIDECAR_SHARED_TOKEN;
    delete process.env.RAG_SIDECAR_SHARED_TOKEN;
    delete process.env.TURBOVEC_ENABLED;
    delete process.env.VECTOR_SEARCH_PROVIDER;
    delete process.env.RAG_SIDECAR_ENABLED;
  });

  it('sends X-Sidecar-Token for vector accelerator requests when configured', async () => {
    process.env.SIDECAR_SHARED_TOKEN = 'shared-token';
    process.env.RAG_SIDECAR_SHARED_TOKEN = 'shared-token';
    process.env.TURBOVEC_ENABLED = 'true';
    process.env.VECTOR_SEARCH_PROVIDER = 'turbovec';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new VectorAcceleratorClient();
    await client.search({
      tenantId: 'tenant-1',
      embedding: [0.1, 0.2],
      topK: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/vector/search'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Sidecar-Token': 'shared-token',
        }),
      }),
    );
  });

  it('sends X-Sidecar-Token for sidecar health checks when configured', async () => {
    process.env.RAG_SIDECAR_ENABLED = 'true';
    process.env.SIDECAR_SHARED_TOKEN = 'shared-token';
    process.env.RAG_SIDECAR_SHARED_TOKEN = 'shared-token';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        multimodalAvailable: false,
        graphAvailable: false,
        parserBackend: 'fallback',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new PythonSidecarClient();
    await client.health();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Sidecar-Token': 'shared-token',
        }),
      }),
    );
  });
});
