"use client";

import * as React from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { ThinkingHighIcon } from "@/components/icons/zen-icons";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

export interface ThoughtCardProps {
  text: string;
  done: boolean;
  createdAt: number;
}

export function ThoughtCard({ text, done, createdAt }: ThoughtCardProps) {
  // When streaming: open by default. When done: auto-collapse into clean 1-line summary unless manually opened.
  const [open, setOpen] = React.useState(!done);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!done) {
      setOpen(true);
      const interval = window.setInterval(() => setNow(Date.now()), 200);
      return () => window.clearInterval(interval);
    } else {
      // Auto-collapse when finished to maintain clean reading flow
      setOpen(false);
    }
  }, [done]);

  const durationSec = Math.max(0.1, (done ? now - createdAt : Date.now() - createdAt) / 1000);
  const lines = text.split("\n").filter(Boolean).length;
  const estimatedTokens = Math.round(text.length * 1.3);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl transition-all duration-200 border",
        done
          ? "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.1] hover:bg-white/[0.025]"
          : "border-purple-400/25 bg-purple-500/[0.04] shadow-[0_0_20px_-8px_rgba(168,85,247,0.3)]",
      )}
    >
      {/* Streaming top micro shimmer */}
      {!done ? (
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(192,132,252,0.8),transparent)]" />
      ) : null}

      {/* Header bar / Single-line summary button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
            done
              ? "border-white/[0.07] bg-white/[0.03] text-mist-500"
              : "border-purple-400/30 bg-purple-500/15 text-purple-300",
          )}
        >
          <ThinkingHighIcon size={14} className={!done ? "animate-pulse" : undefined} />
        </span>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-medium tracking-tight text-mist-300">
            {done ? "已完成推理" : "深度思考中"}
          </span>
          <span className="font-mono text-[9.5px] text-mist-500 tabular-nums">
            {durationSec.toFixed(1)}s
          </span>
          {done ? (
            <span className="font-mono text-[9px] text-mist-600">
              · {lines} 行 · ~{estimatedTokens} tok
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-purple-500/15 border border-purple-400/20 px-1 py-px font-mono text-[8.5px] text-purple-300">
              <Sparkles className="h-2 w-2" />
              reasoning
            </span>
          )}
        </div>

        <span className="ml-auto flex items-center gap-1 text-mist-500">
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              open ? "rotate-180" : "",
            )}
          />
        </span>
      </button>

      {/* Expanded Reasoning Body */}
      {open ? (
        <div className="border-t border-white/[0.04] px-3.5 py-2.5 animate-fade-in space-y-2">
          <div className="flex items-center justify-between text-[9px] font-mono text-mist-600">
            <span>THOUGHT TIMELINE</span>
            <CopyButton value={text} label="复制思考流" />
          </div>

          <div className="max-h-[320px] overflow-y-auto whitespace-pre-wrap font-mono text-[11.5px] leading-[1.7] text-mist-400/90 pr-1">
            {text}
            {!done ? (
              <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-purple-400" />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
