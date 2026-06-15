export const DEFAULT_TEST_DATABASE_URL =
  'postgresql://ai:ai_password@127.0.0.1:5434/ai_sales_test';
export const DEFAULT_TEST_REDIS_URL = 'redis://127.0.0.1:6381';
export const DEFAULT_TEST_SIDECAR_URL = 'http://127.0.0.1:8002';
export const DEFAULT_TEST_SIDECAR_TOKEN = 'test-sidecar-token';

export function ensureDefaultTestEnv(options?: { includeSidecar?: boolean }) {
  if (!process.env.TEST_DATABASE_URL) {
    process.env.TEST_DATABASE_URL = DEFAULT_TEST_DATABASE_URL;
  }

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }

  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = DEFAULT_TEST_REDIS_URL;
  }

  if (options?.includeSidecar) {
    if (!process.env.RAG_SIDECAR_URL) {
      process.env.RAG_SIDECAR_URL = DEFAULT_TEST_SIDECAR_URL;
    }
    if (!process.env.SIDECAR_SHARED_TOKEN) {
      process.env.SIDECAR_SHARED_TOKEN = DEFAULT_TEST_SIDECAR_TOKEN;
    }
    if (!process.env.RAG_SIDECAR_SHARED_TOKEN) {
      process.env.RAG_SIDECAR_SHARED_TOKEN = process.env.SIDECAR_SHARED_TOKEN;
    }
  }

  return {
    databaseUrl: process.env.TEST_DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    sidecarUrl: process.env.RAG_SIDECAR_URL,
    sidecarToken: process.env.SIDECAR_SHARED_TOKEN,
  };
}
