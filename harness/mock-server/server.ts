import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

type JsonBody = Record<string, unknown> | null;

async function readJson(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  return JSON.parse(raw) as JsonBody;
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createMockServer(): Server {
  return createServer(async (req, res) => {
    try {
      const method = req.method || 'GET';
      const url = req.url || '/';

      if (method === 'GET' && url === '/health') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (method === 'POST' && url === '/api/doudian/webhook') {
        const payload = await readJson(req);
        sendJson(res, 200, { success: true, provider: 'doudian', received: payload });
        return;
      }

      if (method === 'POST' && url === '/api/miniapp/webhook') {
        const payload = await readJson(req);
        sendJson(res, 200, { success: true, provider: 'miniapp', received: payload });
        return;
      }

      if (method === 'POST' && url === '/api/webhooks/test') {
        const payload = await readJson(req);
        sendJson(res, 202, { accepted: true, received: payload });
        return;
      }

      sendJson(res, 404, { error: 'not_found' });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : 'internal_error' });
    }
  });
}

export async function listen(server: Server, port = 0): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Mock server did not bind to a TCP port');
  }
  return `http://127.0.0.1:${address.port}`;
}

export async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
