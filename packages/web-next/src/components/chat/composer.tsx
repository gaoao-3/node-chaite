"use client";

import * as React from "react";
import {
  CircleAlert,
  Cpu,
  SendHorizontal,
  Sparkles,
  Square,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => Promise<boolean> | void;
  onCancel: () => void;
  disabled?: boolean;
  streaming: boolean;
  promptPending: boolean;
  preview: boolean;
  model?: string;
  skillCount: number;
  error: string | null;
  onDismissError: () => void;
}

export function Composer({
  value,
  onChange,
  onSend,
  onCancel,
  disabled = false,
  streaming,
  promptPending,
  preview,
  model,
  skillCount,
  error,
  onDismissError,
}: ComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const busy = streaming || promptPending;
  const canSend = value.trim().length > 0 && !busy && !disabled && !preview;

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const next = Math.min(textarea.scrollHeight, 208);
    textarea.style.height = `${Math.max(44, next)}px`;
  }, [value]);

  const submit = async () => {
    if (!canSend) return;
    const text = value;
    onChange("");
    await onSend(text);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.nativeEvent.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    if (event.metaKey || event.ctrlKey || !event.altKey) {
      void submit();
    }
  };

  return (
    <div className="relative shrink-0 px-3 pb-3 pt-1.5 sm:px-6 sm:pb-5">
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-ink-950/85 to-transparent" />
      <div className="mx-auto w-full max-w-[760px]">
        {error ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-rose-400/18 bg-rose-400/[0.06] px-3 py-2 text-[10.5px] leading-relaxed text-rose-200/90 animate-fade-in">
            <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button
              type="button"
              onClick={onDismissError}
              aria-label="忽略错误"
              className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded text-rose-300/70 hover:bg-rose-400/10 hover:text-rose-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className={cn(
            "group relative overflow-hidden rounded-[17px] border bg-[#0c0c12]/90 shadow-[0_-10px_40px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-xl transition-colors",
            streaming ? "border-cyan-300/18" : "border-white/[0.085] focus-within:border-violet-300/28",
          )}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/35 to-transparent opacity-70" />
          {streaming ? (
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(103,232,249,0.8),transparent)]" />
          ) : null}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              preview
                ? "设计预览模式 · 退出预览后可发送指令"
                : streaming
                  ? "Agent 正在运行，你可以先起草下一条指令…"
                  : disabled
                    ? "请先创建或选择一个会话"
                    : "向 Chaite Agent 下达指令…  Enter 发送，Shift+Enter 换行"
            }
            rows={1}
            spellCheck={false}
            aria-label="消息输入框"
            className="max-h-[208px] min-h-[44px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[13px] leading-[1.65] text-mist-100 outline-none placeholder:text-mist-600 disabled:cursor-not-allowed sm:px-4"
          />

          <div className="flex items-center gap-2 px-2.5 pb-2 pt-1 sm:px-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="inline-flex h-6 items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.025] px-1.5 font-mono text-[9px] text-mist-500">
                <Cpu className="h-2.5 w-2.5 text-violet-300/70" />
                <span className="max-w-[110px] truncate">{model || "auto"}</span>
              </span>
              {skillCount > 0 ? (
                <span className="hidden h-6 items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.025] px-1.5 text-[9px] text-mist-500 sm:inline-flex">
                  <Sparkles className="h-2.5 w-2.5 text-cyan-300/60" />
                  {skillCount} skills
                </span>
              ) : null}
              {preview ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-md border border-violet-300/15 bg-violet-400/[0.06] px-1.5 text-[9px] text-violet-200/80">
                  <Zap className="h-2.5 w-2.5" />
                  Preview
                </span>
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-1 text-[9px] text-mist-700 md:inline-flex">
                <Kbd>Enter</Kbd> 发送
                <span className="mx-0.5 text-mist-700">·</span>
                <Kbd>Shift</Kbd>
                <span className="text-mist-700">+</span>
                <Kbd>Enter</Kbd> 换行
              </span>
              {streaming ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={onCancel}
                  className="h-8 gap-1.5"
                  title="终止当前生成"
                >
                  <Square className="h-3 w-3 fill-current" />
                  停止
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="icon-sm"
                  disabled={!canSend}
                  loading={promptPending}
                  aria-label="发送消息"
                  title="发送消息 (Enter)"
                  className="h-8 w-8 rounded-[9px]"
                >
                  {!promptPending ? <SendHorizontal className="h-3.5 w-3.5" /> : null}
                </Button>
              )}
            </div>
          </div>
        </form>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-[9px] text-mist-700">
          <span className="h-1 w-1 rounded-full bg-emerald-300/60" />
          {preview ? "静态演示 · 不会调用后端" : "SSE 端到端加密通道 · Bearer JWT"}
        </div>
      </div>
    </div>
  );
}
