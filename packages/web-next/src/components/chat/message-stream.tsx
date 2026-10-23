"use client";

import * as React from "react";
import { ArrowDown, Info, RadioTower, WifiOff, X } from "lucide-react";
import { ApprovalCard } from "@/components/chat/approval-card";
import { ChatEmptyState } from "@/components/chat/empty-state";
import { AssistantMessage, ErrorNotice, UserMessage } from "@/components/chat/messages";
import { ThoughtCard } from "@/components/chat/thought-card";
import { ToolCallCard } from "@/components/chat/tool-call-card";
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
  autoScroll?: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[760px] space-y-7 py-8">
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
      <div className="mx-auto mb-4 flex w-full max-w-[760px] items-center gap-2 rounded-xl border border-amber-300/18 bg-amber-300/[0.055] px-3 py-2 text-[10.5px] text-amber-200/90">
        <RadioTower className="h-3.5 w-3.5 animate-pulse" />
        事件流中断，正在携带 Last-Event-ID 重连…
      </div>
    );
  }
  if (connection === "offline" || connection === "error") {
    return (
      <div className="mx-auto mb-4 flex w-full max-w-[760px] items-center gap-2 rounded-xl border border-rose-400/18 bg-rose-400/[0.055] px-3 py-2 text-[10.5px] text-rose-200/90">
        <WifiOff className="h-3.5 w-3.5" />
        SSE 连接不可用。请检查后端是否运行在 127.0.0.1:3200，或点击右上角重连。
      </div>
    );
  }
  if (connection === "unauthorized") {
    return (
      <div className="mx-auto mb-4 flex w-full max-w-[760px] items-center gap-2 rounded-xl border border-rose-400/18 bg-rose-400/[0.055] px-3 py-2 text-[10.5px] text-rose-200/90">
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
  autoScroll = true,
}: MessageStreamProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const stickRef = React.useRef(true);
  const [showJump, setShowJump] = React.useState(false);

  const scrollToBottom = React.useCallback((smooth = false) => {
    const container = scrollRef.current;
    if (!container) return;
    stickRef.current = true;
    setShowJump(false);
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  const onScroll = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const stick = distance < 140;
    stickRef.current = stick;
    setShowJump(!stick && distance > 260);
  }, []);

  React.useEffect(() => {
    stickRef.current = true;
    scrollToBottom();
  }, [scrollToBottom, view.session?.id]);

  React.useEffect(() => {
    if (!autoScroll || !stickRef.current) return;
    const frame = window.requestAnimationFrame(() => scrollToBottom());
    return () => window.cancelAnimationFrame(frame);
  }, [autoScroll, scrollToBottom, view.timeline, view.typing]);

  const totalItems = view.timeline.length;
  const lastAssistant = [...view.timeline].reverse().find((item) => item.kind === "assistant");

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain px-4 pb-10 pt-4 sm:px-7 sm:pt-6"
      >
        <ConnectionBanner connection={connection} />

        {preview ? (
          <div className="mx-auto mb-5 flex w-full max-w-[760px] items-center gap-2.5 rounded-xl border border-violet-300/18 bg-violet-400/[0.05] px-3 py-2">
            <Info className="h-3.5 w-3.5 shrink-0 text-violet-300" />
            <span className="text-[10.5px] text-violet-200/80">
              本地设计预览：思考、工具调用与审批均为静态示例，不会提交到后端。
            </span>
            <button
              type="button"
              onClick={onExitPreview}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-300/20 px-1.5 py-0.5 text-[9.5px] text-violet-200 transition-colors hover:bg-violet-300/10"
            >
              <X className="h-2.5 w-2.5" />
              退出
            </button>
          </div>
        ) : null}

        {loading && totalItems === 0 ? (
          <LoadingSkeleton />
        ) : totalItems === 0 ? (
          <ChatEmptyState onSuggestion={onSuggestion} hasSession={hasSession} preview={preview} />
        ) : (
          <div className="chat-stream mx-auto flex w-full max-w-[760px] flex-col gap-4 pb-2">
            {view.timeline.map((item) => {
              if (item.kind === "user") return <UserMessage key={item.id} item={item} />;
              if (item.kind === "thought") {
                return <ThoughtCard key={item.id} text={item.text} done={item.done} createdAt={item.createdAt} />;
              }
              if (item.kind === "tool") {
                return <ToolCallCard key={item.id} call={item.call} createdAt={item.createdAt} />;
              }
              if (item.kind === "assistant") {
                return (
                  <AssistantMessage
                    key={item.id}
                    item={item}
                    streaming={view.isStreaming && item.id === lastAssistant?.id}
                  />
                );
              }
              if (item.kind === "approval") {
                const approval: ApprovalState | undefined = view.approvals[item.requestId];
                if (!approval) return null;
                return <ApprovalCard key={item.id} approval={approval} onRespond={onRespond} />;
              }
              return (
                <ErrorNotice key={item.id} message={item.message} code={item.code} fatal={item.fatal} />
              );
            })}

            {view.typing && !view.isStreaming ? (
              <div className="flex items-center gap-2 pl-11 text-[10px] text-mist-600">
                <span className="h-1 w-1 animate-pulse rounded-full bg-violet-300" />
                typing…
              </div>
            ) : null}
            <div ref={bottomRef} className="h-px" />
          </div>
        )}
      </div>

      {showJump ? (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/[0.1] bg-ink-800/90 px-3 text-[10.5px] text-mist-300 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md transition-colors hover:border-white/[0.16] hover:text-white animate-fade-in"
        >
          <ArrowDown className="h-3 w-3" />
          回到最新
        </button>
      ) : null}

      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-ink-950/50 to-transparent")} />
    </div>
  );
}
