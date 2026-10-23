"use client";

import * as React from "react";
import {
  ChevronDown,
  CircleCheck,
  CircleSlash,
  CircleX,
  Clock3,
  DatabaseZap,
  FileCode2,
  FileSearch,
  Globe2,
  LoaderCircle,
  SquareTerminal,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { TOOL_STATUS_META } from "@/lib/platform";
import type { ToolCallState } from "@/lib/timeline";
import { cn, formatDuration, safeJson, tryParseJson } from "@/lib/utils";

const TOOL_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /query_action/i, icon: DatabaseZap },
  { match: /web|search|browse/i, icon: Globe2 },
  { match: /bash|shell|exec/i, icon: SquareTerminal },
  { match: /write|edit|patch/i, icon: FileCode2 },
  { match: /read|file|fs/i, icon: FileSearch },
];

function toolIcon(name: string): LucideIcon {
  return TOOL_ICONS.find((entry) => entry.match.test(name))?.icon ?? Wrench;
}

function statusIcon(status: ToolCallState["status"]) {
  switch (status) {
    case "succeeded":
      return CircleCheck;
    case "failed":
      return CircleX;
    case "denied":
      return CircleSlash;
    case "skipped":
      return CircleSlash;
    default:
      return LoaderCircle;
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
  const StatusIcon = statusIcon(call.status);
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
        "group relative overflow-hidden rounded-[15px] border bg-[#0b0b11]/80 transition-colors duration-300",
        active
          ? "border-cyan-300/20 shadow-[0_0_0_1px_rgba(103,232,249,0.03),0_14px_40px_-24px_rgba(34,211,238,0.5)]"
          : call.status === "failed"
            ? "border-rose-400/18"
            : "border-white/[0.07] hover:border-white/[0.11]",
      )}
    >
      {active ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(103,232,249,0.65),transparent)]" />
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.018]"
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
            active
              ? "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200"
              : call.status === "failed"
                ? "border-rose-400/20 bg-rose-400/[0.08] text-rose-300"
                : "border-white/[0.07] bg-white/[0.035] text-mist-400",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-mono text-[12px] font-medium tracking-[-0.01em] text-mist-200">
              {call.name}
            </span>
            {call.attempt && call.attempt > 1 ? (
              <span className="rounded border border-white/[0.08] px-1 font-mono text-[8.5px] text-mist-600">
                try {call.attempt}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[9.5px] text-mist-600">
            <span className={meta.text}>{meta.label}</span>
            <span className="text-mist-700">·</span>
            <Clock3 className="h-2.5 w-2.5" />
            <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
            {active ? <span className="text-cyan-300/70">executing…</span> : null}
          </span>
        </span>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium",
            meta.chip,
          )}
        >
          <StatusIcon className={cn("h-2.5 w-2.5", active && "animate-spin")} />
          {meta.label}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-mist-600 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="space-y-2 border-t border-white/[0.055] px-3 py-2.5 animate-fade-in">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-mist-600">入参</span>
              {args ? <CopyButton value={args} label="复制" /> : null}
            </div>
            {args ? (
              <pre className="max-h-52 overflow-auto rounded-lg border border-white/[0.055] bg-black/35 p-2.5 font-mono text-[10.5px] leading-[1.65] text-mist-400">
                {args}
              </pre>
            ) : (
              <div className="rounded-lg border border-dashed border-white/[0.06] px-2.5 py-2 text-[10.5px] text-mist-700">
                无参数
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-mist-600">返回</span>
              {result ? <CopyButton value={result} label="复制" /> : null}
            </div>
            {call.error ? (
              <div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.06] p-2.5 text-[10.5px] leading-relaxed text-rose-200">
                <span className="font-mono text-[9.5px] text-rose-300/80">{call.error.code}</span>
                <div className="mt-0.5">{call.error.message}</div>
              </div>
            ) : result ? (
              <pre
                className={cn(
                  "max-h-52 overflow-auto rounded-lg border border-white/[0.055] bg-black/35 p-2.5 font-mono text-[10.5px] leading-[1.65]",
                  call.status === "failed" ? "text-rose-200/85" : "text-mist-400",
                )}
              >
                {result}
              </pre>
            ) : active ? (
              <div className="flex items-center gap-2 rounded-lg border border-cyan-300/10 bg-cyan-300/[0.035] px-2.5 py-2 text-[10.5px] text-cyan-200/70">
                <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-300" />
                等待工具返回…
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/[0.06] px-2.5 py-2 text-[10.5px] text-mist-700">
                无返回内容
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
