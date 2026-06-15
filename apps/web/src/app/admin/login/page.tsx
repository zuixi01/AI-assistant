'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiPost } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiPost('/api/auth/login', { email, password });
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="premium-page flex min-h-screen items-center justify-center px-4 py-10">
      <div className="premium-container grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="reveal hidden lg:block">
          <div className="premium-kicker mb-6">
            <Sparkles className="h-4 w-4" />
            Admin cockpit
          </div>
          <h1 className="premium-title max-w-xl text-5xl font-black leading-tight">
            统一管理会话、线索、知识库与人工协同。
          </h1>
          <p className="premium-muted mt-5 max-w-lg text-base leading-7">
            为客服主管、销售和运营团队提供清晰的业务视图，让 AI 接待和人工跟进保持同一个节奏。
          </p>
          <div className="mt-8 grid max-w-lg gap-3">
            {['HttpOnly Cookie 安全登录', '多租户后台权限隔离', '实时线索与会话状态同步'].map((item) => (
              <div key={item} className="premium-panel flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="premium-card reveal mx-auto w-full max-w-md p-7 [animation-delay:120ms]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-slate-950 text-white shadow-2xl shadow-slate-900/25">
              <Bot className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{t.login.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{t.login.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                {t.login.email}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="premium-input block w-full px-10 py-3 text-sm"
                  placeholder={t.login.placeholderEmail}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                {t.login.password}
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="premium-input block w-full px-10 py-3 text-sm"
                  placeholder={t.login.placeholderPassword}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="premium-button-primary w-full px-4 py-3 text-sm disabled:opacity-50">
              {loading ? t.login.submitting : t.login.submit}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
