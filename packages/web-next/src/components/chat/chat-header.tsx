"use client";

import * as React from "react";
import {
  Check,
  Layers,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import type { ConnectionState } from "@/hooks/use-agent-session";
import type { AgentSessionInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONNECTION_META: Record<
  ConnectionState,
  { label: string; dot: string; pulse: boolean }
> = {
  idle: { label: "Idle", dot: "bg-zinc-600", pulse: false },
  connecting: { label: "Connecting", dot: "bg-cyan-400", pulse: true },
  live: { label: "Live", dot: "bg-emerald-400", pulse: true },
  reconnecting: { label: "Reconnecting", dot: "bg-amber-400", pulse: true },
  offline: { label: "Offline", dot: "bg-rose-400", pulse: false },
  unauthorized: { label: "Auth lost", dot: "bg-rose-400", pulse: false },
  error: { label: "Stream error", dot: "bg-rose-400", pulse: false },
  preview: { label: "Preview", dot: "bg-purple-400", pulse: false },
};

export interface ChatHeaderProps {
  session: AgentSessionInfo | null;
  connection: ConnectionState;
  pendingCount: number;
  skillCount: number;
  model?: string;
  onMenu: () => void;
  onRename: (title: string) => Promise<boolean>;
  onRefresh: () => void;
  onOpenApprovals: () => void;
  onCreateSession?: () => void;
  onToggleInspector?: () => void;
  inspectorOpen?: boolean;
}

export function ChatHeader({
  session,
  connection,
  pendingCount,
  model,
  onMenu,
  onToggleInspector,
  inspectorOpen,
  onRename,
  onRefresh,
  onOpenApprovals,
  onCreateSession,
}: ChatHeaderProps) {
  const meta = CONNECTION_META[connection] ?? CONNECTION_META.idle;
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(session?.title ?? "");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setValue(session?.title ?? "");
    setEditing(false);
  }, [session?.id, session?.title]);

  React.useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    const title = value.trim();
    if (!title || title === session?.title) {
      setEditing(false);
      setValue(session?.title ?? "");
      return;
    }
    setSaving(true);
    const ok = await onRename(title);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <header className="relative z-10 flex h-[44px] shrink-0 items-center justify-between border-b border-white/[0.06] bg-[var(--bg)] px-2.5 sm:px-3.5">
      {/* ── Left Area: Menu toggle, Session Title ── */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={onMenu}
          aria-label="切换侧栏"
          title="切换侧栏"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-mist-500 hover:bg-white/[0.06] hover:text-mist-100 transition-colors"
        >
          <Menu className="h-4 w-4" />
        </button>

        {onCreateSession ? (
          <button
            type="button"
            onClick={onCreateSession}
            aria-label="新建会话"
            title="新建会话"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-mist-500 hover:bg-white/[0.06] hover:text-mist-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}

        <div className="flex items-center gap-1.5 min-w-0 ml-1">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commit();
                  }
                  if (e.key === "Escape") {
                    setEditing(false);
                    setValue(session?.title ?? "");
                  }
                }}
                onBlur={() => void commit()}
                maxLength={80}
                className="h-6 rounded border border-accent bg-black/40 px-1.5 font-medium text-[13px] text-mist-100 outline-none"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void commit()}
                className="flex h-6 w-6 items-center justify-center rounded text-emerald-400 hover:bg-emerald-500/15"
              >
                {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setEditing(false);
                  setValue(session?.title ?? "");
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-mist-500 hover:bg-white/[0.06]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 group">
              <h1
                onClick={() => {
                  if (session) setEditing(true);
                }}
                className={cn(
                  "truncate max-w-[160px] sm:max-w-[320px] text-[13px] font-semibold text-mist-100",
                  session && "cursor-pointer hover:text-accent transition-colors",
                )}
                title={session ? "点击编辑标题" : undefined}
              >
                {session?.title?.replace(/_/g, " ") || "未选择会话"}
              </h1>

              {session ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    title="重命名会话"
                    className="opacity-0 group-hover:opacity-100 text-mist-500 hover:text-mist-200 transition-opacity"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>

                  <span className="rounded bg-black/20 border border-white/[0.06] px-1 py-px font-mono text-[8.5px] uppercase text-mist-500">
                    {session.platform}
                  </span>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Area: Approvals, Live SSE, Inspector Toggle ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {pendingCount > 0 ? (
          <button
            type="button"
            onClick={onOpenApprovals}
            className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9.5px] font-medium text-amber-200 hover:bg-amber-400/20 transition-colors"
          >
            <ShieldAlert className="h-3 w-3 text-amber-300" />
            <span>{pendingCount} 待审批</span>
          </button>
        ) : null}

        {/* Live SSE status pill */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/10 px-2 py-0.5 text-[9.5px] font-mono text-mist-400">
          <span className="relative flex h-1.5 w-1.5">
            {meta.pulse ? (
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", meta.dot)} />
            ) : null}
            <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", meta.dot)} />
          </span>
          <span>{meta.label}</span>
        </div>

        {/* Inspector toggle button */}
        {onToggleInspector ? (
          <button
            type="button"
            onClick={onToggleInspector}
            title={inspectorOpen ? "收起协同抽屉" : "展开协同抽屉"}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
              inspectorOpen
                ? "border-accent bg-accent/15 text-accent"
                : "border-white/[0.08] bg-white/[0.02] text-mist-400 hover:border-white/[0.16] hover:text-mist-100",
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">协同面板</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onRefresh}
          title="刷新连接"
          className="flex h-7 w-7 items-center justify-center rounded-md text-mist-500 hover:text-mist-200 hover:bg-white/[0.06] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
