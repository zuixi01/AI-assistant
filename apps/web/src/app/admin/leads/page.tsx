'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal, UserCheck, Search, Tag, Eye } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiPatch } from '@/lib/api';
import { ActionButton, EmptyState, LoadingState, PageHeader, PageShell, Panel, ProgressMeter, StatusPill } from '@/components/ui/design-system';
import Link from 'next/link';

interface LeadTag { id: string; name: string; color: string; }

interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  source: string | null;
  intentScore: number;
  followStatus: string;
  ownerId: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  user: { nickname: string } | null;
  conversation: { id: string } | null;
  tags: LeadTag[];
}

export default function LeadsPage() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLeads = (status?: string, source?: string, search?: string) => {
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (status) params.set('followStatus', status);
    if (source) params.set('source', source);
    if (search) params.set('search', search);
    apiGet<{ items: Lead[] }>(`/api/admin/leads?${params.toString()}`)
      .then((data) => setLeads(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeads(statusFilter, sourceFilter, searchQuery);
  }, [statusFilter, sourceFilter]);

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setEditStatus(lead.followStatus);
    setEditRemark(lead.remark || '');
  };

  const handleSave = async () => {
    if (!editingLead) return;
    setSaving(true);
    try {
      await apiPatch(`/api/admin/leads/${editingLead.id}`, { followStatus: editStatus, remark: editRemark });
      setEditingLead(null);
      fetchLeads(statusFilter);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const statusLabels: Record<string, string> = {
    new: t.leads.statusNew,
    contacted: t.leads.statusContacted,
    qualified: t.leads.statusQualified,
    converted: t.leads.statusConverted,
    lost: t.leads.statusLost,
  };

  const sourceLabels: Record<string, string> = {
    chat: t.leads.sourceChat,
    h5: t.leads.sourceH5,
    embed: t.leads.sourceEmbed,
    douyin_miniapp: t.leads.sourceDouyinMiniapp,
    wechat_miniapp: t.leads.sourceWechatMiniapp,
    miniapp: t.leads.sourceMiniapp,
    web: t.leads.sourceWeb,
    phone: t.leads.sourcePhone,
    manual: t.leads.sourceManual,
  };

  const statusTone = (status: string): 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' => {
    if (status === 'converted') return 'emerald';
    if (status === 'qualified') return 'amber';
    if (status === 'lost') return 'rose';
    if (status === 'new') return 'blue';
    return 'slate';
  };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Lead intelligence"
        title={t.leads.title}
        description="集中查看从会话沉淀出的客户线索、意向评分、来源渠道与跟进状态，帮助销售及时接手。"
      />

      <Panel className="mb-4 flex flex-wrap items-center gap-2 p-4">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t.leadsEnhanced.searchLeads}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLeads(statusFilter, sourceFilter, searchQuery)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setLoading(true);
                setStatusFilter(e.target.value);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium"
            >
              <option value="">{t.leads.filterByStatus}</option>
              <option value="new">{t.leads.statusNew}</option>
              <option value="contacted">{t.leads.statusContacted}</option>
              <option value="qualified">{t.leads.statusQualified}</option>
              <option value="converted">{t.leads.statusConverted}</option>
              <option value="lost">{t.leads.statusLost}</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Tag className="h-4 w-4 text-slate-400" />
            <select
              value={sourceFilter}
              onChange={(e) => {
                setLoading(true);
                setSourceFilter(e.target.value);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium"
            >
              <option value="">{t.leadsEnhanced.filterBySource}</option>
              <option value="juguang">聚光</option>
              <option value="xiaohongshu">小红书</option>
              <option value="web">Web</option>
              <option value="h5">H5</option>
            </select>
          </div>
        </div>
      </Panel>

      {editingLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="premium-card w-full max-w-md p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-950">{t.leads.editLead}</h3>
                <p className="text-xs text-slate-500">更新销售跟进状态与备注</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{t.leads.name}</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{editingLead.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400">{t.leads.phone}</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{editingLead.phone || '-'}</p>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">{t.leads.updateStatus}</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="premium-select w-full px-3 py-2 text-sm">
                  {Object.entries(statusLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">{t.leads.remark}</label>
                <textarea
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  rows={3}
                  className="premium-textarea w-full px-3 py-2 text-sm"
                  placeholder={t.leads.remark}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <ActionButton onClick={() => setEditingLead(null)} variant="secondary">{t.common.cancel}</ActionButton>
              <ActionButton onClick={handleSave} disabled={saving}>{saving ? t.common.loading : t.common.save}</ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      <Panel padded={false} className="premium-table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left">{t.leads.name}</th>
                <th className="px-6 py-4 text-left">{t.leads.phone}</th>
                <th className="px-6 py-4 text-left">{t.leads.source}</th>
                <th className="px-6 py-4 text-left">{t.leads.intentScore}</th>
                <th className="px-6 py-4 text-left">{t.leads.statusLabel}</th>
                <th className="px-6 py-4 text-left">{t.leadsEnhanced.tags}</th>
                <th className="px-6 py-4 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{lead.name || lead.user?.nickname || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{lead.phone || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{sourceLabels[lead.source || ''] || lead.source || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <ProgressMeter value={lead.intentScore} tone={lead.intentScore >= 70 ? 'emerald' : 'blue'} />
                      <span className="text-xs font-bold text-slate-500">{lead.intentScore}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <StatusPill tone={statusTone(lead.followStatus)}>
                      {statusLabels[lead.followStatus] || lead.followStatus}
                    </StatusPill>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(lead.tags ?? []).map(tag => (
                        <span key={tag.id} className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: tag.color || '#64748b' }}>{tag.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <div className="flex justify-end gap-1">
                      <Link href={`/admin/leads/${lead.id}`}>
                        <ActionButton variant="secondary" className="px-2 py-1.5 text-xs"><Eye className="h-3 w-3" /></ActionButton>
                      </Link>
                      <ActionButton onClick={() => handleEdit(lead)} variant="secondary" className="px-2 py-1.5 text-xs">
                        {t.common.edit}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length === 0 ? <div className="p-6"><EmptyState title={t.common.noData} /></div> : null}
      </Panel>
    </PageShell>
  );
}
