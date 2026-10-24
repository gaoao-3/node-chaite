"use client";

import * as React from "react";
import {
  Cpu,
  Layers,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Wrench,
  Puzzle,
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
  onOpenChannels?: () => void;
  onOpenSkills?: () => void;
  onOpenMcp?: () => void;
  onOpenPlugins?: () => void;
}

export function Sidebar({
  sessions,
  stats,
  selectedId,
  view,
  collapsed,
  mobileOpen,
  loading,
  onSelect,
  onCreate,
  onToggleCollapse,
  onCloseMobile,
  onViewChange,
  onLogout,
  onToggleInspector,
  onOpenChannels,
  onOpenSkills,
  onOpenMcp,
  onOpenPlugins,
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
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-[var(--bg)] transition-all duration-200 md:static md:z-20 md:translate-x-0",
        mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        compact ? "w-[60px]" : "w-[256px]",
      )}
    >
      {/* ── Top Header / Brand (44px) ── */}
      <div
        className={cn(
          "flex h-[44px] shrink-0 items-center border-b border-white/[0.05]",
          compact ? "justify-center px-1" : "justify-between px-3",
        )}
      >
        {compact ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="展开侧栏"
            className="flex h-7 w-7 items-center justify-center rounded-md text-mist-400 hover:bg-white/[0.06] hover:text-mist-100 transition-colors"
          >
            <BrandMark size={20} />
          </button>
        ) : (
          <>
            <BrandLockup compact />
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onToggleCollapse}
                title={collapsed ? "展开侧栏" : "收起侧栏"}
                className="hidden h-7 w-7 items-center justify-center rounded-md text-mist-500 hover:bg-white/[0.06] hover:text-mist-200 md:flex transition-colors"
              >
                {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                title="关闭侧栏"
                className="flex h-7 w-7 items-center justify-center rounded-md text-mist-500 hover:bg-white/[0.06] hover:text-mist-200 md:hidden"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── New Chat & Search ── */}
      <div className={cn("shrink-0 space-y-1.5 p-2", compact && "px-1.5 py-2")}>
        {compact ? (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onCreate}
              title="新建会话"
              className="flex h-8 w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text)] hover:opacity-80 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onOpenChannels}
              title="模型渠道"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors"
            >
              <Cpu className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenSkills}
              title="技能中心"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenMcp}
              title="MCP 服务"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors"
            >
              <Wrench className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onCreate}
              className="flex h-8 w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 text-[12px] font-medium text-mist-200 hover:bg-white/[0.07] hover:text-white hover:border-white/[0.14] transition-all"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-mist-400" />
                <span>新建会话</span>
              </div>
              <span className="font-mono text-[9px] text-mist-600">New</span>
            </button>

            {/* Quick Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-mist-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索会话…"
                className="h-7 w-full rounded-md border border-white/[0.06] bg-black/20 pl-7 pr-6 text-[11px] text-mist-200 outline-none placeholder:text-mist-600 focus:border-white/[0.15] focus:bg-black/30 transition-colors"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center text-mist-500 hover:text-mist-200"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              ) : null}
            </div>

            {/* Platform filter tabs */}
            <div className="flex items-center gap-0.5 rounded-md bg-white/[0.02] p-0.5 text-[9.5px]">
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
                        ? "bg-white/[0.08] text-mist-100 font-semibold"
                        : "text-mist-500 hover:text-mist-300",
                    )}
                  >
                    {p === "all" ? "全部" : p}
                  </button>
                );
              })}
            </div>

            {/* Quick Management Nav (Channels, Skills, MCP) */}
            <div className="flex items-center gap-1 pt-0.5 text-[10.5px]">
              <button
                type="button"
                onClick={onOpenChannels}
                className="flex-1 flex items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-hover)] py-1 text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                title="模型渠道设置"
              >
                <Cpu className="h-3 w-3" />
                <span>渠道</span>
              </button>
              <button
                type="button"
                onClick={onOpenSkills}
                className="flex-1 flex items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-hover)] py-1 text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                title="技能中心 SOP"
              >
                <Sparkles className="h-3 w-3" />
                <span>技能</span>
              </button>
              <button
                type="button"
                onClick={onOpenMcp}
                className="flex-1 flex items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-hover)] py-1 text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                title="MCP 外部驱动服务"
              >
                <Wrench className="h-3 w-3" />
                <span>MCP</span>
              </button>
              <button
                type="button"
                onClick={onOpenPlugins}
                className="flex-1 flex items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-hover)] py-1 text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                title="插件生态与源码管理"
              >
                <Puzzle className="h-3 w-3" />
                <span>插件</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Sessions List ── */}
      <div className="flex-1 overflow-y-auto px-1.5 py-0.5 space-y-0.5">
        {loading && sessions.length === 0 ? (
          <div className="space-y-1 px-1 py-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-mist-600">
            {query ? "未找到会话" : "暂无历史会话"}
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
                    "relative flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    active
                      ? "bg-white/[0.1] text-white"
                      : "text-mist-500 hover:bg-white/[0.04] hover:text-mist-200",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {session.pendingApprovalIds.length > 0 ? (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          filtered.map((session) => {
            const active = selectedId === session.id;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                className={cn(
                  "group relative flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors",
                  active
                    ? "bg-white/[0.08] text-mist-100"
                    : "text-mist-400 hover:bg-white/[0.035] hover:text-mist-200",
                )}
              >
                <div className="min-w-0 flex-1 pr-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-medium leading-tight">
                      {truncate(session.title?.replace(/_/g, " ") || "未命名会话", 20)}
                    </span>
                    <span className="font-mono text-[8px] uppercase text-mist-600 shrink-0">
                      {session.platform}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-mist-600">
                    <span>{session.turnCount} 轮</span>
                    <span>·</span>
                    <span>{formatRelativeTime(session.lastActiveAt)}</span>
                  </div>
                </div>

                {session.pendingApprovalIds.length > 0 ? (
                  <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-400/20 text-amber-300 font-mono text-[8px] px-1 font-semibold">
                    {session.pendingApprovalIds.length}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {/* ── Bottom Dock (Minimal User & Settings) ── */}
      <div className="shrink-0 border-t border-white/[0.05] p-1.5">
        {compact ? (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => onViewChange("settings")}
              title="设置"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                view === "settings"
                  ? "bg-white/[0.08] text-white"
                  : "text-mist-500 hover:bg-white/[0.04] hover:text-mist-200",
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              title="退出"
              className="flex h-7 w-7 items-center justify-center rounded-md text-mist-600 hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-[11.5px] font-medium text-mist-200">老师</div>
                <div className="truncate font-mono text-[8.5px] text-mist-600">
                  {stats ? `${stats.total} 会话` : "在线"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {onToggleInspector ? (
                <button
                  type="button"
                  onClick={onToggleInspector}
                  title="协同面板"
                  className="flex h-6.5 w-6.5 items-center justify-center rounded-md text-mist-500 hover:bg-white/[0.06] hover:text-mist-200 transition-colors"
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => onViewChange("settings")}
                title="设置"
                className={cn(
                  "flex h-6.5 w-6.5 items-center justify-center rounded-md transition-colors",
                  view === "settings"
                    ? "bg-white/[0.08] text-white"
                    : "text-mist-500 hover:bg-white/[0.06] hover:text-mist-200",
                )}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onLogout}
                title="退出登录"
                className="flex h-6.5 w-6.5 items-center justify-center rounded-md text-mist-600 hover:text-rose-400 transition-colors"
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
