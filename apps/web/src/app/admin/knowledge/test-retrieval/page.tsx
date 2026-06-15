'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BrainCircuit, Search } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet } from '@/lib/api';
import { ActionButton, EmptyState, PageHeader, PageShell, Panel, ProgressMeter, StatusPill } from '@/components/ui/design-system';

interface RetrievalChunk {
  chunkId?: string;
  content?: string;
  score?: number;
  finalScore?: number;
  vectorScore?: number;
  keywordScore?: number;
  sourceTitle?: string;
  title?: string;
  titlePath?: string[];
  pageNumber?: number;
  contentType?: string;
}

function num(v: number | undefined | null, digits = 4): string {
  const n = typeof v === 'number' && !Number.isNaN(v) ? v : 0;
  return n.toFixed(digits);
}

interface RetrievalResponse {
  query: string;
  method: string;
  results: RetrievalChunk[];
}

export default function TestRetrievalPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState('hybrid');
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<RetrievalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTest = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const data = await apiGet<RetrievalResponse>(
        `/api/admin/knowledge/test-retrieval?query=${encodeURIComponent(query)}&method=${method}&topK=${topK}`,
      );
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="RAG lab"
        title="检索测试"
        description="用真实问题测试知识库召回结果，观察混合检索、语义检索、关键词检索和全文检索的命中质量。"
        actions={
          <Link href="/admin/knowledge" className="premium-button-secondary px-4 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            {t.common.back}
          </Link>
        }
      />

      <Panel>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">测试问题</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              className="premium-input w-full px-3 py-2.5 text-sm"
              placeholder="输入要测试的查询，例如：售后退款流程是什么？"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">检索方法</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="premium-select w-full px-3 py-2.5 text-sm">
              <option value="hybrid">混合检索</option>
              <option value="semantic">语义检索</option>
              <option value="keyword">关键词检索</option>
              <option value="fulltext">全文检索</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">返回数量</label>
            <select value={topK} onChange={(e) => setTopK(Number(e.target.value))} className="premium-select w-full px-3 py-2.5 text-sm">
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
          <ActionButton onClick={handleTest} disabled={loading || !query.trim()} className="h-11">
            <Search className="h-4 w-4" />
            {loading ? '检索中...' : '开始测试'}
          </ActionButton>
        </div>
      </Panel>

      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      {results ? (
        <div className="space-y-4">
          <Panel className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-950">查询：{results.query}</p>
              <p className="mt-1 text-xs text-slate-500">方法：{results.method} · 命中：{results.results.length} 条</p>
            </div>
            <StatusPill tone={results.results.length > 0 ? 'emerald' : 'amber'} pulse={results.results.length > 0}>
              {results.results.length > 0 ? '已命中' : '无结果'}
            </StatusPill>
          </Panel>

          {results.results.map((r, i) => {
            const combined = Number(r.finalScore ?? r.score ?? 0);
            const hasSplit = r.vectorScore != null || r.keywordScore != null;
            return (
              <Panel key={r.chunkId || `row-${i}`}>
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">#{i + 1}</span>
                    {r.sourceTitle ? <StatusPill tone="blue">《{r.sourceTitle}》</StatusPill> : null}
                    {r.titlePath && r.titlePath.length > 0 ? <span className="text-xs font-medium text-slate-400">{r.titlePath.join(' > ')}</span> : null}
                    {r.pageNumber ? <StatusPill tone="slate">第 {r.pageNumber} 页</StatusPill> : null}
                    {r.contentType && r.contentType !== 'text' ? <StatusPill tone="cyan">{r.contentType}</StatusPill> : null}
                  </div>
                  <div className="min-w-[220px] rounded-2xl bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>综合分</span>
                      <span className={combined >= 0.78 ? 'text-emerald-600' : combined >= 0.6 ? 'text-amber-600' : 'text-rose-600'}>
                        {num(combined)}
                      </span>
                    </div>
                    <ProgressMeter value={combined * 100} tone={combined >= 0.78 ? 'emerald' : combined >= 0.6 ? 'amber' : 'rose'} />
                    <p className="mt-2 text-xs text-slate-400">
                      {hasSplit ? `向量: ${num(r.vectorScore)} | 关键词: ${num(r.keywordScore)}` : `相似度: ${num(r.score ?? combined)}`}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                  {r.content ?? ''}
                </div>
              </Panel>
            );
          })}

          {results.results.length === 0 ? <EmptyState title="未找到相关知识切片" /> : null}
        </div>
      ) : (
        <Panel className="text-center">
          <BrainCircuit className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-bold text-slate-700">输入一个客户问题，测试知识库召回效果。</p>
        </Panel>
      )}
    </PageShell>
  );
}
