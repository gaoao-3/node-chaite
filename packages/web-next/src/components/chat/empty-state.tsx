"use client";

import * as React from "react";
import { BrandMark } from "@/components/brand";
import { ArrowUpRight } from "lucide-react";

const QUICK_CHIPS = [
  { label: "体检系统状态", prompt: "请调用相关工具体检当前系统状态，重点检查网关连接与工具健康度。" },
  { label: "审查工程代码", prompt: "请使用 hash_read 工具查看当前工程核心代码，并给出针对性重构建议。" },
  { label: "提炼技能 SOP", prompt: "请从最近的执行轨迹中提炼一个可复用的标准技能，并执行四维自评估。" },
];

export function ChatEmptyState({
  onSuggestion,
  hasSession,
}: {
  onSuggestion: (prompt: string) => void;
  hasSession: boolean;
  preview?: boolean;
  onCreateSession?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center select-none">
      {/* Claude-style Minimal Centered Hero */}
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08] shadow-sm mb-4">
        <BrandMark size={28} />
      </div>

      <h1 className="text-[20px] font-medium tracking-tight text-mist-100 sm:text-[22px]">
        {hasSession ? "天童凯伊已就绪" : "有什么我可以帮你的？"}
      </h1>

      <p className="mt-1.5 max-w-sm text-[13px] text-mist-500 leading-relaxed">
        支持深度推理思考、Pi 哈希高精度编辑与多端网关协同
      </p>

      {/* Tiny subtle prompt chips (Claude style) */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 max-w-md">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onSuggestion(chip.prompt)}
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[11.5px] text-mist-400 hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-mist-200 transition-colors"
          >
            <span>{chip.label}</span>
            <ArrowUpRight className="h-3 w-3 opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
}
