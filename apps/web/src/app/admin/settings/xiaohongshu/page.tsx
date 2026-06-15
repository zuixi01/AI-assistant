'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Trash2, Copy, Check, X, QrCode, Smartphone, Loader2, Plus, Edit3, RefreshCw, Radio } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import {
  buildIntegrationWebhookUrl,
  createEmptyJuguangForm,
  createJuguangFormFromAccount,
  getXhsAuthUrl,
  listJuguangAccounts,
  listXhsAccounts,
  refreshJuguangAccountToken,
  removeJuguangAccount,
  removeXhsAccount,
  saveJuguangAccount,
  type JuguangAccount,
  type XhsAccount,
} from '../integrations/shared';

type TabKey = 'xiaohongshu' | 'juguang';

const TABS: { key: TabKey; label: string; icon: typeof BookOpen }[] = [
  { key: 'xiaohongshu', label: '小红书私信', icon: BookOpen },
  { key: 'juguang', label: '聚光广告', icon: Radio },
];

export default function XiaohongshuPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>('xiaohongshu');

  // ─── XHS state ───
  const [accounts, setAccounts] = useState<XhsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [oauthUrl, setOauthUrl] = useState('');
  const [generatingUrl, setGeneratingUrl] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ─── Juguang state ───
  const [jgAccounts, setJgAccounts] = useState<JuguangAccount[]>([]);
  const [jgLoading, setJgLoading] = useState(true);
  const [jgShowForm, setJgShowForm] = useState(false);
  const [jgEditingId, setJgEditingId] = useState<string | null>(null);
  const [jgForm, setJgForm] = useState(createEmptyJuguangForm);
  const [jgCopied, setJgCopied] = useState(false);

  // ─── XHS logic ───
  const webhookUrl = buildIntegrationWebhookUrl('/api/open/im/send');

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await listXhsAccounts());
    } catch (e) {
      console.error('Failed to load XHS accounts', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (!oauth) return;
    if (oauth === 'success') {
      setToast({ type: 'success', msg: t.xiaohongshu.oauthSuccess });
      loadAccounts();
    } else if (oauth === 'error') {
      setToast({ type: 'error', msg: searchParams.get('msg') || t.xiaohongshu.oauthError });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('oauth');
    url.searchParams.delete('msg');
    url.searchParams.delete('accountId');
    window.history.replaceState({}, '', url.toString());
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [searchParams, t, loadAccounts]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(webhookUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const openScanModal = async () => {
    setShowScanModal(true);
    setGeneratingUrl(true);
    setOauthUrl('');
    try {
      const data = await getXhsAuthUrl();
      setOauthUrl(data.url);
    } catch (e: any) {
      setToast({ type: 'error', msg: e.message || t.xiaohongshu.oauthError });
      setShowScanModal(false);
    } finally {
      setGeneratingUrl(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.xiaohongshu.confirmDelete)) return;
    try { await removeXhsAccount(id); await loadAccounts(); } catch { alert(t.xiaohongshu.deleteFailed); }
  };

  const accountTypeLabel = (type: string) => {
    if (type === 'kos') return t.xiaohongshu.kosType;
    if (type === 'personal') return t.xiaohongshu.personal;
    return t.xiaohongshu.enterprise;
  };

  // ─── Juguang logic ───
  const jgWebhookUrl = buildIntegrationWebhookUrl('/api/webhooks/juguang');

  const jgFetchAccounts = useCallback(async () => {
    try { setJgAccounts(await listJuguangAccounts()); } catch { /* ignore */ } finally { setJgLoading(false); }
  }, []);

  useEffect(() => { jgFetchAccounts(); }, [jgFetchAccounts]);

  const jgHandleSave = async () => {
    if (!jgForm.appId || !jgForm.appSecret) return;
    try {
      await saveJuguangAccount(jgEditingId, jgForm);
      setJgShowForm(false); setJgEditingId(null);
      setJgForm(createEmptyJuguangForm());
      jgFetchAccounts();
    } catch { /* ignore */ }
  };

  const jgHandleEdit = (acc: JuguangAccount) => {
    setJgEditingId(acc.id);
    setJgForm(createJuguangFormFromAccount(acc));
    setJgShowForm(true);
  };

  const jgHandleDelete = async (id: string) => {
    if (!confirm(t.juguang.confirmDelete)) return;
    try { await removeJuguangAccount(id); jgFetchAccounts(); } catch { /* ignore */ }
  };

  const jgHandleRefreshToken = async (id: string) => {
    try { await refreshJuguangAccountToken(id); jgFetchAccounts(); } catch { /* ignore */ }
  };

  const jgCopyUrl = () => { navigator.clipboard.writeText(jgWebhookUrl); setJgCopied(true); setTimeout(() => setJgCopied(false), 2000); };

  // ─── Render ───
  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">{t.common.loading}</div>;
  }

  return (
    <div className="admin-page">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="premium-kicker">Integration</span>
          <h2 className="admin-page-title mt-3">小红书管理</h2>
          <p className="mt-2 text-sm text-slate-500">统一管理小红书私信和聚光广告接入</p>
        </div>
        <div className="mt-4">
          <a
            href="/admin/settings/xiaohongshu/setup"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <QrCode className="h-4 w-4" />
            配置向导
          </a>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-slate-100 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════ Tab: 小红书私信 ═══════ */}
      {activeTab === 'xiaohongshu' && (
        <>
          <div className="mb-6 flex justify-end">
            <button onClick={openScanModal} className="premium-button-primary px-5 py-2.5 text-sm">
              <QrCode className="h-4 w-4" />
              {t.xiaohongshu.scanToAdd}
            </button>
          </div>

          {/* Webhook URL */}
          <section className="premium-card mb-6 p-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><BookOpen className="h-5 w-5" /></span>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-950">{t.xiaohongshu.webhookUrl}</h3>
                <p className="text-sm text-slate-500">{t.xiaohongshu.webhookHint}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-mono text-slate-700 break-all">{webhookUrl}</code>
              <button onClick={handleCopy} className="premium-button-secondary px-4 py-2.5 text-sm shrink-0">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? t.xiaohongshu.copied : t.xiaohongshu.copyUrl}
              </button>
            </div>
          </section>

          {/* Account List */}
          {accounts.length === 0 ? (
            <div className="premium-card p-12 text-center">
              <Smartphone className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-sm font-semibold text-slate-500">{t.xiaohongshu.noAccounts}</p>
              <button onClick={openScanModal} className="mt-4 premium-button-primary px-5 py-2.5 text-sm">
                <QrCode className="h-4 w-4" />{t.xiaohongshu.scanToAdd}
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="premium-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black text-slate-950">{acc.nickName || acc.accountCode}</p>
                      <p className="mt-1 text-xs text-slate-500">{t.xiaohongshu.accountType}: {accountTypeLabel(acc.accountType)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${acc.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {acc.status === 'active' ? t.xiaohongshu.statusActive : t.xiaohongshu.statusDisabled}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <p><span className="font-bold">{t.xiaohongshu.userId}:</span> {acc.userId}</p>
                    <p><span className="font-bold">{t.xiaohongshu.appId}:</span> {acc.appId}</p>
                    <p><span className="font-bold">{t.xiaohongshu.accountCode}:</span> {acc.accountCode}</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => handleDelete(acc.id)} className="premium-button-secondary flex-1 px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />{t.common.delete}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* QR Code Scan Modal */}
          {showScanModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="premium-card w-full max-w-md p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-950">{t.xiaohongshu.scanTitle}</h3>
                  <button onClick={() => setShowScanModal(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="mb-5 space-y-2 text-sm text-slate-600">
                  <p>{t.xiaohongshu.scanStep1}</p>
                  <p>{t.xiaohongshu.scanStep2}</p>
                  <p>{t.xiaohongshu.scanStep3}</p>
                  <p>{t.xiaohongshu.scanStep4}</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-6">
                  {generatingUrl ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                      <p className="text-sm text-slate-500">{t.xiaohongshu.generating}</p>
                    </div>
                  ) : oauthUrl ? (
                    <div className="flex flex-col items-center gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(oauthUrl)}`} alt="XHS binding QR Code" width={240} height={240} className="rounded-2xl bg-white p-2 shadow-sm" />
                      <p className="text-xs text-slate-400 text-center max-w-xs">{t.xiaohongshu.scanHint}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <QrCode className="h-8 w-8 text-slate-300" />
                      <p className="text-sm text-slate-400">{t.xiaohongshu.needAppConfig}</p>
                    </div>
                  )}
                </div>
                <div className="mt-5">
                  <button onClick={() => setShowScanModal(false)} className="premium-button-secondary w-full px-5 py-2.5 text-sm">{t.common.close}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════ Tab: 聚光广告 ═══════ */}
      {activeTab === 'juguang' && (
        <>
          {/* Webhook URL */}
          <section className="premium-card mb-6 p-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><Radio className="h-5 w-5" /></span>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-950">聚光 Webhook 地址</h3>
                <p className="text-sm text-slate-500">在聚光平台后台填入此地址接收线索和消息</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-mono text-slate-700 break-all">{jgWebhookUrl}</code>
              <button onClick={jgCopyUrl} className="premium-button-secondary px-4 py-2.5 text-sm shrink-0">
                {jgCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </section>

          {/* Add button */}
          <div className="mb-6 flex justify-end">
            <button onClick={() => { setJgForm({ appId: '', appSecret: '', accountName: '', accessToken: '', refreshToken: '', autoReply: true }); setJgEditingId(null); setJgShowForm(true); }} className="premium-button-primary px-5 py-2.5 text-sm">
              <Plus className="h-4 w-4" />{t.juguang.addAccount}
            </button>
          </div>

          {/* Add/Edit form */}
          {jgShowForm && (
            <section className="premium-card mb-6 p-6">
              <h3 className="mb-4 font-bold text-slate-900">{jgEditingId ? t.juguang.editAccount : t.juguang.addAccount}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.juguang.appId}</label><input value={jgForm.appId} onChange={e => setJgForm({ ...jgForm, appId: e.target.value })} placeholder={t.juguang.appIdPlaceholder} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.juguang.appSecret}</label><input type="password" value={jgForm.appSecret} onChange={e => setJgForm({ ...jgForm, appSecret: e.target.value })} placeholder={t.juguang.appSecretPlaceholder} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.juguang.accountName}</label><input value={jgForm.accountName} onChange={e => setJgForm({ ...jgForm, accountName: e.target.value })} placeholder={t.juguang.accountNamePlaceholder} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.juguang.accessToken}</label><input value={jgForm.accessToken} onChange={e => setJgForm({ ...jgForm, accessToken: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
                <div className="flex items-end gap-2 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={jgForm.autoReply} onChange={e => setJgForm({ ...jgForm, autoReply: e.target.checked })} className="rounded" />{t.juguang.autoReply}</label>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={jgHandleSave} className="premium-button-primary px-5 py-2.5 text-sm">{t.common.save}</button>
                <button onClick={() => { setJgShowForm(false); setJgEditingId(null); }} className="premium-button-secondary px-5 py-2.5 text-sm">{t.common.cancel}</button>
              </div>
            </section>
          )}

          {/* Juguang account list */}
          {jgLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-slate-500">{t.common.loading}</div>
          ) : jgAccounts.length === 0 ? (
            <div className="premium-card p-12 text-center">
              <Radio className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-sm font-semibold text-slate-500">{t.juguang.noAccounts}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {jgAccounts.map((acc) => (
                <div key={acc.id} className="premium-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-bold text-slate-900">{acc.accountName || acc.appId}</h4>
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${acc.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {acc.status === 'active' ? t.juguang.connected : t.juguang.disconnected}
                    </span>
                  </div>
                  <p className="mb-1 truncate font-mono text-xs text-slate-500">App ID: {acc.appId}</p>
                  <p className="mb-3 text-xs text-slate-400">{t.juguang.autoReply}: {acc.autoReply ? t.common.on : t.common.off}</p>
                  {acc.tokenExpires && <p className="mb-3 text-[10px] text-slate-400">{t.juguang.tokenExpires}: {new Date(acc.tokenExpires).toLocaleDateString()}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => jgHandleEdit(acc)} className="premium-button-secondary flex-1 px-2 py-1.5 text-xs"><Edit3 className="h-3 w-3" /></button>
                    <button onClick={() => jgHandleRefreshToken(acc.id)} className="premium-button-secondary flex-1 px-2 py-1.5 text-xs"><RefreshCw className="h-3 w-3" /></button>
                    <button onClick={() => jgHandleDelete(acc.id)} className="premium-button-secondary px-2 py-1.5 text-xs text-red-500"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
