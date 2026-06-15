import { spawnSync } from 'node:child_process';
import { ensureDefaultTestEnv } from './test-env';

function main() {
  const env = ensureDefaultTestEnv();
  const result = spawnSync(
    'pnpm',
    ['--filter', '@ai-assistant/database', 'exec', 'prisma', 'db', 'push', '--skip-generate'],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: env.databaseUrl,
        TEST_DATABASE_URL: env.databaseUrl,
      },
    },
  );

  if (result.status !== 0) {
    throw new Error(`Failed to push Prisma schema to test database (exit ${result.status ?? 1})`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
