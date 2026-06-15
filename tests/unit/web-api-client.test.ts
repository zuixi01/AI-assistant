import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../../apps/web/src/lib/api';

describe('web admin api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends admin requests with cookies and without localStorage bearer headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ id: 'admin-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiGet('/api/auth/me');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
  });

  it('serializes JSON bodies while preserving cookie credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiPost('/api/auth/logout', { reason: 'manual' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ reason: 'manual' }),
      }),
    );
  });
});
