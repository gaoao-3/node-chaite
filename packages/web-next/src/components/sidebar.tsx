"use client";

import * as React from "react";
import {
  ChevronDown,
  Dna,
  LogOut,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand";
import { PlatformIcon } from "@/components/platform-badge";
import { StatusDot } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import { PLATFORM_META, PLATFORM_ORDER, SESSION_STATUS_META } from "@/lib/platform";
import type { AgentSessionInfo, GatewayPlatform, SessionListStats } from "@/lib/types";
import { VIEW_META, type ConsoleView } from "@/lib/views";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";

const NAV_ICONS: Record<ConsoleView, React.ComponentType<{ className?: string }>> = {
  chat: MessageSquareText,
  fusion: Rocket,
  evolution: Dna,
  approvals: ShieldAlert,
  settings: Settings2,
};

export interface SidebarProps {
  sessions: AgentSessionInfo[];
  stats: SessionListStats | null;
  selectedId: string | null;
  view: ConsoleView;
  collapsed: boolean;
  mobileOpen: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  approvalCount: number;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onViewChange: (view: ConsoleView) => void;
  onRefresh: () => void;
  onLogout: () => void;
}

export function Sidebar({
  sessions,
  stats,
  selectedId,
  view,
  collapsed,
  mobileOpen,
  loading,
  refreshing,
  error,
  approvalCount,
  onSelect,
  onCreate,
  onToggleCollapse,
  onCloseMobile,
  onViewChange,
  onRefresh,
  onLogout,
}: SidebarProps) {
  const compact = collapsed && !mobileOpen;
  const [query, setQuery] = React.useState("");
  const [closedGroups, setClosedGroups] = React.useState<Record<string, boolean>>({});

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(needle) ||
        session.id.toLowerCase().includes(needle) ||
        session.botId.toLowerCase().includes(needle),
    );
  }, [query, sessions]);

  const grouped = React.useMemo(() => {
    const map = new Map<GatewayPlatform, AgentSessionInfo[]>();
    for (const platform of PLATFORM_ORDER) {
      map.set(
        platform,
        filtered
          .filter((session) => session.platform === platform)
          .sort((a, b) => b.lastActiveAt - a.lastActiveAt),
      );
    }
    return map;
  }, [filtered]);

  return (
    <aside
      aria-label="会话侧边栏"
      className={cn(
        "glass fixed inset-y-0 left-0 z-50 flex w-[304px] flex-col border-r border-white/[0.065] transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:static md:z-20 md:translate-x-0",
        mobileOpen ? "translate-x-0 shadow-[30px_0_80px_-20px_rgba(0,0,0,0.85)]" : "-translate-x-full",
        collapsed ? "md:w-[76px]" : "md:w-[304px]",
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />

      {/* Brand / collapse */}
      <div
        className={cn(
          "relative flex h-[64px] shrink-0 items-center border-b border-white/[0.055]",
          compact ? "flex-col justify-center gap-1 px-2 pt-1" : "justify-between px-4",
        )}
      >
        {compact ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="展开侧边栏"
            aria-label="展开侧边栏"
            className="group flex flex-col items-center justify-center gap-0.5 transition-transform hover:scale-105"
          >
            <BrandMark size={26} />
            <span className="flex items-center gap-0.5 font-mono text-[8px] text-mist-600 group-hover:text-violet-300">
              <PanelLeftOpen className="h-2.5 w-2.5" />
              展开
            </span>
          </button>
        ) : (
          <>
            <BrandLockup />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCollapse}
                title={collapsed ? "展开侧边栏" : "收起侧边栏"}
                aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
                className="hidden h-7 w-7 items-center justify-center rounded-lg text-mist-600 transition-colors hover:bg-white/[0.06] hover:text-mist-300 md:flex"
              >
                {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="关闭侧边栏"
                title="关闭侧边栏"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist-100 md:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* New session + search */}
      <div className={cn("shrink-0 space-y-2.5", compact ? "px-2 py-3" : "px-3 py-3")}>
        {compact ? (
          <button
            type="button"
            onClick={onCreate}
            title="新建会话"
            aria-label="新建会话"
            className="flex h-10 w-full items-center justify-center rounded-xl border border-violet-300/25 bg-gradient-to-b from-violet-400/20 to-violet-600/10 text-violet-200 transition-all hover:border-violet-300/40 hover:from-violet-400/30 hover:text-white active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : (
          <Button variant="primary" size="md" className="w-full justify-start pl-3.5" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            新建会话
            <span className="ml-auto rounded-md border border-white/15 bg-black/15 px-1.5 py-0.5 text-[9.5px] font-medium text-white/70">
              New Session
            </span>
          </Button>
        )}

        {!compact ? (
          <div className="group relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-600" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索会话、ID 或 Bot…"
              aria-label="搜索会话"
              className="h-8.5 w-full rounded-[10px] border border-white/[0.06] bg-black/20 pl-8 pr-8 text-[11.5px] text-mist-200 outline-none transition-colors placeholder:text-mist-600 hover:border-white/[0.1] focus:border-violet-400/35 focus:bg-black/30"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="清除搜索"
                className="absolute right-1.5 top-1/2 flex h-5.5 w-5.5 -translate-y-1/2 items-center justify-center rounded-md text-mist-600 hover:bg-white/[0.06] hover:text-mist-300"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-mist-700">
                /
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Sessions */}
      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", compact ? "px-1.5" : "px-2.5")}>
        {loading && sessions.length === 0 ? (
          <div className="space-y-2 px-1 py-2">
            {[0, 1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className={cn("h-[52px] w-full", compact && "h-9")} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className={cn("mt-4 rounded-xl border border-dashed border-white/[0.08] p-4 text-center", compact && "p-2")}>
            {!compact ? (
              <>
                <Sparkles className="mx-auto h-5 w-5 text-violet-300/60" />
                <div className="mt-2 text-[11.5px] font-medium text-mist-300">还没有会话</div>
                <div className="mt-1 text-[10.5px] leading-relaxed text-mist-600">
                  创建一个会话，开始与多端 Agent 协作。
                </div>
              </>
            ) : (
              <Sparkles className="mx-auto h-4 w-4 text-violet-300/60" />
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 px-2 text-center text-[11px] text-mist-600">没有匹配的会话</div>
        ) : compact ? (
          <div className="flex flex-col items-center gap-1.5 py-1">
            {filtered.slice(0, 12).map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                title={`${session.title} · ${PLATFORM_META[session.platform].label}`}
                aria-label={`打开会话 ${session.title}`}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all",
                  selectedId === session.id
                    ? "border-violet-300/35 bg-violet-400/15 text-violet-100 shadow-[0_0_24px_-8px_rgba(139,92,246,0.7)]"
                    : "border-transparent text-mist-500 hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-mist-200",
                )}
              >
                <PlatformIcon platform={session.platform} className="h-4 w-4" />
                <span className="absolute -bottom-0.5 -right-0.5">
                  <StatusDot status={session.status} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 py-1">
            {PLATFORM_ORDER.map((platform) => {
              const items = grouped.get(platform) ?? [];
              if (items.length === 0) return null;
              const meta = PLATFORM_META[platform];
              const closed = closedGroups[platform] ?? false;
              return (
                <section key={platform} aria-label={meta.groupLabel}>
                  <button
                    type="button"
                    onClick={() => setClosedGroups((current) => ({ ...current, [platform]: !current[platform] }))}
                    className="group flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.025]"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-md border"
                      style={{
                        color: meta.accent,
                        borderColor: `${meta.accent}2b`,
                        backgroundColor: meta.tint,
                      }}
                    >
                      <PlatformIcon platform={platform} className="h-2.5 w-2.5" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-mist-500">
                      {meta.groupLabel}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-1.5 text-[9px] font-medium text-mist-600">
                      {items.length}
                    </span>
                    <ChevronDown
                      className={cn(
                        "ml-auto h-3 w-3 text-mist-700 transition-transform duration-200",
                        closed && "-rotate-90",
                      )}
                    />
                  </button>

                  {!closed ? (
                    <div className="mt-1 space-y-1">
                      {items.map((session) => {
                        const active = selectedId === session.id;
                        const statusMeta = SESSION_STATUS_META[session.status];
                        return (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() => onSelect(session.id)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "group relative flex w-full flex-col gap-1 rounded-xl border px-2.5 py-2 text-left transition-all duration-200",
                              active
                                ? "border-white/[0.1] bg-gradient-to-br from-violet-400/[0.14] via-white/[0.035] to-cyan-300/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_-20px_rgba(139,92,246,0.8)]"
                                : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.035]",
                            )}
                          >
                            {active ? (
                              <span className="absolute left-0 top-2.5 h-6 w-[2px] rounded-r-full bg-gradient-to-b from-violet-300 to-cyan-300" />
                            ) : null}
                            <div className="flex items-center gap-2">
                              <StatusDot status={session.status} />
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate text-[12px] font-medium leading-5",
                                  active ? "text-mist-100" : "text-mist-300 group-hover:text-mist-200",
                                )}
                              >
                                {truncate(session.title || "未命名会话", 26)}
                              </span>
                              {session.pendingApprovalIds.length > 0 ? (
                                <span className="flex h-4 min-w-4 items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/15 px-1 text-[9px] font-semibold text-amber-100">
                                  {session.pendingApprovalIds.length}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1.5 pl-3.5 text-[9.5px] text-mist-600">
                              <span className={statusMeta.text}>{statusMeta.label}</span>
                              <span className="text-mist-700">·</span>
                              <span>{session.turnCount} 轮</span>
                              <span className="text-mist-700">·</span>
                              <span className="truncate">{formatRelativeTime(session.lastActiveAt)}</span>
                              {session.model ? (
                                <span className="ml-auto max-w-[76px] truncate rounded border border-white/[0.06] bg-black/20 px-1 py-px font-mono text-[8.5px] text-mist-600">
                                  {session.model}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}

        {error ? (
          <div className="mx-1 mt-3 rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-2.5 py-2 text-[10.5px] leading-relaxed text-rose-200/90">
            {error}
          </div>
        ) : null}
      </div>

      {/* Bottom navigation */}
      <div className={cn("shrink-0 border-t border-white/[0.06]", compact ? "px-1.5 py-2" : "px-2.5 py-2.5")}>
        {!compact ? (
          <div className="mb-2 flex items-center justify-between px-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-mist-700">
              Console
            </span>
            <button
              type="button"
              onClick={onRefresh}
              title="刷新数据"
              aria-label="刷新数据"
              className="flex h-6 w-6 items-center justify-center rounded-md text-mist-600 transition-colors hover:bg-white/[0.05] hover:text-mist-300"
            >
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            </button>
          </div>
        ) : null}

        <nav aria-label="控制台导航" className="space-y-0.5">
          {(Object.keys(VIEW_META) as ConsoleView[]).map((key) => {
            const meta = VIEW_META[key];
            const Icon = NAV_ICONS[key];
            const active = view === key;
            const badge = key === "approvals" ? approvalCount : 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onViewChange(key)}
                title={compact ? meta.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex w-full items-center rounded-xl transition-all duration-200",
                  compact ? "h-10 justify-center" : "gap-2.5 px-2.5 py-2",
                  active
                    ? "border border-white/[0.08] bg-gradient-to-r from-violet-400/[0.13] to-cyan-300/[0.035] text-mist-100"
                    : "border border-transparent text-mist-500 hover:bg-white/[0.04] hover:text-mist-200",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                    active
                      ? "border-violet-300/25 bg-violet-400/15 text-violet-200"
                      : "border-transparent bg-white/[0.025] text-mist-500 group-hover:text-mist-300",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {!compact ? (
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-[11.5px] font-medium leading-4">{meta.label}</span>
                    <span className="mt-0.5 block truncate text-[9.5px] leading-3 text-mist-600">
                      {meta.description}
                    </span>
                  </span>
                ) : null}
                {badge > 0 ? (
                  <span
                    className={cn(
                      "flex h-4 min-w-4 items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/15 px-1 text-[9px] font-semibold text-amber-100",
                      compact ? "absolute right-1 top-1" : "",
                    )}
                  >
                    {badge}
                  </span>
                ) : active && !compact ? (
                  <span className="h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.9)]" />
                ) : null}
              </button>
            );
          })}
        </nav>

        {!compact ? (
          <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/[0.055] bg-black/20 px-2.5 py-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium leading-3 text-mist-300">Gateway connected</div>
              <div className="mt-0.5 truncate font-mono text-[9px] leading-3 text-mist-600">
                {stats ? `${stats.total} sessions · ${stats.streaming} live · ${stats.waitingApproval} wait` : "127.0.0.1:3200"}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="退出登录"
              aria-label="退出登录"
              className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md text-mist-600 transition-colors hover:bg-rose-400/10 hover:text-rose-300"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLogout}
            title="退出登录"
            aria-label="退出登录"
            className="mt-1 flex h-9 w-full items-center justify-center rounded-lg text-mist-600 transition-colors hover:bg-rose-400/10 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
}
