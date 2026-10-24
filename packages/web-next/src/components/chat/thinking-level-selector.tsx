"use client";

import * as React from "react";
import {
  ThinkingNoneIcon,
  ThinkingLowIcon,
  ThinkingMediumIcon,
  ThinkingHighIcon,
  ThinkingMaxIcon,
} from "@/components/icons/zen-icons";
import { cn } from "@/lib/utils";

export type ThinkingLevel = "none" | "low" | "medium" | "high" | "max";

export interface ThinkingLevelConfig {
  id: ThinkingLevel;
  label: string;
  glyph: string;
  desc: string;
  budgetHint: string;
}

export const THINKING_LEVELS: ThinkingLevelConfig[] = [
  { id: "none", label: "关闭", glyph: "○", desc: "直接回答", budgetHint: "0 tok · 极速" },
  { id: "low", label: "轻度", glyph: "◔", desc: "快速推理", budgetHint: "~1k tok" },
  { id: "medium", label: "平衡", glyph: "◑", desc: "适中思考", budgetHint: "~4k tok · 推荐" },
  { id: "high", label: "深度", glyph: "◕", desc: "多步推演", budgetHint: "~8k tok" },
  { id: "max", label: "极限", glyph: "●", desc: "满血架构分析", budgetHint: "无上限" },
];

export function getThinkingIcon(level: ThinkingLevel, size = 15) {
  switch (level) {
    case "none":
      return <ThinkingNoneIcon size={size} />;
    case "low":
      return <ThinkingLowIcon size={size} />;
    case "medium":
      return <ThinkingMediumIcon size={size} />;
    case "high":
      return <ThinkingHighIcon size={size} />;
    case "max":
      return <ThinkingMaxIcon size={size} />;
  }
}

export interface ThinkingLevelSelectorProps {
  value: ThinkingLevel;
  onChange: (level: ThinkingLevel) => void;
  disabled?: boolean;
  className?: string;
}

export function ThinkingLevelSelector({
  value,
  onChange,
  disabled = false,
  className,
}: ThinkingLevelSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const current = THINKING_LEVELS.find((l) => l.id === value) ?? THINKING_LEVELS[2];

  // Outside click handler
  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Keyboard navigation
  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = THINKING_LEVELS.findIndex((l) => l.id === value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = THINKING_LEVELS[(idx + 1) % THINKING_LEVELS.length];
      onChange(next.id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = THINKING_LEVELS[(idx - 1 + THINKING_LEVELS.length) % THINKING_LEVELS.length];
      onChange(prev.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative inline-block", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`思考等级: ${current.label} (${current.desc})`}
        title={`思考等级: ${current.label} · ${current.budgetHint}`}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-mono transition-colors",
          value === "none"
            ? "border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
            : value === "max"
              ? "border-purple-500/40 bg-purple-500/15 text-purple-700 dark:text-purple-200 font-semibold shadow-[0_0_12px_-3px_rgba(168,85,247,0.3)]"
              : "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-medium hover:border-purple-500/50",
          open && "ring-1 ring-purple-500/50",
        )}
      >
        <span className="shrink-0 text-purple-600 dark:text-purple-300">{getThinkingIcon(value, 14)}</span>
        <span className="font-medium tracking-tight">{current.label}</span>
      </button>

      {/* Floating Popover Selector */}
      {open ? (
        <div
          role="listbox"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="absolute bottom-9 right-0 z-50 w-56 max-w-[calc(100vw-24px)] rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-1.5 shadow-2xl backdrop-blur-2xl animate-scale-in"
        >
          <div className="px-2 py-1 flex items-center justify-between text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
            <span>思考等级 · 推理深度</span>
            <span className="font-mono text-purple-600 dark:text-purple-300">{current.budgetHint}</span>
          </div>
          <div className="space-y-0.5 mt-0.5">
            {THINKING_LEVELS.map((item) => {
              const active = item.id === value;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors",
                    active
                      ? "bg-purple-500/15 text-purple-700 dark:text-purple-200 font-semibold"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={active ? "text-purple-600 dark:text-purple-300" : "text-[var(--text-dim)]"}>
                      {getThinkingIcon(item.id, 14)}
                    </span>
                    <div>
                      <div className="leading-tight">{item.label}</div>
                      <div className="text-[9.5px] font-normal text-[var(--text-dim)]">{item.desc}</div>
                    </div>
                  </div>
                  <span className="font-mono text-[9px] text-mist-500">{item.budgetHint.split(" · ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
