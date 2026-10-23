import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent align-[-2px]",
        className,
      )}
      aria-label="加载中"
      role="status"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(100deg,rgba(255,255,255,0.035)_35%,rgba(255,255,255,0.075)_50%,rgba(255,255,255,0.035)_65%)]",
        className,
      )}
    />
  );
}
