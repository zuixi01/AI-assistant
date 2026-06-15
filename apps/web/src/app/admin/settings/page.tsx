'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BellRing, BookOpen, Bot, BrainCircuit, CheckCircle2, Copy, Edit3, HelpCircle,
  Languages, Lightbulb, Loader2, Plus, PlugZap, QrCode, Radio,
  RefreshCw, Search, Settings, Smartphone, Tag, Trash2, Wand2, Webhook, X, XCircle,
} from 'lucide-react';
import { useTranslation, localeNames, type Locale } from '@/lib/i18n';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { ActionButton, EmptyState, LoadingState, Panel, StatusPill } from '@/components/ui/design-system';
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
} from './integrations/shared';

// ─── Shared types ───

interface TenantConfig {
  id: string; name: string; slug: string; type: string; plan: string;
  config: { aiName?: string; welcomeMessage?: string; wecomWebhook?: string; feishuWebhook?: string } | null;
}
interface ProviderConfig { provider: string; apiKey: string; baseUrl: string; model: string; }
interface ModelConfigData { llm: ProviderConfig; embedding: ProviderConfig; }
interface TestResult { ok: boolean; message: string; latencyMs?: number; }
interface QuickReplyTemplate { id: string; content: string; category: string; shortcut: string | null; usageCount: number; createdAt: string; }
interface UnknownQuestion { id: string; question: string; normalizedQuestion: string | null; scene: string | null; intent: string | null; count: number; failReason: string | null; status: string; suggestedAnswer: string | null; lastSeenAt: string | null; resolved: boolean; suggestion: string | null; createdAt: string; }
type TabKey = 'basic' | 'model' | 'quickReply' | 'unknown' | 'channels';

const PRESETS: Record<string, { baseUrl: string; llmModel: string; embeddingModel: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', llmModel: 'deepseek-chat', embeddingModel: 'text-embedding-v3' },
  openai: { baseUrl: 'https://api.openai.com/v1', llmModel: 'gpt-4o-mini', embeddingModel: 'text-embedding-3-small' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', llmModel: 'qwen-turbo', embeddingModel: 'text-embedding-v3' },
  mock: { baseUrl: '', llmModel: 'mock', embeddingModel: 'mock' },
};

// ─── ProviderForm (shared by ModelSettings) ───

function ProviderForm({
  label, config, onChange, testResult, testing, onTest, t, isEmbedding,
}: {
  label: string; config: ProviderConfig; onChange: (c: ProviderConfig) => void;
  testResult: TestResult | null; testing: boolean; onTest: () => void; t: any; isEmbedding?: boolean;
}) {
  const handleProviderChange = (provider: string) => {
    const preset = PRESETS[provider];
    const defaultModel = isEmbedding ? preset?.embeddingModel : preset?.llmModel;
    onChange({ ...config, provider, baseUrl: preset?.baseUrl || config.baseUrl, model: defaultModel || '' });
  };
  return (
    <Panel className="p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><BrainCircuit className="h-5 w-5" /></span>
        <div><h3 className="text-lg font-black tracking-tight text-slate-950">{label}</h3></div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">{t.modelConfig.providerLabel}</label>
          <select value={config.provider} onChange={(e) => handleProviderChange(e.target.value)} className="premium-select w-full px-3 py-2.5 text-sm">
            <option value="mock">{t.modelConfig.providerMock}</option>
            {!isEmbedding && <option value="deepseek">{t.modelConfig.providerDeepseek}</option>}
            <option value="openai">{t.modelConfig.providerOpenai}</option>
            <option value="qwen">{t.modelConfig.providerQwen}</option>
          </select>
        </div>
        {config.provider !== 'mock' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">{t.modelConfig.apiKeyLabel}</label>
              <input type="password" value={config.apiKey} onChange={(e) => onChange({ ...config, apiKey: e.target.value })} placeholder={t.modelConfig.placeholderApiKey} className="premium-input w-full px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">{t.modelConfig.baseUrlLabel}</label>
              <input type="text" value={config.baseUrl} onChange={(e) => onChange({ ...config, baseUrl: e.target.value })} placeholder={t.modelConfig.placeholderBaseUrl} className="premium-input w-full px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">{t.modelConfig.modelLabel}</label>
              <input type="text" value={config.model} onChange={(e) => onChange({ ...config, model: e.target.value })} placeholder={t.modelConfig.placeholderModel} className="premium-input w-full px-3 py-2.5 text-sm" />
            </div>
          </>
        )}
        {testResult && (
          <div className={`flex items-center gap-2 rounded-2xl p-3 text-sm font-medium ${testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <span>{testResult.message}</span>
            {testResult.latencyMs !== undefined && <span className="ml-auto text-xs opacity-70">{testResult.latencyMs}ms</span>}
          </div>
        )}
        <button type="button" onClick={onTest} disabled={testing || (config.provider !== 'mock' && !config.apiKey)} className="premium-button-secondary px-5 py-2.5 text-sm disabled:opacity-50">
          {testing ? (<><Loader2 className="h-4 w-4 animate-spin" />{t.modelConfig.testing}</>) : (<><PlugZap className="h-4 w-4" />{t.modelConfig.testConnection}</>)}
        </button>
      </div>
    </Panel>
  );
}

// ─── Tab: Basic Settings ───

function BasicSettings({ t }: { t: any }) {
  const { locale, setLocale } = useTranslation();
  const defaultAiName = t.settings.defaultAiName;
  const defaultWelcome = t.settings.defaultWelcome;
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [aiName, setAiName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [wecomWebhook, setWecomWebhook] = useState('');
  const [feishuWebhook, setFeishuWebhook] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [testingNotify, setTestingNotify] = useState(false);
  const [testNotifyMsg, setTestNotifyMsg] = useState('');

  useEffect(() => {
    apiGet<{ tenantId?: string }>('/api/auth/me')
      .then((admin) => { if (!admin.tenantId) return; return apiGet<TenantConfig>(`/api/tenants/${admin.tenantId}`); })
      .then((data) => {
        if (!data) return;
        setTenant(data);
        const cfg = data.config || {};
        setAiName(cfg.aiName || defaultAiName);
        setWelcomeMessage(cfg.welcomeMessage || defaultWelcome);
        setWecomWebhook(cfg.wecomWebhook || '');
        setFeishuWebhook(cfg.feishuWebhook || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [defaultAiName, defaultWelcome]);

  const handleSaveAiConfig = async () => {
    if (!tenant) return; setSaving(true); setSaveMsg('');
    try {
      const newConfig = { ...(tenant.config || {}), aiName, welcomeMessage };
      await apiPatch(`/api/tenants/${tenant.id}`, { config: newConfig });
      setTenant({ ...tenant, config: newConfig }); setSaveMsg(t.settings.saved);
    } catch { setSaveMsg(t.settings.saveFailed); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000); }
  };

  const handleSaveWebhooks = async () => {
    if (!tenant) return; setSaving(true); setSaveMsg('');
    try {
      const newConfig = { ...(tenant.config || {}), wecomWebhook, feishuWebhook };
      await apiPatch(`/api/tenants/${tenant.id}`, { config: newConfig });
      setTenant({ ...tenant, config: newConfig }); setSaveMsg(t.settings.saved);
    } catch { setSaveMsg(t.settings.saveFailed); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000); }
  };

  const handleTestNotifications = async () => {
    setTestingNotify(true); setTestNotifyMsg('');
    try {
      const data = await apiPost<Record<string, unknown>>('/api/admin/notifications/test', {});
      const summary = typeof (data as { summary?: string }).summary === 'string' ? (data as { summary: string }).summary : JSON.stringify(data);
      setTestNotifyMsg(`${t.settings.testNotificationsOk}: ${summary}`);
    } catch { setTestNotifyMsg(t.settings.testNotificationsFail); }
    finally { setTestingNotify(false); setTimeout(() => setTestNotifyMsg(''), 12000); }
  };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><Languages className="h-5 w-5" /></span>
          <div><h3 className="text-lg font-black tracking-tight text-slate-950">{t.settings.languageSettings}</h3><p className="text-sm text-slate-500">{t.settings.languageDesc}</p></div>
        </div>
        <label className="mb-2 block text-sm font-bold text-slate-700">{t.settings.languageLabel}</label>
        <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="premium-select w-full px-3 py-2.5 text-sm">
          {Object.entries(localeNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        {tenant && (
          <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Tenant</p>
            <p className="mt-2 text-lg font-black">{tenant.name}</p>
            <p className="text-sm text-slate-300">{tenant.slug} · {tenant.plan}</p>
          </div>
        )}
      </Panel>

      <Panel className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><Bot className="h-5 w-5" /></span>
          <div><h3 className="text-lg font-black tracking-tight text-slate-950">{t.settings.aiConfig}</h3><p className="text-sm text-slate-500">定义客户看到的 AI 助手名称和欢迎语。</p></div>
        </div>
        <div className="space-y-4">
          <div><label className="mb-1 block text-sm font-bold text-slate-700">{t.settings.aiNameLabel}</label><input type="text" value={aiName} onChange={(e) => setAiName(e.target.value)} className="premium-input w-full px-3 py-2.5 text-sm" /></div>
          <div><label className="mb-1 block text-sm font-bold text-slate-700">{t.settings.welcomeMessageLabel}</label><textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={4} className="premium-textarea w-full px-3 py-2.5 text-sm" /></div>
          <button onClick={handleSaveAiConfig} disabled={saving} className="premium-button-primary px-5 py-2.5 text-sm disabled:opacity-50">{saving ? t.common.loading : t.common.save}</button>
          {saveMsg && <span className={`ml-3 text-sm font-bold ${saveMsg.includes('失败') || saveMsg.includes('fail') ? 'text-red-600' : 'text-emerald-600'}`}>{saveMsg}</span>}
        </div>
      </Panel>

      <Panel className="p-6 xl:col-span-2">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><Webhook className="h-5 w-5" /></span>
          <div><h3 className="text-lg font-black tracking-tight text-slate-950">{t.settings.integrationConfig}</h3><p className="text-sm text-slate-500">把关键客服事件推送到团队协作工具。</p></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-900/5 bg-white/58 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-black text-slate-950">{t.settings.wecomNotification}</p><p className="mt-1 text-sm leading-6 text-slate-500">{t.settings.wecomDesc}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${wecomWebhook ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{wecomWebhook ? t.settings.connected : t.settings.disconnected}</span>
            </div>
            <input type="text" value={wecomWebhook} onChange={(e) => setWecomWebhook(e.target.value)} className="premium-input mt-4 w-full px-3 py-2 text-sm" placeholder={t.settings.webhookUrl} />
          </div>
          <div className="rounded-2xl border border-slate-900/5 bg-white/58 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-black text-slate-950">{t.settings.feishuNotification}</p><p className="mt-1 text-sm leading-6 text-slate-500">{t.settings.feishuDesc}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${feishuWebhook ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{feishuWebhook ? t.settings.connected : t.settings.disconnected}</span>
            </div>
            <input type="text" value={feishuWebhook} onChange={(e) => setFeishuWebhook(e.target.value)} className="premium-input mt-4 w-full px-3 py-2 text-sm" placeholder={t.settings.webhookUrl} />
          </div>
        </div>
        {testNotifyMsg && <p className="mt-5 rounded-2xl bg-white/62 p-3 text-sm font-medium text-slate-700" role="status">{testNotifyMsg}</p>}
        <p className="mt-5 text-xs text-slate-500">{t.settings.testNotificationsHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={handleSaveWebhooks} disabled={saving || testingNotify} className="premium-button-primary px-5 py-2.5 text-sm disabled:opacity-50">{saving ? t.common.loading : t.common.save}</button>
          <button type="button" onClick={handleTestNotifications} disabled={saving || testingNotify} className="premium-button-secondary px-5 py-2.5 text-sm disabled:opacity-50"><BellRing className="h-4 w-4" />{testingNotify ? t.common.loading : t.settings.testNotifications}</button>
        </div>
      </Panel>
    </div>
  );
}

// ─── Tab: Model Settings ───

function ModelSettings({ t }: { t: any }) {
  const [llmConfig, setLlmConfig] = useState<ProviderConfig>({ provider: 'mock', apiKey: '', baseUrl: '', model: '' });
  const [embeddingConfig, setEmbeddingConfig] = useState<ProviderConfig>({ provider: 'qwen', apiKey: '', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'text-embedding-v3' });
  const [llmTest, setLlmTest] = useState<TestResult | null>(null);
  const [embeddingTest, setEmbeddingTest] = useState<TestResult | null>(null);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testingEmbedding, setTestingEmbedding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<ModelConfigData>('/api/model-config')
      .then((data) => { if (data.llm) setLlmConfig(data.llm); if (data.embedding) setEmbeddingConfig(data.embedding); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleTestLlm = async () => {
    setTestingLlm(true); setLlmTest(null);
    try { const r = await apiPost<TestResult>('/api/model-config/test-llm', llmConfig); setLlmTest(r); }
    catch (e: any) { setLlmTest({ ok: false, message: e.message || t.modelConfig.testFailed }); }
    finally { setTestingLlm(false); }
  };
  const handleTestEmbedding = async () => {
    setTestingEmbedding(true); setEmbeddingTest(null);
    try { const r = await apiPost<TestResult>('/api/model-config/test-embedding', embeddingConfig); setEmbeddingTest(r); }
    catch (e: any) { setEmbeddingTest({ ok: false, message: e.message || t.modelConfig.testFailed }); }
    finally { setTestingEmbedding(false); }
  };
  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try { await apiPost('/api/model-config', { llm: llmConfig, embedding: embeddingConfig }); setSaveMsg(t.modelConfig.saveSuccess); }
    catch { setSaveMsg(t.modelConfig.saveFailed); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 4000); }
  };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <div>
      {saveMsg && <div className={`mb-4 rounded-full px-4 py-2 text-sm font-bold inline-block ${saveMsg.includes('失败') || saveMsg.includes('fail') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{saveMsg}</div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <ProviderForm label={t.modelConfig.llmConfig} config={llmConfig} onChange={setLlmConfig} testResult={llmTest} testing={testingLlm} onTest={handleTestLlm} t={t} />
        <ProviderForm label={t.modelConfig.embeddingConfig} config={embeddingConfig} onChange={setEmbeddingConfig} testResult={embeddingTest} testing={testingEmbedding} onTest={handleTestEmbedding} t={t} isEmbedding />
      </div>
      <div className="mt-6">
        <button type="button" onClick={handleSave} disabled={saving} className="premium-button-primary px-6 py-2.5 text-sm disabled:opacity-50">{saving ? t.common.loading : t.common.save}</button>
      </div>
    </div>
  );
}

// ─── Tab: Quick Reply ───

function QuickReplySettings({ t }: { t: any }) {
  const [templates, setTemplates] = useState<QuickReplyTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formShortcut, setFormShortcut] = useState('');
  const [batchText, setBatchText] = useState('');
  const [showBatch, setShowBatch] = useState(false);

  const fetchTemplates = () => {
    const params = new URLSearchParams({ page: '1', pageSize: '100' });
    if (categoryFilter) params.set('category', categoryFilter);
    if (searchQuery) params.set('search', searchQuery);
    apiGet<{ items: QuickReplyTemplate[] }>(`/api/admin/quick-replies?${params}`)
      .then((data) => setTemplates(data.items || []))
      .catch(console.error).finally(() => setLoading(false));
  };
  const fetchCategories = () => { apiGet<string[]>('/api/admin/quick-replies/categories').then(setCategories).catch(console.error); };

  useEffect(() => { fetchTemplates(); fetchCategories(); }, [categoryFilter]);

  const handleSave = async () => {
    if (!formContent.trim()) return;
    try {
      if (editingId) { await apiPatch(`/api/admin/quick-replies/${editingId}`, { content: formContent, category: formCategory, shortcut: formShortcut || null }); }
      else { await apiPost('/api/admin/quick-replies', { content: formContent, category: formCategory, shortcut: formShortcut || null }); }
      resetForm(); fetchTemplates(); fetchCategories();
    } catch { /* ignore */ }
  };
  const handleDelete = async (id: string) => { if (!confirm(t.common.confirm)) return; try { await apiDelete(`/api/admin/quick-replies/${id}`); fetchTemplates(); } catch { /* ignore */ } };
  const handleEdit = (tpl: QuickReplyTemplate) => { setEditingId(tpl.id); setFormContent(tpl.content); setFormCategory(tpl.category); setFormShortcut(tpl.shortcut || ''); setShowForm(true); };
  const handleBatchImport = async () => {
    if (!batchText.trim()) return;
    const items = batchText.split('\n').filter(Boolean).map((line) => { const p = line.split('|'); return { category: p[0]?.trim() || '通用', content: p[1]?.trim() || '', shortcut: p[2]?.trim() || null }; }).filter((i) => i.content);
    if (items.length === 0) return;
    try { await apiPost('/api/admin/quick-replies/batch', { items }); setShowBatch(false); setBatchText(''); fetchTemplates(); fetchCategories(); } catch { /* ignore */ }
  };
  const resetForm = () => { setShowForm(false); setEditingId(null); setFormContent(''); setFormCategory(''); setFormShortcut(''); };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <ActionButton onClick={() => { setShowBatch(!showBatch); setShowForm(false); }} variant="secondary" className="px-3 py-1.5 text-xs"><Copy className="h-3.5 w-3.5" /> {t.quickReply.batchImport}</ActionButton>
        <ActionButton onClick={() => { resetForm(); setShowForm(!showForm); setShowBatch(false); }} className="px-3 py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> {t.quickReply.addTemplate}</ActionButton>
      </div>

      {showBatch && (
        <Panel className="mb-4 p-4">
          <h3 className="mb-2 font-bold text-slate-900">{t.quickReply.batchImport}</h3>
          <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)} placeholder={t.quickReply.batchImportPlaceholder} rows={6} className="mb-3 w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm focus:border-blue-400 focus:outline-none" />
          <div className="flex gap-2">
            <ActionButton onClick={handleBatchImport}>{t.common.submit}</ActionButton>
            <ActionButton onClick={() => setShowBatch(false)} variant="secondary">{t.common.cancel}</ActionButton>
          </div>
        </Panel>
      )}

      {showForm && (
        <Panel className="mb-4 p-4">
          <h3 className="mb-3 font-bold text-slate-900">{editingId ? t.quickReply.editTemplate : t.quickReply.addTemplate}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">{t.quickReply.content}</label>
              <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder={t.quickReply.contentPlaceholder} rows={3} className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none" />
            </div>
            <div className="space-y-3">
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.quickReply.category}</label><input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder={t.quickReply.categoryPlaceholder} list="qr-category-list" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" /><datalist id="qr-category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">{t.quickReply.shortcut}</label><input value={formShortcut} onChange={(e) => setFormShortcut(e.target.value)} placeholder={t.quickReply.shortcutPlaceholder} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" /></div>
              <div className="flex gap-2"><ActionButton onClick={handleSave} className="flex-1">{t.common.save}</ActionButton><ActionButton onClick={resetForm} variant="secondary" className="flex-1">{t.common.cancel}</ActionButton></div>
            </div>
          </div>
        </Panel>
      )}

      <Panel className="mb-4 flex flex-wrap items-center gap-2 p-4">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t.quickReply.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchTemplates()} className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1">
          <Tag className="h-4 w-4 text-slate-400" />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium">
            <option value="">{t.quickReply.allCategories}</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </Panel>

      <Panel padded={false} className="premium-table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead><tr>
              <th className="px-6 py-4 text-left">{t.quickReply.category}</th>
              <th className="px-6 py-4 text-left">{t.quickReply.content}</th>
              <th className="px-6 py-4 text-left">{t.quickReply.shortcut}</th>
              <th className="px-6 py-4 text-left">{t.quickReply.usageCount}</th>
              <th className="px-6 py-4 text-right">{t.common.actions}</th>
            </tr></thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id}>
                  <td className="px-6 py-3"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{tpl.category}</span></td>
                  <td className="max-w-md truncate px-6 py-3 text-sm text-slate-700">{tpl.content}</td>
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">{tpl.shortcut || '-'}</td>
                  <td className="px-6 py-3 text-sm text-slate-500">{tpl.usageCount}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <ActionButton onClick={() => handleEdit(tpl)} variant="secondary" className="px-2 py-1 text-xs"><Edit3 className="h-3 w-3" /></ActionButton>
                      <ActionButton onClick={() => handleDelete(tpl.id)} variant="secondary" className="px-2 py-1 text-xs text-red-500"><Trash2 className="h-3 w-3" /></ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {templates.length === 0 && <div className="p-6"><EmptyState title={t.quickReply.noTemplates} /></div>}
      </Panel>
    </div>
  );
}

// ─── Tab: Unknown Questions ───

function UnknownQuestionsSettings({ t }: { t: any }) {
  const [questions, setQuestions] = useState<UnknownQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [faqAnswer, setFaqAnswer] = useState('');

  const fetchQuestions = () => {
    apiGet<{ items: UnknownQuestion[] }>('/api/admin/knowledge/unknown-questions?page=1&pageSize=50')
      .then((data) => setQuestions(data.items || []))
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchQuestions(); }, []);

  const handleResolve = async (id: string) => { await apiPatch(`/api/admin/unknown-questions/${id}/resolve`, { suggestion: t.unknownQuestions.resolveNote }); fetchQuestions(); };
  const handleConvertToFAQ = async (id: string) => {
    if (!faqAnswer.trim()) return;
    try { await apiPost(`/api/admin/knowledge/unknown-questions/${id}/convert-to-faq`, { answer: faqAnswer.trim() }); setConvertingId(null); setFaqAnswer(''); fetchQuestions(); } catch { /* ignore */ }
  };

  const statusLabels: Record<string, { label: string; tone: 'amber' | 'emerald' | 'slate' | 'blue' }> = {
    pending: { label: '待处理', tone: 'amber' },
    converted_to_faq: { label: '已转 FAQ', tone: 'emerald' },
    ignored: { label: '已忽略', tone: 'slate' },
    assigned: { label: '已分配', tone: 'blue' },
  };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <div className="space-y-4">
      {questions.map((q) => {
        const status = statusLabels[q.status] || { label: q.status, tone: 'slate' as const };
        return (
          <Panel key={q.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusPill tone={status.tone} pulse={q.status === 'pending'}>{status.label}</StatusPill>
                  {q.intent && <StatusPill tone="blue">意图: {q.intent}</StatusPill>}
                  <span className="text-xs font-semibold text-slate-500">{t.unknownQuestions.count}: {q.count}</span>
                  <span className="text-xs font-semibold text-slate-400">{t.unknownQuestions.time}: {new Date(q.lastSeenAt || q.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700"><HelpCircle className="h-5 w-5" /></div>
                  <div>
                    <p className="text-base font-black text-slate-950">{q.question}</p>
                    {q.failReason && <p className="mt-2 text-sm text-slate-500">{t.unknownQuestions.reason}: {q.failReason}</p>}
                    {q.suggestedAnswer && <p className="mt-2 text-sm font-semibold text-emerald-700">{t.unknownQuestions.solution}: {q.suggestedAnswer}</p>}
                    {q.suggestion && <p className="mt-1 text-sm font-semibold text-emerald-700">{t.unknownQuestions.solution}: {q.suggestion}</p>}
                  </div>
                </div>
                {convertingId === q.id && (
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <label className="mb-2 block text-sm font-bold text-slate-700">输入 FAQ 标准答案</label>
                    <textarea value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} rows={3} className="premium-textarea mb-3 w-full px-3 py-2 text-sm" placeholder="输入此问题的标准答案..." />
                    <div className="flex gap-2">
                      <ActionButton onClick={() => handleConvertToFAQ(q.id)} disabled={!faqAnswer.trim()} variant="success" className="px-3 py-1.5 text-xs"><Wand2 className="h-3.5 w-3.5" /> 确认转为 FAQ</ActionButton>
                      <ActionButton onClick={() => { setConvertingId(null); setFaqAnswer(''); }} variant="secondary" className="px-3 py-1.5 text-xs">{t.common.cancel}</ActionButton>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {q.status === 'pending' && !convertingId && (
                  <>
                    <ActionButton onClick={() => { setConvertingId(q.id); setFaqAnswer(''); }} variant="secondary" className="px-3 py-1.5 text-xs"><Lightbulb className="h-3.5 w-3.5" /> 转为 FAQ</ActionButton>
                    {!q.resolved && <ActionButton onClick={() => handleResolve(q.id)} className="px-3 py-1.5 text-xs">{t.unknownQuestions.markResolved}</ActionButton>}
                  </>
                )}
                {(q.status === 'converted_to_faq' || q.resolved) && <StatusPill tone="emerald" pulse>{t.unknownQuestions.resolved}</StatusPill>}
              </div>
            </div>
          </Panel>
        );
      })}
      {questions.length === 0 && <EmptyState title={t.common.noData} />}
    </div>
  );
}

// ─── Tab: Channel Integration ───

function ChannelSettings({ t }: { t: any }) {
  const searchParams = useSearchParams();

  // XHS state
  const [xhsAccounts, setXhsAccounts] = useState<XhsAccount[]>([]);
  const [xhsLoading, setXhsLoading] = useState(true);
  const [xhsCopied, setXhsCopied] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [oauthUrl, setOauthUrl] = useState('');
  const [generatingUrl, setGeneratingUrl] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Juguang state
  const [jgAccounts, setJgAccounts] = useState<JuguangAccount[]>([]);
  const [jgLoading, setJgLoading] = useState(true);
  const [jgShowForm, setJgShowForm] = useState(false);
  const [jgEditingId, setJgEditingId] = useState<string | null>(null);
  const [jgForm, setJgForm] = useState(createEmptyJuguangForm);
  const [jgCopied, setJgCopied] = useState(false);

  // XHS logic
  const xhsWebhookUrl = buildIntegrationWebhookUrl('/api/open/im/send');
  const loadXhsAccounts = useCallback(async () => {
    try { setXhsAccounts(await listXhsAccounts()); }
    catch (e) { console.error('Failed to load XHS accounts', e); }
    finally { setXhsLoading(false); }
  }, []);

  useEffect(() => { loadXhsAccounts(); }, [loadXhsAccounts]);

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (!oauth) return;
    if (oauth === 'success') { setToast({ type: 'success', msg: t.xiaohongshu.oauthSuccess }); loadXhsAccounts(); }
    else if (oauth === 'error') { setToast({ type: 'error', msg: searchParams.get('msg') || t.xiaohongshu.oauthError }); }
    const url = new URL(window.location.href);
    url.searchParams.delete('oauth'); url.searchParams.delete('msg'); url.searchParams.delete('accountId');
    window.history.replaceState({}, '', url.toString());
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [searchParams, t, loadXhsAccounts]);

  const handleXhsCopy = async () => { try { await navigator.clipboard.writeText(xhsWebhookUrl); setXhsCopied(true); setTimeout(() => setXhsCopied(false), 2000); } catch { /* ignore */ } };
  const openScanModal = async () => {
    setShowScanModal(true); setGeneratingUrl(true); setOauthUrl('');
    try { const data = await getXhsAuthUrl(); setOauthUrl(data.url); }
    catch (e: any) { setToast({ type: 'error', msg: e.message || t.xiaohongshu.oauthError }); setShowScanModal(false); }
    finally { setGeneratingUrl(false); }
  };
  const handleXhsDelete = async (id: string) => { if (!confirm(t.xiaohongshu.confirmDelete)) return; try { await removeXhsAccount(id); await loadXhsAccounts(); } catch { alert(t.xiaohongshu.deleteFailed); } };
  const accountTypeLabel = (type: string) => { if (type === 'kos') return t.xiaohongshu.kosType; if (type === 'personal') return t.xiaohongshu.personal; return t.xiaohongshu.enterprise; };

  // Juguang logic
  const jgWebhookUrl = buildIntegrationWebhookUrl('/api/webhooks/juguang');
  const jgFetchAccounts = useCallback(async () => { try { setJgAccounts(await listJuguangAccounts()); } catch { /* ignore */ } finally { setJgLoading(false); } }, []);
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
  const jgHandleEdit = (acc: JuguangAccount) => { setJgEditingId(acc.id); setJgForm(createJuguangFormFromAccount(acc)); setJgShowForm(true); };
  const jgHandleDelete = async (id: string) => { if (!confirm(t.juguang.confirmDelete)) return; try { await removeJuguangAccount(id); jgFetchAccounts(); } catch { /* ignore */ } };
  const jgHandleRefreshToken = async (id: string) => { try { await refreshJuguangAccountToken(id); jgFetchAccounts(); } catch { /* ignore */ } };
  const jgCopyUrl = () => { navigator.clipboard.writeText(jgWebhookUrl); setJgCopied(true); setTimeout(() => setJgCopied(false), 2000); };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ── XHS Section ── */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white"><BookOpen className="h-4 w-4" /></span>
            <h3 className="text-lg font-black tracking-tight text-slate-950">{t.xiaohongshu.title}</h3>
          </div>
          <button onClick={openScanModal} className="premium-button-primary px-5 py-2.5 text-sm"><QrCode className="h-4 w-4" />{t.xiaohongshu.scanToAdd}</button>
        </div>

        <Panel className="mb-4 p-4">
          <p className="text-xs font-semibold text-slate-500">{t.xiaohongshu.webhookHint}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-mono text-slate-700 break-all">{xhsWebhookUrl}</code>
            <button onClick={handleXhsCopy} className="premium-button-secondary px-4 py-2.5 text-sm shrink-0">
              {xhsCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {xhsCopied ? t.xiaohongshu.copied : t.xiaohongshu.copyUrl}
            </button>
          </div>
        </Panel>

        {xhsLoading ? <LoadingState label={t.common.loading} /> : xhsAccounts.length === 0 ? (
          <Panel className="p-12 text-center">
            <Smartphone className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm font-semibold text-slate-500">{t.xiaohongshu.noAccounts}</p>
          </Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {xhsAccounts.map((acc) => (
              <Panel key={acc.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-slate-950">{acc.nickName || acc.accountCode}</p>
                    <p className="mt-1 text-xs text-slate-500">{t.xiaohongshu.accountType}: {accountTypeLabel(acc.accountType)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${acc.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{acc.status === 'active' ? t.xiaohongshu.statusActive : t.xiaohongshu.statusDisabled}</span>
                </div>
                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <p><span className="font-bold">{t.xiaohongshu.userId}:</span> {acc.userId}</p>
                  <p><span className="font-bold">{t.xiaohongshu.appId}:</span> {acc.appId}</p>
                  <p><span className="font-bold">{t.xiaohongshu.accountCode}:</span> {acc.accountCode}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleXhsDelete(acc.id)} className="premium-button-secondary flex-1 px-3 py-2 text-xs text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />{t.common.delete}</button>
                </div>
              </Panel>
            ))}
          </div>
        )}

        {/* QR Scan Modal */}
        {showScanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="premium-card w-full max-w-md p-6">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-950">{t.xiaohongshu.scanTitle}</h3>
                <button onClick={() => setShowScanModal(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>
              <div className="mb-5 space-y-2 text-sm text-slate-600">
                <p>{t.xiaohongshu.scanStep1}</p><p>{t.xiaohongshu.scanStep2}</p><p>{t.xiaohongshu.scanStep3}</p><p>{t.xiaohongshu.scanStep4}</p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-6">
                {generatingUrl ? (
                  <div className="flex flex-col items-center gap-3 py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /><p className="text-sm text-slate-500">{t.xiaohongshu.generating}</p></div>
                ) : oauthUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(oauthUrl)}`} alt="XHS binding QR Code" width={240} height={240} className="rounded-2xl bg-white p-2 shadow-sm" />
                    <p className="text-xs text-slate-400 text-center max-w-xs">{t.xiaohongshu.scanHint}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-8"><QrCode className="h-8 w-8 text-slate-300" /><p className="text-sm text-slate-400">{t.xiaohongshu.needAppConfig}</p></div>
                )}
              </div>
              <div className="mt-5"><button onClick={() => setShowScanModal(false)} className="premium-button-secondary w-full px-5 py-2.5 text-sm">{t.common.close}</button></div>
            </div>
          </div>
        )}
      </div>

      {/* ── Juguang Section ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white"><Radio className="h-4 w-4" /></span>
            <h3 className="text-lg font-black tracking-tight text-slate-950">{t.juguang.title}</h3>
          </div>
          <button onClick={() => { setJgForm({ appId: '', appSecret: '', accountName: '', accessToken: '', refreshToken: '', autoReply: true }); setJgEditingId(null); setJgShowForm(true); }} className="premium-button-primary px-5 py-2.5 text-sm"><Plus className="h-4 w-4" />{t.juguang.addAccount}</button>
        </div>

        <Panel className="mb-4 p-4">
          <p className="text-xs font-semibold text-slate-500">{t.juguang.webhookHint}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-mono text-slate-700 break-all">{jgWebhookUrl}</code>
            <button onClick={jgCopyUrl} className="premium-button-secondary px-4 py-2.5 text-sm shrink-0">
              {jgCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </Panel>

        {jgShowForm && (
          <Panel className="mb-4 p-4">
            <h3 className="mb-3 font-bold text-slate-900">{jgEditingId ? t.juguang.editAccount : t.juguang.addAccount}</h3>
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
          </Panel>
        )}

        {jgLoading ? <LoadingState label={t.common.loading} /> : jgAccounts.length === 0 ? (
          <Panel className="p-12 text-center">
            <Radio className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm font-semibold text-slate-500">{t.juguang.noAccounts}</p>
          </Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {jgAccounts.map((acc) => (
              <Panel key={acc.id} className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">{acc.accountName || acc.appId}</h4>
                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${acc.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{acc.status === 'active' ? t.juguang.connected : t.juguang.disconnected}</span>
                </div>
                <p className="mb-1 truncate font-mono text-xs text-slate-500">App ID: {acc.appId}</p>
                <p className="mb-3 text-xs text-slate-400">{t.juguang.autoReply}: {acc.autoReply ? t.common.on : t.common.off}</p>
                {acc.tokenExpires && <p className="mb-3 text-[10px] text-slate-400">{t.juguang.tokenExpires}: {new Date(acc.tokenExpires).toLocaleDateString()}</p>}
                <div className="flex gap-2">
                  <ActionButton onClick={() => jgHandleEdit(acc)} variant="secondary" className="flex-1 px-2 py-1.5 text-xs"><Edit3 className="h-3 w-3" /></ActionButton>
                  <ActionButton onClick={() => jgHandleRefreshToken(acc.id)} variant="secondary" className="flex-1 px-2 py-1.5 text-xs"><RefreshCw className="h-3 w-3" /></ActionButton>
                  <ActionButton onClick={() => jgHandleDelete(acc.id)} variant="secondary" className="px-2 py-1.5 text-xs text-red-500"><Trash2 className="h-3 w-3" /></ActionButton>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Settings Page ───

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('basic');

  const tabs: { key: TabKey; label: string; icon: typeof Settings }[] = [
    { key: 'basic', label: t.settings.tabBasic, icon: Settings },
    { key: 'model', label: t.settings.tabModel, icon: BrainCircuit },
    { key: 'quickReply', label: t.settings.tabQuickReply, icon: Copy },
    { key: 'unknown', label: t.settings.tabUnknown, icon: HelpCircle },
    { key: 'channels', label: t.settings.tabChannels, icon: Radio },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="premium-kicker">System Settings</span>
          <h2 className="admin-page-title mt-3">{t.settings.title}</h2>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-slate-100 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'basic' && <BasicSettings t={t} />}
      {activeTab === 'model' && <ModelSettings t={t} />}
      {activeTab === 'quickReply' && <QuickReplySettings t={t} />}
      {activeTab === 'unknown' && <UnknownQuestionsSettings t={t} />}
      {activeTab === 'channels' && <ChannelSettings t={t} />}
    </div>
  );
}
