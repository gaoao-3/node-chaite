import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "violet"
  | "cyan"
  | "emerald"
  | "amber"
  | "rose"
  | "outline";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "border-white/[0.08] bg-white/[0.04] text-mist-300",
  violet: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  rose: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  outline: "border-white/[0.1] bg-transparent text-mist-400",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  mono?: boolean;
}

export function Badge({ className, variant = "default", mono = false, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium tracking-[0.02em] whitespace-nowrap",
        mono && "font-mono text-[10px] tracking-normal",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", className)} aria-hidden />;
}
