"use client";

import * as React from "react";
import { ArrowDown, Info, RadioTower, WifiOff, X } from "lucide-react";
import { ApprovalCard } from "@/components/chat/approval-card";
import { ChatEmptyState } from "@/components/chat/empty-state";
import { AssistantMessage, ErrorNotice, UserMessage } from "@/components/chat/messages";
import { ThoughtCard } from "@/components/chat/thought-card";
import { ToolCallGroup } from "@/components/chat/tool-call-group";
import { Skeleton } from "@/components/ui/spinner";
import type { ConnectionState } from "@/hooks/use-agent-session";
import type { ApprovalState, StreamView } from "@/lib/timeline";
import type { HumanApprovalOption } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageStreamProps {
  view: StreamView;
  connection: ConnectionState;
  loading: boolean;
  preview: boolean;
  hasSession: boolean;
  onSuggestion: (prompt: string) => void;
  onRespond: (requestId: string, option: HumanApprovalOption) => Promise<boolean>;
  onExitPreview: () => void;
  onCreateSession?: () => void;
  autoScroll?: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[var(--chat-content-max-width,820px)] space-y-7 py-8">
      <div className="flex justify-end gap-3">
        <div className="space-y-2">
          <Skeleton className="ml-auto h-3 w-24" />
          <Skeleton className="h-16 w-[300px] rounded-2xl" />
        </div>
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[82%]" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ConnectionBanner({ connection }: { connection: ConnectionState }) {
  if (connection === "reconnecting") {
    return (
      <div className="mx-auto mb-4 flex w-full max-w-[var(--chat-content-max-width,820px)] items-center gap-2 rounded-xl border border-amber-300/18 bg-amber-300/[0.055] px-3 py-2 text-[10.5px] text-amber-200/90">
        <RadioTower className="h-3.5 w-3.5 animate-pulse" />
        事件流中断，正在携带 Last-Event-ID 重连…
      </div>
    );
  }
  if (connection === "offline" || connection === "error") {
    return (
      <div className="mx-auto mb-4 flex w-full max-w-[var(--chat-content-max-width,820px)] items-center gap-2 rounded-xl border border-rose-400/18 bg-rose-400/[0.055] px-3 py-2 text-[10.5px] text-rose-200/90">
        <WifiOff className="h-3.5 w-3.5" />
        SSE 连接不可用。请检查后端是否运行在 127.0.0.1:3200，或点击右上角重连。
      </div>
    );
  }
  if (connection === "unauthorized") {
    return (
      <div className="mx-auto mb-4 flex w-full max-w-[var(--chat-content-max-width,820px)] items-center gap-2 rounded-xl border border-rose-400/18 bg-rose-400/[0.055] px-3 py-2 text-[10.5px] text-rose-200/90">
        <WifiOff className="h-3.5 w-3.5" />
        登录凭据已失效，请退出后重新输入口令。
      </div>
    );
  }
  return null;
}

export function MessageStream({
  view,
  connection,
  loading,
  preview,
  hasSession,
  onSuggestion,
  onRespond,
  onExitPreview,
  onCreateSession,
  autoScroll = true,
}: MessageStreamProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const stickRef = React.useRef(true);
  const [showJump, setShowJump] = React.useState(false);

  const scrollToBottom = React.useCallback((smooth = false) => {
    const container = scrollRef.current;
    if (!container || view.timeline.length === 0) return;
    stickRef.current = true;
    setShowJump(false);
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [view.timeline.length]);

  const onScroll = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const stick = distance < 140;
    stickRef.current = stick;
    setShowJump(!stick && distance > 260);
  }, []);

  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (view.timeline.length === 0) {
      container.scrollTop = 0;
      stickRef.current = false;
      return;
    }
    stickRef.current = true;
    scrollToBottom();
  }, [scrollToBottom, view.session?.id, view.timeline.length]);

  React.useEffect(() => {
    if (!autoScroll || !stickRef.current || view.timeline.length === 0) return;
    const frame = window.requestAnimationFrame(() => scrollToBottom());
    return () => window.cancelAnimationFrame(frame);
  }, [autoScroll, scrollToBottom, view.timeline, view.typing]);

  const totalItems = view.timeline.length;
  const lastAssistant = [...view.timeline].reverse().find((item) => item.kind === "assistant");

  // Group adjacent tool calls into tool_group
  const groupedItems = React.useMemo(() => {
    type GroupItem =
      | { kind: "user"; id: string; item: any }
      | { kind: "thought"; id: string; item: any }
      | { kind: "assistant"; id: string; item: any }
      | { kind: "approval"; id: string; item: any }
      | { kind: "error"; id: string; item: any }
      | {
          kind: "tool_group";
          id: string;
          items: Array<{ id: string; createdAt: number; call: any }>;
        };

    const list: GroupItem[] = [];
    let currentTools: Array<{ id: string; createdAt: number; call: any }> | null = null;

    for (const item of view.timeline) {
      if (item.kind === "tool") {
        if (!currentTools) currentTools = [];
        currentTools.push({ id: item.id, createdAt: item.createdAt, call: item.call });
      } else {
        if (currentTools && currentTools.length > 0) {
          list.push({
            kind: "tool_group",
            id: `tool_group_${currentTools[0].id}`,
            items: currentTools,
          });
          currentTools = null;
        }
        list.push({ kind: item.kind, id: item.id, item: item as any });
      }
    }

    if (currentTools && currentTools.length > 0) {
      list.push({
        kind: "tool_group",
        id: `tool_group_${currentTools[0].id}`,
        items: currentTools,
      });
    }

    return list;
  }, [view.timeline]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain px-4 pb-12 pt-4 sm:px-7 sm:pt-6"
      >
        <ConnectionBanner connection={connection} />

        {preview ? (
          <div className="mx-auto mb-5 flex w-full max-w-[var(--chat-content-max-width,820px)] items-center gap-2.5 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] px-3 py-2">
            <Info className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-300" />
            <span className="text-[11px] text-violet-700 dark:text-violet-200">
              本地设计预览：思考、工具调用与审批均为静态示例，不会提交到后端。
            </span>
            <button
              type="button"
              onClick={onExitPreview}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-500/30 px-1.5 py-0.5 text-[9.5px] text-violet-700 dark:text-violet-200 transition-colors hover:bg-violet-500/10"
            >
              <X className="h-2.5 w-2.5" />
              退出
            </button>
          </div>
        ) : null}

        {loading && totalItems === 0 ? (
          <LoadingSkeleton />
        ) : totalItems === 0 ? (
          <ChatEmptyState onSuggestion={onSuggestion} hasSession={hasSession} preview={preview} onCreateSession={onCreateSession} />
        ) : (
          <div className="chat-stream mx-auto flex w-full max-w-[var(--chat-content-max-width,820px)] flex-col gap-4 pb-2">
            {groupedItems.map((entry) => {
              if (entry.kind === "user") return <UserMessage key={entry.id} item={entry.item} />;
              if (entry.kind === "thought") {
                return (
                  <ThoughtCard
                    key={entry.id}
                    text={entry.item.text}
                    done={entry.item.done}
                    createdAt={entry.item.createdAt}
                    durationMs={entry.item.durationMs}
                  />
                );
              }
              if (entry.kind === "tool_group") {
                return <ToolCallGroup key={entry.id} items={entry.items} />;
              }
              if (entry.kind === "assistant") {
                return (
                  <AssistantMessage
                    key={entry.id}
                    item={entry.item}
                    streaming={view.isStreaming && entry.item.id === lastAssistant?.id}
                  />
                );
              }
              if (entry.kind === "approval") {
                const approval: ApprovalState | undefined = view.approvals[entry.item.requestId];
                if (!approval) return null;
                return <ApprovalCard key={entry.id} approval={approval} onRespond={onRespond} />;
              }
              return (
                <ErrorNotice key={entry.id} message={entry.item.message} code={entry.item.code} fatal={entry.item.fatal} />
              );
            })}

            {view.typing && !view.isStreaming ? (
              <div className="flex items-center gap-2 pl-11 text-[11px] text-[var(--text-muted)] font-mono">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                正在生成中…
              </div>
            ) : null}
            <div ref={bottomRef} className="h-12 shrink-0" />
          </div>
        )}
      </div>

      {showJump ? (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 left-1/2 z-20 flex h-7.5 -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 text-[11px] font-medium text-[var(--text)] shadow-lg backdrop-blur-md transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] animate-spring-up active:scale-95"
        >
          <ArrowDown className="h-3 w-3" />
          回到最新
        </button>
      ) : null}

      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-ink-950/50 to-transparent")} />
    </div>
  );
}
