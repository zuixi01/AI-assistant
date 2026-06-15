'use client';

import { useEffect, useState } from 'react';
import { HelpCircle, Lightbulb, Wand2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { ActionButton, EmptyState, LoadingState, PageHeader, PageShell, Panel, StatusPill } from '@/components/ui/design-system';

interface UnknownQuestion {
  id: string;
  question: string;
  normalizedQuestion: string | null;
  scene: string | null;
  intent: string | null;
  count: number;
  failReason: string | null;
  status: string;
  suggestedAnswer: string | null;
  lastSeenAt: string | null;
  resolved: boolean;
  suggestion: string | null;
  createdAt: string;
}

export default function UnknownQuestionsPage() {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<UnknownQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [faqAnswer, setFaqAnswer] = useState('');

  const fetchQuestions = () => {
    apiGet<{ items: UnknownQuestion[] }>('/api/admin/knowledge/unknown-questions?page=1&pageSize=50')
      .then((data) => setQuestions(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleResolve = async (id: string) => {
    await apiPatch(`/api/admin/unknown-questions/${id}/resolve`, { suggestion: t.unknownQuestions.resolveNote });
    fetchQuestions();
  };

  const handleConvertToFAQ = async (id: string) => {
    if (!faqAnswer.trim()) return;
    try {
      await apiPost(`/api/admin/knowledge/unknown-questions/${id}/convert-to-faq`, { answer: faqAnswer.trim() });
      setConvertingId(null);
      setFaqAnswer('');
      fetchQuestions();
    } catch (e) {
      console.error('Convert to FAQ failed:', e);
    }
  };

  const statusLabels: Record<string, { label: string; tone: 'amber' | 'emerald' | 'slate' | 'blue' }> = {
    pending: { label: '待处理', tone: 'amber' },
    converted_to_faq: { label: '已转 FAQ', tone: 'emerald' },
    ignored: { label: '已忽略', tone: 'slate' },
    assigned: { label: '已分配', tone: 'blue' },
  };

  if (loading) return <LoadingState label={t.common.loading} />;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Knowledge gap loop"
        title={t.unknownQuestions.title}
        description="AI 无法回答的问题会沉淀到这里，客服可补充标准答案并转成 FAQ，持续提高知识库命中率。"
      />

      <div className="space-y-4">
        {questions.map((q) => {
          const status = statusLabels[q.status] || { label: q.status, tone: 'slate' as const };
          return (
            <Panel key={q.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusPill tone={status.tone} pulse={q.status === 'pending'}>{status.label}</StatusPill>
                    {q.intent ? <StatusPill tone="blue">意图: {q.intent}</StatusPill> : null}
                    <span className="text-xs font-semibold text-slate-500">{t.unknownQuestions.count}: {q.count}</span>
                    <span className="text-xs font-semibold text-slate-400">
                      {t.unknownQuestions.time}: {new Date(q.lastSeenAt || q.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-950">{q.question}</p>
                      {q.failReason ? <p className="mt-2 text-sm text-slate-500">{t.unknownQuestions.reason}: {q.failReason}</p> : null}
                      {q.suggestedAnswer ? <p className="mt-2 text-sm font-semibold text-emerald-700">{t.unknownQuestions.solution}: {q.suggestedAnswer}</p> : null}
                      {q.suggestion ? <p className="mt-1 text-sm font-semibold text-emerald-700">{t.unknownQuestions.solution}: {q.suggestion}</p> : null}
                    </div>
                  </div>

                  {convertingId === q.id ? (
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <label className="mb-2 block text-sm font-bold text-slate-700">输入 FAQ 标准答案</label>
                      <textarea
                        value={faqAnswer}
                        onChange={(e) => setFaqAnswer(e.target.value)}
                        rows={3}
                        className="premium-textarea mb-3 w-full px-3 py-2 text-sm"
                        placeholder="输入此问题的标准答案..."
                      />
                      <div className="flex gap-2">
                        <ActionButton onClick={() => handleConvertToFAQ(q.id)} disabled={!faqAnswer.trim()} variant="success" className="px-3 py-1.5 text-xs">
                          <Wand2 className="h-3.5 w-3.5" />
                          确认转为 FAQ
                        </ActionButton>
                        <ActionButton onClick={() => { setConvertingId(null); setFaqAnswer(''); }} variant="secondary" className="px-3 py-1.5 text-xs">
                          {t.common.cancel}
                        </ActionButton>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {q.status === 'pending' && !convertingId ? (
                    <>
                      <ActionButton onClick={() => { setConvertingId(q.id); setFaqAnswer(''); }} variant="secondary" className="px-3 py-1.5 text-xs">
                        <Lightbulb className="h-3.5 w-3.5" />
                        转为 FAQ
                      </ActionButton>
                      {!q.resolved ? (
                        <ActionButton onClick={() => handleResolve(q.id)} className="px-3 py-1.5 text-xs">
                          {t.unknownQuestions.markResolved}
                        </ActionButton>
                      ) : null}
                    </>
                  ) : null}
                  {(q.status === 'converted_to_faq' || q.resolved) ? (
                    <StatusPill tone="emerald" pulse>{t.unknownQuestions.resolved}</StatusPill>
                  ) : null}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {questions.length === 0 ? <EmptyState title={t.common.noData} /> : null}
    </PageShell>
  );
}
