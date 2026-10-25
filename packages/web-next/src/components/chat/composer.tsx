"use client";

import * as React from "react";
import {
  ArrowRight,
  ChevronDown,
  CircleAlert,
  FileCode,
  Square,
  GitCompare,
  X,
} from "lucide-react";
import {
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
  fusionMode?: boolean;
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
  const [fusionModeActive, setFusionModeActive] = React.useState(false);

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
      fusionMode: fusionModeActive,
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
    <div className="chat-input-shell relative shrink-0 px-4 pb-2 pt-1 sm:px-8 sm:pb-3">
      <div className="mx-auto w-full max-w-[var(--chat-content-max-width,820px)]">
        {error ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-700 dark:text-rose-200 animate-slide-up-fade">
            <span className="truncate">{error}</span>
            <button type="button" onClick={onDismissError} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-100">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}

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
          className="group relative"
        >
          {attachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-1 pr-2 text-[10.5px] text-[var(--text)] animate-scale-in"
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

          {/* Pi Web: a quiet input card; controls live outside below it. */}
          <div
            className={cn(
              "flex items-end gap-2 rounded-[14px] border bg-[var(--bg)] px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-colors",
              isDragging ? "border-[var(--accent)]" : "border-[var(--border)] focus-within:border-[var(--accent)]/60",
            )}
          >
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
              className="chat-input-textarea max-h-[200px] min-h-6 flex-1 resize-none border-0 bg-transparent py-0.5 text-[16px] leading-[1.6] text-[var(--text)] outline-none placeholder:text-[var(--text-dim)] disabled:cursor-not-allowed focus:outline-none focus:ring-0 sm:text-[calc(14px_+_var(--chat-font-size-offset))]"
            />

            {streaming ? (
              <button
                type="button"
                onClick={onCancel}
                title="停止生成"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 transition-colors hover:bg-rose-500/20 dark:text-rose-300 sm:px-3"
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                title="发送"
                aria-label="发送"
                className={cn(
                  "flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-0 text-[13px] font-semibold transition-colors sm:px-3.5",
                  canSend
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm hover:bg-[var(--accent-hover)]"
                    : "bg-[var(--bg-panel)] text-[var(--text-dim)] cursor-not-allowed",
                  "w-9 sm:w-auto",
                )}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">发送</span>
              </button>
            )}
          </div>

          {/* Usage metadata stays quiet and outside the input card. */}
          {totalTok > 0 ? (
            <div className="mt-1 flex min-h-5 items-center justify-between gap-2 px-1 font-mono text-[10px] text-[var(--text-dim)] select-none">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:gap-3">
                <span className="flex items-center gap-1 text-[var(--text-muted)]">
                  <TokenCoinIcon size={11} className="text-[var(--accent)]" />
                  <span>{formatNumber(totalTok)}</span>
                  <span className="text-[9px] text-[var(--text-dim)]">tok</span>
                </span>
                {cacheRate !== null && cacheRate > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                    <CacheLightningIcon size={10} />
                    <span>{cacheRate}% 缓存</span>
                  </span>
                ) : null}
                {reasoningTok > 0 ? (
                  <span className="text-purple-700 dark:text-purple-300">🧠 {formatNumber(reasoningTok)} 思考</span>
                ) : null}
              </div>

              <div className="relative shrink-0" ref={usageMenuRef}>
                <button
                  type="button"
                  onClick={() => setUsageOpen((v) => !v)}
                  className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9.5px] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                >
                  <span>用量</span>
                  <ChevronDown className={cn("h-2.5 w-2.5 opacity-60 transition-transform", usageOpen && "rotate-180")} />
                </button>
                {usageOpen ? (
                  <div className="absolute bottom-6 right-0 z-50 w-52 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-2.5 shadow-xl text-[11px] font-mono space-y-1.5 animate-spring-up">
                    <div className="border-b border-[var(--border)] pb-1 text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                      Token 与缓存指标明细
                    </div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">输入 (Prompt)</span><span className="text-[var(--text)]">{formatNumber(promptTok)}</span></div>
                    {cachedTok > 0 ? <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>缓存命中</span><span>{formatNumber(cachedTok)} ({cacheRate}%)</span></div> : null}
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">输出 (Output)</span><span className="text-[var(--text)]">{formatNumber(completionTok)}</span></div>
                    {reasoningTok > 0 ? <div className="flex justify-between text-purple-700 dark:text-purple-300"><span>深度推理</span><span>{formatNumber(reasoningTok)}</span></div> : null}
                    <div className="flex justify-between border-t border-[var(--border)] pt-1 font-semibold text-[var(--text)]"><span>总计 Tokens</span><span className="text-[var(--accent)]">{formatNumber(totalTok)}</span></div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Pi Web: left attach/model, right thinking/tools, below the card. */}
          <div className="chat-input-controls mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="flex min-w-0 items-center gap-1">
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
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--bg-subtle,rgba(127,127,127,0.04))] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
              >
                <PlusAttachmentIcon size={14} />
              </button>

              <div className="relative min-w-0" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((v) => !v)}
                  className={cn(
                    "flex h-8 min-w-0 items-center gap-1 rounded-[10px] border px-2 text-[11px] font-medium transition-colors",
                    modelMenuOpen
                      ? "border-[var(--accent)] bg-[var(--bg-hover)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--bg-subtle,rgba(127,127,127,0.04))] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                  )}
                >
                  <CpuChipIcon size={12} className="shrink-0 text-[var(--accent)]" />
                  <span className="max-w-[112px] truncate sm:max-w-[180px]">{selectedModel}</span>
                  <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
                </button>
                {modelMenuOpen ? (
                  <div className="absolute bottom-9 left-0 z-50 max-h-[60vh] w-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-1 shadow-xl animate-spring-up">
                    <div className="space-y-0.5">
                      {PRESET_MODELS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectModel(item.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
                            selectedModel === item.id ? "bg-[var(--accent)]/15 text-[var(--accent)] font-semibold" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                          )}
                        >
                          <div><div className="font-medium">{item.label}</div><div className="text-[9px] text-[var(--text-dim)]">{item.desc}</div></div>
                          <span>{item.badge}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-1">
              <ThinkingLevelSelector
                value={thinkingLevel}
                onChange={(level) => {
                  setThinkingLevel(level);
                  setDeepThinkingActive(level !== "none");
                }}
              />
              <button
                type="button"
                onClick={() => setWebSearchActive((v) => !v)}
                title="联网检索"
                className={cn(
                  "flex h-8 items-center gap-1 rounded-[10px] border px-2 text-[11px] font-medium transition-colors",
                  webSearchActive
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-[var(--border)] bg-[var(--bg-subtle,rgba(127,127,127,0.04))] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                )}
              >
                <GlobeWireIcon size={12} />
                <span className="hidden sm:inline">联网</span>
              </button>
              <button
                type="button"
                onClick={() => setFusionModeActive((v) => !v)}
                title="双星协同 (主脑架构师规划 + 副手模型执行生成 Diff 交叉审查)"
                className={cn(
                  "flex h-8 items-center gap-1 rounded-[10px] border px-2 text-[11px] font-medium transition-colors",
                  fusionModeActive
                    ? "border-purple-500/40 bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold"
                    : "border-[var(--border)] bg-[var(--bg-subtle,rgba(127,127,127,0.04))] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                )}
              >
                <GitCompare className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">双星</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
