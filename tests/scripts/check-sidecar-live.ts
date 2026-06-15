import { PythonSidecarClient } from '../../apps/api/src/knowledge/services/python-sidecar.client';
import { ensureDefaultTestEnv } from './test-env';

async function fetchHealth(url: string, sidecarToken: string) {
  try {
    const response = await fetch(`${url}/health`, {
      headers: sidecarToken ? { 'X-Sidecar-Token': sidecarToken } : {},
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`health endpoint returned ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as { status?: string; parser_backend?: string; parserBackend?: string };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Sidecar unavailable at ${url}: ${message}`);
  }
}

async function main() {
  const env = ensureDefaultTestEnv({ includeSidecar: true });
  process.env.RAG_SIDECAR_ENABLED = 'true';

  const sidecarUrl = process.env.RAG_SIDECAR_URL || env.sidecarUrl;
  const sidecarToken = process.env.RAG_SIDECAR_SHARED_TOKEN || process.env.SIDECAR_SHARED_TOKEN || env.sidecarToken || '';
  const health = await fetchHealth(sidecarUrl!, sidecarToken);

  if (health.status !== 'ok') {
    throw new Error(`Sidecar unhealthy at ${sidecarUrl}: status=${health.status || 'unknown'}`);
  }

  const client = new PythonSidecarClient();
  const parseResult = await client.parseDocument(
    Buffer.from('hello from sidecar live test', 'utf8'),
    'sidecar-smoke.txt',
    {
      extractTables: false,
      extractImages: false,
      extractFormulas: false,
    },
  );

  if (parseResult === null) {
    throw new Error(`Sidecar parse request failed at ${sidecarUrl}; service may be unavailable or timed out`);
  }

  if (!parseResult?.success) {
    throw new Error(`Sidecar business failure at ${sidecarUrl}: ${parseResult?.error || 'unknown error'}`);
  }

  if (!parseResult.fullText || parseResult.sections.length === 0) {
    throw new Error('Sidecar parse returned empty content');
  }

  console.log(
    `sidecar live ok: parser=${health.parserBackend || health.parser_backend || 'unknown'}, sections=${parseResult.sections.length}, url=${sidecarUrl}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
