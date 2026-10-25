"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  DatabaseZap,
  FileCode2,
  FileSearch,
  Globe2,
  ListTree,
  SquareTerminal,
  Wrench,
  X,
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

export function getToolIcon(name: string): IconComponent {
  return TOOL_ICONS.find((entry) => entry.match.test(name))?.icon ?? Wrench;
}

export function StatusSpine({ status }: { status: ToolCallState["status"] }) {
  switch (status) {
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

export interface ToolItemProps {
  id: string;
  createdAt: number;
  call: ToolCallState;
  index?: number;
}

/**
 * 单个工具详细行（支持独立展开入参与出参）
 */
export function ToolDetailItem({ item }: { item: ToolItemProps }) {
  const call = item.call;
  const active = call.status === "requested" || call.status === "running";
  const [open, setOpen] = React.useState(active || call.status === "failed");
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [active]);

  const started = call.startedAt ?? item.createdAt;
  const duration = call.completedAt
    ? call.completedAt - started
    : active
      ? now - started
      : undefined;

  const args = pretty(call.argsPreview);
  const result = pretty(call.resultPreview);
  const Icon = getToolIcon(call.name);
  const meta = TOOL_STATUS_META[call.status] ?? TOOL_STATUS_META.running;

  return (
    <div className="rounded-[7px] border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.04)] overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        {item.index !== undefined ? (
          <span className="font-mono text-[10px] text-[var(--text-dim)] w-4 text-center shrink-0">
            {item.index}
          </span>
        ) : null}

        <span className="truncate font-mono text-[11px] font-semibold text-[#16a34a]">
          {call.name}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--text-dim)]">
          {call.argsPreview}
        </span>

        {call.name.startsWith("hash_") ? (
          <span className="rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-1 font-mono text-[8.5px] text-[var(--accent)]">
            hashline
          </span>
        ) : null}

        <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--text-muted)] ml-auto shrink-0">
          <Clock3 className="h-2.5 w-2.5 text-[var(--text-dim)]" />
          <span className="tabular-nums">{formatDuration(duration)}</span>
        </span>

        <span
          className="inline-flex items-center gap-1 text-[10px] font-mono shrink-0 ml-1.5 text-[var(--text-dim)]"
        >
          <StatusSpine status={call.status} />
          {meta.label}
        </span>

        <ChevronDown
          className={cn(
            "h-3 w-3 text-[var(--text-dim)] transition-transform duration-200 shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="border-t border-[var(--border)] p-2.5 space-y-2 bg-[var(--bg)] text-[11px] animate-fade-in">
          {args ? (
            <div>
              <div className="mb-1 flex items-center justify-between text-[9px] font-mono text-[var(--text-dim)] uppercase">
                <span>入参 (Arguments)</span>
                <CopyButton value={args} label="复制" />
              </div>
              <pre className="max-h-40 overflow-auto rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-2 font-mono text-[10.5px] text-[var(--text)] leading-relaxed">
                {args}
              </pre>
            </div>
          ) : null}

          <div>
            <div className="mb-1 flex items-center justify-between text-[9px] font-mono text-[var(--text-dim)] uppercase">
              <span>返回结果 (Result)</span>
              {result ? <CopyButton value={result} label="复制" /> : null}
            </div>
            {call.error ? (
              <div className="rounded-md border border-rose-500/25 bg-rose-500/10 p-2 text-rose-700 dark:text-rose-300 font-mono text-[10.5px]">
                {call.error.code ? <div className="font-bold">{call.error.code}</div> : null}
                <div>{call.error.message}</div>
              </div>
            ) : result ? (
              <pre
                className={cn(
                  "max-h-48 overflow-auto rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-2 font-mono text-[10.5px] text-[var(--text)] leading-relaxed",
                  call.status === "failed" && "text-rose-700 dark:text-rose-300",
                )}
              >
                {result}
              </pre>
            ) : active ? (
              <div className="text-[10px] text-cyan-600 dark:text-cyan-400 animate-pulse font-mono py-1">
                执行中，等待输出…
              </div>
            ) : (
              <div className="text-[10px] text-[var(--text-dim)] font-mono py-1">无返回内容</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 工具调用聚合链 (ToolCallGroup)
 *
 * 核心特性：
 * 1. 自动折叠逻辑：单次任务中发生多个工具调用时，在执行完成后自动收拢为 1 行极简统计摘要
 * 2. 高对比度适配：针对浅色/暗色双主题全面强化边框、徽标文字与背景层次
 * 3. 一键展开明细：点击摘要条就地展开垂直时间线，可逐项查阅每个工具的入参和输出
 */
export function ToolCallGroup({ items }: { items: ToolItemProps[] }) {
  const total = items.length;
  const isMultiple = total >= 2;

  // Active / Failed / Succeeded breakdown
  const activeCount = items.filter(
    (i) => i.call.status === "requested" || i.call.status === "running",
  ).length;
  const failedCount = items.filter(
    (i) => i.call.status === "failed" || i.call.status === "denied",
  ).length;
  const isAllDone = activeCount === 0;

  // Manual toggle state. When isAllDone transitions to true, default is collapsed.
  const [manualOpen, setManualOpen] = React.useState<boolean | null>(null);

  // Auto-collapse logic: open while running; collapse as soon as all finished!
  const isOpen = manualOpen !== null ? manualOpen : !isAllDone;

  // Calculate tool name frequencies (e.g. 8 exec_bash, 2 read_file, 1 hash_read)
  const breakdownStr = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.call.name] = (counts[item.call.name] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => (count > 1 ? `${count} ${name}` : name))
      .join(", ");
  }, [items]);

  // Total duration calculation
  const totalDuration = React.useMemo(() => {
    return items.reduce((acc, item) => {
      const started = item.call.startedAt ?? item.createdAt;
      const completed = item.call.completedAt ?? Date.now();
      return acc + (completed - started);
    }, 0);
  }, [items]);

  // Single tool call: render single compact card
  if (!isMultiple && items.length === 1) {
    return (
      <div className="my-1">
        <ToolDetailItem item={items[0]} />
      </div>
    );
  }

  return (
    <div className="my-1.5 overflow-hidden rounded-[7px] border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.04)] transition-colors">
      {/* ── Group Header Bar (Click to toggle) ── */}
      <button
        type="button"
        onClick={() => setManualOpen((prev) => (prev !== null ? !prev : isAllDone))}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >

        {/* Title and breakdown */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 leading-tight">
            <span className="text-[12.5px] font-semibold text-[var(--text)]">
              {!isAllDone ? `正在执行工具链 (${total - activeCount}/${total})` : `已执行 ${total} 项工具`}
            </span>
            <span className="font-mono text-[10.5px] text-[var(--text-muted)] truncate max-w-[280px]">
              ({breakdownStr})
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-dim)]">
            <Clock3 className="h-2.5 w-2.5" />
            <span>总耗时 {formatDuration(totalDuration)}</span>
            {!isAllDone ? (
              <span className="text-cyan-600 dark:text-cyan-400 font-sans font-medium animate-pulse ml-1">
                · 进行中…
              </span>
            ) : null}
          </div>
        </div>

        {/* Status chip */}
        <div className="flex shrink-0 items-center gap-2">
          {!isAllDone ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan-700 dark:text-cyan-300">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-cyan-500" />
              执行中
            </span>
          ) : failedCount > 0 ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-rose-700 dark:text-rose-300">
              <X className="h-3 w-3" />
              {failedCount} 项失败
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
              <Check className="h-3 w-3" />
              全部完成
            </span>
          )}

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-[var(--text-dim)] transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* ── Expanded Timeline List ── */}
      {isOpen ? (
        <div className="border-t border-[var(--border)] p-2 space-y-1.5 bg-[var(--bg)] animate-fade-in">
          {items.map((item, idx) => (
            <ToolDetailItem key={item.id} item={{ ...item, index: idx + 1 }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
