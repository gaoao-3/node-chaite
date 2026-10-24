"use client";

import * as React from "react";
import { ArrowUpRight, Plus, Sparkles, TerminalSquare, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";

const SUGGESTIONS = [
  {
    icon: TerminalSquare,
    title: "检查系统运行状态",
    text: "检查 SSE 事件流、工具与外部网关连接健康度。",
    prompt: "请调用相关工具体检当前系统状态，重点检查网关连接与工具健康度。",
  },
  {
    icon: WandSparkles,
    title: "审查并重构代码",
    text: "使用 hashline 精准代码工具定位并优化目标文件。",
    prompt: "请使用 hash_read 工具查看当前工程核心代码，并给出针对性重构建议。",
  },
  {
    icon: Sparkles,
    title: "自进化提炼技能",
    text: "从过往执行轨迹中提炼可复用的 SKILL.md SOP。",
    prompt: "请从最近的执行轨迹中提炼一个可复用的标准技能，并执行四维自评估。",
  },
];

export function ChatEmptyState({
  onSuggestion,
  hasSession,
  preview: _preview,
  onCreateSession,
}: {
  onSuggestion: (prompt: string) => void;
  hasSession: boolean;
  preview?: boolean;
  onCreateSession?: () => void;
}) {
  return (
    <div className="relative mx-auto flex w-full max-w-[720px] flex-col items-center px-4 pt-12 pb-8 text-center sm:pt-20">
      {/* Sleek Zen Logo */}
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-sm">
        <BrandMark size={32} />
      </div>

      <div className="mt-6 space-y-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-mist-100 sm:text-[26px]">
          {hasSession ? "天童凯伊（Key）已就绪" : "创建会话，开始工程协作"}
        </h1>
        <p className="mx-auto max-w-md text-[13px] leading-relaxed text-mist-500">
          {hasSession
            ? "输入指令、粘贴日志或代码。推理思考、Pi 哈希编程与副手协同将实时呈现在对话流中。"
            : "Chaite Agent 支持多端会话聚合、流式推理、Hashline 编辑与实时安全审批。"}
        </p>

        {!hasSession && onCreateSession ? (
          <div className="pt-3">
            <Button size="md" variant="primary" onClick={onCreateSession}>
              <Plus className="h-4 w-4" />
              立即新建会话
            </Button>
          </div>
        ) : null}
      </div>

      {/* Quick Suggestion Pills */}
      <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-3">
        {SUGGESTIONS.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onSuggestion(item.prompt)}
            className="group relative flex flex-col items-start gap-1.5 rounded-xl border border-white/[0.06] bg-black/20 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-white/[0.03] hover:-translate-y-0.5"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-accent">
              <item.icon className="h-3 w-3" />
            </span>
            <span className="text-[12px] font-semibold text-mist-200 group-hover:text-mist-100">
              {item.title}
            </span>
            <span className="text-[10.5px] leading-relaxed text-mist-500 line-clamp-2">
              {item.text}
            </span>
            <ArrowUpRight className="absolute right-2.5 top-2.5 h-3 w-3 text-mist-700 transition-transform group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        ))}
      </div>

      {/* Footer tiny caps */}
      <div className="mt-8 flex items-center justify-center gap-3 font-mono text-[9.5px] text-mist-600">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>Chaite Kernel 1.15</span>
        </span>
        <span>·</span>
        <span>Pi Hashline Enabled</span>
        <span>·</span>
        <span>Multi-Platform Ready</span>
      </div>
    </div>
  );
}
