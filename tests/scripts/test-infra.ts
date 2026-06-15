import { spawnSync } from 'node:child_process';
import net from 'node:net';
import {
  DEFAULT_TEST_DATABASE_URL,
  DEFAULT_TEST_REDIS_URL,
  DEFAULT_TEST_SIDECAR_TOKEN,
  DEFAULT_TEST_SIDECAR_URL,
  ensureDefaultTestEnv,
} from './test-env';

const action = (process.argv[2] || 'up').toLowerCase();
const composeFile = 'docker-compose.test.yml';

function runCompose(args: string[]) {
  const result = spawnSync('docker', ['compose', '-f', composeFile, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: process.cwd(),
    env: {
      ...process.env,
      COMPOSE_PROJECT_NAME: process.env.COMPOSE_PROJECT_NAME || 'ai-assistant-test',
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL || DEFAULT_TEST_REDIS_URL,
      SIDECAR_SHARED_TOKEN: process.env.SIDECAR_SHARED_TOKEN || DEFAULT_TEST_SIDECAR_TOKEN,
      RAG_SIDECAR_SHARED_TOKEN:
        process.env.RAG_SIDECAR_SHARED_TOKEN || process.env.SIDECAR_SHARED_TOKEN || DEFAULT_TEST_SIDECAR_TOKEN,
      RAG_SIDECAR_URL: process.env.RAG_SIDECAR_URL || DEFAULT_TEST_SIDECAR_URL,
    },
  });

  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function waitForTcpPort(port: number, host = '127.0.0.1', timeoutMs = 60_000) {
  const startedAt = Date.now();
  return new Promise<void>((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ port, host });
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1000);
      });
    };
    attempt();
  });
}

async function waitForSidecarHealth(url: string, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/health`, {
        headers: { 'X-Sidecar-Token': process.env.SIDECAR_SHARED_TOKEN || DEFAULT_TEST_SIDECAR_TOKEN },
      });
      if (response.ok) return;
    } catch {
      // keep retrying
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for sidecar health at ${url}/health`);
}

async function waitForInfra() {
  await Promise.all([
    waitForTcpPort(5434),
    waitForTcpPort(6381),
    waitForSidecarHealth(process.env.RAG_SIDECAR_URL || DEFAULT_TEST_SIDECAR_URL),
  ]);
}

async function main() {
  ensureDefaultTestEnv({ includeSidecar: true });

  switch (action) {
    case 'up':
      runCompose(['up', '-d', '--build']);
      await waitForInfra();
      console.log('test infra ready');
      break;
    case 'down':
      runCompose(['down', '-v', '--remove-orphans']);
      console.log('test infra stopped');
      break;
    case 'restart':
      runCompose(['down', '-v', '--remove-orphans']);
      runCompose(['up', '-d', '--build']);
      await waitForInfra();
      console.log('test infra restarted');
      break;
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
