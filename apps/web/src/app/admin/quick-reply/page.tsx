'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { ActionButton, EmptyState, LoadingState, PageHeader, PageShell, Panel } from '@/components/ui/design-system';
import { Plus, Trash2, Edit3, Search, Copy, Tag } from 'lucide-react';

interface QuickReplyTemplate {
  id: string;
  content: string;
  category: string;
  shortcut: string | null;
  usageCount: number;
  createdAt: string;
}

export default function QuickReplyPage() {
  const { t } = useTranslation();
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
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchCategories = () => {
    apiGet<string[]>('/api/admin/quick-replies/categories')
      .then(setCategories)
      .catch(console.error);
  };

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, [categoryFilter]);

  const handleSave = async () => {
    if (!formContent.trim()) return;
    try {
      if (editingId) {
        await apiPatch(`/api/admin/quick-replies/${editingId}`, { content: formContent, category: formCategory, shortcut: formShortcut || null });
      } else {
        await apiPost('/api/admin/quick-replies', { content: formContent, category: formCategory, shortcut: formShortcut || null });
      }
      resetForm();
      fetchTemplates();
      fetchCategories();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.common.confirm)) return;
    try {
      await apiDelete(`/api/admin/quick-replies/${id}`);
      fetchTemplates();
    } catch { /* ignore */ }
  };

  const handleEdit = (tpl: QuickReplyTemplate) => {
    setEditingId(tpl.id);
    setFormContent(tpl.content);
    setFormCategory(tpl.category);
    setFormShortcut(tpl.shortcut || '');
    setShowForm(true);
  };

  const handleUse = async (id: string) => {
    try {
      await apiPost(`/api/admin/quick-replies/${id}/use`);
      fetchTemplates();
    } catch { /* ignore */ }
  };

  const handleBatchImport = async () => {
    if (!batchText.trim()) return;
    const lines = batchText.split('\n').filter(Boolean);
    const items = lines.map((line) => {
      const parts = line.split('|');
      return { category: parts[0]?.trim() || '通用', content: parts[1]?.trim() || '', shortcut: parts[2]?.trim() || null };
    }).filter((i) => i.content);
    if (items.length === 0) return;
    try {
      await apiPost('/api/admin/quick-replies/batch', { items });
      setShowBatch(false);
      setBatchText('');
      fetchTemplates();
      fetchCategories();
    } catch { /* ignore */ }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormContent('');
    setFormCategory('');
    setFormShortcut('');
  };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Reply templates"
        title={t.quickReply.title}
        description={t.quickReply.subtitle}
        actions={
          <div className="flex gap-2">
            <ActionButton onClick={() => { setShowBatch(!showBatch); setShowForm(false); }} variant="secondary" className="px-3 py-1.5 text-xs">
              <Copy className="h-3.5 w-3.5" /> {t.quickReply.batchImport}
            </ActionButton>
            <ActionButton onClick={() => { resetForm(); setShowForm(!showForm); setShowBatch(false); }} className="px-3 py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> {t.quickReply.addTemplate}
            </ActionButton>
          </div>
        }
      />

      {showBatch && (
        <Panel>
          <h3 className="mb-2 font-bold text-slate-900">{t.quickReply.batchImport}</h3>
          <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)} placeholder={t.quickReply.batchImportPlaceholder} rows={6} className="mb-3 w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm focus:border-blue-400 focus:outline-none" />
          <div className="flex gap-2">
            <ActionButton onClick={handleBatchImport}>{t.common.submit}</ActionButton>
            <ActionButton onClick={() => setShowBatch(false)} variant="secondary">{t.common.cancel}</ActionButton>
          </div>
        </Panel>
      )}

      {showForm && (
        <Panel>
          <h3 className="mb-3 font-bold text-slate-900">{editingId ? t.quickReply.editTemplate : t.quickReply.addTemplate}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">{t.quickReply.content}</label>
              <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder={t.quickReply.contentPlaceholder} rows={3} className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">{t.quickReply.category}</label>
                <input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder={t.quickReply.categoryPlaceholder} list="category-list" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
                <datalist id="category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">{t.quickReply.shortcut}</label>
                <input value={formShortcut} onChange={(e) => setFormShortcut(e.target.value)} placeholder={t.quickReply.shortcutPlaceholder} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <ActionButton onClick={handleSave} className="flex-1">{t.common.save}</ActionButton>
                <ActionButton onClick={resetForm} variant="secondary" className="flex-1">{t.common.cancel}</ActionButton>
              </div>
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
            <thead>
              <tr>
                <th className="px-6 py-4 text-left">{t.quickReply.category}</th>
                <th className="px-6 py-4 text-left">{t.quickReply.content}</th>
                <th className="px-6 py-4 text-left">{t.quickReply.shortcut}</th>
                <th className="px-6 py-4 text-left">{t.quickReply.usageCount}</th>
                <th className="px-6 py-4 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id}>
                  <td className="px-6 py-3"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{tpl.category}</span></td>
                  <td className="max-w-md truncate px-6 py-3 text-sm text-slate-700">{tpl.content}</td>
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">{tpl.shortcut || '-'}</td>
                  <td className="px-6 py-3 text-sm text-slate-500">{tpl.usageCount}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <ActionButton onClick={() => handleUse(tpl.id)} variant="secondary" className="px-2 py-1 text-xs"><Copy className="h-3 w-3" /></ActionButton>
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
    </PageShell>
  );
}
