import { cn } from "@/lib/utils";

export function BrandMark({ size = 34, className }: { size?: number; className?: string }) {
  const id = "chaite-grad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden
      className={cn("shrink-0 drop-shadow-[0_6px_16px_rgba(139,92,246,0.35)]", className)}
    >
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4B5FD" />
          <stop offset="0.48" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="6" y1="4" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#241A3E" />
          <stop offset="0.55" stopColor="#12101D" />
          <stop offset="1" stopColor="#0A1418" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="34" height="34" rx="10.5" fill={`url(#${id}-fill)`} />
      <rect
        x="1"
        y="1"
        width="34"
        height="34"
        rx="10.5"
        stroke={`url(#${id})`}
        strokeOpacity="0.75"
      />
      <path
        d="M18 6.8 L27.4 18 L18 29.2 L8.6 18 Z"
        stroke={`url(#${id})`}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeOpacity="0.9"
      />
      <path
        d="M18 11.6 L23.4 18 L18 24.4 L12.6 18 Z"
        fill={`url(#${id})`}
        fillOpacity="0.16"
        stroke={`url(#${id})`}
        strokeWidth="1.1"
        strokeLinejoin="round"
        strokeOpacity="0.85"
      />
      <circle cx="18" cy="18" r="2.1" fill={`url(#${id})`} />
      <circle cx="18" cy="18" r="4.5" stroke={`url(#${id})`} strokeOpacity="0.25" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark size={32} />
      <div className="min-w-0 leading-none">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-semibold tracking-[-0.025em] text-mist-100">
            Chaite
          </span>
          <span className="rounded border border-violet-300/20 bg-violet-400/[0.08] px-1 py-[1px] font-mono text-[8.5px] font-medium uppercase tracking-[0.16em] text-violet-200/85">
            Agent
          </span>
        </div>
        {!compact ? (
          <div className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.18em] text-mist-600">
            Control Plane
          </div>
        ) : null}
      </div>
    </div>
  );
}
