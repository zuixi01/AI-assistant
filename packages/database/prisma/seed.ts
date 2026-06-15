import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const FIXTURES_DIR = join(__dirname, '..', '..', '..', 'tests', 'fixtures');

function loadFixture<T>(filename: string): T {
  const raw = readFileSync(join(FIXTURES_DIR, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

interface TenantFixture {
  id: string; name: string; slug: string; type: string; status: string; plan: string; config: any;
}
interface AdminFixture {
  id: string; tenantId: string; email: string; password: string; name: string; role: string;
}
interface UserFixture {
  id: string; tenantId: string; nickname: string; phone: string | null; source: string;
  avatarUrl: string | null; wechatOpenid: string | null; douyinOpenid: string | null; xhsOpenid: string | null;
}
interface ConversationFixture {
  id: string; tenantId: string; userId: string; channel: string; intent: string;
  intentScore: number; status: string; summary: string;
  messages: { role: string; content: string; createdAt: string }[];
}
interface LeadFixture {
  id: string; tenantId: string; userId: string | null; conversationId: string | null;
  name: string; phone: string | null; source: string; intentScore: number;
  tags: string[]; followStatus: string; ownerId: string | null; remark: string;
}
interface QuickReplyFixture {
  id: string; tenantId: string; title: string; content: string;
  category: string; sortOrder: number; usageCount: number;
}
interface UnknownQuestionFixture {
  id: string; tenantId: string; question: string; normalizedQuestion: string;
  scene: string; intent: string; count: number; status: string;
  suggestedAnswer: string | null; resolved: boolean; failReason: string;
}

async function main() {
  console.log('=== Seeding database with comprehensive demo data ===\n');

  // ── 1. Tenants ──
  const tenants = loadFixture<TenantFixture[]>('tenants.demo.json');
  for (const t of tenants) {
    await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: { name: t.name, type: t.type, status: t.status, plan: t.plan, config: t.config },
      create: { id: t.id, name: t.name, slug: t.slug, type: t.type, status: t.status, plan: t.plan, config: t.config },
    });
    console.log(`  Tenant: ${t.name} (${t.slug}) [${t.status}]`);
  }

  // ── 2. Admins ──
  const admins = loadFixture<AdminFixture[]>('admin-users.demo.json');
  for (const a of admins) {
    const hashed = await bcrypt.hash(a.password, 10);
    await prisma.admin.upsert({
      where: { email: a.email },
      update: { name: a.name, role: a.role, password: hashed },
      create: { id: a.id, tenantId: a.tenantId, email: a.email, password: hashed, name: a.name, role: a.role },
    });
    console.log(`  Admin: ${a.name} <${a.email}> (${a.role})`);
  }

  // ── 3. Users ──
  const users = loadFixture<UserFixture[]>('users.demo.json');
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { nickname: u.nickname, phone: u.phone, source: u.source },
      create: {
        id: u.id, tenantId: u.tenantId, nickname: u.nickname, phone: u.phone,
        source: u.source, avatarUrl: u.avatarUrl, wechatOpenid: u.wechatOpenid,
        douyinOpenid: u.douyinOpenid, xhsOpenid: u.xhsOpenid,
      },
    });
    console.log(`  User: ${u.nickname} (${u.source})`);
  }

  // ── 4. Conversations + Messages ──
  const conversations = loadFixture<ConversationFixture[]>('conversations.demo.json');
  for (const conv of conversations) {
    const tokenHash = sha256(`public-${conv.id}`);
    await prisma.conversation.upsert({
      where: { id: conv.id },
      update: { status: conv.status, intent: conv.intent, intentScore: conv.intentScore, summary: conv.summary },
      create: {
        id: conv.id, tenantId: conv.tenantId, userId: conv.userId,
        channel: conv.channel, intent: conv.intent, intentScore: conv.intentScore,
        status: conv.status, summary: conv.summary, publicTokenHash: tokenHash,
      },
    });

    // Delete existing messages and recreate
    await prisma.message.deleteMany({ where: { conversationId: conv.id } });
    await prisma.message.createMany({
      data: conv.messages.map((m) => ({
        conversationId: conv.id,
        role: m.role,
        content: m.content,
        channel: conv.channel,
      })),
    });
    console.log(`  Conversation: ${conv.id} (${conv.channel}/${conv.intent}) — ${conv.messages.length} messages`);
  }

  // ── 5. Leads ──
  const leads = loadFixture<LeadFixture[]>('leads.demo.json');
  for (const l of leads) {
    await prisma.lead.upsert({
      where: { id: l.id },
      update: { followStatus: l.followStatus, intentScore: l.intentScore, tags: l.tags, remark: l.remark },
      create: {
        id: l.id, tenantId: l.tenantId, userId: l.userId, conversationId: l.conversationId,
        name: l.name, phone: l.phone, source: l.source, intentScore: l.intentScore,
        tags: l.tags, followStatus: l.followStatus, ownerId: l.ownerId, remark: l.remark,
      },
    });
    console.log(`  Lead: ${l.name} (${l.followStatus}, score=${l.intentScore})`);
  }

  // ── 6. Knowledge Sources ──
  const ecommerceKb = readFileSync(join(FIXTURES_DIR, 'knowledge.ecommerce.md'), 'utf-8');
  const schoolKb = readFileSync(join(FIXTURES_DIR, 'knowledge.school.md'), 'utf-8');

  const knowledgeItems = [
    { tenantSlug: 'lingnan-fresh-produce', title: '水果门店商品、配送与售后 FAQ', type: 'faq', category: '客服', rawText: ecommerceKb },
    { tenantSlug: 'upskill-digital-lab', title: '课程咨询、试听与退费 FAQ', type: 'faq', category: '客服', rawText: schoolKb },
  ];

  for (const ki of knowledgeItems) {
    const tenant = tenants.find((t) => t.slug === ki.tenantSlug)!;
    const existing = await prisma.knowledgeSource.findFirst({
      where: { tenantId: tenant.id, title: ki.title },
    });
    if (existing) {
      await prisma.knowledgeSource.update({
        where: { id: existing.id },
        data: { rawText: ki.rawText, status: 'ready' },
      });
    } else {
      await prisma.knowledgeSource.create({
        data: { tenantId: tenant.id, title: ki.title, type: ki.type, category: ki.category, rawText: ki.rawText, status: 'ready' },
      });
    }
    console.log(`  Knowledge: ${ki.title} (${ki.tenantSlug})`);
  }

  // ── 7. Quick Replies ──
  const quickReplies = loadFixture<QuickReplyFixture[]>('quick-replies.demo.json');
  for (const qr of quickReplies) {
    await prisma.quickReply.upsert({
      where: { id: qr.id },
      update: { title: qr.title, content: qr.content, category: qr.category, sortOrder: qr.sortOrder, usageCount: qr.usageCount },
      create: { id: qr.id, tenantId: qr.tenantId, title: qr.title, content: qr.content, category: qr.category, sortOrder: qr.sortOrder, usageCount: qr.usageCount },
    });
  }
  console.log(`  Quick Replies: ${quickReplies.length} created`);

  // ── 8. Unknown Questions ──
  const unknownQuestions = loadFixture<UnknownQuestionFixture[]>('unknown-questions.demo.json');
  for (const uq of unknownQuestions) {
    await prisma.unknownQuestion.upsert({
      where: { id: uq.id },
      update: { count: uq.count, status: uq.status, suggestedAnswer: uq.suggestedAnswer, resolved: uq.resolved },
      create: {
        id: uq.id, tenantId: uq.tenantId, question: uq.question, normalizedQuestion: uq.normalizedQuestion,
        scene: uq.scene, intent: uq.intent, count: uq.count, status: uq.status,
        suggestedAnswer: uq.suggestedAnswer, resolved: uq.resolved, failReason: uq.failReason,
      },
    });
  }
  console.log(`  Unknown Questions: ${unknownQuestions.length} created`);

  // ── 9. Lead Tags ──
  const tagNames = new Set<string>();
  for (const l of leads) {
    for (const tag of l.tags) tagNames.add(tag);
  }
  const ecommerceTenant = tenants.find((t) => t.slug === 'lingnan-fresh-produce')!;
  const schoolTenant = tenants.find((t) => t.slug === 'upskill-digital-lab')!;
  const tagColors: Record<string, string> = {
    '妃子笑荔枝': '#f97316', '时效敏感': '#f59e0b', '待支付': '#22c55e',
    '麒麟瓜': '#16a34a', '蓝莓': '#3b82f6', '高转化': '#15803d',
    '蓝莓售后': '#ef4444', '部分退款': '#f87171', '企业团购': '#8b5cf6',
    '水果拼盘': '#6366f1', '月结咨询': '#7c3aed', '耙耙柑': '#f59e0b',
    '礼盒': '#fb7185', '异地送礼': '#94a3b8',
    'Python 自动化': '#0ea5e9', '零基础': '#06b6d4', '晚班': '#0284c7',
    'Scratch 启蒙': '#a855f7', '试听待约': '#d946ef', '家长咨询': '#ec4899',
    '数据分析': '#14b8a6', '转岗咨询': '#0f766e', '就业辅导': '#64748b',
  };
  for (const tag of tagNames) {
    const isSchool = ['Python 自动化', '零基础', '晚班', 'Scratch 启蒙', '试听待约', '家长咨询', '数据分析', '转岗咨询', '就业辅导'].includes(tag);
    const tenantId = isSchool ? schoolTenant.id : ecommerceTenant.id;
    await prisma.leadTag.upsert({
      where: { tenantId_name: { tenantId, name: tag } },
      update: {},
      create: { tenantId, name: tag, color: tagColors[tag] || '#6b7280' },
    });
  }
  console.log(`  Lead Tags: ${tagNames.size} created`);

  console.log('\n=== Seed completed! ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
