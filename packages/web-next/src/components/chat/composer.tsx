"use client";

import * as React from "react";
import {
  ChevronDown,
  CircleAlert,
  FileCode,
  Square,
  X,
} from "lucide-react";
import {
  SendArrowIcon,
  PlusAttachmentIcon,
  CpuChipIcon,
  GlobeWireIcon,
  TokenCoinIcon,
  CacheLightningIcon,
} from "@/components/icons/zen-icons";
import { ThinkingLevelSelector, type ThinkingLevel } from "@/components/chat/thinking-level-selector";
import type { GatewayUsage } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

export interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  type: "image" | "file";
  dataUrl?: string;
  textContent?: string;
}

export interface ComposerSendOptions {
  model?: string;
  webSearch?: boolean;
  deepThinking?: boolean;
  thinkingLevel?: ThinkingLevel;
  attachments?: AttachmentItem[];
}

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string, options?: ComposerSendOptions) => Promise<boolean> | void;
  onCancel: () => void;
  disabled?: boolean;
  streaming: boolean;
  promptPending: boolean;
  preview: boolean;
  model?: string;
  onModelChange?: (model: string) => void;
  skillCount: number;
  error: string | null;
  onDismissError: () => void;
  usage?: GatewayUsage;
}

const PRESET_MODELS = [
  { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash", desc: "本地高速 · 默认首选", badge: "⚡" },
  { id: "claude-3.7-sonnet", label: "Claude 3.7 Sonnet", desc: "架构师 · 深度推理", badge: "🧠" },
  { id: "deepseek-v4.1-flash", label: "DeepSeek V4.1", desc: "极速副手 · 工具执行", badge: "🚀" },
  { id: "gpt-4o", label: "GPT-4o", desc: "OpenAI 旗舰全能多模态", badge: "🌐" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  onModelChange,
  error,
  onDismissError,
  usage,
}: ComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedModel, setSelectedModel] = React.useState(model || "gemini-3.8-flash-high");
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const modelMenuRef = React.useRef<HTMLDivElement>(null);

  const [webSearchActive, setWebSearchActive] = React.useState(false);
  const [deepThinkingActive, setDeepThinkingActive] = React.useState(false);
  const [thinkingLevel, setThinkingLevel] = React.useState<ThinkingLevel>("medium");

  const [usageOpen, setUsageOpen] = React.useState(false);
  const usageMenuRef = React.useRef<HTMLDivElement>(null);

  const [attachments, setAttachments] = React.useState<AttachmentItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    if (model && model !== "auto") {
      setSelectedModel(model);
    }
  }, [model]);

  // Outside click for model selector
  React.useEffect(() => {
    if (!modelMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelMenuOpen]);

  // Outside click for usage popover
  React.useEffect(() => {
    if (!usageOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (usageMenuRef.current && !usageMenuRef.current.contains(e.target as Node)) {
        setUsageOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [usageOpen]);

  const busy = streaming || promptPending;
  const canSend = (value.trim().length > 0 || attachments.length > 0) && !busy && !disabled && !preview;

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const next = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${Math.max(44, next)}px`;
  }, [value]);

  const handleSelectModel = (m: string) => {
    setSelectedModel(m);
    onModelChange?.(m);
    setModelMenuOpen(false);
  };

  const submit = async () => {
    if (!canSend) return;
    const text = value;
    const currentAttachments = [...attachments];
    onChange("");
    setAttachments([]);
    await onSend(text, {
      model: selectedModel,
      webSearch: webSearchActive,
      deepThinking: deepThinkingActive,
      thinkingLevel,
      attachments: currentAttachments,
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const newItems: AttachmentItem[] = [];
    for (const file of Array.from(files)) {
      const isImg = file.type.startsWith("image/");
      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      if (isImg) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newItems.push({ id, name: file.name, size: file.size, type: "image", dataUrl });
      } else {
        try {
          const text = await file.text();
          newItems.push({ id, name: file.name, size: file.size, type: "file", textContent: text });
        } catch {
          newItems.push({ id, name: file.name, size: file.size, type: "file" });
        }
      }
    }
    setAttachments((prev) => [...prev, ...newItems]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Token & Cache statistics
  const totalTok = usage?.totalTokens ?? 0;
  const promptTok = usage?.promptTokens ?? 0;
  const cachedTok = usage?.cachedTokens ?? 0;
  const completionTok = usage?.completionTokens ?? 0;
  const reasoningTok = usage?.reasoningTokens ?? 0;
  const cacheRate = promptTok > 0 && cachedTok > 0
    ? Math.min(100, Math.round((cachedTok / promptTok) * 100))
    : null;

  return (
    <div className="relative shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 sm:px-8 sm:pb-5">
      <div className="mx-auto w-full max-w-[var(--chat-content-max-width,820px)]">
        {/* Error notice */}
        {error ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-700 dark:text-rose-200 animate-slide-up-fade">
            <span className="truncate">{error}</span>
            <button type="button" onClick={onDismissError} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-100">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}

        {/* Minimal Floating Composer Card */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "group relative rounded-xl border bg-[var(--bg-panel)] transition-all duration-150",
            isDragging
              ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
              : "border-[var(--border)] focus-within:border-[var(--border)] focus-within:shadow-sm",
          )}
        >
          {/* Attachments preview */}
          {attachments.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-2.5">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] p-1 pr-2 text-[10.5px] text-[var(--text)] animate-scale-in"
                >
                  {att.type === "image" && att.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={att.dataUrl} alt={att.name} className="h-6 w-6 rounded object-cover border border-[var(--border)]" />
                  ) : (
                    <FileCode className="h-3.5 w-3.5 text-[var(--accent)] ml-1" />
                  )}
                  <span className="max-w-[100px] truncate font-medium">{att.name}</span>
                  <span className="font-mono text-[8.5px] text-[var(--text-dim)]">({formatFileSize(att.size)})</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="ml-0.5 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Clean Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              streaming
                ? "Agent 正在生成中…"
                : disabled
                  ? "请选择或新建会话"
                  : "输入你的需求或问题…"
            }
            rows={1}
            spellCheck={false}
            className="w-full resize-none border-0 bg-transparent px-3.5 pt-3 pb-2 text-[calc(14px_+_var(--chat-font-size-offset))] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-dim)] disabled:cursor-not-allowed focus:outline-none focus:ring-0"
          />

          {/* ── Token Usage & Cache Hit Rate Micro-Strip ── */}
          {totalTok > 0 ? (
            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-1 font-mono text-[10px] text-[var(--text-dim)] bg-[var(--bg-hover)]/30 select-none transition-colors">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3">
                <span className="flex items-center gap-1 font-medium text-[var(--text)]">
                  <TokenCoinIcon size={12} className="text-[var(--accent)]" />
                  <span>{formatNumber(totalTok)}</span>
                  <span className="font-normal text-[9px] text-[var(--text-dim)]">tok</span>
                </span>

                {cacheRate !== null && cacheRate > 0 ? (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                    <CacheLightningIcon size={10} />
                    <span>{cacheRate}% 缓存</span>
                  </span>
                ) : null}

                {reasoningTok > 0 ? (
                  <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 font-medium bg-purple-500/10 px-1 py-0.2 rounded border border-purple-500/20">
                    <span>🧠 {formatNumber(reasoningTok)} 思考</span>
                  </span>
                ) : null}
              </div>

              {/* Usage Breakdown Trigger */}
              <div className="relative" ref={usageMenuRef}>
                <button
                  type="button"
                  onClick={() => setUsageOpen((v) => !v)}
                  className="flex items-center gap-0.5 text-[9.5px] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors px-1 py-0.5 rounded hover:bg-[var(--bg-hover)]"
                >
                  <span>用量</span>
                  <ChevronDown className={cn("h-2.5 w-2.5 opacity-60 transition-transform duration-150", usageOpen && "rotate-180")} />
                </button>

                {usageOpen ? (
                  <div className="absolute bottom-6 right-0 z-50 w-52 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-2.5 shadow-2xl backdrop-blur-2xl animate-spring-up text-[11px] font-mono space-y-1.5">
                    <div className="text-[9.5px] font-semibold text-[var(--text-dim)] uppercase tracking-wider pb-1 border-b border-[var(--border)]">
                      Token 与缓存指标明细
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)]">输入 (Prompt)</span>
                      <span className="text-[var(--text)] font-semibold">{formatNumber(promptTok)}</span>
                    </div>
                    {cachedTok > 0 ? (
                      <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400">
                        <span className="flex items-center gap-1">
                          <CacheLightningIcon size={11} />
                          <span>缓存命中</span>
                        </span>
                        <span className="font-semibold">{formatNumber(cachedTok)} ({cacheRate}%)</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)]">输出 (Output)</span>
                      <span className="text-[var(--text)] font-semibold">{formatNumber(completionTok)}</span>
                    </div>
                    {reasoningTok > 0 ? (
                      <div className="flex justify-between items-center text-purple-700 dark:text-purple-300">
                        <span>深度推理</span>
                        <span className="font-semibold">{formatNumber(reasoningTok)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center pt-1 border-t border-[var(--border)] font-bold text-[var(--text)]">
                      <span>总计 Tokens</span>
                      <span className="text-[var(--accent)]">{formatNumber(totalTok)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ── Toolbar: Actions & Send ── */}
          <div className="flex items-end justify-between gap-2 px-2.5 pb-2 pt-1.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:gap-1.5">
              {/* Attach button (+) */}
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files) void handleFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
                accept="image/*,.txt,.md,.json,.ts,.js,.py,.csv,.log,.yaml,.yml"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="添加附件"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-all active:scale-95 shrink-0"
              >
                <PlusAttachmentIcon size={15} />
              </button>

              {/* Model Pill */}
              <div className="relative shrink-0" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((v) => !v)}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors border",
                    modelMenuOpen
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)]",
                  )}
                >
                  <CpuChipIcon size={13} className="text-[var(--accent)] shrink-0" />
                  <span className="max-w-[72px] truncate sm:max-w-[130px]">{selectedModel}</span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-60 shrink-0" />
                </button>

                {modelMenuOpen ? (
                  <div className="absolute bottom-8 left-0 z-50 w-56 max-h-[60vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-1 shadow-2xl animate-spring-up">
                    <div className="space-y-0.5">
                      {PRESET_MODELS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectModel(item.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors",
                            selectedModel === item.id ? "bg-[var(--accent)]/15 text-[var(--accent)] font-semibold" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                          )}
                        >
                          <div>
                            <div className="font-medium">{item.label}</div>
                            <div className="text-[9px] text-[var(--text-dim)]">{item.desc}</div>
                          </div>
                          <span>{item.badge}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Thinking Level Pill */}
              <ThinkingLevelSelector
                value={thinkingLevel}
                onChange={(level) => {
                  setThinkingLevel(level);
                  setDeepThinkingActive(level !== "none");
                }}
              />

              {/* Web search toggle pill */}
              <button
                type="button"
                onClick={() => setWebSearchActive((v) => !v)}
                title="联网检索"
                className={cn(
                  "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors border shrink-0",
                  webSearchActive
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                <GlobeWireIcon size={13} className="shrink-0" />
                <span className="hidden sm:inline">联网</span>
              </button>
            </div>

            {/* Right: Circular Send or Stop Button (Claude/ChatGPT style) */}
            <div className="shrink-0 ml-1.5">
              {streaming ? (
                <button
                  type="button"
                  onClick={onCancel}
                  title="停止生成"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-all active:scale-95"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  title="发送"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 active:scale-95",
                    canSend
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm hover:scale-105"
                      : "bg-zinc-100 text-zinc-400 dark:bg-white/10 dark:text-zinc-600 border border-[var(--border)] cursor-not-allowed",
                  )}
                >
                  <SendArrowIcon size={15} />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
