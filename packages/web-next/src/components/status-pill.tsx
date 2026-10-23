import { SESSION_STATUS_META } from "@/lib/platform";
import type { AgentSessionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusPill({
  status,
  label,
  className,
  compact = false,
}: {
  status: AgentSessionStatus;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const meta = SESSION_STATUS_META[status] ?? SESSION_STATUS_META.idle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        compact ? "px-1.5 py-[1px] text-[9px]" : "px-2 py-0.5 text-[10px]",
        meta.chip,
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {meta.pulse ? (
          <span
            className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", meta.dot)}
          />
        ) : null}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", meta.dot)} />
      </span>
      {label ?? meta.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: AgentSessionStatus; className?: string }) {
  const meta = SESSION_STATUS_META[status] ?? SESSION_STATUS_META.idle;
  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      {meta.pulse ? (
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-50", meta.dot)} />
      ) : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", meta.dot)} />
    </span>
  );
}
