"use client";

import * as React from "react";
import {
  ArrowUp,
  ChevronDown,
  CircleAlert,
  Cpu,
  FileCode,
  Globe,
  Paperclip,
  Plus,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThinkingLevelSelector, type ThinkingLevel } from "@/components/chat/thinking-level-selector";

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
}: ComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedModel, setSelectedModel] = React.useState(model || "gemini-3.8-flash-high");
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [customModelInput, setCustomModelInput] = React.useState("");
  const modelMenuRef = React.useRef<HTMLDivElement>(null);

  const [webSearchActive, setWebSearchActive] = React.useState(false);
  const [deepThinkingActive, setDeepThinkingActive] = React.useState(false);
  const [thinkingLevel, setThinkingLevel] = React.useState<ThinkingLevel>("medium");

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

  return (
    <div className="relative shrink-0 px-3 pb-3 pt-1 sm:px-6 sm:pb-4">
      <div className="mx-auto w-full max-w-[760px]">
        {/* Error notice */}
        {error ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.08] px-3 py-1.5 text-[11px] text-rose-200">
            <span className="truncate">{error}</span>
            <button type="button" onClick={onDismissError} className="text-rose-400 hover:text-rose-200">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}

        {/* Claude-style Minimal Floating Card */}
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
            "group relative rounded-2xl border bg-[var(--bg-panel)] shadow-sm transition-all duration-150",
            isDragging ? "border-accent ring-1 ring-accent" : "border-white/[0.1] focus-within:border-white/[0.2]",
          )}
        >
          {/* Attachments preview */}
          {attachments.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-2.5">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 pr-2 text-[10.5px] text-mist-200"
                >
                  {att.type === "image" && att.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={att.dataUrl} alt={att.name} className="h-6 w-6 rounded object-cover border border-white/10" />
                  ) : (
                    <FileCode className="h-3.5 w-3.5 text-accent ml-1" />
                  )}
                  <span className="max-w-[100px] truncate font-medium">{att.name}</span>
                  <span className="font-mono text-[8.5px] text-mist-500">({formatFileSize(att.size)})</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="ml-0.5 text-mist-500 hover:text-white"
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
            className="w-full resize-none bg-transparent px-3.5 pt-3 pb-2 text-[14px] leading-relaxed text-mist-100 outline-none placeholder:text-mist-500 disabled:cursor-not-allowed"
          />

          {/* Claude Toolbar (Left pills + Right circular Send button) */}
          <div className="flex items-center justify-between px-2.5 pb-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
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
                className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-400 hover:bg-white/[0.06] hover:text-mist-100 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>

              {/* Model Pill */}
              <div className="relative" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((v) => !v)}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors border",
                    modelMenuOpen
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-white/[0.07] bg-white/[0.02] text-mist-400 hover:border-white/[0.14] hover:text-mist-200",
                  )}
                >
                  <Cpu className="h-3 w-3" />
                  <span className="max-w-[100px] truncate sm:max-w-[140px]">{selectedModel}</span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>

                {modelMenuOpen ? (
                  <div className="absolute bottom-8 left-0 z-50 w-56 max-h-[60vh] overflow-y-auto rounded-xl border border-white/[0.1] bg-[var(--bg-panel)] p-1 shadow-2xl animate-scale-in">
                    <div className="space-y-0.5">
                      {PRESET_MODELS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectModel(item.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors",
                            selectedModel === item.id ? "bg-accent/15 text-accent font-medium" : "text-mist-300 hover:bg-white/[0.05]",
                          )}
                        >
                          <div>
                            <div>{item.label}</div>
                            <div className="text-[9px] text-mist-500">{item.desc}</div>
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
                  "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors border",
                  webSearchActive
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-white/[0.07] bg-white/[0.02] text-mist-400 hover:border-white/[0.14] hover:text-mist-200",
                )}
              >
                <Globe className="h-3 w-3" />
                <span>联网</span>
              </button>
            </div>

            {/* Right: Circular Send or Stop Button (Claude/ChatGPT style) */}
            <div>
              {streaming ? (
                <button
                  type="button"
                  onClick={onCancel}
                  title="停止生成"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  title="发送"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150",
                    canSend
                      ? "bg-white text-zinc-950 shadow-sm hover:scale-105 active:scale-95"
                      : "bg-white/[0.08] text-mist-600 cursor-not-allowed",
                  )}
                >
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
