'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  CircleSlash,
  Clock3,
  Copy,
  FileText,
  Headphones,
  Inbox,
  MessageSquareReply,
  Pin,
  RefreshCcw,
  Search,
  Send,
  Tag,
  UserMinus,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { ActionButton, EmptyState, LoadingState, ProgressMeter, StatusPill } from '@/components/ui/design-system';
import { cn } from '@/lib/cn';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  citations?: { source: string; content: string }[];
  metadata?: { sender?: string; [key: string]: unknown } | null;
}

interface ConversationSummary {
  id: string;
  channel: string;
  intent: string | null;
  intentScore: number;
  status: string;
  createdAt: string;
  user: { nickname: string; phone?: string } | null;
  lead: { name: string; phone?: string } | null;
  _count: { messages: number };
}

interface ConversationDetail {
  id: string;
  channel: string;
  intent: string | null;
  intentScore: number;
  status: string;
  assignedTo: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; nickname: string; phone: string } | null;
  lead: { id: string; name: string; phone: string; followStatus: string } | null;
  messages: Message[];
}

interface AdminProfile {
  id: string;
}

type StatusTone = 'emerald' | 'amber' | 'blue' | 'slate' | 'rose';

function formatClock(value: string) {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '';
  return time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatFullTime(value: string) {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '';
  return time.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

export default function ConversationDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const conversationId = params?.id as string;
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);

  const fetchConversation = useCallback(() => {
    apiGet<ConversationDetail>(`/api/admin/conversations/${conversationId}`)
      .then(setConv)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [conversationId]);

  const fetchConversationList = useCallback(() => {
    apiGet<{ items: ConversationSummary[] }>('/api/admin/conversations?page=1&pageSize=30')
      .then((data) => setConversations(data.items || []))
      .catch(console.error);
  }, []);

  const fetchCurrentAdmin = useCallback(() => {
    apiGet<AdminProfile>('/api/auth/me')
      .then((data) => setCurrentAdminId(data?.id || null))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    fetchCurrentAdmin();
    fetchConversation();
    fetchConversationList();
  }, [conversationId, fetchConversation, fetchConversationList, fetchCurrentAdmin]);

  const handleSetStatus = async (status: string) => {
    if (!conv || conv.status === status) return;
    await apiPatch(`/api/admin/conversations/${conversationId}/status`, { status });
    fetchConversation();
    fetchConversationList();
  };

  const handleSendHumanReply = async () => {
    const content = replyContent.trim();
    if (!conv || !content || sendingReply) return;
    setSendingReply(true);
    try {
      await apiPost(`/api/admin/conversations/${conversationId}/reply`, { content });
      setReplyContent('');
      fetchConversation();
      fetchConversationList();
    } finally {
      setSendingReply(false);
    }
  };

  const handleAssign = async () => {
    if (!conv || !currentAdminId) return;
    try {
      await apiPatch(`/api/admin/conversations/${conversationId}/assignment`, { assignedTo: currentAdminId });
      fetchConversation();
      fetchConversationList();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnassign = async () => {
    if (!conv) return;
    try {
      await apiPatch(`/api/admin/conversations/${conversationId}/assignment`, { assignedTo: null });
      fetchConversation();
      fetchConversationList();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText(conversationId).catch(() => undefined);
  };

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

  const currentCustomerName = useMemo(() => {
    if (!conv) return '';
    return conv.user?.nickname || conv.lead?.name || t.conversations.anonymousUser;
  }, [conv, t.conversations.anonymousUser]);

  const filteredConversationList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => {
      const name = item.user?.nickname || item.lead?.name || t.conversations.anonymousUser;
      const channel = channelLabels[item.channel] || item.channel;
      return `${name} ${channel} ${item.intent || ''}`.toLowerCase().includes(query);
    });
  }, [channelLabels, conversations, searchQuery, t.conversations.anonymousUser]);

  if (loading) return <LoadingState label={t.common.loading} />;
  if (error || !conv) return <EmptyState title={`${t.common.error}: ${error}`} />;

  const status = statusLabels[conv.status];
  const customerPhone = conv.user?.phone || conv.lead?.phone;
  const channelLabel = channelLabels[conv.channel] || conv.channel;
  const currentInitials = currentCustomerName.slice(0, 2).toUpperCase();

  return (
    <div className="workbench-shell conversation-detail-workbench grid min-h-[calc(100vh-2.5rem)] gap-3 xl:grid-cols-[260px_minmax(420px,1fr)_280px] 2xl:grid-cols-[320px_minmax(560px,1fr)_360px]">
      <aside className="workbench-panel hidden min-h-0 flex-col xl:flex">
        <div className="border-b workbench-section-divider px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Dialogue</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">{t.common.all}</h2>
            </div>
            <button
              type="button"
              onClick={() => router.push('/admin/conversations')}
              className="workbench-icon-button"
              title={t.common.back}
            >
              <Inbox className="h-4 w-4" />
            </button>
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t.common.search}
              className="premium-input h-9 w-full px-3 pl-9 text-sm"
            />
          </label>
        </div>

        <div className="soft-scrollbar flex-1 overflow-y-auto p-2">
          {filteredConversationList.map((item) => {
            const itemStatus = statusLabels[item.status];
            const name = item.user?.nickname || item.lead?.name || t.conversations.anonymousUser;
            const active = item.id === conversationId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/admin/conversations/${item.id}`)}
                className={cn('conversation-row flex items-start gap-3', active && 'conversation-row-active')}
              >
                <span className="relative shrink-0">
                  <span className="workbench-avatar h-11 w-11 text-xs">{name.slice(0, 2).toUpperCase()}</span>
                  {item.status !== 'closed' ? <span className="workbench-presence-dot" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-slate-950">{name}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(item.createdAt)}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{channelLabels[item.channel] || item.channel}</span>
                  <span className="mt-2 flex items-center gap-2">
                    <StatusPill tone={itemStatus?.tone || 'slate'} className="px-2 py-0.5">
                      {itemStatus?.label || item.status}
                    </StatusPill>
                    <span className="text-[11px] font-semibold text-slate-400">{item._count.messages}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="workbench-panel workbench-chat-surface flex min-h-0 flex-col">
        <header className="flex flex-col gap-3 border-b workbench-section-divider px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="workbench-icon-button xl:hidden"
              title={t.common.back}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="relative shrink-0">
              <span className="workbench-avatar">{currentInitials}</span>
              {conv.status !== 'closed' ? <span className="workbench-presence-dot" /> : null}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-slate-950">{currentCustomerName}</h1>
              <p className="mt-1 truncate text-sm text-slate-500">
                {channelLabel}
                {conv.intent ? ` · ${intentLabels[conv.intent] || conv.intent}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="workbench-icon-button" title="置顶">
              <Pin className="h-4 w-4" />
            </button>
            <button type="button" onClick={fetchConversation} className="workbench-icon-button" title="刷新">
              <RefreshCcw className="h-4 w-4" />
            </button>
            <ActionButton onClick={handleAssign} variant="secondary" className="px-3 py-2 text-xs">
              <UserPlus className="h-4 w-4" />
              {t.workspace.assignToMe}
            </ActionButton>
            {conv.status !== 'pending_human' ? (
              <ActionButton onClick={() => handleSetStatus('pending_human')} variant="warning" className="px-3 py-2 text-xs">
                <Headphones className="h-4 w-4" />
                {t.conversations.markPendingHuman}
              </ActionButton>
            ) : null}
            <ActionButton
              onClick={() => handleSetStatus(conv.status === 'closed' ? 'open' : 'closed')}
              variant={conv.status === 'closed' ? 'success' : 'danger'}
              className="px-3 py-2 text-xs"
            >
              <CircleSlash className="h-4 w-4" />
              {conv.status === 'closed' ? t.conversations.reopenConversation : t.conversations.closeConversation}
            </ActionButton>
          </div>
        </header>

        <div className="soft-scrollbar workbench-chat-scroll flex-1 space-y-5 overflow-y-auto px-5 py-6">
          <div className="flex flex-col items-center gap-3">
            <span className="workbench-timeline-chip">
              {formatFullTime(conv.createdAt)} 顾客发起会话
            </span>
            <span className="workbench-timeline-chip">
              {formatFullTime(conv.createdAt)} AI 客服开始接待
            </span>
          </div>

          {conv.messages.length === 0 ? (
            <EmptyState title={t.conversations.noMessages} />
          ) : (
            conv.messages.map((msg) => {
              const isCustomer = msg.role === 'user';
              const isHumanReply = msg.role === 'assistant' && msg.metadata?.sender === 'human';
              const senderLabel = isCustomer ? '顾客' : isHumanReply ? t.conversations.humanMessage : t.conversations.aiMessage;
              return (
                <div key={msg.id} className={cn('flex items-end gap-3', isCustomer ? 'justify-end' : 'justify-start')}>
                  {!isCustomer ? (
                    <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-white', isHumanReply ? 'bg-emerald-600' : 'bg-blue-600')}>
                      {isHumanReply ? <Headphones className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                  ) : null}
                  <div className="max-w-[78%]">
                    <div className={cn('mb-1 flex items-center gap-2 text-xs text-slate-400', isCustomer && 'justify-end')}>
                      <span className="font-bold">{senderLabel}</span>
                      <span>{formatClock(msg.createdAt)}</span>
                    </div>
                    <div
                      className={cn(
                        'rounded-[1rem] px-4 py-3 text-sm leading-6',
                        isCustomer
                          ? 'message-bubble-customer rounded-br-md'
                          : isHumanReply
                            ? 'message-bubble-human rounded-bl-md'
                            : 'message-bubble-assistant rounded-bl-md',
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.citations && msg.citations.length > 0 ? (
                      <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left">
                        <p className="mb-1 text-xs font-bold text-amber-800">引用来源</p>
                        {msg.citations.map((citation, index) => (
                          <p key={`${citation.source}-${index}`} className="truncate text-xs text-amber-700">
                            [{citation.source}] {citation.content}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {isCustomer ? (
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
                      <UserRound className="h-4 w-4" />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <footer className="border-t workbench-section-divider bg-white/70 p-4">
          <div className="workbench-composer overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <MessageSquareReply className="h-4 w-4" />
                {t.conversations.humanReply}
              </div>
              <StatusPill tone={status?.tone || 'slate'}>{status?.label || conv.status}</StatusPill>
            </div>
            <textarea
              value={replyContent}
              onChange={(event) => setReplyContent(event.target.value)}
              rows={3}
              className="w-full resize-none border-0 bg-white px-4 py-3 text-sm outline-none"
              placeholder={t.conversations.humanReplyPlaceholder}
            />
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
              <span className="text-xs text-slate-400">AI 接待中可随时切换人工回复</span>
              <ActionButton type="button" onClick={handleSendHumanReply} disabled={!replyContent.trim() || sendingReply} className="px-4 py-2">
                <Send className="h-4 w-4" />
                {sendingReply ? t.common.loading : t.conversations.sendHumanReply}
              </ActionButton>
            </div>
          </div>
        </footer>
      </section>

      <aside className="workbench-panel flex min-h-0 flex-col 2xl:flex">
        <div className="flex items-center justify-between border-b workbench-section-divider px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="workbench-avatar">{currentInitials}</span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-950">{currentCustomerName}</h2>
              <p className="truncate text-sm text-slate-500">{customerPhone || '未填写手机号'}</p>
            </div>
          </div>
          <button type="button" className="workbench-icon-button" title="顾客资料">
            <UserRound className="h-4 w-4" />
          </button>
        </div>

        <div className="soft-scrollbar flex-1 overflow-y-auto p-5">
          <section>
            <h3 className="text-sm font-black text-slate-950">顾客信息</h3>
            <div className="mt-3">
              <div className="workbench-info-row">
                <span className="text-slate-500">{t.conversations.channel}</span>
                <span className="font-semibold text-slate-800">{channelLabel}</span>
              </div>
              <div className="workbench-info-row">
                <span className="text-slate-500">{t.conversations.statusLabel}</span>
                <StatusPill tone={status?.tone || 'slate'} pulse={conv.status !== 'closed'}>
                  {status?.label || conv.status}
                </StatusPill>
              </div>
              <div className="workbench-info-row">
                <span className="text-slate-500">{t.workspace.assignedTo}</span>
                <span className="font-semibold text-slate-800">{conv.assignedTo ? conv.assignedTo.slice(0, 8) : t.workspace.unassigned}</span>
              </div>
              <div className="workbench-info-row">
                <span className="text-slate-500">{t.conversations.time}</span>
                <span className="text-right font-semibold text-slate-800">{formatFullTime(conv.createdAt)}</span>
              </div>
            </div>
          </section>

          <section className="mt-6 border-t workbench-section-divider pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-950">标签</h3>
              <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500">
                <Tag className="h-3.5 w-3.5" />
                添加
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill tone={status?.tone || 'slate'}>{status?.label || conv.status}</StatusPill>
              {conv.intent ? <StatusPill tone="blue">{intentLabels[conv.intent] || conv.intent}</StatusPill> : null}
              {conv.lead ? <StatusPill tone="emerald">{conv.lead.followStatus}</StatusPill> : null}
            </div>
          </section>

          <section className="mt-6 border-t workbench-section-divider pt-5">
            <h3 className="text-sm font-black text-slate-950">{t.conversations.intent}</h3>
            {conv.intent ? (
              <div className="mt-3 space-y-3">
                <StatusPill tone="blue">{intentLabels[conv.intent] || conv.intent}</StatusPill>
                <div className="flex items-center gap-3">
                  <ProgressMeter value={conv.intentScore} tone={conv.intentScore >= 70 ? 'emerald' : 'blue'} />
                  <span className="text-sm font-black text-slate-700">{conv.intentScore}%</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">暂无识别意图</p>
            )}
          </section>

          <section className="mt-6 border-t workbench-section-divider pt-5">
            <h3 className="text-sm font-black text-slate-950">自定义名片</h3>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              {conv.summary || '暂无会话摘要，可在后续接待中沉淀顾客偏好、预算、需求区域和跟进备注。'}
            </p>
          </section>

          <section className="mt-6 border-t workbench-section-divider pt-5">
            <h3 className="text-sm font-black text-slate-950">处理动作</h3>
            <div className="mt-3 grid gap-2">
              <ActionButton onClick={handleAssign} variant="secondary" className="justify-start">
                <UserPlus className="h-4 w-4" />
                {t.workspace.assignToMe}
              </ActionButton>
              <ActionButton onClick={handleUnassign} variant="secondary" className="justify-start">
                <UserMinus className="h-4 w-4" />
                {t.workspace.unassign}
              </ActionButton>
              {conv.status !== 'needs_review' ? (
                <ActionButton onClick={() => handleSetStatus('needs_review')} variant="secondary" className="justify-start">
                  <RefreshCcw className="h-4 w-4" />
                  {t.conversations.markNeedsReview}
                </ActionButton>
              ) : null}
              {conv.status !== 'pending_human' ? (
                <ActionButton onClick={() => handleSetStatus('pending_human')} variant="warning" className="justify-start">
                  <Headphones className="h-4 w-4" />
                  {t.conversations.markPendingHuman}
                </ActionButton>
              ) : null}
              <ActionButton
                onClick={() => handleSetStatus(conv.status === 'closed' ? 'open' : 'closed')}
                variant={conv.status === 'closed' ? 'success' : 'danger'}
                className="justify-start"
              >
                <CircleSlash className="h-4 w-4" />
                {conv.status === 'closed' ? t.conversations.reopenConversation : t.conversations.closeConversation}
              </ActionButton>
            </div>
          </section>

          {conv.lead ? (
            <section className="mt-6 border-t workbench-section-divider pt-5">
              <h3 className="text-sm font-black text-slate-950">{t.leads.title}</h3>
              <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-slate-700">
                <p className="font-bold">{t.leads.name}: {conv.lead.name}</p>
                <p className="mt-1">{t.leads.phone}: {conv.lead.phone}</p>
                <div className="mt-2">
                  <StatusPill tone="blue">{conv.lead.followStatus}</StatusPill>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-6 border-t workbench-section-divider pt-5">
            <h3 className="text-sm font-black text-slate-950">访问标识</h3>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 break-all">{conv.id}</span>
              <button type="button" onClick={handleCopyId} className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-blue-600" title="复制">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
