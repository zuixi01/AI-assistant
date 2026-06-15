'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { ActionButton, EmptyState, LoadingState, PageHeader, PageShell, Panel } from '@/components/ui/design-system';
import { Plus, Trash2, Edit3, RefreshCw, Copy, Check } from 'lucide-react';
import {
  buildIntegrationWebhookUrl,
  createEmptyJuguangForm,
  createJuguangFormFromAccount,
  listJuguangAccounts,
  refreshJuguangAccountToken,
  removeJuguangAccount,
  saveJuguangAccount,
  type JuguangAccount,
  type JuguangForm,
} from '../integrations/shared';

export default function JuguangSettingsPage() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<JuguangAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JuguangForm>(createEmptyJuguangForm);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setForm(createEmptyJuguangForm());
    setEditingId(null);
  };

  const fetchAccounts = useCallback(async () => {
    try {
      setAccounts(await listJuguangAccounts());
    } catch (error) {
      console.error('Failed to load Juguang accounts', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const webhookUrl = buildIntegrationWebhookUrl('/api/webhooks/juguang');

  const handleSave = async () => {
    if (!form.appId || !form.appSecret) return;
    try {
      await saveJuguangAccount(editingId, form);
      setShowForm(false);
      resetForm();
      await fetchAccounts();
    } catch { /* ignore */ }
  };

  const handleEdit = (acc: JuguangAccount) => {
    setEditingId(acc.id);
    setForm(createJuguangFormFromAccount(acc));
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.juguang.confirmDelete)) return;
    try {
      await removeJuguangAccount(id);
      await fetchAccounts();
    } catch { /* ignore */ }
  };

  const handleRefreshToken = async (id: string) => {
    try {
      await refreshJuguangAccountToken(id);
      await fetchAccounts();
    } catch { /* ignore */ }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <PageShell>
      <PageHeader eyebrow="Integration" title={t.juguang.title} description={t.juguang.subtitle}
        actions={<ActionButton onClick={() => { resetForm(); setShowForm(true); }} className="px-3 py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> {t.juguang.addAccount}</ActionButton>}
      />

      <Panel className="mb-4 p-4">
        <p className="text-xs font-semibold text-slate-500">{t.juguang.webhookHint}</p>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2">
          <code className="flex-1 break-all font-mono text-xs text-slate-700">{webhookUrl}</code>
          <ActionButton onClick={copyUrl} variant="secondary" className="px-2 py-1 text-xs">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </ActionButton>
        </div>
      </Panel>

      {showForm && (
        <Panel>
          <h3 className="mb-3 font-bold text-slate-900">{editingId ? t.juguang.editAccount : t.juguang.addAccount}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.juguang.appId}</label><input value={form.appId} onChange={e => setForm({ ...form, appId: e.target.value })} placeholder={t.juguang.appIdPlaceholder} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.juguang.appSecret}</label><input type="password" value={form.appSecret} onChange={e => setForm({ ...form, appSecret: e.target.value })} placeholder={t.juguang.appSecretPlaceholder} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.juguang.accountName}</label><input value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} placeholder={t.juguang.accountNamePlaceholder} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.juguang.accessToken}</label><input value={form.accessToken} onChange={e => setForm({ ...form, accessToken: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
            <div className="flex items-end gap-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoReply} onChange={e => setForm({ ...form, autoReply: e.target.checked })} className="rounded" />{t.juguang.autoReply}</label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <ActionButton onClick={handleSave}>{t.common.save}</ActionButton>
            <ActionButton onClick={() => { setShowForm(false); resetForm(); }} variant="secondary">{t.common.cancel}</ActionButton>
          </div>
        </Panel>
      )}

      {accounts.length === 0 ? <Panel className="p-6"><EmptyState title={t.juguang.noAccounts} /></Panel> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map(acc => (
            <Panel key={acc.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-bold text-slate-900">{acc.accountName || acc.appId}</h4>
                <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${acc.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{acc.status === 'active' ? t.juguang.connected : t.juguang.disconnected}</span>
              </div>
              <p className="mb-1 truncate font-mono text-xs text-slate-500">App ID: {acc.appId}</p>
              <p className="mb-3 text-xs text-slate-400">{t.juguang.autoReply}: {acc.autoReply ? t.common.on : t.common.off}</p>
              {acc.tokenExpires && <p className="mb-3 text-[10px] text-slate-400">{t.juguang.tokenExpires}: {new Date(acc.tokenExpires).toLocaleDateString()}</p>}
              <div className="flex gap-2">
                <ActionButton onClick={() => handleEdit(acc)} variant="secondary" className="flex-1 px-2 py-1.5 text-xs"><Edit3 className="h-3 w-3" /></ActionButton>
                <ActionButton onClick={() => handleRefreshToken(acc.id)} variant="secondary" className="flex-1 px-2 py-1.5 text-xs"><RefreshCw className="h-3 w-3" /></ActionButton>
                <ActionButton onClick={() => handleDelete(acc.id)} variant="secondary" className="px-2 py-1.5 text-xs text-red-500"><Trash2 className="h-3 w-3" /></ActionButton>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </PageShell>
  );
}
