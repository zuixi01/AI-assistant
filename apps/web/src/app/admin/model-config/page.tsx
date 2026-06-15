'use client';

import { useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle2, Loader2, PlugZap, XCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiPost } from '@/lib/api';

interface ProviderConfig { provider: string; apiKey: string; baseUrl: string; model: string; }
interface ModelConfig { llm: ProviderConfig; embedding: ProviderConfig; }
interface TestResult { ok: boolean; message: string; latencyMs?: number; }

const PRESETS: Record<string, { baseUrl: string; llmModel: string; embeddingModel: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', llmModel: 'deepseek-chat', embeddingModel: 'text-embedding-v3' },
  openai: { baseUrl: 'https://api.openai.com/v1', llmModel: 'gpt-4o-mini', embeddingModel: 'text-embedding-3-small' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', llmModel: 'qwen-turbo', embeddingModel: 'text-embedding-v3' },
  mock: { baseUrl: '', llmModel: 'mock', embeddingModel: 'mock' },
};

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
    <section className="premium-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white">
          <BrainCircuit className="h-5 w-5" />
        </span>
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
    </section>
  );
}


export default function ModelConfigPage() {
  const { t } = useTranslation();
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
    apiGet<ModelConfig>('/api/model-config')
      .then((data) => { if (data.llm) setLlmConfig(data.llm); if (data.embedding) setEmbeddingConfig(data.embedding); })
      .catch(console.error)
      .finally(() => setLoading(false));
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

  if (loading) return <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">{t.common.loading}</div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="premium-kicker">AI Model</span>
          <h2 className="admin-page-title mt-3">{t.modelConfig.title}</h2>
          <p className="mt-2 text-sm text-slate-500">{t.modelConfig.subtitle}</p>
        </div>
        {saveMsg && <span className={`rounded-full px-4 py-2 text-sm font-bold ${saveMsg.includes('失败') || saveMsg.includes('fail') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{saveMsg}</span>}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <ProviderForm label={t.modelConfig.llmConfig} config={llmConfig} onChange={setLlmConfig} testResult={llmTest} testing={testingLlm} onTest={handleTestLlm} t={t} />
        <ProviderForm label={t.modelConfig.embeddingConfig} config={embeddingConfig} onChange={setEmbeddingConfig} testResult={embeddingTest} testing={testingEmbedding} onTest={handleTestEmbedding} t={t} isEmbedding />
      </div>
      <div className="mt-6 flex items-center gap-4">
        <button type="button" onClick={handleSave} disabled={saving || (!llmConfig.provider && !embeddingConfig.provider)} className="premium-button-primary px-6 py-2.5 text-sm disabled:opacity-50">
          {saving ? t.common.loading : t.common.save}
        </button>
      </div>
    </div>
  );
}
