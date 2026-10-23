"use client";

import * as React from "react";
import { ArrowUpRight, Radio, ShieldCheck, Sparkles, TerminalSquare, WandSparkles } from "lucide-react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  {
    icon: TerminalSquare,
    title: "体检当前会话",
    text: "检查 SSE 事件流、工具调用与审批链路的健康度。",
    prompt: "帮我体检一下当前 Agent 会话，重点看 SSE 事件流、工具调用和审批链路。",
  },
  {
    icon: WandSparkles,
    title: "生成发布说明",
    text: "把最近的改动整理成面向团队的 Markdown 周报。",
    prompt: "请根据最近的工作，为团队生成一份结构清晰的发布说明。",
  },
  {
    icon: Sparkles,
    title: "沉淀为技能",
    text: "从成功轨迹中提炼可复用的 SKILL.md 草稿。",
    prompt: "把这次诊断流程沉淀成一个可复用的技能，并给出四维自评分。",
  },
];

export function ChatEmptyState({
  onSuggestion,
  hasSession,
  preview,
  onCreateSession,
}: {
  onSuggestion: (prompt: string) => void;
  hasSession: boolean;
  preview?: boolean;
  onCreateSession?: () => void;
}) {
  return (
    <div className="relative mx-auto flex w-full max-w-[760px] flex-col items-center px-1 pt-10 pb-6 text-center sm:pt-16">
      <div className="pointer-events-none absolute left-1/2 top-2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-500/[0.09] blur-[70px]" />

      <div className="relative animate-float">
        <div className="absolute inset-0 -m-5 rounded-full border border-white/[0.045]" />
        <div className="absolute inset-0 -m-10 rounded-full border border-white/[0.028]" />
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[24px] border border-white/[0.09] bg-gradient-to-br from-violet-400/[0.14] via-ink-800 to-cyan-300/[0.05] shadow-[0_24px_70px_-28px_rgba(139,92,246,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <BrandMark size={46} />
        </div>
      </div>

      <div className="mt-9">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[9.5px] font-medium uppercase tracking-[0.16em] text-mist-500">
          <span className="h-1 w-1 rounded-full bg-emerald-300" />
          {preview ? "Design preview" : "Agent ready"}
        </div>
        <h1 className="mt-4 text-[25px] font-semibold leading-tight tracking-[-0.04em] text-mist-100 sm:text-[30px]">
          {hasSession ? "把下一步交给 Agent。" : "先创建一个会话，再开始协作。"}
        </h1>
        <p className="mx-auto mt-2.5 max-w-md text-[12.5px] leading-relaxed text-mist-500">
          {hasSession
            ? "输入任务、粘贴日志，或从下面的建议开始。思考过程、工具调用与审批会实时出现在同一条时间线上。"
            : "Chaite 会把多端会话、实时事件与安全审批汇聚到这里。"}
        </p>
        {!hasSession && onCreateSession ? (
          <div className="mt-5 flex justify-center">
            <Button size="md" variant="primary" onClick={onCreateSession} className="shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]">
              <Plus className="h-4 w-4" />
              立即新建会话
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-3">
        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={suggestion.title}
            type="button"
            onClick={() => onSuggestion(suggestion.prompt)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-[15px] border border-white/[0.065] bg-white/[0.022] p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300/20 hover:bg-white/[0.04] hover:shadow-[0_18px_40px_-30px_rgba(139,92,246,0.8)] animate-fade-up",
            )}
            style={{ animationDelay: `${120 + index * 70}ms` }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-violet-300/80 transition-colors group-hover:border-violet-300/20 group-hover:bg-violet-400/10 group-hover:text-violet-200">
              <suggestion.icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11.5px] font-medium text-mist-200">{suggestion.title}</span>
            <span className="text-[10px] leading-relaxed text-mist-600">{suggestion.text}</span>
            <ArrowUpRight className="absolute right-3 top-3 h-3 w-3 text-mist-700 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-300" />
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[9.5px] text-mist-600">
        <span className="inline-flex items-center gap-1.5">
          <Radio className="h-3 w-3 text-emerald-300/70" />
          Live SSE
        </span>
        <span className="inline-flex items-center gap-1.5">
          <TerminalSquare className="h-3 w-3 text-cyan-300/70" />
          Tool timeline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-violet-300/70" />
          Human approval
        </span>
      </div>
    </div>
  );
}
