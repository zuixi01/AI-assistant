import { spawnSync } from 'node:child_process';
import { ensureDefaultTestEnv } from './test-env';

function runStep(label: string, command: string, args: string[]) {
  console.log(`\n=== ${label} ===`);

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: process.cwd(),
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
}

function main() {
  ensureDefaultTestEnv({ includeSidecar: true });

  let infraStarted = false;

  try {
    runStep('Start test infra', 'pnpm', ['test:infra:up']);
    infraStarted = true;
    runStep('Sync test schema', 'pnpm', ['test:db:push']);
    runStep('Reset test database', 'pnpm', ['reset:test']);
    runStep('Seed test database', 'pnpm', ['seed:test']);
    runStep('Build workspace', 'pnpm', ['build']);
    runStep('Run validation chain', 'pnpm', ['validate']);
    runStep('Run RAG eval', 'pnpm', ['test:rag']);
    runStep('Run sidecar live smoke', 'pnpm', ['test:sidecar:live']);
  } finally {
    if (infraStarted) {
      try {
        runStep('Stop test infra', 'pnpm', ['test:infra:down']);
      } catch (cleanupError) {
        console.error(
          cleanupError instanceof Error ? cleanupError.message : cleanupError,
        );
      }
    }
  }

  console.log('\nrelease validation passed');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
