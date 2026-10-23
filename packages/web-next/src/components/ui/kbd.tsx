import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-white/[0.1] bg-white/[0.045] px-1 font-mono text-[10px] font-medium text-mist-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_0_rgba(0,0,0,0.4)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
