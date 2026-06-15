import { existsSync, readFileSync } from 'node:fs';
import * as net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '..');

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function wait(ms: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function parseHostAndPort(urlString: string, defaultPort: number) {
  const parsed = new URL(urlString);
  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port ? Number(parsed.port) : defaultPort,
  };
}

function canConnect(host: string, port: number, timeoutMs: number) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host, port });

    const onError = (error: Error) => {
      socket.destroy();
      rejectPromise(error);
    };

    socket.setTimeout(timeoutMs, () => {
      onError(new Error(`timeout after ${timeoutMs}ms`));
    });

    socket.once('connect', () => {
      socket.end();
      resolvePromise();
    });

    socket.once('error', onError);
  });
}

async function waitForDependency(
  name: string,
  host: string,
  port: number,
  attempts: number,
  delayMs: number,
  timeoutMs: number,
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await canConnect(host, port, timeoutMs);
      console.log(`[deps:wait] ${name} is reachable at ${host}:${port}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[deps:wait] ${name} not ready (${attempt}/${attempts}) at ${host}:${port}: ${message}`,
      );
      if (attempt === attempts) {
        throw new Error(
          `[deps:wait] ${name} did not become reachable at ${host}:${port} after ${attempts} attempts`,
        );
      }
      await wait(delayMs);
    }
  }
}

async function main() {
  if (process.env.SKIP_RUNTIME_DEPS_WAIT === '1') {
    console.log('[deps:wait] Skip requested via SKIP_RUNTIME_DEPS_WAIT=1');
    return;
  }

  loadEnvFile(resolve(workspaceRoot, '.env'));
  loadEnvFile(resolve(workspaceRoot, 'apps', 'api', '.env'));

  const attempts = Number(process.env.RUNTIME_DEPS_MAX_ATTEMPTS || 20);
  const delayMs = Number(process.env.RUNTIME_DEPS_RETRY_DELAY_MS || 3000);
  const timeoutMs = Number(process.env.RUNTIME_DEPS_CONNECT_TIMEOUT_MS || 2000);

  const database = parseHostAndPort(
    process.env.DATABASE_URL || 'postgresql://localhost:5433/ai_sales',
    5432,
  );
  const redis = parseHostAndPort(
    process.env.REDIS_URL || 'redis://localhost:6380',
    6379,
  );

  console.log('[deps:wait] Waiting for core runtime dependencies...');
  await waitForDependency(
    'postgres',
    database.host,
    database.port,
    attempts,
    delayMs,
    timeoutMs,
  );
  await waitForDependency(
    'redis',
    redis.host,
    redis.port,
    attempts,
    delayMs,
    timeoutMs,
  );
  console.log('[deps:wait] Core runtime dependencies are ready.');
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : `[deps:wait] ${String(error)}`,
  );
  process.exit(1);
});
