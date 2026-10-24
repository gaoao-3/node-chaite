"use client";

import * as React from "react";
import {
  Brain,
  Check,
  ChevronDown,
  CircleAlert,
  Cpu,
  FileCode,
  Globe,
  ImageIcon,
  Lightbulb,
  Paperclip,
  SendHorizontal,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

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
  { id: "gpt-4o", label: "GPT-4o", desc: "OpenAI 旗舰多模态", badge: "🌐" },
];

const PROMPT_SNIPPETS = [
  { title: "🔍 审查代码质量", prompt: "请全面审查以下代码的安全隐患、性能瓶颈与潜在 Bug，并给出重构方案：" },
  { title: "🐛 排查报错异常", prompt: "请分析以下报错日志或异常堆栈，诊断根本原因并给出修复步骤：" },
  { title: "⚡ 重构并补齐类型", prompt: "请将以下代码按照现代 Clean Code 规范重构，补齐 TypeScript 类型：" },
  { title: "📝 提炼核心要点", prompt: "请将上述讨论的内容与任务提炼为结构清晰的 Summary 与待办清单：" },
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
  skillCount,
  error,
  onDismissError,
}: ComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedModel, setSelectedModel] = React.useState(model || "gemini-3.8-flash-high");
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [customModelInput, setCustomModelInput] = React.useState("");

  const [webSearchActive, setWebSearchActive] = React.useState(false);
  const [deepThinkingActive, setDeepThinkingActive] = React.useState(false);
  const [snippetsOpen, setSnippetsOpen] = React.useState(false);

  const [attachments, setAttachments] = React.useState<AttachmentItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);

  const modelMenuRef = React.useRef<HTMLDivElement>(null);
  const snippetsMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (model && model !== "auto") {
      setSelectedModel(model);
    }
  }, [model]);

  const busy = streaming || promptPending;
  const canSend = (value.trim().length > 0 || attachments.length > 0) && !busy && !disabled && !preview;

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const next = Math.min(textarea.scrollHeight, 220);
    textarea.style.height = `${Math.max(44, next)}px`;
  }, [value]);

  // Close menus on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setModelMenuOpen(false);
      }
      if (snippetsMenuRef.current && !snippetsMenuRef.current.contains(event.target as Node)) {
        setSnippetsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      attachments: currentAttachments,
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  // ─── File Attachment Handlers ───────────────────────────────────────────────

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
        newItems.push({
          id,
          name: file.name,
          size: file.size,
          type: "image",
          dataUrl,
        });
      } else {
        try {
          const text = await file.text();
          newItems.push({
            id,
            name: file.name,
            size: file.size,
            type: "file",
            textContent: text,
          });
        } catch {
          newItems.push({
            id,
            name: file.name,
            size: file.size,
            type: "file",
          });
        }
      }
    }
    setAttachments((prev) => [...prev, ...newItems]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Clipboard paste support
  const onPaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      event.preventDefault();
      void handleFiles(files);
    }
  };

  // Drag and drop support
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="relative shrink-0 px-3 pb-3 pt-1.5 sm:px-6 sm:pb-5">
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[var(--bg)] to-transparent" />
      <div className="mx-auto w-full max-w-[780px]">
        {/* Error notice */}
        {error ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] px-3 py-2 text-[11px] leading-relaxed text-rose-200 animate-fade-in">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button
              type="button"
              onClick={onDismissError}
              aria-label="忽略错误"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-rose-300 hover:bg-rose-400/20"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}

        {/* Form container */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "group relative overflow-hidden rounded-[18px] border bg-[var(--bg-panel)] shadow-lg backdrop-blur-xl transition-all duration-200",
            isDragging ? "border-accent bg-accent/10" : "border-white/[0.09] focus-within:border-accent/50",
            streaming ? "border-cyan-400/30" : "",
          )}
        >
          {/* Active indicator top bar */}
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

          {/* Attachments preview strip */}
          {attachments.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-black/15 px-3 py-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] p-1 pr-2 text-[10.5px] text-mist-200 animate-scale-in"
                >
                  {att.type === "image" && att.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="h-7 w-7 rounded object-cover border border-white/10"
                    />
                  ) : (
                    <FileCode className="h-4 w-4 text-accent ml-1" />
                  )}
                  <span className="max-w-[130px] truncate font-medium">{att.name}</span>
                  <span className="font-mono text-[9px] text-mist-500">({formatFileSize(att.size)})</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="ml-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/15 text-mist-400 hover:text-white"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Text input area */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={
              preview
                ? "设计预览模式 · 退出预览后可发送指令"
                : streaming
                  ? "Agent 正在执行任务，你可以直接输入下一条指令…"
                  : disabled
                    ? "请先创建或选择一个会话"
                    : "向 Chaite Agent 下达指令… (支持粘贴图片/拖拽文件，Enter 发送)"
            }
            rows={1}
            spellCheck={false}
            aria-label="消息输入框"
            className="max-h-[220px] min-h-[46px] w-full resize-none bg-transparent px-3.5 pb-1.5 pt-3 text-[13.5px] leading-[1.65] text-mist-100 outline-none placeholder:text-mist-600 disabled:cursor-not-allowed sm:px-4"
          />

          {/* Bottom control bar */}
          <div className="flex flex-col gap-1.5 border-t border-white/[0.045] px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:px-3">
            {/* Left controls: Attachments, Models, Web, Reasoning, Snippets */}
            <div className="flex flex-wrap items-center gap-1">
              {/* 1. Attachment Button */}
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
                title="上传附件 (图片、代码或文档，也支持直接粘贴)"
                className="flex h-7 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-mist-400 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-mist-100 transition-colors"
              >
                <Paperclip className="h-3 w-3" />
                <span className="hidden sm:inline">附件</span>
              </button>

              {/* 2. Model Selector Pill & Popover */}
              <div className="relative" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((v) => !v)}
                  title="切换当前会话驱动模型"
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-mono transition-colors",
                    modelMenuOpen
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-white/[0.08] bg-white/[0.03] text-mist-300 hover:border-white/[0.16] hover:text-white",
                  )}
                >
                  <Cpu className="h-3 w-3 text-accent" />
                  <span className="max-w-[100px] truncate font-medium sm:max-w-[130px]">{selectedModel}</span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>

                {modelMenuOpen ? (
                  <div className="absolute bottom-9 left-0 z-50 w-64 rounded-xl border border-white/[0.12] bg-[var(--bg-panel)] p-1.5 shadow-2xl backdrop-blur-2xl animate-scale-in">
                    <div className="px-2 py-1 text-[10px] font-semibold text-mist-500 uppercase tracking-wider">
                      选择驱动模型
                    </div>
                    <div className="space-y-0.5">
                      {PRESET_MODELS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectModel(item.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors",
                            selectedModel === item.id
                              ? "bg-accent/15 text-accent"
                              : "text-mist-200 hover:bg-white/[0.06]",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{item.label}</div>
                            <div className="text-[9px] text-mist-500 truncate">{item.desc}</div>
                          </div>
                          <span className="ml-2 shrink-0 text-[9px] font-mono opacity-80">{item.badge}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-1 border-t border-white/[0.06] pt-1.5">
                      <input
                        type="text"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && customModelInput.trim()) {
                            e.preventDefault();
                            handleSelectModel(customModelInput.trim());
                          }
                        }}
                        placeholder="输入自定义模型后回车…"
                        className="w-full rounded-md border border-white/[0.1] bg-black/30 px-2 py-1 text-[10.5px] font-mono text-mist-100 outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* 3. Web Search Toggle Button */}
              <button
                type="button"
                onClick={() => setWebSearchActive((v) => !v)}
                title="开启/关闭全网实时搜索"
                className={cn(
                  "flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] transition-colors",
                  webSearchActive
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                    : "border-white/[0.08] bg-white/[0.03] text-mist-400 hover:text-mist-200",
                )}
              >
                <Globe className="h-3 w-3" />
                <span className="hidden sm:inline">联网</span>
              </button>

              {/* 4. Deep Thinking Toggle Button */}
              <button
                type="button"
                onClick={() => setDeepThinkingActive((v) => !v)}
                title="开启/关闭深度推理思考链"
                className={cn(
                  "flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] transition-colors",
                  deepThinkingActive
                    ? "border-purple-400/40 bg-purple-500/15 text-purple-300"
                    : "border-white/[0.08] bg-white/[0.03] text-mist-400 hover:text-mist-200",
                )}
              >
                <Brain className="h-3 w-3" />
                <span className="hidden sm:inline">思考</span>
              </button>

              {/* 5. Prompt Snippets Dropdown */}
              <div className="relative" ref={snippetsMenuRef}>
                <button
                  type="button"
                  onClick={() => setSnippetsOpen((v) => !v)}
                  title="常用提示词模板"
                  className="flex h-7 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-mist-400 hover:text-mist-200 transition-colors"
                >
                  <Lightbulb className="h-3 w-3" />
                  <span className="hidden md:inline">快捷</span>
                </button>

                {snippetsOpen ? (
                  <div className="absolute bottom-9 left-0 z-50 w-64 rounded-xl border border-white/[0.12] bg-[var(--bg-panel)] p-1.5 shadow-2xl backdrop-blur-2xl animate-scale-in">
                    <div className="px-2 py-1 text-[10px] font-semibold text-mist-500 uppercase tracking-wider">
                      快捷指令模板
                    </div>
                    <div className="space-y-0.5">
                      {PROMPT_SNIPPETS.map((snip) => (
                        <button
                          key={snip.title}
                          type="button"
                          onClick={() => {
                            onChange(snip.prompt);
                            setSnippetsOpen(false);
                            textareaRef.current?.focus();
                          }}
                          className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left text-[11px] text-mist-200 hover:bg-white/[0.06] transition-colors"
                        >
                          <span className="font-medium text-accent">{snip.title}</span>
                          <span className="truncate text-[9.5px] text-mist-500">{snip.prompt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Clear draft */}
              {value.trim().length > 0 || attachments.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setAttachments([]);
                  }}
                  title="清空当前输入与附件"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] text-mist-500 hover:text-rose-300 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}

              {skillCount > 0 ? (
                <span className="hidden items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 text-[9.5px] font-mono text-mist-500 xl:inline-flex">
                  <Sparkles className="h-2.5 w-2.5 text-accent" />
                  {skillCount}
                </span>
              ) : null}
            </div>

            {/* Right controls: Submit / Stop */}
            <div className="flex items-center justify-end gap-2">
              <span className="hidden items-center gap-1 text-[9px] text-mist-500 lg:inline-flex">
                <Kbd>Enter</Kbd> 发送 · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> 换行
              </span>
              {streaming ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={onCancel}
                  className="h-7.5 gap-1.5 px-3 text-[11px]"
                  title="终止当前生成"
                >
                  <Square className="h-3 w-3 fill-current" />
                  停止
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!canSend}
                  loading={promptPending}
                  aria-label="发送消息"
                  title="发送消息 (Enter)"
                  className="h-7.5 gap-1.5 rounded-lg px-3.5 text-[11px] font-semibold"
                >
                  {!promptPending ? <SendHorizontal className="h-3.5 w-3.5" /> : null}
                  <span>发送</span>
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Footer tiny info */}
        <div className="mt-1.5 flex items-center justify-center gap-2 text-[9px] text-mist-600">
          <span className="h-1 w-1 rounded-full bg-emerald-400" />
          <span>Chaite SSE 双星通道</span>
          <span>·</span>
          <span>支持多模态附件与全网检索</span>
        </div>
      </div>
    </div>
  );
}
