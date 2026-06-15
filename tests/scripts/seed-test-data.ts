import { PrismaClient } from '../../packages/database/node_modules/@prisma/client';
import * as bcrypt from '../../packages/database/node_modules/bcryptjs';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ensureDefaultTestEnv } from './test-env';

ensureDefaultTestEnv();

const prisma = new PrismaClient();
const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

function loadFixture<T>(filename: string): T {
  const raw = readFileSync(join(FIXTURES_DIR, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function stableUuid(input: string): string {
  const hex = createHash('sha1').update(input).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];

  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

function optionalStableUuid(input?: string | null): string | undefined {
  return input ? stableUuid(input) : undefined;
}

async function main() {
  console.log('=== Seeding test data from fixtures ===\n');

  // ── 1. Tenants ──
  const tenants = loadFixture<any[]>('tenants.demo.json');
  for (const t of tenants) {
    if (t.status === 'suspended') continue;
    const tenantId = stableUuid(t.id);
    await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: { name: t.name, type: t.type, status: t.status, plan: t.plan, config: t.config },
      create: { id: tenantId, name: t.name, slug: t.slug, type: t.type, status: t.status, plan: t.plan, config: t.config },
    });
    console.log(`  Tenant: ${t.name} (${t.slug})`);
  }

  // ── 2. Admins ──
  const admins = loadFixture<any[]>('admin-users.demo.json');
  for (const a of admins) {
    const tenant = tenants.find((t) => t.id === a.tenantId);
    if (!tenant || tenant.status === 'suspended') continue;
    const hashed = await bcrypt.hash(a.password, 10);
    await prisma.admin.upsert({
      where: { email: a.email },
      update: { name: a.name, role: a.role, password: hashed },
      create: {
        id: stableUuid(a.id),
        tenantId: stableUuid(a.tenantId),
        email: a.email,
        password: hashed,
        name: a.name,
        role: a.role,
      },
    });
    console.log(`  Admin: ${a.name} <${a.email}>`);
  }

  // ── 3. Users ──
  const users = loadFixture<any[]>('users.demo.json');
  for (const u of users) {
    const tenant = tenants.find((t) => t.id === u.tenantId);
    if (!tenant || tenant.status === 'suspended') continue;
    await prisma.user.upsert({
      where: { id: stableUuid(u.id) },
      update: { nickname: u.nickname, phone: u.phone, source: u.source },
      create: {
        id: stableUuid(u.id), tenantId: stableUuid(u.tenantId), nickname: u.nickname, phone: u.phone,
        source: u.source, avatarUrl: u.avatarUrl, wechatOpenid: u.wechatOpenid,
        douyinOpenid: u.douyinOpenid, xhsOpenid: u.xhsOpenid,
      },
    });
  }
  console.log(`  Users: ${users.length} seeded`);

  // ── 4. Conversations + Messages ──
  const conversations = loadFixture<any[]>('conversations.demo.json');
  for (const conv of conversations) {
    const tenant = tenants.find((t) => t.id === conv.tenantId);
    if (!tenant || tenant.status === 'suspended') continue;
    const conversationId = stableUuid(conv.id);
    const tokenHash = sha256(`test-${conv.id}`);
    await prisma.conversation.upsert({
      where: { id: conversationId },
      update: { status: conv.status, intent: conv.intent, intentScore: conv.intentScore, summary: conv.summary },
      create: {
        id: conversationId, tenantId: stableUuid(conv.tenantId), userId: optionalStableUuid(conv.userId),
        channel: conv.channel, intent: conv.intent, intentScore: conv.intentScore,
        status: conv.status, summary: conv.summary, publicTokenHash: tokenHash,
      },
    });
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.message.createMany({
      data: conv.messages.map((m: any) => ({
        conversationId,
        role: m.role,
        content: m.content,
        channel: conv.channel,
      })),
    });
  }
  console.log(`  Conversations: ${conversations.length} seeded`);

  // ── 5. Leads ──
  const leads = loadFixture<any[]>('leads.demo.json');
  for (const l of leads) {
    const tenant = tenants.find((t) => t.id === l.tenantId);
    if (!tenant || tenant.status === 'suspended') continue;
    await prisma.lead.upsert({
      where: { id: stableUuid(l.id) },
      update: { followStatus: l.followStatus, intentScore: l.intentScore, tags: l.tags, remark: l.remark },
      create: {
        id: stableUuid(l.id), tenantId: stableUuid(l.tenantId), userId: optionalStableUuid(l.userId), conversationId: optionalStableUuid(l.conversationId),
        name: l.name, phone: l.phone, source: l.source, intentScore: l.intentScore,
        tags: l.tags, followStatus: l.followStatus, ownerId: optionalStableUuid(l.ownerId), remark: l.remark,
      },
    });
  }
  console.log(`  Leads: ${leads.length} seeded`);

  // ── 6. Knowledge Sources ──
  const ecommerceTenant = tenants.find((t) => t.slug === 'lingnan-fresh-produce')!;
  const schoolTenant = tenants.find((t) => t.slug === 'upskill-digital-lab')!;
  const ecommerceKb = readFileSync(join(FIXTURES_DIR, 'knowledge.ecommerce.md'), 'utf-8');
  const schoolKb = readFileSync(join(FIXTURES_DIR, 'knowledge.school.md'), 'utf-8');

  for (const ki of [
    { tenantId: stableUuid(ecommerceTenant.id), title: '水果门店商品、配送与售后 FAQ', type: 'faq', category: '客服', rawText: ecommerceKb },
    { tenantId: stableUuid(schoolTenant.id), title: '课程咨询、试听与退费 FAQ', type: 'faq', category: '客服', rawText: schoolKb },
  ]) {
    const existing = await prisma.knowledgeSource.findFirst({ where: { tenantId: ki.tenantId, title: ki.title } });
    if (existing) {
      await prisma.knowledgeSource.update({ where: { id: existing.id }, data: { rawText: ki.rawText, status: 'ready' } });
    } else {
      await prisma.knowledgeSource.create({ data: { ...ki, status: 'ready' } });
    }
  }
  console.log('  Knowledge sources: 2 seeded');

  // ── 7. Quick Replies ──
  const quickReplies = loadFixture<any[]>('quick-replies.demo.json');
  for (const qr of quickReplies) {
    const tenant = tenants.find((t) => t.id === qr.tenantId);
    if (!tenant || tenant.status === 'suspended') continue;
    await prisma.quickReply.upsert({
      where: { id: stableUuid(qr.id) },
      update: { title: qr.title, content: qr.content, category: qr.category },
      create: {
        id: stableUuid(qr.id),
        tenantId: stableUuid(qr.tenantId),
        title: qr.title,
        content: qr.content,
        category: qr.category,
        sortOrder: qr.sortOrder,
        usageCount: qr.usageCount,
      },
    });
  }
  console.log(`  Quick replies: ${quickReplies.length} seeded`);

  // ── 8. Unknown Questions ──
  const unknownQuestions = loadFixture<any[]>('unknown-questions.demo.json');
  for (const uq of unknownQuestions) {
    const tenant = tenants.find((t) => t.id === uq.tenantId);
    if (!tenant || tenant.status === 'suspended') continue;
    await prisma.unknownQuestion.upsert({
      where: { id: stableUuid(uq.id) },
      update: { count: uq.count, status: uq.status, suggestedAnswer: uq.suggestedAnswer, resolved: uq.resolved },
      create: {
        id: stableUuid(uq.id), tenantId: stableUuid(uq.tenantId), question: uq.question, normalizedQuestion: uq.normalizedQuestion,
        scene: uq.scene, intent: uq.intent, count: uq.count, status: uq.status,
        suggestedAnswer: uq.suggestedAnswer, resolved: uq.resolved, failReason: uq.failReason,
      },
    });
  }
  console.log(`  Unknown questions: ${unknownQuestions.length} seeded`);

  console.log('\n=== Test data seeded! ===');
}

main()
  .catch((e) => {
    console.error('Test seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
