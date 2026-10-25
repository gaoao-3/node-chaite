"use client";

import * as React from "react";
import {
  ThinkingNoneIcon,
  ThinkingLowIcon,
  ThinkingMediumIcon,
  ThinkingHighIcon,
  ThinkingMaxIcon,
} from "@/components/icons/zen-icons";
import type { ModelMetadata } from "@/lib/api";
import { cn } from "@/lib/utils";

export type ThinkingLevel = "none" | "low" | "medium" | "high" | "max";

export interface ThinkingLevelConfig {
  id: ThinkingLevel;
  label: string;
  glyph: string;
  desc: string;
  budgetHint: string;
}

export const BASE_THINKING_LEVELS: ThinkingLevelConfig[] = [
  { id: "none", label: "关闭", glyph: "○", desc: "直接回答", budgetHint: "0 tok · 极速" },
  { id: "low", label: "轻度", glyph: "◔", desc: "快速推理", budgetHint: "~2k tok" },
  { id: "medium", label: "平衡", glyph: "◑", desc: "适中思考", budgetHint: "~8k tok · 推荐" },
  { id: "high", label: "深度", glyph: "◕", desc: "多步推演", budgetHint: "~24k tok" },
  { id: "max", label: "极限", glyph: "●", desc: "满血架构分析", budgetHint: "~64k tok" },
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
  modelMetadata?: ModelMetadata | null;
}

export function ThinkingLevelSelector({
  value,
  onChange,
  disabled = false,
  className,
  modelMetadata,
}: ThinkingLevelSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isModelKnown = Boolean(modelMetadata);
  const supportsThinking = modelMetadata ? modelMetadata.supportsThinking : true;
  const thinkingType = modelMetadata?.thinkingType;

  // 根据当前模型的思考类型微调预算提示
  const dynamicLevels: ThinkingLevelConfig[] = React.useMemo(() => {
    if (thinkingType === "budget_tokens") {
      return [
        { id: "none", label: "关闭", glyph: "○", desc: "直接输出正文", budgetHint: "0 tok · 极速" },
        { id: "low", label: "轻度", glyph: "◔", desc: "快速逻辑梳理", budgetHint: "~2k tokens" },
        { id: "medium", label: "平衡", glyph: "◑", desc: "系统架构推演", budgetHint: "~8k tokens · 推荐" },
        { id: "high", label: "深度", glyph: "◕", desc: "复杂推理与审查", budgetHint: "~24k tokens" },
        { id: "max", label: "极限", glyph: "●", desc: "满血极限思考", budgetHint: "~64k tokens" },
      ];
    }
    if (thinkingType === "gemini_level") {
      return [
        { id: "none", label: "关闭", glyph: "○", desc: "关闭推理链", budgetHint: "OFF · 极速" },
        { id: "low", label: "轻度", glyph: "◔", desc: "简短思考验证", budgetHint: "LOW · 快速" },
        { id: "medium", label: "平衡", glyph: "◑", desc: "标准思考深度", budgetHint: "MEDIUM · 推荐" },
        { id: "high", label: "深度", glyph: "◕", desc: "多维深度探究", budgetHint: "HIGH · 深度" },
        { id: "max", label: "极限", glyph: "●", desc: "极限推理思考", budgetHint: "HIGH+" },
      ];
    }
    if (thinkingType === "reasoning_effort") {
      return [
        { id: "none", label: "关闭", glyph: "○", desc: "默认推理", budgetHint: "DEFAULT" },
        { id: "low", label: "轻度", glyph: "◔", desc: "快速推理", budgetHint: "LOW" },
        { id: "medium", label: "平衡", glyph: "◑", desc: "标准推理努力", budgetHint: "MEDIUM · 推荐" },
        { id: "high", label: "深度", glyph: "◕", desc: "深入推理努力", budgetHint: "HIGH" },
        { id: "max", label: "极限", glyph: "●", desc: "极致推理推演", budgetHint: "MAX" },
      ];
    }
    return BASE_THINKING_LEVELS;
  }, [thinkingType]);

  const current = dynamicLevels.find((l) => l.id === value) ?? dynamicLevels[2];

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
    if (!supportsThinking) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    const idx = dynamicLevels.findIndex((l) => l.id === value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = dynamicLevels[(idx + 1) % dynamicLevels.length];
      onChange(next.id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = dynamicLevels[(idx - 1 + dynamicLevels.length) % dynamicLevels.length];
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
        aria-label={
          !supportsThinking
            ? `思考等级: 不支持 (当前模型为非推理模型)`
            : `思考等级: ${current.label} (${current.desc})`
        }
        title={
          !supportsThinking
            ? `${modelMetadata?.label || "当前模型"} 不支持思考推理链`
            : `思考等级: ${current.label} · ${current.budgetHint}`
        }
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-[10px] border px-2 text-[11px] font-mono transition-colors",
          !supportsThinking
            ? "border-[var(--border)] bg-[var(--bg-subtle,rgba(127,127,127,0.02))] text-[var(--text-dim)] opacity-70 hover:opacity-100"
            : value === "max"
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-semibold"
              : value === "none"
                ? "border-[var(--border)] bg-[var(--bg-subtle,rgba(127,127,127,0.04))] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                : "border-purple-500/35 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-medium hover:border-purple-500/50",
          open && "ring-1 ring-[var(--accent)]/40",
        )}
      >
        <span
          className={cn(
            "shrink-0",
            !supportsThinking
              ? "text-[var(--text-dim)]"
              : value === "none"
                ? "text-[var(--text-muted)]"
                : "text-purple-600 dark:text-purple-300",
          )}
        >
          {getThinkingIcon(!supportsThinking ? "none" : value, 14)}
        </span>
        <span className="font-medium tracking-tight">
          {!supportsThinking ? "无思考" : current.label}
        </span>
      </button>

      {/* Floating Popover Selector */}
      {open ? (
        <div
          role="listbox"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="absolute bottom-9 right-0 z-50 w-64 max-w-[calc(100vw-24px)] rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-2 shadow-2xl backdrop-blur-2xl animate-spring-up"
        >
          {!supportsThinking ? (
            /* 不支持思考时的友好引导卡片 */
            <div className="p-2 space-y-1.5 text-left">
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text)]">
                <ThinkingNoneIcon size={14} className="text-[var(--text-dim)] shrink-0" />
                <span>非推理思考模型</span>
              </div>
              <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                当前选中的模型 <strong className="text-[var(--text)]">{modelMetadata?.label || "该模型"}</strong> 为标准生成模型，无需额外推理思考预算，默认直接生成最终回答。
              </p>
              <div className="pt-1.5 border-t border-[var(--border)] text-[9.5px] font-mono text-[var(--text-dim)]">
                💡 如需开启深度思考链，可在左侧切换为 <span className="text-[var(--accent)]">Claude 3.7</span>、<span className="text-[var(--accent)]">Gemini 3.8 Flash</span> 或 <span className="text-[var(--accent)]">DeepSeek R1</span>。
              </div>
            </div>
          ) : (
            /* 支持思考时的精细等级选择项 */
            <>
              <div className="px-2 py-1 flex items-center justify-between text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                <span>思考等级 · 推理深度</span>
                <span className="font-mono text-purple-600 dark:text-purple-300 font-semibold">{current.budgetHint}</span>
              </div>
              <div className="space-y-0.5 mt-1">
                {dynamicLevels.map((item) => {
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
                          ? "bg-purple-500/15 text-purple-800 dark:text-purple-200 font-semibold"
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
                      <span className="font-mono text-[9px] text-[var(--text-dim)]">{item.budgetHint.split(" · ")[0]}</span>
                    </button>
                  );
                })}
              </div>

              {modelMetadata?.contextWindowFormatted ? (
                <div className="mt-2 pt-1.5 border-t border-[var(--border)] px-2 flex items-center justify-between font-mono text-[9px] text-[var(--text-dim)]">
                  <span>模型上下文上限</span>
                  <span className="text-[var(--accent)] font-semibold">{modelMetadata.contextWindowFormatted} Tokens</span>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
