import { PrismaClient } from '../../packages/database/node_modules/@prisma/client';
import { ensureDefaultTestEnv } from './test-env';

ensureDefaultTestEnv();

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for reset:test');
}

if (!/(localhost|127\.0\.0\.1|ai_sales_test|test)/i.test(testDatabaseUrl)) {
  throw new Error('Refusing to reset a database URL that does not look like a test database');
}

process.env.DATABASE_URL = testDatabaseUrl;

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    console.log('test database already empty');
    return;
  }

  const tableList = tables
    .map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`)
    .join(', ');

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  console.log(`reset test database tables: ${tables.length}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
