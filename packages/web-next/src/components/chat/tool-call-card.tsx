"use client";

import * as React from "react";
import {
  ChevronDown,
  Clock3,
  DatabaseZap,
  FileCode2,
  FileSearch,
  Globe2,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import {
  SpineRunningIcon,
  SpineSuccessIcon,
  SpineErrorIcon,
  SpineApprovalIcon,
  HashlineCodeIcon,
} from "@/components/icons/zen-icons";
import { CopyButton } from "@/components/ui/copy-button";
import { TOOL_STATUS_META } from "@/lib/platform";
import type { ToolCallState } from "@/lib/timeline";
import { cn, formatDuration, safeJson, tryParseJson } from "@/lib/utils";

type IconComponent = React.ComponentType<{ size?: number | string; className?: string }>;

const TOOL_ICONS: { match: RegExp; icon: IconComponent }[] = [
  { match: /^hash_/i, icon: HashlineCodeIcon },
  { match: /query_action/i, icon: DatabaseZap },
  { match: /web|search|browse/i, icon: Globe2 },
  { match: /bash|shell|exec/i, icon: SquareTerminal },
  { match: /write|edit|patch/i, icon: FileCode2 },
  { match: /read|file|fs/i, icon: FileSearch },
];

function toolIcon(name: string): IconComponent {
  return TOOL_ICONS.find((entry) => entry.match.test(name))?.icon ?? Wrench;
}

function StatusSpine({ status }: { status: ToolCallState["status"] }) {
  switch (status) {
    case "succeeded":
    case "succeeded":
      return <SpineSuccessIcon size={14} className="text-emerald-600 dark:text-emerald-400" />;
    case "failed":
      return <SpineErrorIcon size={14} className="text-rose-600 dark:text-rose-400" />;
    case "denied":
      return <SpineApprovalIcon size={14} className="text-amber-600 dark:text-amber-400" />;
    case "skipped":
      return <SpineApprovalIcon size={14} className="text-[var(--text-dim)]" />;
    default:
      return <SpineRunningIcon size={14} className="text-cyan-600 dark:text-cyan-400 animate-spin" />;
  }
}

function pretty(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = tryParseJson(value);
  return safeJson(parsed);
}

export function ToolCallCard({ call, createdAt }: { call: ToolCallState; createdAt: number }) {
  const active = call.status === "requested" || call.status === "running";
  const [open, setOpen] = React.useState(active || call.status === "failed");
  const [now, setNow] = React.useState(() => Date.now());
  const Icon = toolIcon(call.name);
  const meta = TOOL_STATUS_META[call.status] ?? TOOL_STATUS_META.running;

  React.useEffect(() => {
    if (!active) return;
    setOpen(true);
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [active]);

  const started = call.startedAt ?? createdAt;
  const duration = call.completedAt
    ? call.completedAt - started
    : active
      ? now - started
      : undefined;
  const args = pretty(call.argsPreview);
  const result = pretty(call.resultPreview);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border transition-colors duration-200",
        active
          ? "border-cyan-500/30 bg-cyan-500/[0.04] shadow-[0_0_20px_-8px_rgba(6,182,212,0.3)]"
          : call.status === "failed"
            ? "border-rose-500/30 bg-rose-500/[0.04]"
            : "border-[var(--border)] bg-[var(--bg-panel)] shadow-xs hover:border-[var(--accent)]/40",
      )}
    >
      {active ? (
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.7),transparent)]" />
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
            active
              ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
              : call.status === "failed"
                ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                : "border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-muted)]",
          )}
        >
          <Icon className="h-3 w-3" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[12px] font-semibold tracking-tight text-[var(--text)]">
              {call.name}
            </span>
            {call.name.startsWith("hash_") ? (
              <span className="rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-1 font-mono text-[8.5px] text-[var(--accent)]">
                hashline
              </span>
            ) : null}
            {call.attempt && call.attempt > 1 ? (
              <span className="rounded border border-[var(--border)] px-1 font-mono text-[8px] text-[var(--text-dim)]">
                try {call.attempt}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-mono">
            <Clock3 className="h-2.5 w-2.5 text-[var(--text-dim)]" />
            <span className="tabular-nums">{formatDuration(duration)}</span>
            {active ? <span className="text-cyan-600 dark:text-cyan-400 font-sans animate-pulse ml-1">· 执行中…</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono",
              meta.chip,
            )}
          >
            <StatusSpine status={call.status} />
            {meta.label}
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-[var(--text-dim)] transition-transform duration-200", open && "rotate-180")}
          />
        </div>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-[var(--border)] px-3 py-2.5 bg-[var(--bg)] animate-fade-in">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-[var(--text-dim)]">入参</span>
              {args ? <CopyButton value={args} label="复制" /> : null}
            </div>
            {args ? (
              <pre className="max-h-48 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-2 font-mono text-[10.5px] leading-[1.65] text-[var(--text)]">
                {args}
              </pre>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1.5 text-[10px] text-[var(--text-dim)]">
                无参数
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-[var(--text-dim)]">返回</span>
              {result ? <CopyButton value={result} label="复制" /> : null}
            </div>
            {call.error ? (
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-2 text-[10.5px] leading-relaxed text-rose-700 dark:text-rose-300">
                <span className="font-mono text-[9px] text-rose-600 dark:text-rose-400 font-bold">{call.error.code}</span>
                <div className="mt-0.5">{call.error.message}</div>
              </div>
            ) : result ? (
              <pre
                className={cn(
                  "max-h-52 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-2 font-mono text-[10.5px] leading-[1.65] text-[var(--text)]",
                  call.status === "failed" && "text-rose-700 dark:text-rose-300",
                )}
              >
                {result}
              </pre>
            ) : active ? (
              <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] text-cyan-700 dark:text-cyan-300 font-mono">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
                等待工具返回…
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1.5 text-[10px] text-[var(--text-dim)] font-mono">
                无返回内容
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
