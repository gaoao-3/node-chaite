"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function BoardPage({
  icon,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-[0.16]" />
      <header className="glass relative z-10 flex h-[68px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 sm:px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/18 bg-gradient-to-br from-violet-400/[0.12] to-cyan-300/[0.04] text-violet-200">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-mist-100">{title}</h1>
            <span className="hidden rounded-full border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 text-[8.5px] font-medium uppercase tracking-[0.14em] text-mist-500 sm:inline">
              {eyebrow}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-mist-600">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </header>
      <div className="relative min-h-0 flex-1 overflow-y-auto px-3.5 pb-10 pt-5 sm:px-7 sm:pt-6">
        <div className="mx-auto w-full max-w-[1120px] space-y-4">{children}</div>
      </div>
    </main>
  );
}

export function SectionCard({
  title,
  hint,
  action,
  className,
  children,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("panel overflow-hidden rounded-[18px]", className)}>
      <div className="flex items-center gap-2 border-b border-white/[0.055] px-4 py-3">
        <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-mist-200">{title}</h2>
        {hint ? <span className="text-[9.5px] text-mist-600">{hint}</span> : null}
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  accent = "violet",
  footer,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  accent?: "violet" | "cyan" | "emerald" | "amber" | "rose";
  footer?: React.ReactNode;
}) {
  const accents = {
    violet: "border-violet-300/18 bg-violet-400/[0.08] text-violet-200",
    cyan: "border-cyan-300/18 bg-cyan-300/[0.08] text-cyan-200",
    emerald: "border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-200",
    amber: "border-amber-300/18 bg-amber-300/[0.08] text-amber-200",
    rose: "border-rose-400/18 bg-rose-400/[0.08] text-rose-300",
  } as const;

  return (
    <div className="panel group relative overflow-hidden rounded-[16px] px-3.5 py-3.5 transition-colors hover:border-white/[0.1]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/[0.02] blur-2xl" />
      <div className="flex items-center gap-2">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg border", accents[accent])}>
          {icon}
        </span>
        <span className="text-[9.5px] font-medium uppercase tracking-[0.13em] text-mist-500">{label}</span>
      </div>
      <div className="mt-2.5 text-[24px] font-semibold leading-none tracking-[-0.04em] text-mist-100 tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-[9.5px] leading-relaxed text-mist-600">{hint}</div> : null}
      {footer}
    </div>
  );
}

export function EmptyPanel({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.075] px-5 py-9 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-mist-500">
        {icon}
      </div>
      <div className="mt-2.5 text-[12px] font-medium text-mist-300">{title}</div>
      <p className="mt-1 max-w-sm text-[10.5px] leading-relaxed text-mist-600">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
