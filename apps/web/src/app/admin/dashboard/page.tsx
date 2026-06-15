'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrainCircuit, HelpCircle, MessageSquareText, Send, Sparkles, TrendingUp, UsersRound } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet } from '@/lib/api';
import { EmptyState, LoadingState, PageHeader, PageShell, Panel, ProgressMeter, StatCard, StatusPill } from '@/components/ui/design-system';

interface DashboardData {
  conversations: { total: number; today: number };
  messages: { total: number; today: number };
  leads: { total: number; today: number };
  unknownQuestions: { unresolved: number };
}

interface RecentConversation {
  id: string;
  channel: string;
  intent: string | null;
  status: string;
  createdAt: string;
  user: { nickname: string } | null;
  _count: { messages: number };
}

interface RecentLead {
  id: string;
  name: string | null;
  phone: string | null;
  source: string | null;
  intentScore: number;
  followStatus: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentConvs, setRecentConvs] = useState<RecentConversation[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<DashboardData>('/api/admin/analytics/dashboard'),
      apiGet<{ items: RecentConversation[] }>('/api/admin/conversations?page=1&pageSize=5'),
      apiGet<{ items: RecentLead[] }>('/api/admin/leads?page=1&pageSize=5'),
    ])
      .then(([dashData, convData, leadData]) => {
        setData(dashData);
        setRecentConvs(convData.items || []);
        setRecentLeads(leadData.items || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const conversationStatusLabels: Record<string, { label: string; tone: 'emerald' | 'amber' | 'blue' | 'slate' }> = {
    open: { label: t.conversations.statusOpen, tone: 'emerald' },
    pending_human: { label: t.conversations.statusPendingHuman, tone: 'amber' },
    needs_review: { label: t.conversations.statusNeedsReview, tone: 'blue' },
    closed: { label: t.conversations.statusClosed, tone: 'slate' },
  };

  const statusLabels: Record<string, string> = {
    new: t.leads.statusNew,
    contacted: t.leads.statusContacted,
    qualified: t.leads.statusQualified,
    converted: t.leads.statusConverted,
    lost: t.leads.statusLost,
  };

  if (loading) return <LoadingState label={t.common.loading} />;
  if (!data) return <EmptyState title={t.common.noData} />;

  const stats = [
    { label: t.dashboard.todayConversations, value: data.conversations?.today ?? 0, total: `${t.common.total}: ${data.conversations?.total ?? 0}`, tone: 'blue' as const, icon: <MessageSquareText className="h-5 w-5" /> },
    { label: t.dashboard.todayMessages, value: data.messages?.today ?? 0, total: `${t.common.total}: ${data.messages?.total ?? 0}`, tone: 'emerald' as const, icon: <Send className="h-5 w-5" /> },
    { label: t.dashboard.todayLeads, value: data.leads?.today ?? 0, total: `${t.common.total}: ${data.leads?.total ?? 0}`, tone: 'amber' as const, icon: <UsersRound className="h-5 w-5" /> },
    { label: t.dashboard.unresolvedQuestions, value: data.unknownQuestions?.unresolved ?? 0, tone: 'rose' as const, icon: <HelpCircle className="h-5 w-5" /> },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations dashboard"
        title={t.dashboard.title}
        description="集中查看 AI 接待效率、线索沉淀与待复核问题，帮助团队快速判断今天需要优先处理什么。"
        actions={
          <Link href="/admin/knowledge/test-retrieval" className="premium-button-secondary px-4 py-2 text-sm">
            <BrainCircuit className="h-4 w-4" />
            检索测试
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <Panel className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-300">今日客服运行状态</p>
              <h2 className="mt-2 text-3xl font-black">AI 正在承接基础咨询</h2>
            </div>
            <Sparkles className="h-8 w-8 text-cyan-200" />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            高意向、投诉、售后和未知问题会自动进入人工或复核流程；普通 FAQ 优先由知识库回答。
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['自动接待', '7×24'],
              ['知识命中', `${Math.max(0, (data.messages?.today ?? 0) - (data.unknownQuestions?.unresolved ?? 0))}`],
              ['待跟进', `${data.leads?.today ?? 0}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/70 p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950">转化漏斗提醒</p>
              <p className="text-xs text-slate-500">优先处理高意向与待人工会话</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm font-semibold text-slate-600">
                <span>线索沉淀</span>
                <span>{data.leads?.today ?? 0}</span>
              </div>
              <ProgressMeter value={Math.min(100, (data.leads?.today ?? 0) * 12)} tone="emerald" />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm font-semibold text-slate-600">
                <span>待复核问题</span>
                <span>{data.unknownQuestions?.unresolved ?? 0}</span>
              </div>
              <ProgressMeter value={Math.min(100, (data.unknownQuestions?.unresolved ?? 0) * 15)} tone="amber" />
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-950">{t.dashboard.recentConversations}</h3>
              <p className="text-sm text-slate-500">最近进入系统的客户咨询</p>
            </div>
            <Link href="/admin/conversations" className="text-sm font-semibold text-blue-700 hover:underline">
              {t.common.viewAll}
            </Link>
          </div>
          {recentConvs.length === 0 ? (
            <EmptyState title={t.common.noData} />
          ) : (
            <div className="space-y-3">
              {recentConvs.map((conv) => {
                const status = conversationStatusLabels[conv.status];
                return (
                  <Link
                    key={conv.id}
                    href={`/admin/conversations/${conv.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{conv.user?.nickname || t.conversations.anonymousUser}</p>
                      <p className="text-xs text-slate-500">{conv.channel} · {conv._count.messages} {t.conversations.messageCount}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {conv.intent ? <StatusPill tone="blue">{conv.intent}</StatusPill> : null}
                      <StatusPill tone={status?.tone || 'slate'} pulse={conv.status !== 'closed'}>
                        {status?.label || conv.status}
                      </StatusPill>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-950">{t.dashboard.latestLeads}</h3>
              <p className="text-sm text-slate-500">可继续跟进的客户线索</p>
            </div>
            <Link href="/admin/leads" className="text-sm font-semibold text-blue-700 hover:underline">
              {t.common.viewAll}
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <EmptyState title={t.common.noData} />
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{lead.name || '-'}</p>
                    <p className="text-xs text-slate-500">{lead.phone || '未留电话'} · {lead.source || '-'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ProgressMeter value={lead.intentScore} tone={lead.intentScore >= 70 ? 'emerald' : 'blue'} />
                    <StatusPill tone={lead.followStatus === 'converted' ? 'emerald' : lead.followStatus === 'lost' ? 'rose' : 'amber'}>
                      {statusLabels[lead.followStatus] || lead.followStatus}
                    </StatusPill>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
