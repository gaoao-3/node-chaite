"use client";

import * as React from "react";
import { Brain, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThoughtCard({
  text,
  done,
  createdAt,
}: {
  text: string;
  done: boolean;
  createdAt: number;
}) {
  const [open, setOpen] = React.useState(true);
  const lines = text.split("\n").length;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[15px] border transition-colors duration-300",
        done
          ? "border-white/[0.06] bg-white/[0.018]"
          : "border-violet-300/16 bg-violet-400/[0.035]",
      )}
    >
      {!done ? (
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(196,181,253,0.7),transparent)]" />
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg border",
            done
              ? "border-white/[0.07] bg-white/[0.03] text-mist-500"
              : "border-violet-300/20 bg-violet-400/10 text-violet-200",
          )}
        >
          <Brain className={cn("h-3.5 w-3.5", !done && "animate-pulse-soft")} />
        </span>
        <span className="text-[10.5px] font-medium tracking-[0.01em] text-mist-400">
          {done ? "思考过程" : "正在思考"}
        </span>
        <span className="rounded border border-white/[0.06] bg-black/20 px-1 py-px font-mono text-[8.5px] text-mist-600">
          {lines} lines
        </span>
        {!done ? (
          <span className="inline-flex items-center gap-1 text-[9px] text-violet-200/70">
            <Sparkles className="h-2.5 w-2.5" />
            reasoning
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          <span className="hidden font-mono text-[8.5px] text-mist-700 sm:inline">
            {new Date(createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-mist-600 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div className="border-t border-white/[0.045] px-3 py-2.5 animate-fade-in">
          <div className="max-h-[300px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-[1.75] text-mist-500/90">
            {text}
            {!done ? (
              <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-violet-300/80" />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
