import { close, createMockServer, listen } from '../../harness/mock-server/server';

async function main() {
  const server = createMockServer();
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/webhooks/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'smoke.test',
        sentAt: new Date(0).toISOString(),
      }),
    });
    const body = (await response.json()) as { accepted?: boolean };

    if (response.status !== 202 || body.accepted !== true) {
      throw new Error(`Unexpected webhook mock response: ${response.status}`);
    }

    console.log('mock webhook accepted');
  } finally {
    await close(server);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
