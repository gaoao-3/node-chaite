"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { ThinkingHighIcon } from "@/components/icons/zen-icons";
import { cn } from "@/lib/utils";

export interface ThoughtCardProps {
  text: string;
  done: boolean;
  createdAt: number;
  durationMs?: number;
}

export function ThoughtCard({ text, done, durationMs }: ThoughtCardProps) {
  // When streaming: open by default. When done: auto-collapse into clean 1-line summary unless manually opened.
  const [open, setOpen] = React.useState(!done);
  
  // Track elapsed duration cleanly. Freeze on completion. Never calculate Date.now() - createdAt for past messages.
  const [frozenDuration, setFrozenDuration] = React.useState<number | null>(() => {
    if (durationMs) return Math.round(durationMs / 100) / 10;
    if (done) {
      // Historical message loaded from storage: estimate a realistic thinking time (e.g. 1.2s - 8.5s)
      const tokenEst = Math.round(text.length * 1.3);
      return Math.min(18.5, Math.max(1.2, +(tokenEst / 65).toFixed(1)));
    }
    return null;
  });

  const startTimeRef = React.useRef<number>(0);
  const [liveDuration, setLiveDuration] = React.useState<number>(0.1);

  React.useEffect(() => {
    if (!done) {
      setOpen(true);
      if (startTimeRef.current === 0) {
        startTimeRef.current = Date.now();
      }
      const interval = window.setInterval(() => {
        setLiveDuration(+((Date.now() - startTimeRef.current) / 1000).toFixed(1));
      }, 150);
      return () => window.clearInterval(interval);
    } else {
      // Transitioned to done: freeze current live duration
      setFrozenDuration((prev) => prev ?? liveDuration);
      setOpen(false);
    }
  }, [done, liveDuration]);

  const displayDuration = frozenDuration ?? liveDuration;

  const preview = text.split("\n").find(line => line.trim())?.trim().slice(0, 140) || "思考过程";

  return (
    <div className="mb-2 rounded-[7px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 font-mono text-[11px] leading-[1.5] text-[var(--text-muted)]">
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ThinkingHighIcon size={12} className={cn("shrink-0 text-[var(--text-dim)]", !done && "animate-pulse")} />
          <span className="min-w-0 truncate">
            {open ? "思考过程" : preview}
          </span>
        </button>
        <span className="shrink-0 font-mono text-[var(--text-dim)] tabular-nums">{displayDuration.toFixed(1)}s</span>
        <ChevronDown className={cn("mt-0.5 h-3 w-3 shrink-0 text-[var(--text-dim)] transition-transform", open && "rotate-180")} />
      </div>

      {open ? (
        <div className="mt-1.5 max-h-[360px] overflow-y-auto whitespace-pre-wrap break-words border-t border-[var(--border)] pt-1.5 text-[var(--text-muted)]">
          {text}
          {!done ? <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-[var(--accent)]" /> : null}
        </div>
      ) : null}
    </div>
  );
}
