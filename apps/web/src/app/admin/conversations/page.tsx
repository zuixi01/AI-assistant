'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Headphones,
  Inbox,
  MessageCircle,
  MessageSquareText,
  Search,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet } from '@/lib/api';
import { EmptyState, LoadingState, ProgressMeter, StatusPill } from '@/components/ui/design-system';
import { cn } from '@/lib/cn';

interface Conversation {
  id: string;
  channel: string;
  intent: string | null;
  intentScore: number;
  status: string;
  createdAt: string;
  user: { nickname: string; phone: string } | null;
  lead: { name: string; phone: string } | null;
  _count: { messages: number };
}

interface WorkspaceStats {
  openCount: number;
  pendingCount: number;
  todayConversations: number;
}

type StatusTone = 'emerald' | 'amber' | 'blue' | 'slate';

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

export default function ConversationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<WorkspaceStats | null>(null);

  const fetchConversations = (status?: string) => {
    const url = `/api/admin/conversations?page=1&pageSize=50${status ? `&status=${status}` : ''}`;
    apiGet<{ items: Conversation[] }>(url)
      .then((data) => setConversations(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConversations(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    apiGet<WorkspaceStats>('/api/admin/workspace/stats')
      .then(setStats)
      .catch(console.error);
  }, []);

  const intentLabels: Record<string, string> = {
    product_inquiry: t.conversations.intentProductInquiry,
    price_inquiry: t.conversations.intentPriceInquiry,
    logistics_inquiry: t.conversations.intentLogisticsInquiry,
    after_sale: t.conversations.intentAfterSale,
    purchase_intent: t.conversations.intentPurchaseIntent,
    transfer_human: t.conversations.intentTransferHuman,
    general_inquiry: t.conversations.intentGeneralInquiry,
  };

  const channelLabels = useMemo<Record<string, string>>(
    () => ({
      h5: t.conversations.channelH5,
      embed: t.conversations.channelEmbed,
      douyin_miniapp: t.conversations.channelDouyinMiniapp,
      wechat_miniapp: t.conversations.channelWechatMiniapp,
      miniapp: t.conversations.channelMiniapp,
      web: t.conversations.channelWeb,
      api: t.conversations.channelApi,
      xiaohongshu: t.nav.xiaohongshu,
      juguang: t.nav.juguang,
    }),
    [
      t.conversations.channelApi,
      t.conversations.channelDouyinMiniapp,
      t.conversations.channelEmbed,
      t.conversations.channelH5,
      t.conversations.channelMiniapp,
      t.conversations.channelWeb,
      t.conversations.channelWechatMiniapp,
      t.nav.juguang,
      t.nav.xiaohongshu,
    ],
  );

  const statusLabels: Record<string, { label: string; tone: StatusTone }> = {
    open: { label: t.conversations.statusOpen, tone: 'emerald' },
    pending_human: { label: t.conversations.statusPendingHuman, tone: 'amber' },
    needs_review: { label: t.conversations.statusNeedsReview, tone: 'blue' },
    closed: { label: t.conversations.statusClosed, tone: 'slate' },
  };

  const statusBuckets = [
    { value: '', label: t.common.all, icon: Inbox },
    { value: 'open', label: t.conversations.statusOpen, icon: MessageCircle },
    { value: 'pending_human', label: t.conversations.statusPendingHuman, icon: Headphones },
    { value: 'needs_review', label: t.conversations.statusNeedsReview, icon: Sparkles },
    { value: 'closed', label: t.conversations.statusClosed, icon: Clock3 },
  ];

  const filteredConversations = useMemo(() => {
    let result = conversations;
    if (channelFilter) {
      result = result.filter((c) => c.channel === channelFilter);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((conv) => {
        const name = conv.user?.nickname || conv.lead?.name || t.conversations.anonymousUser;
        const phone = conv.user?.phone || conv.lead?.phone || '';
        const channel = channelLabels[conv.channel] || conv.channel;
        return `${name} ${phone} ${channel} ${conv.intent || ''}`.toLowerCase().includes(query);
      });
    }
    return result;
  }, [channelLabels, channelFilter, conversations, searchQuery, t.conversations.anonymousUser]);

  const counts = useMemo(() => {
    return conversations.reduce<Record<string, number>>(
      (acc, conv) => {
        acc.all += 1;
        acc[conv.status] = (acc[conv.status] || 0) + 1;
        return acc;
      },
      { all: 0 },
    );
  }, [conversations]);

  const channelBuckets = useMemo(() => {
    const channelCounts = conversations.reduce<Record<string, number>>((acc, conv) => {
      acc[conv.channel] = (acc[conv.channel] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(channelCounts).map(([value, count]) => ({
      value,
      label: channelLabels[value] || value,
      count,
    }));
  }, [channelLabels, conversations]);

  const handleExport = async (format: string) => {
    try {
      const data = await apiGet<any>(`/api/admin/workspace/export?format=${format}`);
      const blob = new Blob([format === 'csv' ? data : JSON.stringify(data, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversations.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(t.workspace.exportFailed);
    }
  };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <div className="workbench-shell conversation-list-workbench grid min-h-[calc(100vh-2.5rem)] gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="workbench-panel flex min-h-0 flex-col">
        <div className="border-b workbench-section-divider px-4 py-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Dialogue</p>
          <h1 className="mt-1 text-xl font-black text-slate-950">{t.conversations.title}</h1>
        </div>

        <div className="soft-scrollbar flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {statusBuckets.map((bucket) => {
              const active = statusFilter === bucket.value;
              const Icon = bucket.icon;
              const count = bucket.value ? counts[bucket.value] || 0 : counts.all || 0;
              return (
                <button
                  key={bucket.value || 'all'}
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setStatusFilter(bucket.value);
                  }}
                  className={cn('workbench-filter-item', active && 'workbench-filter-item-active')}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{bucket.label}</span>
                  </span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t workbench-section-divider pt-4">
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-slate-500">
              <span>接入渠道</span>
              <Filter className="h-3.5 w-3.5" />
            </div>
            <button
              type="button"
              onClick={() => setChannelFilter('')}
              className={cn('workbench-filter-item text-xs', channelFilter === '' && 'workbench-filter-item-active')}
            >
              <span>全部渠道</span>
              <span>{counts.all || 0}</span>
            </button>
            {channelBuckets.map((bucket) => (
              <button
                key={bucket.value}
                type="button"
                onClick={() => setChannelFilter(bucket.value)}
                className={cn('workbench-filter-item text-xs', channelFilter === bucket.value && 'workbench-filter-item-active')}
              >
                <span className="truncate">{bucket.label}</span>
                <span>{bucket.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t workbench-section-divider p-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '进行中', value: stats?.openCount ?? counts.open ?? 0 },
              { label: '待人工', value: stats?.pendingCount ?? counts.pending_human ?? 0 },
              { label: '今日', value: stats?.todayConversations ?? 0 },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 px-2 py-2 text-center ring-1 ring-slate-100">
                <p className="text-base font-black text-slate-950">{item.value}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="workbench-panel flex min-h-0 flex-col">
        <header className="flex flex-col gap-3 border-b workbench-section-divider px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">All conversations</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              {statusFilter ? statusLabels[statusFilter]?.label : t.common.all}
            </h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t.common.search}
                className="premium-input h-10 w-full min-w-[240px] px-3 pl-9 text-sm"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="workbench-icon-button"
                title="导出 CSV"
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('json')}
                className="workbench-icon-button"
                title="导出 JSON"
              >
                <MessageSquareText className="h-4 w-4" />
                <span className="sr-only">JSON</span>
              </button>
            </div>
          </div>
        </header>

        <div className="soft-scrollbar flex-1 overflow-y-auto p-2">
          {filteredConversations.length === 0 ? (
            <div className="p-5">
              <EmptyState title={t.common.noData} />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredConversations.map((conv, index) => {
                const status = statusLabels[conv.status];
                const name = conv.user?.nickname || conv.lead?.name || t.conversations.anonymousUser;
                const phone = conv.user?.phone || conv.lead?.phone;
                const initials = name.slice(0, 2).toUpperCase();
                const channel = channelLabels[conv.channel] || conv.channel;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => router.push(`/admin/conversations/${conv.id}`)}
                    className={cn('conversation-row group flex items-start gap-3 rounded-none', index === 0 && 'conversation-row-active')}
                  >
                    <span className="relative shrink-0">
                      <span className="workbench-avatar">{initials}</span>
                      {conv.status !== 'closed' ? <span className="workbench-presence-dot" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-base font-bold text-slate-950">{name}</span>
                        <span className="shrink-0 text-xs font-medium text-slate-400">{formatRelativeTime(conv.createdAt)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                        <Bot className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{channel}</span>
                        {phone ? <span className="hidden truncate sm:inline">{phone}</span> : null}
                      </span>
                      <span className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusPill tone={status?.tone || 'slate'} pulse={conv.status !== 'closed'}>
                          {status?.label || conv.status}
                        </StatusPill>
                        {conv.intent ? (
                          <>
                            <StatusPill tone="blue">{intentLabels[conv.intent] || conv.intent}</StatusPill>
                            <ProgressMeter value={conv.intentScore} tone={conv.intentScore >= 70 ? 'emerald' : 'blue'} />
                          </>
                        ) : null}
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          {conv._count.messages} {t.conversations.messageCount}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="mt-4 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-500" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
