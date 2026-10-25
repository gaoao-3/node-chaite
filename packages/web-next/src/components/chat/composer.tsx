"use client";

import * as React from "react";
import {
  ArrowRight,
  ChevronDown,
  CircleAlert,
  FileCode,
  GitCompare,
  Search,
  Sparkles,
  Square,
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
import {
  fetchAvailableModels,
  type ModelMetadata,
} from "@/lib/api";
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
  token?: string | null;
}

const DEFAULT_PRESET_MODELS: ModelMetadata[] = [
  {
    id: "gemini-3.8-flash-high",
    label: "Gemini 3.8 Flash (High)",
    provider: "google",
    channelName: "default-gemini",
    contextWindow: 1_048_576,
    contextWindowFormatted: "1M",
    supportsThinking: true,
    thinkingType: "gemini_level",
    supportsVision: true,
    supportsTools: true,
    isRecommended: true,
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    channelName: "default-gemini",
    contextWindow: 200_000,
    contextWindowFormatted: "200K",
    supportsThinking: true,
    thinkingType: "budget_tokens",
    supportsVision: true,
    supportsTools: true,
    isRecommended: true,
  },
  {
    id: "claude-opus-4-6-thinking",
    label: "Claude Opus 4.6 (Thinking)",
    provider: "anthropic",
    channelName: "default-gemini",
    contextWindow: 200_000,
    contextWindowFormatted: "200K",
    supportsThinking: true,
    thinkingType: "budget_tokens",
    supportsVision: true,
    supportsTools: true,
    isRecommended: true,
  },
  {
    id: "gpt-oss-120b-medium",
    label: "GPT-OSS 120B",
    provider: "openai",
    channelName: "default-gemini",
    contextWindow: 131_072,
    contextWindowFormatted: "131K",
    supportsThinking: true,
    thinkingType: "reasoning_effort",
    supportsVision: false,
    supportsTools: true,
    isRecommended: true,
  },
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
  token,
}: ComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedModel, setSelectedModel] = React.useState(model || "gemini-3.8-flash-high");
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [modelSearchQuery, setModelSearchQuery] = React.useState("");
  const [customModelInput, setCustomModelInput] = React.useState("");
  const modelMenuRef = React.useRef<HTMLDivElement>(null);

  // Available models dynamically fetched from backend
  const [modelsList, setModelsList] = React.useState<ModelMetadata[]>(DEFAULT_PRESET_MODELS);
  const [modelsLoading, setModelsLoading] = React.useState(false);

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

  // Load available models automatically from backend /api/agent/models
  const loadModels = React.useCallback(async (force = false) => {
    if (!token) return;
    setModelsLoading(true);
    try {
      const res = await fetchAvailableModels(token, { refresh: force });
      if (res && Array.isArray(res.items) && res.items.length > 0) {
        setModelsList(res.items);
      }
    } catch (err) {
      console.warn("fetchAvailableModels failed, fallback to preset models:", err);
    } finally {
      setModelsLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void loadModels(false);
  }, [loadModels]);

  // Outside click for model selector
  React.useEffect(() => {
    if (!modelMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
        setModelSearchQuery("");
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
    setModelSearchQuery("");
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

  // Find current model's metadata
  const currentModelMetadata = React.useMemo<ModelMetadata>(() => {
    const found = modelsList.find((m) => m.id === selectedModel);
    if (found) return found;

    // Fallback heuristic for ad-hoc custom model input
    const lower = selectedModel.toLowerCase();
    const ctx = lower.includes("gemini") ? 1_048_576 : lower.includes("claude") ? 200_000 : 128_000;
    const supportsThinking = lower.includes("thinking") || lower.includes("sonnet") || lower.includes("r1") || lower.startsWith("o1") || lower.startsWith("o3");
    return {
      id: selectedModel,
      label: selectedModel,
      provider: "other",
      channelName: "custom",
      contextWindow: ctx,
      contextWindowFormatted: ctx >= 1_000_000 ? `${+(ctx / 1_000_000).toFixed(1)}M` : `${Math.round(ctx / 1_000)}K`,
      supportsThinking,
      supportsVision: true,
      supportsTools: true,
    };
  }, [modelsList, selectedModel]);

  // Filtered models by search query
  const filteredModels = React.useMemo(() => {
    if (!modelSearchQuery.trim()) return modelsList;
    const q = modelSearchQuery.trim().toLowerCase();
    return modelsList.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.channelName.toLowerCase().includes(q)
    );
  }, [modelsList, modelSearchQuery]);

  // Token & Cache statistics
  const totalTok = usage?.totalTokens ?? 0;
  const promptTok = usage?.promptTokens ?? 0;
  const cachedTok = usage?.cachedTokens ?? 0;
  const completionTok = usage?.completionTokens ?? 0;
  const reasoningTok = usage?.reasoningTokens ?? 0;
  const cacheRate = promptTok > 0 && cachedTok > 0
    ? Math.min(100, Math.round((cachedTok / promptTok) * 100))
    : null;

  // Context window usage ratio
  const maxContext = currentModelMetadata.contextWindow;
  const contextUsagePercent = Math.min(100, +((totalTok / maxContext) * 100).toFixed(1));
  const remainingTok = Math.max(0, maxContext - totalTok);

  return (
    <div className="chat-input-shell relative shrink-0 px-4 pb-2 pt-1 sm:px-8 sm:pb-3">
      <div className="mx-auto w-full max-w-[var(--chat-content-max-width,820px)]">
        {/* Error notice */}
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
          {/* Attachments preview */}
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

          {/* ── Token Usage & Context Window Ratio Micro-Strip ── */}
          {totalTok > 0 ? (
            <div className="mt-1 flex min-h-5 items-center justify-between gap-2 px-1 font-mono text-[10px] text-[var(--text-dim)] select-none">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:gap-3">
                {/* Real context window ratio: e.g. 5万 / 100万 (5%) */}
                <span className="flex items-center gap-1 text-[var(--text-muted)]" title={`已使用上下文: ${formatNumber(totalTok)} / ${currentModelMetadata.contextWindowFormatted} (${contextUsagePercent}%)`}>
                  <TokenCoinIcon size={11} className="text-[var(--accent)]" />
                  <span className="font-semibold text-[var(--text)]">{formatNumber(totalTok)}</span>
                  <span className="text-[var(--text-dim)]">/ {currentModelMetadata.contextWindowFormatted}</span>
                  <span className={cn(
                    "rounded px-1 py-0.2 text-[8.5px] font-semibold",
                    contextUsagePercent > 80
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      : contextUsagePercent > 50
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-[var(--bg-hover)] text-[var(--text-dim)]"
                  )}>
                    {contextUsagePercent}%
                  </span>
                </span>

                {cacheRate !== null && cacheRate > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-medium">
                    <CacheLightningIcon size={10} />
                    <span>{cacheRate}% 缓存</span>
                  </span>
                ) : null}

                {reasoningTok > 0 ? (
                  <span className="text-purple-700 dark:text-purple-300 font-medium">
                    🧠 {formatNumber(reasoningTok)} 思考
                  </span>
                ) : null}
              </div>

              {/* Usage & Context Breakdown Trigger */}
              <div className="relative shrink-0" ref={usageMenuRef}>
                <button
                  type="button"
                  onClick={() => setUsageOpen((v) => !v)}
                  className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9.5px] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                >
                  <span>用量与上下文</span>
                  <ChevronDown className={cn("h-2.5 w-2.5 opacity-60 transition-transform", usageOpen && "rotate-180")} />
                </button>

                {usageOpen ? (
                  <div className="absolute bottom-6 right-0 z-50 w-64 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3 shadow-2xl backdrop-blur-2xl text-[11px] font-mono space-y-2 animate-spring-up">
                    <div className="border-b border-[var(--border)] pb-1.5 flex items-center justify-between text-[9.5px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                      <span>模型实际上下文诊断</span>
                      <span className="text-[var(--accent)]">{currentModelMetadata.id}</span>
                    </div>

                    {/* Context window progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-[var(--text-muted)]">上下文占用</span>
                        <span className="font-semibold text-[var(--text)]">
                          {formatNumber(totalTok)} / {currentModelMetadata.contextWindowFormatted} ({contextUsagePercent}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--bg-hover)] overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            contextUsagePercent > 80
                              ? "bg-rose-500"
                              : contextUsagePercent > 50
                                ? "bg-amber-500"
                                : "bg-[var(--accent)]"
                          )}
                          style={{ width: `${contextUsagePercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-[var(--text-dim)]">
                        <span>剩余可用空间:</span>
                        <span className="font-semibold">{formatNumber(remainingTok)} Tokens</span>
                      </div>
                    </div>

                    <div className="border-t border-[var(--border)] pt-1.5 space-y-1 text-[10.5px]">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">输入 (Prompt)</span>
                        <span className="text-[var(--text)]">{formatNumber(promptTok)}</span>
                      </div>
                      {cachedTok > 0 ? (
                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                          <span className="flex items-center gap-1">
                            <CacheLightningIcon size={11} />
                            <span>缓存命中</span>
                          </span>
                          <span>{formatNumber(cachedTok)} ({cacheRate}%)</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">输出 (Output)</span>
                        <span className="text-[var(--text)]">{formatNumber(completionTok)}</span>
                      </div>
                      {reasoningTok > 0 ? (
                        <div className="flex justify-between text-purple-700 dark:text-purple-300">
                          <span>深度推理 (Reasoning)</span>
                          <span>{formatNumber(reasoningTok)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold text-[var(--text)]">
                      <span>总计消耗 Tokens</span>
                      <span className="text-[var(--accent)]">{formatNumber(totalTok)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ── Bottom Controls: Model Selector, Thinking, WebSearch, Fusion ── */}
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

              {/* Dynamic Available Models Selector */}
              <div className="relative min-w-0" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setModelMenuOpen((v) => !v);
                    if (!modelMenuOpen) void loadModels(false);
                  }}
                  className={cn(
                    "flex h-8 min-w-0 items-center gap-1 rounded-[10px] border px-2 text-[11px] font-medium transition-colors",
                    modelMenuOpen
                      ? "border-[var(--accent)] bg-[var(--bg-hover)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--bg-subtle,rgba(127,127,127,0.04))] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                  )}
                >
                  <CpuChipIcon size={12} className="shrink-0 text-[var(--accent)]" />
                  <span className="max-w-[100px] truncate sm:max-w-[160px] font-semibold">
                    {currentModelMetadata.label}
                  </span>
                  <span className="font-mono text-[9px] text-[var(--text-dim)] shrink-0 hidden sm:inline">
                    {currentModelMetadata.contextWindowFormatted}
                  </span>
                  <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
                </button>

                {/* Enhanced Dropdown with Search, Context Window and Badges */}
                {modelMenuOpen ? (
                  <div className="absolute bottom-9 left-0 z-50 w-72 max-w-[calc(100vw-32px)] rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-1.5 shadow-2xl animate-spring-up">
                    {/* Search bar inside popover */}
                    <div className="relative mb-1.5 px-0.5">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-dim)]" />
                      <input
                        type="text"
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        placeholder="搜索可用模型 (如 gemini, claude, r1)..."
                        className="h-7 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] pl-7 pr-6 text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
                      />
                      {modelSearchQuery ? (
                        <button
                          type="button"
                          onClick={() => setModelSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)]"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      ) : null}
                    </div>

                    {/* Model items list */}
                    <div className="max-h-[50vh] overflow-y-auto space-y-0.5 pr-0.5">
                      {modelsLoading && modelsList.length === 0 ? (
                        <div className="py-6 text-center text-[11px] text-[var(--text-dim)]">
                          正在探测渠道可用模型…
                        </div>
                      ) : filteredModels.length === 0 ? (
                        <div className="py-4 text-center text-[11px] text-[var(--text-dim)]">
                          未找到匹配模型
                        </div>
                      ) : (
                        filteredModels.map((item) => {
                          const isSelected = selectedModel === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectModel(item.id)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11.5px] transition-colors",
                                isSelected
                                  ? "bg-[var(--accent)]/15 text-[var(--accent)] font-semibold"
                                  : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                              )}
                            >
                              <div className="min-w-0 flex-1 pr-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate leading-tight font-medium">{item.label}</span>
                                  {item.isRecommended ? (
                                    <span className="text-[9px] text-amber-500 font-normal shrink-0">⚡</span>
                                  ) : null}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-[var(--text-dim)]">
                                  <span>{item.channelName}</span>
                                  <span>·</span>
                                  <span>{item.provider}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* Context Window badge */}
                                <span className="rounded bg-[var(--bg)] border border-[var(--border)] px-1 py-0.2 font-mono text-[8.5px] text-[var(--text)] font-semibold">
                                  {item.contextWindowFormatted}
                                </span>

                                {/* Capability icons */}
                                {item.supportsThinking ? (
                                  <span title="支持思考推理链" className="text-[10px] text-purple-600 dark:text-purple-300">
                                    🧠
                                  </span>
                                ) : null}
                                {item.supportsVision ? (
                                  <span title="支持多模态视觉" className="text-[10px]">
                                    👁️
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Custom model input fallback */}
                    <div className="border-t border-[var(--border)] pt-1.5 mt-1 px-1">
                      <div className="text-[9px] font-mono text-[var(--text-dim)] mb-1">
                        自定义输入任意模型 ID:
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={customModelInput}
                          onChange={(e) => setCustomModelInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (customModelInput.trim()) {
                                handleSelectModel(customModelInput.trim());
                                setCustomModelInput("");
                              }
                            }
                          }}
                          placeholder="如: deepseek-chat, gpt-4.5..."
                          className="h-6 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 font-mono text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          type="button"
                          disabled={!customModelInput.trim()}
                          onClick={() => {
                            if (customModelInput.trim()) {
                              handleSelectModel(customModelInput.trim());
                              setCustomModelInput("");
                            }
                          }}
                          className="h-6 px-2 rounded bg-[var(--accent)] text-[var(--accent-contrast)] text-[10px] font-medium disabled:opacity-40 shrink-0"
                        >
                          设置
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-1">
              {/* Dynamic Thinking Level Selector aware of current model */}
              <ThinkingLevelSelector
                value={thinkingLevel}
                modelMetadata={currentModelMetadata}
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
                  "flex h-8 items-center gap-1 rounded-[10px] border px-2 text-[11px] font-medium transition-colors",
                  webSearchActive
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-[var(--border)] bg-[var(--bg-subtle,rgba(127,127,127,0.04))] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                )}
              >
                <GlobeWireIcon size={12} />
                <span className="hidden sm:inline">联网</span>
              </button>

              {/* Fusion mode pill */}
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
