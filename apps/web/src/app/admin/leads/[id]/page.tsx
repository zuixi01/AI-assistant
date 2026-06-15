'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiPatch } from '@/lib/api';
import { ActionButton, LoadingState, PageHeader, PageShell, Panel, StatusPill } from '@/components/ui/design-system';
import { ArrowLeft, Phone, User, Tag, Clock } from 'lucide-react';
import Link from 'next/link';

interface LeadDetail {
  id: string;
  name: string | null;
  phone: string | null;
  source: string | null;
  followStatus: string;
  intentScore: number;
  ownerId: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  leadTags: { id: string; name: string; color: string | null }[];
  conversation: {
    id: string;
    channel: string;
    status: string;
    createdAt: string;
    messages: { id: string }[];
  } | null;
}

export default function LeadDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params.id as string;
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLead = useCallback(() => {
    apiGet<LeadDetail>(`/api/admin/leads/${id}`)
      .then(setLead)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { if (id) fetchLead(); }, [id, fetchLead]);

  const handleStatusChange = async (status: string) => {
    try { await apiPatch(`/api/admin/leads/${id}/status`, { status }); fetchLead(); } catch { /* ignore */ }
  };

  if (loading) return <LoadingState label={t.common.loading} />;
  if (!lead) return <PageShell><div className="p-8 text-center text-slate-500">{t.common.noData}</div></PageShell>;

  const statusTone: Record<string, 'slate' | 'blue' | 'amber' | 'emerald' | 'rose'> = {
    new: 'blue', contacted: 'amber', qualified: 'emerald', converted: 'emerald', lost: 'rose'
  };
  const conversations = lead.conversation ? [lead.conversation] : [];

  return (
    <PageShell>
      <div className="mb-6">
        <Link href="/admin/leads" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> {t.common.back}</Link>
      </div>

      <PageHeader eyebrow="Lead CRM" title={lead.name} description={`${t.leads.source}: ${lead.source}`}
        actions={<div className="flex gap-2">
          {['new', 'contacted', 'qualified', 'converted', 'lost'].map(s => (
            <ActionButton key={s} onClick={() => handleStatusChange(s)} variant={lead.followStatus === s ? 'primary' : 'secondary'} className="px-3 py-1.5 text-xs capitalize">{s}</ActionButton>
          ))}
        </div>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Panel className="p-6">
            <h3 className="mb-4 text-sm font-bold text-slate-700">Lead Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3"><User className="h-5 w-5 text-slate-400" /><div><p className="text-xs text-slate-500">{t.leads.name}</p><p className="font-semibold text-slate-900">{lead.name || '-'}</p></div></div>
              <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-slate-400" /><div><p className="text-xs text-slate-500">{t.leads.phone}</p><p className="font-semibold text-slate-900">{lead.phone || '-'}</p></div></div>
              <div className="flex items-center gap-3"><Tag className="h-5 w-5 text-slate-400" /><div><p className="text-xs text-slate-500">{t.leads.intentScore}</p><p className="font-semibold text-blue-600">{lead.intentScore}</p></div></div>
              <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-slate-400" /><div><p className="text-xs text-slate-500">{t.common.time}</p><p className="text-sm text-slate-600">{new Date(lead.createdAt).toLocaleString('zh-CN')}</p></div></div>
            </div>
          </Panel>

          <Panel className="p-6">
            <h3 className="mb-4 text-sm font-bold text-slate-700">{t.leads.remark}</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{lead.remark || '-'}</p>
          </Panel>

          <Panel padded={false} className="premium-table">
            <div className="px-6 py-4 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-700">{t.conversations.title}</h3></div>
            <div className="overflow-x-auto"><table className="w-full"><thead><tr>
              <th className="px-6 py-3 text-left text-xs">{t.conversations.channel}</th>
              <th className="px-6 py-3 text-left text-xs">{t.conversations.statusLabel}</th>
              <th className="px-6 py-3 text-left text-xs">{t.conversations.messageCount}</th>
              <th className="px-6 py-3 text-left text-xs">{t.conversations.time}</th>
            </tr></thead>
            <tbody>{conversations.map(c => <tr key={c.id}><td className="px-6 py-3 text-sm font-semibold">{c.channel}</td><td className="px-6 py-3"><StatusPill tone={c.status === 'open' ? 'emerald' : 'slate'}>{c.status}</StatusPill></td><td className="px-6 py-3 text-sm">{c.messages.length}</td><td className="px-6 py-3 text-xs text-slate-400">{new Date(c.createdAt).toLocaleString('zh-CN')}</td></tr>)}</tbody></table></div>
            {conversations.length === 0 && <p className="p-6 text-center text-sm text-slate-400">{t.conversations.noMessages}</p>}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-6">
            <h3 className="mb-3 text-sm font-bold text-slate-700">{t.leads.statusLabel}</h3>
            <StatusPill tone={statusTone[lead.followStatus] || 'slate'} className="w-full justify-center py-2 text-sm font-bold capitalize">{lead.followStatus}</StatusPill>
          </Panel>

          <Panel className="p-6">
            <h3 className="mb-3 text-sm font-bold text-slate-700">{t.leadsEnhanced.tags}</h3>
            <div className="flex flex-wrap gap-2">
              {lead.leadTags.map(tag => <span key={tag.id} className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: tag.color || '#64748b' }}>{tag.name}</span>)}
              {lead.leadTags.length === 0 && <p className="text-xs text-slate-400">No tags</p>}
            </div>
          </Panel>

          <Panel className="p-6">
            <h3 className="mb-3 text-sm font-bold text-slate-700">{t.leads.owner}</h3>
            <p className="text-sm font-semibold text-slate-900">{lead.ownerId || t.workspace.unassigned}</p>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
