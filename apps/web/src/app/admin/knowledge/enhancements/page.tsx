'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { apiPost, apiGet } from '@/lib/api';
import { ActionButton, PageHeader, PageShell, Panel } from '@/components/ui/design-system';
import { Upload, BrainCircuit, Search, FileText } from 'lucide-react';

export default function KnowledgeEnhancementsPage() {
  const { t } = useTranslation();
  const [batchText, setBatchText] = useState('');
  const [learnDays, setLearnDays] = useState(7);
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleBatchImport = async () => {
    if (!batchText.trim()) return;
    setLoading(true);
    try {
      const lines = batchText.split('\n').filter(Boolean);
      const items = lines.map(line => {
        const [question, answer] = line.split('\t');
        return { question: question?.trim(), answer: answer?.trim() };
      }).filter(i => i.question && i.answer);

      const res = await apiPost<{ count: number }>('/api/admin/knowledge/batch-import', { items });
      setImportResult(`${res.count} items imported`);
      setBatchText('');
    } catch (e) {
      setImportResult('Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLearnFromChat = async () => {
    setLoading(true);
    try {
      const res = await apiPost<{ count: number }>('/api/admin/knowledge/learn-from-chat', { days: learnDays });
      setImportResult(`Learned ${res.count} Q&A pairs from chat`);
    } catch (e) {
      setImportResult('Learning failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordTest = async () => {
    if (!testQuery.trim()) return;
    setLoading(true);
    try {
      const res = await apiGet<{ matches: any[] }>(`/api/admin/knowledge/test?query=${encodeURIComponent(testQuery)}`);
      setTestResults(res.matches || []);
    } catch (e) {
      setTestResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImportJuguangTemplates = async () => {
    setLoading(true);
    try {
      const res = await apiPost<{ count: number }>('/api/admin/knowledge/juguang-templates');
      setImportResult(`Imported ${res.count} Juguang templates`);
    } catch (e) {
      setImportResult('Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader eyebrow="Knowledge Base" title="Knowledge Enhancements" description="Advanced tools for knowledge management" />

      {importResult && (
        <div className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {importResult}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Panel className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-600"><Upload className="h-5 w-5" /></div>
            <div><h3 className="font-bold text-slate-900">{t.knowledgeEnhanced.batchImport}</h3><p className="text-xs text-slate-500">{t.knowledgeEnhanced.batchImportDesc}</p></div>
          </div>
          <textarea value={batchText} onChange={e => setBatchText(e.target.value)} placeholder={t.knowledgeEnhanced.batchImportPlaceholder} rows={4} className="mb-3 w-full resize-none rounded-xl border border-slate-200 px-4 py-2 font-mono text-xs" />
          <ActionButton onClick={handleBatchImport} disabled={loading}>{t.common.submit}</ActionButton>
        </Panel>

        <Panel className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100 text-purple-600"><BrainCircuit className="h-5 w-5" /></div>
            <div><h3 className="font-bold text-slate-900">{t.knowledgeEnhanced.learnFromChat}</h3><p className="text-xs text-slate-500">{t.knowledgeEnhanced.learnFromChatDesc}</p></div>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <label className="text-sm font-medium">{t.knowledgeEnhanced.learnDays}</label>
            <input type="number" value={learnDays} onChange={e => setLearnDays(Number(e.target.value))} min={1} max={30} className="w-20 rounded-lg border px-2 py-1 text-sm" />
          </div>
          <ActionButton onClick={handleLearnFromChat} disabled={loading}>{t.common.submit}</ActionButton>
        </Panel>

        <Panel className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-600"><Search className="h-5 w-5" /></div>
            <div><h3 className="font-bold text-slate-900">{t.knowledgeEnhanced.keywordTest}</h3><p className="text-xs text-slate-500">{t.knowledgeEnhanced.keywordTestDesc}</p></div>
          </div>
          <div className="mb-3 flex gap-2">
            <input value={testQuery} onChange={e => setTestQuery(e.target.value)} placeholder={t.knowledgeEnhanced.testQueryPlaceholder} className="flex-1 rounded-xl border px-3 py-2 text-sm" />
            <ActionButton onClick={handleKeywordTest} disabled={loading}>{t.common.search}</ActionButton>
          </div>
          {testResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {testResults.map((r, i) => <div key={i} className="rounded-lg bg-slate-50 p-3 text-xs"><p className="font-bold">{r.question}</p><p className="mt-1 text-slate-600">{r.answer}</p><p className="mt-1 text-slate-400">Score: {r.score}</p></div>)}
            </div>
          )}
        </Panel>

        <Panel className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-600"><FileText className="h-5 w-5" /></div>
            <div><h3 className="font-bold text-slate-900">{t.knowledgeEnhanced.juguangTemplates}</h3><p className="text-xs text-slate-500">{t.knowledgeEnhanced.juguangTemplatesDesc}</p></div>
          </div>
          <ActionButton onClick={handleImportJuguangTemplates} disabled={loading}>{t.knowledgeEnhanced.importTemplates}</ActionButton>
        </Panel>
      </div>
    </PageShell>
  );
}
