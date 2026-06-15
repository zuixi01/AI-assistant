import { close, createMockServer, listen } from '../../harness/mock-server/server';

async function main() {
  const server = createMockServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/miniapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'message.created',
        openid: 'mock-openid-1',
        tenantSlug: 'test',
      }),
    });
    const body = (await response.json()) as { success?: boolean; provider?: string };

    if (!response.ok || body.success !== true || body.provider !== 'miniapp') {
      throw new Error(`Unexpected miniapp mock response: ${response.status}`);
    }

    console.log('miniapp mock webhook ok');
  } finally {
    await close(server);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
