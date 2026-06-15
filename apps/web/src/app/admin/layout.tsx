'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  BrainCircuit,
  Home,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Settings,
  Sparkles,
  UsersRound,
  BarChart3,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiPost } from '@/lib/api';
import { cn } from '@/lib/cn';

interface AdminProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const { t } = useTranslation();

  const navItems = [
    { href: '/admin/dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { href: '/admin/conversations', label: t.nav.conversations, icon: MessageSquareText },
    { href: '/admin/leads', label: t.nav.leads, icon: UsersRound },
    { href: '/admin/analytics', label: t.nav.analytics, icon: BarChart3 },
    { href: '/admin/knowledge', label: t.nav.knowledge, icon: BrainCircuit },
    { href: '/admin/settings', label: t.nav.settings, icon: Settings },
  ];

  useEffect(() => {
    setMounted(true);
    if (pathname === '/admin/login') return;
    if (admin) return;

    apiGet<AdminProfile>('/api/auth/me')
      .then((data) => {
        if (data?.id) setAdmin(data);
      })
      .catch(() => router.push('/admin/login'));
  }, [pathname, router, admin]);

  const handleLogout = async () => {
    await apiPost('/api/auth/logout');
    router.push('/admin/login');
  };

  if (!mounted) return null;
  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <div className="admin-workbench-root flex min-h-screen">
      <aside className="admin-workbench-sidebar sticky top-0 hidden h-screen w-[288px] shrink-0 flex-col lg:flex">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-3 px-2">
            <div className="grid h-11 w-11 place-items-center rounded-[18px] bg-white text-blue-600 shadow-lg shadow-blue-200/70 ring-1 ring-blue-100">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-950">美洽 AI</h1>
              <p className="text-xs font-semibold text-blue-500">智能客服管理后台</p>
            </div>
          </div>
          <Link href="/" className="mt-5 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-blue-600">
            <Home className="h-4 w-4" />
            {t.nav.backToHome}
          </Link>
        </div>

        <nav className="soft-scrollbar flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'admin-workbench-nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-semibold',
                  active ? 'admin-workbench-nav-item-active' : 'text-slate-600',
                )}
              >
                <span className="admin-workbench-nav-icon">
                  <Icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4">
          <div className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-xl shadow-blue-200/30">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-cyan-100 text-sm font-black text-blue-700 ring-1 ring-white">
                {admin?.name?.[0] || admin?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{admin?.name || admin?.email || 'Admin'}</p>
                <p className="truncate text-xs text-slate-500">{admin?.role || 'admin'}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/80 hover:text-slate-800"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-300/60">
              <Sparkles className="mr-2 inline h-3.5 w-3.5" />
              AI 正在协助分流、接待与复核会话
            </div>
          </div>
        </div>
      </aside>

      <main className="premium-admin-main">
        <div className="mx-auto w-full max-w-[1640px] p-3 sm:p-4 lg:p-5">{children}</div>
      </main>
    </div>
  );
}
