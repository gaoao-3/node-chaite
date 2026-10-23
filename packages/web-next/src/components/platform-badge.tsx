import { MessageSquareMore, MonitorSmartphone, Smartphone, type LucideIcon } from "lucide-react";
import { PLATFORM_META } from "@/lib/platform";
import type { GatewayPlatform } from "@/lib/types";
import { cn } from "@/lib/utils";

const PLATFORM_ICONS: Record<GatewayPlatform, LucideIcon> = {
  qq: MessageSquareMore,
  dsh: Smartphone,
  web: MonitorSmartphone,
};

export function PlatformIcon({
  platform,
  className,
}: {
  platform: GatewayPlatform;
  className?: string;
}) {
  const Icon = PLATFORM_ICONS[platform];
  return <Icon className={className} aria-hidden />;
}

export function PlatformBadge({
  platform,
  label,
  className,
  size = "sm",
}: {
  platform: GatewayPlatform;
  label?: string;
  className?: string;
  size?: "xs" | "sm";
}) {
  const meta = PLATFORM_META[platform];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium tracking-[0.01em] whitespace-nowrap",
        size === "xs" ? "px-1.5 py-[1.5px] text-[9.5px]" : "px-2 py-0.5 text-[10.5px]",
        className,
      )}
      style={{
        color: meta.accent,
        backgroundColor: meta.tint,
        borderColor: `${meta.accent}2e`,
      }}
    >
      <PlatformIcon platform={platform} className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label ?? meta.label}
    </span>
  );
}
