'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Power, RefreshCcw, Search, Trash2, UploadCloud } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { ActionButton, EmptyState, LoadingState, PageHeader, PageShell, Panel, StatusPill } from '@/components/ui/design-system';

interface KnowledgeSource {
  id: string;
  title: string;
  type: string;
  category: string | null;
  status: string;
  parseStatus: string;
  indexStatus: string;
  fileName: string | null;
  fileType: string | null;
  priority: number;
  createdAt: string;
  _count: { chunks: number };
}

function apiErrorMessage(data: unknown): string {
  const payload = data instanceof ApiError ? data.payload : data;
  if (!payload || typeof payload !== 'object') return data instanceof Error ? data.message : '';
  const msg = (payload as { message?: string | string[] }).message;
  if (Array.isArray(msg)) return msg.join('; ');
  if (typeof msg === 'string') return msg;
  return '';
}

function statusConfig(status: string): { label: string; tone: 'slate' | 'amber' | 'blue' | 'emerald' | 'rose' } {
  const config: Record<string, { label: string; tone: 'slate' | 'amber' | 'blue' | 'emerald' | 'rose' }> = {
    pending: { label: '待处理', tone: 'slate' },
    processing: { label: '处理中', tone: 'amber' },
    indexing: { label: '索引中', tone: 'blue' },
    completed: { label: '完成', tone: 'emerald' },
    ready: { label: '就绪', tone: 'emerald' },
    failed: { label: '失败', tone: 'rose' },
    error: { label: '错误', tone: 'rose' },
  };
  return config[status] || { label: status, tone: 'slate' };
}

export default function KnowledgePage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [reindexFeedback, setReindexFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchSources = () => {
    apiGet<{ items?: KnowledgeSource[] }>('/api/admin/knowledge?page=1&pageSize=50')
      .then((data) => setSources(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const resetCreateForm = () => {
    setShowCreate(false);
    setNewTitle('');
    setNewContent('');
    setNewCategory('');
    setUploadFile(null);
    setSubmitError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = async () => {
    if (!uploadFile && (!newTitle.trim() || !newContent.trim())) {
      setSubmitError(t.knowledge.manualFieldsRequired);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      if (uploadFile) {
        const fd = new FormData();
        fd.append('file', uploadFile);
        if (newTitle.trim()) fd.append('title', newTitle.trim());
        if (newCategory.trim()) fd.append('category', newCategory.trim());
        if (newContent.trim()) fd.append('extraText', newContent.trim());
        await apiPost('/api/admin/knowledge/upload', fd);
      } else {
        await apiPost('/api/admin/knowledge', {
          title: newTitle.trim(),
          type: 'faq',
          category: newCategory.trim() || undefined,
          rawText: newContent.trim(),
        });
      }

      resetCreateForm();
      fetchSources();
    } catch (err) {
      setSubmitError(apiErrorMessage(err) || (uploadFile ? t.knowledge.uploadFailed : t.common.error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.knowledge.confirmDelete)) return;
    await apiDelete(`/api/admin/knowledge/${id}`);
    fetchSources();
  };

  const handleReindex = async (id: string) => {
    setReindexingId(id);
    setReindexFeedback(null);
    try {
      const data = await apiPost<{ message?: string }>(`/api/admin/knowledge/${id}/reindex`);
      const msg = typeof data.message === 'string' ? data.message : t.knowledge.reindexQueued;
      setReindexFeedback({ ok: true, text: msg });
    } catch (err) {
      setReindexFeedback({ ok: false, text: apiErrorMessage(err) || t.knowledge.reindexFailed });
    } finally {
      setReindexingId(null);
      fetchSources();
      setTimeout(() => setReindexFeedback(null), 6000);
    }
  };

  const handleToggleStatus = async (id: string) => {
    await apiPatch(`/api/admin/knowledge/${id}/toggle-status`);
    fetchSources();
  };

  const typeLabels: Record<string, string> = {
    faq: t.knowledge.typeFaq,
    document: t.knowledge.typeDocument,
    url: t.knowledge.typeUrl,
    manual: t.knowledge.typeManual,
  };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Knowledge operations"
        title={t.knowledge.title}
        description="上传文档、维护 FAQ、追踪解析和索引状态，保证 AI 回复基于企业真实资料。"
        actions={
          <>
            <Link href="/admin/knowledge/test-retrieval" className="premium-button-secondary px-4 py-2 text-sm">
              <Search className="h-4 w-4" />
              {t.knowledge.retrievalTest}
            </Link>
            <ActionButton type="button" onClick={() => { setShowCreate(true); setSubmitError(''); }}>
              <Plus className="h-4 w-4" />
              {t.knowledge.addKnowledge}
            </ActionButton>
          </>
        }
      />

      {reindexFeedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            reindexFeedback.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
          role="status"
        >
          {reindexFeedback.text}
        </div>
      ) : null}

      {showCreate ? (
        <Panel>
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-950">{t.knowledge.newSource}</h3>
              <p className="text-xs text-slate-500">文件解析后会进入知识切片和索引流程</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">{t.knowledge.titleLabel}</label>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="premium-input w-full px-3 py-2.5 text-sm" placeholder={t.knowledge.placeholderTitle} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">{t.knowledge.categoryLabel}</label>
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="premium-input w-full px-3 py-2.5 text-sm" placeholder={t.knowledge.placeholderCategory} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">{t.knowledge.fileUploadLabel}</label>
              <p className="mb-2 text-xs text-slate-500">{t.knowledge.fileUploadHint}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx,.ppt,.xlsx,.xls,.csv,.md,.markdown,.txt,.png,.jpg,.jpeg,.gif,.webp,.bmp,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/markdown,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="block w-full max-w-xl text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-slate-800"
              />
              {uploadFile ? (
                <button
                  type="button"
                  onClick={() => {
                    setUploadFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="mt-2 text-sm font-bold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
                >
                  {t.common.reset}
                </button>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">{t.knowledge.contentLabel}</label>
              {uploadFile ? <p className="mb-2 text-xs text-slate-500">{t.knowledge.extraTextHint}</p> : null}
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={8} className="premium-textarea w-full px-3 py-2.5 text-sm" placeholder={t.knowledge.placeholderContent} />
            </div>
            {submitError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{submitError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <ActionButton type="button" onClick={handleCreate} disabled={submitting}>{submitting ? t.knowledge.uploading : t.common.create}</ActionButton>
              <ActionButton type="button" onClick={resetCreateForm} disabled={submitting} variant="secondary">{t.common.cancel}</ActionButton>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel padded={false} className="premium-table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left">{t.knowledge.titleLabel}</th>
                <th className="px-6 py-4 text-left">{t.knowledge.typeLabel}</th>
                <th className="px-6 py-4 text-left">{t.knowledge.categoryLabel}</th>
                <th className="px-6 py-4 text-left">{t.knowledge.chunkCount}</th>
                <th className="px-6 py-4 text-left">解析</th>
                <th className="px-6 py-4 text-left">索引</th>
                <th className="px-6 py-4 text-left">{t.knowledge.statusLabel}</th>
                <th className="px-6 py-4 text-left">{t.knowledge.actions}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => {
                const parse = statusConfig(source.parseStatus);
                const index = statusConfig(source.indexStatus);
                return (
                  <tr key={source.id}>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="font-black text-slate-950">{source.title}</span>
                          {source.fileName ? <span className="block text-xs text-slate-400">{source.fileName}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{typeLabels[source.type] || source.type}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{source.category || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link href={`/admin/knowledge/${source.id}/chunks`} className="font-bold text-blue-700 hover:underline">
                        {source._count.chunks}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm"><StatusPill tone={parse.tone}>{parse.label}</StatusPill></td>
                    <td className="px-6 py-4 text-sm"><StatusPill tone={index.tone}>{index.label}</StatusPill></td>
                    <td className="px-6 py-4 text-sm">
                      <StatusPill tone={source.status === 'active' ? 'emerald' : source.status === 'disabled' ? 'slate' : 'rose'} pulse={source.status === 'active'}>
                        {source.status === 'active' ? t.common.enabled : source.status === 'disabled' ? t.common.disabled : source.status}
                      </StatusPill>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-3">
                        <Link href={`/admin/knowledge/${source.id}/chunks`} className="font-bold text-slate-700 hover:text-blue-700">查看切片</Link>
                        <button type="button" onClick={() => handleReindex(source.id)} disabled={reindexingId === source.id} className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-blue-700 disabled:cursor-wait disabled:opacity-50">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          {reindexingId === source.id ? '索引中...' : t.knowledge.reindex}
                        </button>
                        <button type="button" onClick={() => handleToggleStatus(source.id)} className="inline-flex items-center gap-1 font-bold text-amber-700 hover:text-amber-900">
                          <Power className="h-3.5 w-3.5" />
                          {source.status === 'active' ? '禁用' : '启用'}
                        </button>
                        <button type="button" onClick={() => handleDelete(source.id)} className="inline-flex items-center gap-1 font-bold text-rose-600 hover:text-rose-800">
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.common.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sources.length === 0 ? <div className="p-6"><EmptyState title={t.common.noData} /></div> : null}
      </Panel>
    </PageShell>
  );
}
