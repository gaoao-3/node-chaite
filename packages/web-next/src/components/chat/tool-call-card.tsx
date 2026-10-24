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
      return <SpineSuccessIcon size={14} className="text-emerald-400" />;
    case "failed":
      return <SpineErrorIcon size={14} className="text-rose-400" />;
    case "denied":
      return <SpineApprovalIcon size={14} className="text-amber-400" />;
    case "skipped":
      return <SpineApprovalIcon size={14} className="text-mist-500" />;
    default:
      return <SpineRunningIcon size={14} className="text-cyan-400" />;
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
          ? "border-cyan-400/25 bg-cyan-500/[0.035] shadow-[0_0_20px_-8px_rgba(6,182,212,0.3)]"
          : call.status === "failed"
            ? "border-rose-400/20 bg-rose-500/[0.03]"
            : "border-white/[0.055] bg-white/[0.015] hover:border-white/[0.1] hover:bg-white/[0.025]",
      )}
    >
      {active ? (
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.7),transparent)]" />
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
            active
              ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-300"
              : call.status === "failed"
                ? "border-rose-400/25 bg-rose-500/10 text-rose-300"
                : "border-white/[0.07] bg-white/[0.03] text-mist-400",
          )}
        >
          <Icon className="h-3 w-3" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[11.5px] font-medium tracking-tight text-mist-200">
              {call.name}
            </span>
            {call.name.startsWith("hash_") ? (
              <span className="rounded border border-accent/20 bg-accent/10 px-1 font-mono text-[8.5px] text-accent">
                hashline
              </span>
            ) : null}
            {call.attempt && call.attempt > 1 ? (
              <span className="rounded border border-white/[0.08] px-1 font-mono text-[8px] text-mist-600">
                try {call.attempt}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-mist-600">
            <span className={meta.text}>{meta.label}</span>
            <span className="text-mist-700">·</span>
            <Clock3 className="h-2.5 w-2.5" />
            <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
            {active ? <span className="text-cyan-300/80 animate-pulse">executing…</span> : null}
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
            className={cn("h-3.5 w-3.5 shrink-0 text-mist-600 transition-transform duration-200", open && "rotate-180")}
          />
        </div>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-white/[0.04] px-3 py-2.5 animate-fade-in">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-mist-600">入参</span>
              {args ? <CopyButton value={args} label="复制" /> : null}
            </div>
            {args ? (
              <pre className="max-h-48 overflow-auto rounded-lg border border-white/[0.055] bg-black/35 p-2 font-mono text-[10.5px] leading-[1.65] text-mist-400">
                {args}
              </pre>
            ) : (
              <div className="rounded-lg border border-dashed border-white/[0.06] px-2.5 py-1.5 text-[10px] text-mist-700">
                无参数
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-mist-600">返回</span>
              {result ? <CopyButton value={result} label="复制" /> : null}
            </div>
            {call.error ? (
              <div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.06] p-2 text-[10.5px] leading-relaxed text-rose-200">
                <span className="font-mono text-[9px] text-rose-300/80">{call.error.code}</span>
                <div className="mt-0.5">{call.error.message}</div>
              </div>
            ) : result ? (
              <pre
                className={cn(
                  "max-h-52 overflow-auto rounded-lg border border-white/[0.055] bg-black/35 p-2 font-mono text-[10.5px] leading-[1.65]",
                  call.status === "failed" ? "text-rose-200/85" : "text-mist-400",
                )}
              >
                {result}
              </pre>
            ) : active ? (
              <div className="flex items-center gap-2 rounded-lg border border-cyan-300/10 bg-cyan-300/[0.035] px-2.5 py-1.5 text-[10px] text-cyan-200/70">
                <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-300" />
                等待工具返回…
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/[0.06] px-2.5 py-1.5 text-[10px] text-mist-700">
                无返回内容
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
