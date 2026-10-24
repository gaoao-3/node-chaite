"use client";

import * as React from "react";
import {
  Layers,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand";
import { Skeleton } from "@/components/ui/spinner";
import type { AgentSessionInfo, GatewayPlatform, SessionListStats } from "@/lib/types";
import { type ConsoleView } from "@/lib/views";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";

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
  onToggleInspector?: () => void;
}

const PLATFORM_PILLS: Record<GatewayPlatform, { label: string; color: string }> = {
  web: { label: "Web", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  qq: { label: "QQ", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  dsh: { label: "DSH", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

export function Sidebar({
  sessions,
  stats,
  selectedId,
  view,
  collapsed,
  mobileOpen,
  loading,
  refreshing: _refreshing,
  error: _error,
  approvalCount: _approvalCount,
  onSelect,
  onCreate,
  onToggleCollapse,
  onCloseMobile,
  onViewChange,
  onRefresh: _onRefresh,
  onLogout,
  onToggleInspector,
}: SidebarProps) {
  const compact = collapsed && !mobileOpen;
  const [query, setQuery] = React.useState("");
  const [platformFilter, setPlatformFilter] = React.useState<"all" | GatewayPlatform>("all");

  const filtered = React.useMemo(() => {
    let list = sessions;
    if (platformFilter !== "all") {
      list = list.filter((s) => s.platform === platformFilter);
    }
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [...list].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    }
    return list
      .filter(
        (session) =>
          session.title.toLowerCase().includes(needle) ||
          session.id.toLowerCase().includes(needle) ||
          session.botId.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }, [platformFilter, query, sessions]);

  return (
    <aside
      aria-label="会话侧边栏"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-[var(--bg-panel)] transition-all duration-200 md:static md:z-20 md:translate-x-0",
        mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        compact ? "w-[68px]" : "w-[268px]",
      )}
    >
      {/* ── Top Header / Brand ── */}
      <div
        className={cn(
          "flex h-[52px] shrink-0 items-center border-b border-white/[0.05]",
          compact ? "justify-center px-2" : "justify-between px-3.5",
        )}
      >
        {compact ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="展开侧栏"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-400 hover:bg-white/[0.06] hover:text-mist-100 transition-colors"
          >
            <BrandMark size={22} />
          </button>
        ) : (
          <>
            <BrandLockup />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCollapse}
                title={collapsed ? "展开侧栏" : "收起侧栏"}
                className="hidden h-7 w-7 items-center justify-center rounded-lg text-mist-500 hover:bg-white/[0.06] hover:text-mist-200 md:flex transition-colors"
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                title="关闭侧栏"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-500 hover:bg-white/[0.06] hover:text-mist-200 md:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── New Chat & Search ── */}
      <div className={cn("shrink-0 space-y-2 p-2.5", compact && "px-2 py-2")}>
        {compact ? (
          <button
            type="button"
            onClick={onCreate}
            title="新建会话"
            className="flex h-9 w-full items-center justify-center rounded-xl bg-accent text-[var(--accent-contrast)] hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onCreate}
              className="flex h-9 w-full items-center justify-between rounded-xl bg-accent px-3 text-[12px] font-semibold text-[var(--accent-contrast)] hover:opacity-90 active:scale-[0.99] transition-all shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>新建对话</span>
              </div>
              <span className="font-mono text-[10px] opacity-75">New</span>
            </button>

            {/* Quick Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索历史会话…"
                className="h-8 w-full rounded-lg border border-white/[0.06] bg-black/20 pl-8 pr-7 text-[11.5px] text-mist-200 outline-none placeholder:text-mist-600 focus:border-accent/40 focus:bg-black/30 transition-colors"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center text-mist-500 hover:text-mist-200"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            {/* Platform filter tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-white/[0.04] bg-black/15 p-0.5 text-[10px]">
              {(["all", "web", "qq", "dsh"] as const).map((p) => {
                const active = platformFilter === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatformFilter(p)}
                    className={cn(
                      "flex-1 rounded py-0.5 font-medium transition-colors uppercase",
                      active
                        ? "bg-white/[0.08] text-mist-100 shadow-xs"
                        : "text-mist-500 hover:text-mist-300",
                    )}
                  >
                    {p === "all" ? "全部" : p}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Sessions List ── */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
        {loading && sessions.length === 0 ? (
          <div className="space-y-1.5 px-1 py-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-mist-600">
            {query ? "未找到匹配会话" : "暂无会话"}
          </div>
        ) : compact ? (
          <div className="flex flex-col items-center gap-1 py-1">
            {filtered.slice(0, 15).map((session) => {
              const active = selectedId === session.id;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelect(session.id)}
                  title={`${session.title} (${session.platform})`}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                    active
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-transparent text-mist-500 hover:bg-white/[0.04] hover:text-mist-200",
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  {session.pendingApprovalIds.length > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          filtered.map((session) => {
            const active = selectedId === session.id;
            const pill = PLATFORM_PILLS[session.platform];
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                className={cn(
                  "group relative flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors",
                  active
                    ? "bg-white/[0.08] text-mist-100 shadow-xs"
                    : "text-mist-400 hover:bg-white/[0.035] hover:text-mist-200",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 rounded-r bg-accent" />
                ) : null}
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded border px-1 py-px font-mono text-[8px] uppercase",
                        pill.color,
                      )}
                    >
                      {pill.label}
                    </span>
                    <span className="truncate text-[12px] font-medium leading-tight">
                      {truncate(session.title || "未命名会话", 22)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-mist-600">
                    <span>{session.turnCount} 轮</span>
                    <span>·</span>
                    <span>{formatRelativeTime(session.lastActiveAt)}</span>
                  </div>
                </div>

                {session.pendingApprovalIds.length > 0 ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400/20 text-amber-300 font-mono text-[9px] font-semibold px-1">
                    {session.pendingApprovalIds.length}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {/* ── Bottom Dock (User, Settings, Inspector, Logout) ── */}
      <div className="shrink-0 border-t border-white/[0.05] p-2">
        {compact ? (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => onViewChange("settings")}
              title="设置"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                view === "settings"
                  ? "bg-white/[0.08] text-accent"
                  : "text-mist-500 hover:bg-white/[0.04] hover:text-mist-200",
              )}
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              title="退出登录"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-600 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl bg-black/15 px-2.5 py-1.5 border border-white/[0.04]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-mist-200">老师 (Sensei)</div>
                <div className="truncate font-mono text-[8.5px] text-mist-600">
                  {stats ? `${stats.total} 会话 · 3200` : "在线"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onToggleInspector ? (
                <button
                  type="button"
                  onClick={onToggleInspector}
                  title="协同资产抽屉"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-500 hover:bg-white/[0.06] hover:text-accent transition-colors"
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => onViewChange("settings")}
                title="打开偏好设置"
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  view === "settings"
                    ? "bg-white/[0.08] text-accent"
                    : "text-mist-500 hover:bg-white/[0.06] hover:text-mist-200",
                )}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onLogout}
                title="退出登录"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-600 hover:bg-rose-500/15 hover:text-rose-400 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
