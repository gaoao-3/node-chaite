"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Cpu,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { PlatformBadge } from "@/components/platform-badge";
import type { ConnectionState } from "@/hooks/use-agent-session";
import type { AgentSessionInfo } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";

const CONNECTION_META: Record<
  ConnectionState,
  { label: string; dot: string; chip: string; pulse: boolean }
> = {
  idle: { label: "Idle", dot: "bg-zinc-600", chip: "text-mist-500", pulse: false },
  connecting: { label: "Connecting", dot: "bg-cyan-300", chip: "text-cyan-200", pulse: true },
  live: { label: "Live SSE", dot: "bg-emerald-300", chip: "text-emerald-200", pulse: true },
  reconnecting: { label: "Reconnecting", dot: "bg-amber-300", chip: "text-amber-200", pulse: true },
  offline: { label: "Offline", dot: "bg-rose-400", chip: "text-rose-300", pulse: false },
  unauthorized: { label: "Auth lost", dot: "bg-rose-400", chip: "text-rose-300", pulse: false },
  error: { label: "Stream error", dot: "bg-rose-400", chip: "text-rose-300", pulse: false },
  preview: { label: "Preview", dot: "bg-violet-300", chip: "text-violet-200", pulse: false },
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
}

export function ChatHeader({
  session,
  connection,
  pendingCount,
  skillCount,
  model,
  onMenu,
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
    <header className="glass relative z-10 flex h-[68px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-3.5 sm:px-5">
      <button
        type="button"
        onClick={onMenu}
        aria-label="切换侧边栏"
        title="切换侧边栏"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist-100"
      >
        <Menu className="h-4 w-4" />
      </button>

      {onCreateSession ? (
        <button
          type="button"
          onClick={onCreateSession}
          aria-label="新建会话"
          title="新建会话"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist-100"
        >
          <Plus className="h-4 w-4" />
        </button>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {editing ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <input
                ref={inputRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void commit();
                  }
                  if (event.key === "Escape") {
                    setEditing(false);
                    setValue(session?.title ?? "");
                  }
                }}
                onBlur={() => void commit()}
                maxLength={80}
                className="h-7 min-w-0 rounded-md border border-violet-300/25 bg-black/30 px-2 text-[13px] font-semibold text-mist-100 outline-none"
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void commit()}
                aria-label="保存标题"
                className="flex h-6 w-6 items-center justify-center rounded-md text-emerald-300 hover:bg-emerald-300/10"
              >
                {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setEditing(false);
                  setValue(session?.title ?? "");
                }}
                aria-label="取消重命名"
                className="flex h-6 w-6 items-center justify-center rounded-md text-mist-500 hover:bg-white/[0.06]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <h1
                onClick={() => { if (session) setEditing(true); }}
                className={cn(
                  "min-w-0 truncate text-[14px] font-semibold tracking-[-0.02em] text-mist-100",
                  session && "cursor-pointer hover:text-mist-200 transition-colors"
                )}
                title={session ? "点击编辑会话标题" : undefined}
              >
                {session?.title || "未选择会话"}
              </h1>
              {session ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="重命名会话"
                  title="重命名会话"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-mist-600 transition-colors hover:bg-white/[0.06] hover:text-mist-200"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-2 text-[9.5px] text-mist-600">
          {session ? (
            <>
              <PlatformBadge platform={session.platform} size="xs" />
              <span className="hidden truncate font-mono text-[9px] text-mist-600 sm:inline">
                {session.botId}
              </span>
              <span className="hidden text-mist-700 sm:inline">·</span>
              <span className="hidden items-center gap-1 sm:inline-flex">
                <Cpu className="h-2.5 w-2.5" />
                <span className="max-w-44 truncate font-mono text-[9px]">{model || session.model || "auto"}</span>
              </span>
              {skillCount > 0 ? (
                <span className="hidden items-center gap-1 md:inline-flex">
                  <Sparkles className="h-2.5 w-2.5 text-violet-300/60" />
                  <span>{skillCount} skills</span>
                </span>
              ) : null}
              <span className="hidden text-mist-700 lg:inline">·</span>
              <span className="hidden text-mist-600 lg:inline">{formatRelativeTime(session.lastActiveAt)}活跃</span>
            </>
          ) : (
            <span>从左侧选择一个会话</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {pendingCount > 0 ? (
          <button
            type="button"
            onClick={onOpenApprovals}
            className="hidden items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2.5 py-1 text-[10px] font-medium text-amber-100 transition-colors hover:bg-amber-300/[0.14] sm:inline-flex"
          >
            <ShieldAlert className="h-3 w-3" />
            {pendingCount} 待审批
            <ChevronDown className="h-2.5 w-2.5 -rotate-90" />
          </button>
        ) : null}

        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium",
            meta.chip,
          )}
          title={`SSE: /api/agent/sessions/${session?.id ?? ":id"}/events`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {meta.pulse ? (
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-50", meta.dot)} />
            ) : null}
            <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", meta.dot)} />
          </span>
          <span className="hidden sm:inline">{meta.label}</span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          aria-label="重新连接事件流"
          title="重新连接事件流"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-600 transition-colors hover:bg-white/[0.055] hover:text-mist-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
