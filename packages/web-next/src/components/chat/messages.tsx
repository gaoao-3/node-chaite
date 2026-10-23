"use client";

import * as React from "react";
import { CheckCheck, CircleAlert, Clock3, Sparkles, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Markdown } from "@/components/chat/markdown";
import type { AssistantImage, TimelineItem } from "@/lib/timeline";
import { cn, formatClock, formatNumber } from "@/lib/utils";

type UserItem = Extract<TimelineItem, { kind: "user" }>;
type AssistantItem = Extract<TimelineItem, { kind: "assistant" }>;

export function UserMessage({ item }: { item: UserItem }) {
  return (
    <div className="group flex items-start justify-end gap-2.5 animate-fade-up">
      <div className="flex max-w-[86%] flex-col items-end gap-1.5 sm:max-w-[76%]">
        <div className="flex items-center gap-1.5 pr-1 text-[9.5px] text-mist-600">
          <span>你</span>
          <span className="text-mist-700">·</span>
          <span className="font-mono">{formatClock(item.createdAt)}</span>
          {item.pending ? (
            <span className="inline-flex items-center gap-1 text-violet-300/70">
              <span className="h-1 w-1 animate-pulse rounded-full bg-violet-300" />
              发送中
            </span>
          ) : (
            <CheckCheck className="h-2.5 w-2.5 text-mist-700" />
          )}
        </div>
        <div
          className={cn(
            "relative rounded-[16px] rounded-tr-[6px] border px-3.5 py-2.5 text-[13px] leading-[1.65] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            item.failed
              ? "border-rose-400/25 bg-rose-400/[0.07] text-rose-100"
              : "border-white/[0.085] bg-gradient-to-br from-white/[0.07] to-white/[0.035] text-mist-200",
          )}
        >
          <div className="whitespace-pre-wrap break-words">{item.text}</div>
          {item.failed ? (
            <div className="mt-1.5 flex items-center gap-1 text-[9.5px] text-rose-300">
              <CircleAlert className="h-2.5 w-2.5" />
              发送失败，请重试
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-gradient-to-br from-mist-500/40 to-mist-700/30 text-mist-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <UserRound className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

function ImageGrid({ images }: { images: AssistantImage[] }) {
  if (images.length === 0) return null;
  return (
    <div className="mt-3 grid max-w-xl grid-cols-2 gap-2">
      {images.map((image, index) =>
        image.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${image.url.slice(0, 48)}-${index}`}
            src={image.url}
            alt={image.alt ?? "Agent 生成图片"}
            className="max-h-72 w-full rounded-xl border border-white/[0.08] object-cover"
            loading="lazy"
          />
        ) : null,
      )}
    </div>
  );
}

export function AssistantMessage({ item, streaming }: { item: AssistantItem; streaming: boolean }) {
  const showTyping = streaming && !item.text && !item.done;
  return (
    <div className="group flex items-start gap-3 animate-fade-up">
      <div className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-300/18 bg-gradient-to-br from-violet-400/15 to-cyan-300/[0.06] shadow-[0_0_24px_-10px_rgba(139,92,246,0.7)]">
        <BrandMark size={22} className="drop-shadow-none" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-[-0.01em] text-mist-200">Chaite Agent</span>
          <span className="rounded border border-violet-300/15 bg-violet-400/[0.06] px-1 py-px text-[8.5px] font-medium uppercase tracking-[0.1em] text-violet-200/70">
            assistant
          </span>
          {!item.done && streaming ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-1.5 py-px text-[8.5px] text-cyan-200/80">
              <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-300" />
              streaming
            </span>
          ) : null}
          <span className="ml-auto hidden items-center gap-1 font-mono text-[9px] text-mist-700 sm:inline-flex">
            <Clock3 className="h-2.5 w-2.5" />
            {formatClock(item.createdAt)}
          </span>
        </div>

        <div className="mt-1.5">
          {showTyping ? <TypingDots /> : null}
          {item.text ? (
            <div className="relative">
              <Markdown content={item.text} />
              {!item.done && streaming ? (
                <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-cyan-300/80" />
              ) : null}
            </div>
          ) : null}
          <ImageGrid images={item.images ?? []} />
        </div>

        <div className="mt-1.5 flex items-center gap-2 text-[8.5px] text-mist-700 opacity-0 transition-opacity group-hover:opacity-100">
          {item.usage?.totalTokens ? (
            <span className="font-mono">
              {formatNumber(item.usage.promptTokens ?? 0)} in · {formatNumber(item.usage.completionTokens ?? 0)} out
            </span>
          ) : null}
          {item.usage?.cachedTokens ? (
            <span className="font-mono text-emerald-300/40">{formatNumber(item.usage.cachedTokens)} cached</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex h-7 items-center gap-1">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300/70"
          style={{ animationDelay: `${dot * 130}ms`, animationDuration: "1.1s" }}
        />
      ))}
      <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-mist-600">
        <Sparkles className="h-2.5 w-2.5 text-violet-300/60" />
        Agent 正在生成
      </span>
    </div>
  );
}

export function ErrorNotice({
  message,
  code,
  fatal,
}: {
  message: string;
  code?: string;
  fatal?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-rose-400/18 bg-rose-400/[0.055] px-3 py-2.5 animate-fade-up">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-rose-200">
            {fatal ? "运行已终止" : "运行告警"}
          </span>
          {code ? (
            <span className="rounded border border-rose-400/15 px-1 font-mono text-[8.5px] text-rose-300/70">
              {code}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-rose-200/80">{message}</p>
      </div>
    </div>
  );
}
