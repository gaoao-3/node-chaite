"use client";

import * as React from "react";
import { ArrowLeft, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export function BoardPage({
  icon,
  eyebrow,
  title,
  description,
  actions,
  onMenu,
  onBack,
  children,
}: {
  icon?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  onMenu?: () => void;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      {/* 44px Slim Header matching ChatHeader */}
      <header className="relative z-10 flex h-[44px] shrink-0 items-center justify-between border-b border-white/[0.06] bg-[var(--bg)] px-2.5 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="返回"
              title="返回"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-mist-400 hover:bg-white/[0.06] hover:text-mist-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : onMenu ? (
            <button
              type="button"
              onClick={onMenu}
              aria-label="切换侧栏"
              title="切换侧栏"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-mist-400 hover:bg-white/[0.06] hover:text-mist-100 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : null}

          {icon ? <span className="text-mist-400">{icon}</span> : null}

          <div className="flex items-center gap-2 min-w-0">
            <h1 className="truncate text-[13px] font-semibold text-mist-100">{title}</h1>
            {eyebrow ? (
              <span className="hidden rounded bg-black/20 border border-white/[0.06] px-1 py-px font-mono text-[8.5px] uppercase text-mist-500 sm:inline">
                {eyebrow}
              </span>
            ) : null}
          </div>
        </div>

        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </header>

      {/* Clean Centered Content Area */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-3.5 pb-12 pt-4 sm:px-6">
        <div className="mx-auto w-full max-w-[760px] space-y-4">
          {description ? (
            <p className="text-[12px] text-mist-500 leading-relaxed">{description}</p>
          ) : null}
          {children}
        </div>
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
    <section className={cn("rounded-xl border border-white/[0.06] bg-[var(--bg-panel)] overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[12.5px] font-semibold text-mist-100">{title}</h2>
          {hint ? <span className="text-[10px] text-mist-500 font-mono">{hint}</span> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-3.5 sm:p-4">{children}</div>
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
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[var(--bg-panel)] p-3.5 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-mist-400">{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-mist-500">{label}</span>
      </div>
      <div className="mt-2 text-[20px] font-semibold leading-none text-mist-100 tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1 text-[10px] text-mist-500">{hint}</div> : null}
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
      <div className="text-mist-500 mb-2">{icon}</div>
      <div className="text-[12px] font-medium text-mist-300">{title}</div>
      <p className="mt-0.5 max-w-xs text-[11px] text-mist-500 leading-relaxed">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
