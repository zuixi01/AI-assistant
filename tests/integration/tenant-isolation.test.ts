import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('admin tenant isolation contracts', () => {
  it.each([
    ['products', 'apps/api/src/products/products.service.ts', /product\.findFirst\(\{\s*where:\s*\{\s*id,\s*tenantId/s],
    ['leads', 'apps/api/src/leads/leads.service.ts', /lead\.findFirst\(\{\s*where:\s*\{\s*id,\s*tenantId/s],
    ['orders', 'apps/api/src/orders/orders.service.ts', /order\.findFirst\(\{\s*where:\s*\{\s*id,\s*tenantId/s],
    ['users', 'apps/api/src/users/users.service.ts', /user\.findFirst\(\{\s*where:\s*\{\s*id,\s*tenantId/s],
    [
      'conversations',
      'apps/api/src/conversations/conversations.service.ts',
      /const where = id \? \{ id, tenantId: tenantIdOrId \} : \{ id: tenantIdOrId \}/,
    ],
    [
      'unknown questions',
      'apps/api/src/unknown-questions/unknown-questions.service.ts',
      /unknownQuestion\.findFirst\(\{\s*where:\s*\{\s*id,\s*tenantId/s,
    ],
    [
      'messages',
      'apps/api/src/messages/messages.service.ts',
      /conversation\.findFirst\(\{\s*where:\s*\{\s*id:\s*conversationId,\s*tenantId/s,
    ],
  ])('%s detail lookup is tenant-scoped', (_name, file, pattern) => {
    expect(source(file)).toMatch(pattern);
  });
});

describe('public session access contracts', () => {
  it.each([
    ['conversation detail', 'apps/api/src/conversations/conversations.controller.ts', /findPublicByToken\(/],
    ['chat turn', 'apps/api/src/chat/chat.controller.ts', /findPublicSession\(/],
    ['message polling', 'apps/api/src/messages/messages.controller.ts', /findPublicSession\(/],
    ['lead capture', 'apps/api/src/leads/leads.controller.ts', /findPublicSession\(/],
  ])('%s requires public conversation token validation', (_name, file, pattern) => {
    expect(source(file)).toMatch(pattern);
  });
});

describe('production database hardening contracts', () => {
  const schema = () => source('packages/database/prisma/schema.prisma');

  it('stores only public conversation token hashes with a unique constraint', () => {
    expect(schema()).toMatch(/publicTokenHash\s+String\s+@unique\s+@map\("public_token_hash"\)/);
  });

  it('keeps hot public chat and admin queue indexes in the Prisma schema', () => {
    const text = schema();
    expect(text).toMatch(/@@index\(\[tenantId,\s*status,\s*updatedAt\]\)/);
    expect(text).toMatch(/@@index\(\[conversationId,\s*createdAt\]\)/);
    expect(text).toMatch(/@@index\(\[tenantId,\s*followStatus,\s*createdAt\]\)/);
  });

  it('encodes external product and order sync uniqueness', () => {
    const text = schema();
    expect(text).toMatch(/@@unique\(\[tenantId,\s*platform,\s*externalProductId\]\)/);
    expect(text).toMatch(/@@unique\(\[tenantId,\s*platform,\s*externalOrderId\]\)/);
  });

  it('uses product upsert for Doudian external product sync', () => {
    expect(source('apps/api/src/integrations/doudian/doudian.service.ts')).toMatch(/product\.upsert\(/);
  });
});
