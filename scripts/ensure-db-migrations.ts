import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '..');
const databaseDir = resolve(workspaceRoot, 'packages', 'database');

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

if (process.env.SKIP_DB_ENSURE === '1') {
  console.log('[db:ensure] Skip requested via SKIP_DB_ENSURE=1');
  process.exit(0);
}

loadEnvFile(resolve(workspaceRoot, '.env'));
loadEnvFile(resolve(workspaceRoot, 'apps', 'api', '.env'));

const attempts = Number(process.env.DB_ENSURE_MAX_ATTEMPTS || 12);
const delayMs = Number(process.env.DB_ENSURE_RETRY_DELAY_MS || 5000);

function sleep(ms: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function main() {
  console.log('[db:ensure] Checking and applying pending Prisma migrations...');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(
      'pnpm',
      ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      {
        cwd: databaseDir,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: process.env,
      },
    );

    if (result.status === 0) {
      console.log('[db:ensure] Database schema is ready.');
      return;
    }

    if (attempt === attempts) {
      process.exit(result.status ?? 1);
    }

    console.warn(
      `[db:ensure] Attempt ${attempt}/${attempts} failed. Retrying in ${delayMs}ms...`,
    );
    await sleep(delayMs);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : `[db:ensure] ${String(error)}`,
  );
  process.exit(1);
});
