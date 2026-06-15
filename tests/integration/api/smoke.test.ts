import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_AUTH_COOKIE,
  buildAdminCookieOptions,
  extractJwtFromRequest,
} from '../../../apps/api/src/auth/auth.config';
import {
  KNOWLEDGE_INDEX_JOB,
  KNOWLEDGE_INDEX_QUEUE,
} from '../../../apps/api/src/knowledge/pipeline/knowledge-index-queue.service';

describe('API production contracts', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

  it('uses the admin httpOnly cookie as the browser auth contract', () => {
    const cookieOptions = buildAdminCookieOptions('production');

    expect(ADMIN_AUTH_COOKIE).toBe('admin_token');
    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.secure).toBe(true);
    expect(cookieOptions.sameSite).toBe('lax');
    expect(extractJwtFromRequest({ headers: { cookie: 'admin_token=cookie-jwt' } })).toBe(
      'cookie-jwt',
    );
  });

  it('keeps knowledge indexing behind a durable queue contract', () => {
    expect(KNOWLEDGE_INDEX_QUEUE).toBe('knowledge-index');
    expect(KNOWLEDGE_INDEX_JOB).toBe('index-source');
  });

  it('points live RAG eval at authenticated admin knowledge routes', () => {
    const evalScript = source('tests/evals/run-rag-eval.ts');

    expect(evalScript).toContain('/admin/knowledge');
    expect(evalScript).not.toMatch(/API_BASE_URL\}\/knowledge/);
  });
});
