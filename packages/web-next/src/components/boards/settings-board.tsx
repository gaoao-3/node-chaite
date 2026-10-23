"use client";

import * as React from "react";
import {
  Check,
  Cpu,
  Database,
  Eye,
  EyeOff,
  Gauge,
  HardDrive,
  Info,
  KeyRound,
  Layers3,
  LogOut,
  MonitorSmartphone,
  Palette,
  Radio,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BoardPage, SectionCard } from "@/components/boards/board-shell";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Segmented, Switch } from "@/components/ui/switch";
import type { ConsolePreferences, Density } from "@/hooks/use-preferences";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platform";
import type { SessionListStats } from "@/lib/types";
import { cn } from "@/lib/utils";

function maskToken(token: string | null): string {
  if (!token) return "未登录";
  if (token.length <= 18) return `${token.slice(0, 4)}••••${token.slice(-2)}`;
  return `${token.slice(0, 14)}••••••••••${token.slice(-6)}`;
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.05] py-2.5 last:border-0 last:pb-0 first:pt-0">
      {icon ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-mist-500">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-mist-200">{title}</div>
        {description ? <div className="mt-0.5 text-[9.5px] leading-relaxed text-mist-600">{description}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsBoard({
  preferences,
  update,
  reset,
  token,
  stats,
  sessionCount,
  onLogout,
  onReconnect,
  onMenu,
}: {
  preferences: ConsolePreferences;
  update: (patch: Partial<ConsolePreferences>) => void;
  reset: () => void;
  token: string | null;
  stats: SessionListStats | null;
  sessionCount: number;
  onLogout: () => void;
  onReconnect: () => void;
  onMenu?: () => void;
}) {
  const [reveal, setReveal] = React.useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000";

  return (
    <BoardPage
      onMenu={onMenu}
      icon={<Settings2 className="h-4 w-4" />}
      eyebrow="Preferences"
      title="设置"
      description="连接、外观、默认会话平台与本地凭据"
      actions={
        <Button size="sm" variant="subtle" onClick={onReconnect}>
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">刷新连接</span>
        </Button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-3">
          <SectionCard title="连接" hint="Connection" action={<span className="font-mono text-[8.5px] text-mist-700">SSE / REST</span>}>
            <SettingRow
              icon={<Server className="h-3.5 w-3.5" />}
              title="前端 Origin"
              description="Next.js 通过 rewrites 将 /api/* 反代到后端。"
            >
              <code className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-1 font-mono text-[9.5px] text-mist-400">
                {origin}
              </code>
            </SettingRow>
            <SettingRow
              icon={<Database className="h-3.5 w-3.5" />}
              title="后端服务"
              description="Chaite Express API。"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[0.055] px-2 py-1 font-mono text-[9px] text-emerald-200/85">
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-300" />
                127.0.0.1:3200
              </span>
            </SettingRow>
            <SettingRow
              icon={<Radio className="h-3.5 w-3.5" />}
              title="事件流端点"
              description="单会话单流，断线自动携带 Last-Event-ID 续传。"
            >
              <code className="max-w-[210px] truncate rounded-md border border-white/[0.06] bg-black/25 px-2 py-1 font-mono text-[9px] text-mist-400">
                /api/agent/sessions/:id/events
              </code>
            </SettingRow>
            <SettingRow
              icon={<Gauge className="h-3.5 w-3.5" />}
              title="会话统计"
              description="来自 /api/agent/sessions/stats 的实时快照。"
            >
              <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-mist-400">
                <span>{sessionCount} sessions</span>
                <span className="text-mist-700">·</span>
                <span className="text-cyan-200/80">{stats?.streaming ?? 0} live</span>
                <span className="text-mist-700">·</span>
                <span className="text-amber-200/80">{stats?.waitingApproval ?? 0} wait</span>
              </div>
            </SettingRow>
          </SectionCard>

          <SectionCard title="外观" hint="Appearance">
            <SettingRow
              icon={<Palette className="h-3.5 w-3.5" />}
              title="界面密度"
              description="Compact 会收紧消息间距，适合长会话。"
            >
              <Segmented<Density>
                value={preferences.density}
                onChange={(density) => update({ density })}
                ariaLabel="界面密度"
                options={[
                  { value: "comfortable", label: "舒适" },
                  { value: "compact", label: "紧凑" },
                ]}
              />
            </SettingRow>
            <SettingRow
              icon={<Sparkles className="h-3.5 w-3.5" />}
              title="减少动态效果"
              description="关闭呼吸、漂浮与流光动画。"
            >
              <Switch
                checked={preferences.reduceMotion}
                onChange={(reduceMotion) => update({ reduceMotion })}
                label="减少动态效果"
              />
            </SettingRow>
            <SettingRow
              icon={<Layers3 className="h-3.5 w-3.5" />}
              title="自动跟随最新消息"
              description="新事件到达时自动滚动到底部。"
            >
              <Switch
                checked={preferences.autoScroll}
                onChange={(autoScroll) => update({ autoScroll })}
                label="自动跟随最新消息"
              />
            </SettingRow>
            <SettingRow
              icon={<Sparkles className="h-3.5 w-3.5" />}
              title="对话设计预览"
              description="加载本地静态时间线，用于审阅思考、工具与审批卡片。"
            >
              <Switch
                checked={preferences.preview}
                onChange={(preview) => update({ preview })}
                label="对话设计预览"
              />
            </SettingRow>
          </SectionCard>

          <SectionCard title="新建会话默认值" hint="Defaults">
            <SettingRow
              icon={<MonitorSmartphone className="h-3.5 w-3.5" />}
              title="默认平台"
              description="点击 + New Session 时预选的平台。"
            >
              <div className="flex items-center gap-1">
                {PLATFORM_ORDER.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => update({ defaultPlatform: platform })}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[9.5px] font-medium transition-colors",
                      preferences.defaultPlatform === platform
                        ? "border-white/[0.12] bg-white/[0.08] text-mist-100"
                        : "border-white/[0.055] bg-black/20 text-mist-500 hover:text-mist-300",
                    )}
                  >
                    {PLATFORM_META[platform].label}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow
              icon={<Cpu className="h-3.5 w-3.5" />}
              title="驱动模型"
              description="由后端 ChatPreset 决定，可在会话 PATCH 时覆盖。"
            >
              <span className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-1 font-mono text-[9.5px] text-mist-400">
                auto
              </span>
            </SettingRow>
            <div className="mt-2.5 flex items-center justify-between rounded-lg border border-white/[0.055] bg-black/15 px-2.5 py-2">
              <span className="text-[9.5px] text-mist-600">恢复默认偏好（不影响登录凭据）</span>
              <Button size="xs" variant="ghost" onClick={reset}>
                <RefreshCw className="h-3 w-3" />
                重置
              </Button>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-3">
          <SectionCard title="凭据" hint="Local credential" action={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300/70" />}>
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2.5">
              <div className="flex items-center gap-1.5">
                <KeyRound className="h-3 w-3 text-violet-300/70" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-mist-600">Bearer JWT</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[8.5px] text-emerald-300/70">
                  <span className="h-1 w-1 rounded-full bg-emerald-300" />
                  local only
                </span>
              </div>
              <div className="mt-1.5 break-all font-mono text-[9.5px] leading-relaxed text-mist-400">
                {reveal ? token ?? "未登录" : maskToken(token)}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setReveal((value) => !value)}
                  className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-1.5 py-0.5 text-[9px] text-mist-500 transition-colors hover:bg-white/[0.05] hover:text-mist-300"
                >
                  {reveal ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                  {reveal ? "隐藏" : "显示"}
                </button>
                {token ? (
                  <CopyButton value={token} label="复制令牌" className="rounded-md border border-white/[0.06] px-1.5" />
                ) : null}
              </div>
            </div>

            <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-300/12 bg-amber-300/[0.04] px-2.5 py-2 text-[9px] leading-relaxed text-amber-200/70">
              <Info className="mt-px h-3 w-3 shrink-0" />
              令牌由 /api/auth/login 签发，存放在 localStorage。公共设备使用后请立即退出。
            </div>

            <Button variant="danger" size="sm" className="mt-3 w-full" onClick={onLogout}>
              <LogOut className="h-3.5 w-3.5" />
              退出登录并清除凭据
            </Button>
          </SectionCard>

          <SectionCard title="本地数据" hint="Local storage">
            <div className="space-y-1.5 text-[9.5px]">
              {[
                ["chaite.console.token", token ? "已写入" : "空"],
                ["chaite.console.preferences", "已写入"],
                ["会话选择 / 草稿", "仅内存"],
              ].map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-md border border-white/[0.045] bg-black/15 px-2 py-1.5">
                  <code className="font-mono text-[9px] text-mist-500">{key}</code>
                  <span className={cn("text-[8.5px]", value === "空" ? "text-mist-700" : "text-emerald-300/70")}>{value}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="关于" hint="About">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/18 bg-violet-400/[0.08] text-violet-200">
                <HardDrive className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[11.5px] font-semibold text-mist-200">Chaite Agent Console</div>
                <div className="font-mono text-[9px] text-mist-600">web-next · 0.1.0</div>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {["Next.js 16", "React 19", "Tailwind v4", "SSE", "shadcn tokens"].map((item) => (
                <span key={item} className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[8.5px] text-mist-500">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-mist-600">
              <Check className="h-3 w-3 text-emerald-300/70" />
              深色设计系统 · 毛玻璃 · 精致细边框
            </div>
          </SectionCard>
        </div>
      </div>
    </BoardPage>
  );
}
