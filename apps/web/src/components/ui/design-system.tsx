'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate' | 'cyan';

const toneMap: Record<Tone, string> = {
  blue: 'from-blue-500 to-cyan-400 text-blue-700 bg-blue-50 ring-blue-200',
  emerald: 'from-emerald-500 to-teal-400 text-emerald-700 bg-emerald-50 ring-emerald-200',
  amber: 'from-amber-500 to-orange-400 text-amber-700 bg-amber-50 ring-amber-200',
  rose: 'from-rose-500 to-pink-400 text-rose-700 bg-rose-50 ring-rose-200',
  violet: 'from-violet-500 to-fuchsia-400 text-violet-700 bg-violet-50 ring-violet-200',
  slate: 'from-slate-700 to-slate-500 text-slate-700 bg-slate-100 ring-slate-200',
  cyan: 'from-cyan-500 to-sky-400 text-cyan-700 bg-cyan-50 ring-cyan-200',
};

const pillMap: Record<Tone, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
};

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('reveal space-y-6', className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-slate-200/60 backdrop-blur">
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-64 rounded-full bg-blue-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        'interactive-card overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-xl shadow-slate-200/60 backdrop-blur',
        padded && 'p-5 sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  total,
  tone = 'blue',
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  total?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <Panel className="group relative min-h-[150px] p-5">
      <div className={cn('absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-20 blur-2xl', toneMap[tone])} />
      <div className="relative flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {icon ? (
            <div className={cn('grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-110', toneMap[tone])}>
              {icon}
            </div>
          ) : null}
        </div>
        <div>
          <p className="text-3xl font-black tracking-tight text-slate-950">{value}</p>
          {total !== undefined ? <p className="mt-1 text-xs font-medium text-slate-400">{total}</p> : null}
        </div>
      </div>
    </Panel>
  );
}

export function StatusPill({
  children,
  tone = 'slate',
  pulse = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', pillMap[tone], className)}>
      {pulse ? <span className="status-dot" /> : null}
      {children}
    </span>
  );
}

export function ProgressMeter({ value, tone = 'blue' }: { value: number; tone?: Tone }) {
  const bounded = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out', toneMap[tone])}
        style={{ width: `${bounded}%` }}
      />
    </div>
  );
}

export function EmptyState({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

export function LoadingState({ label = '加载中...' }: { label?: ReactNode }) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="rounded-full border border-white/70 bg-white/85 px-5 py-3 text-sm font-semibold text-slate-600 shadow-xl shadow-slate-200/70 backdrop-blur">
        <span className="mr-3 inline-flex gap-1 align-middle">
          <span className="typing-dot" />
          <span className="typing-dot [animation-delay:120ms]" />
          <span className="typing-dot [animation-delay:240ms]" />
        </span>
        {label}
      </div>
    </div>
  );
}

export function ActionLink({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition duration-300',
        variant === 'primary'
          ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 hover:bg-blue-700'
          : 'border border-slate-200 bg-white/80 text-slate-700 hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function ActionButton({
  children,
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success';
}) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition duration-300 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-slate-950 text-white shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 hover:bg-blue-700',
        variant === 'secondary' && 'border border-slate-200 bg-white/80 text-slate-700 hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700',
        variant === 'danger' && 'bg-rose-600 text-white shadow-lg shadow-rose-500/20 hover:-translate-y-0.5 hover:bg-rose-700',
        variant === 'warning' && 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 hover:bg-amber-600',
        variant === 'success' && 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 hover:bg-emerald-700',
        className,
      )}
    >
      {children}
    </button>
  );
}
