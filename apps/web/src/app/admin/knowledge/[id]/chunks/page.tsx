'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Hash, Pencil, Power } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiPatch } from '@/lib/api';
import { ActionButton, EmptyState, LoadingState, PageHeader, PageShell, Panel, StatusPill } from '@/components/ui/design-system';
import { cn } from '@/lib/cn';

interface Chunk {
  id: string;
  title: string | null;
  titlePath: string[] | null;
  content: string;
  contentType: string;
  q: string | null;
  a: string | null;
  summary: string | null;
  keywords: string[] | null;
  keywordText: string | null;
  pageNumber: number | null;
  sheetName: string | null;
  rowNumber: number | null;
  chunkIndex: number;
  tokenCount: number | null;
  priority: number;
  status: string;
  hitCount: number;
  lastHitAt: string | null;
}

interface SourceInfo {
  id: string;
  title: string;
  type: string;
  parseStatus: string;
  indexStatus: string;
  _count: { chunks: number };
}

export default function ChunksPage() {
  const { t } = useTranslation();
  const params = useParams();
  const sourceId = params.id as string;
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editingChunk, setEditingChunk] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);
  const prevSourceIdRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    setLoadError('');

    let fetchPage = page;
    if (prevSourceIdRef.current !== sourceId) {
      prevSourceIdRef.current = sourceId;
      fetchPage = 1;
      if (page !== 1) setPage(1);
    }

    try {
      const [srcData, chunkData] = await Promise.all([
        apiGet<SourceInfo>(`/api/admin/knowledge/${sourceId}`),
        apiGet<{ items?: Chunk[]; total?: number }>(`/api/admin/knowledge/${sourceId}/chunks?page=${fetchPage}&pageSize=20`),
      ]);

      setSource(srcData);
      setChunks(chunkData.items || []);
      setTotal(chunkData.total || 0);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '网络异常，请稍后重试');
      setChunks([]);
    } finally {
      setLoading(false);
    }
  }, [sourceId, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveChunk = async (chunkId: string) => {
    await apiPatch(`/api/admin/knowledge/chunks/${chunkId}`, { content: editContent });
    setEditingChunk(null);
    void loadData();
  };

  const handleToggleChunkStatus = async (chunkId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    await apiPatch(`/api/admin/knowledge/chunks/${chunkId}`, { status: newStatus });
    void loadData();
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Knowledge chunks"
        title={`切片管理 · ${source?.title || '...'}`}
        description="查看文档解析后的知识切片，按命中、页码、关键词与状态判断是否需要编辑或停用。"
        actions={
          <Link href="/admin/knowledge" className="premium-button-secondary px-4 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            {t.common.back}
          </Link>
        }
      />

      {loadError ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{loadError}</div> : null}

      {source ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            ['总切片数', source._count.chunks],
            ['解析状态', source.parseStatus],
            ['索引状态', source.indexStatus],
            ['类型', source.type],
          ].map(([label, value]) => (
            <Panel key={label as string}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{label as string}</p>
              <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
            </Panel>
          ))}
        </div>
      ) : null}

      {loading ? (
        <LoadingState label={t.common.loading} />
      ) : (
        <div className="space-y-4">
          {chunks.map((chunk) => (
            <Panel key={chunk.id} className={cn(chunk.status === 'disabled' && 'opacity-60')}>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="slate">
                    <Hash className="h-3.5 w-3.5" />
                    {chunk.chunkIndex}
                  </StatusPill>
                  {chunk.title ? <span className="text-sm font-black text-slate-950">{chunk.title}</span> : null}
                  {chunk.titlePath && chunk.titlePath.length > 0 ? (
                    <span className="text-xs font-medium text-slate-400">{chunk.titlePath.join(' > ')}</span>
                  ) : null}
                  {chunk.contentType !== 'text' ? <StatusPill tone="blue">{chunk.contentType}</StatusPill> : null}
                  <StatusPill tone={chunk.status === 'active' ? 'emerald' : 'slate'} pulse={chunk.status === 'active'}>
                    {chunk.status}
                  </StatusPill>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  {chunk.pageNumber ? <span>P{chunk.pageNumber}</span> : null}
                  {chunk.sheetName ? <span>Sheet: {chunk.sheetName}</span> : null}
                  {chunk.tokenCount ? <span>{chunk.tokenCount} tokens</span> : null}
                  <span>命中: {chunk.hitCount}</span>
                </div>
              </div>

              {editingChunk === chunk.id ? (
                <div>
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6} className="premium-textarea mb-3 w-full px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <ActionButton type="button" onClick={() => handleSaveChunk(chunk.id)} className="px-3 py-1.5 text-xs">{t.common.save}</ActionButton>
                    <ActionButton type="button" onClick={() => setEditingChunk(null)} variant="secondary" className="px-3 py-1.5 text-xs">{t.common.cancel}</ActionButton>
                  </div>
                </div>
              ) : (
                <div>
                  <div className={cn('rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700', expandedChunk === chunk.id ? '' : 'max-h-32 overflow-hidden')}>
                    {chunk.content}
                  </div>
                  {chunk.content.length > 200 ? (
                    <button type="button" onClick={() => setExpandedChunk(expandedChunk === chunk.id ? null : chunk.id)} className="mt-2 text-xs font-bold text-blue-700 hover:underline">
                      {expandedChunk === chunk.id ? '收起' : '展开全部'}
                    </button>
                  ) : null}
                  {chunk.q ? <p className="mt-3 text-xs text-slate-500"><span className="font-bold text-slate-700">Q:</span> {chunk.q}</p> : null}
                  {chunk.a ? <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">A:</span> {chunk.a}</p> : null}
                  {chunk.keywords && chunk.keywords.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {chunk.keywords.map((kw, i) => (
                        <StatusPill key={i} tone="blue">{kw}</StatusPill>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => { setEditingChunk(chunk.id); setEditContent(chunk.content); }} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">
                  <Pencil className="h-3.5 w-3.5" />
                  {t.common.edit}
                </button>
                <button type="button" onClick={() => handleToggleChunkStatus(chunk.id, chunk.status)} className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline">
                  <Power className="h-3.5 w-3.5" />
                  {chunk.status === 'active' ? '禁用' : '启用'}
                </button>
              </div>
            </Panel>
          ))}

          {chunks.length === 0 && !loadError ? <EmptyState title={t.common.noData} /> : null}

          {totalPages > 1 ? (
            <div className="flex justify-center gap-2 pt-2">
              <ActionButton type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} variant="secondary">{t.common.back}</ActionButton>
              <span className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-bold text-slate-600">{page} / {totalPages}</span>
              <ActionButton type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} variant="secondary">下一页</ActionButton>
            </div>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
