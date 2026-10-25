"use client";

import * as React from "react";
import { CheckCheck, CircleAlert, Copy, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Markdown } from "@/components/chat/markdown";
import type { AssistantImage, TimelineItem } from "@/lib/timeline";
import { cn, formatClock, formatNumber } from "@/lib/utils";

type UserItem = Extract<TimelineItem, { kind: "user" }>;
type AssistantItem = Extract<TimelineItem, { kind: "assistant" }>;

export function UserMessage({ item }: { item: UserItem }) {
  const [lightboxImage, setLightboxImage] = React.useState<string | null>(null);

  return (
    <div className="group flex w-full justify-end animate-fade-up">
      <div className="flex max-w-[85%] sm:max-w-[75%] min-w-0 flex-col items-end gap-1.5">

        {/* Attached Images */}
        {item.images && item.images.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2 max-w-full">
            {item.images.map((img, idx) => {
              const src = img.url || img.base64 || "";
              if (!src) return null;
              return (
                <div
                  key={idx}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-black/10 shadow-xs cursor-pointer transition-transform hover:scale-[1.02]"
                  onClick={() => setLightboxImage(src)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`图片附件 ${idx + 1}`}
                    className="max-h-60 max-w-full rounded-xl object-contain"
                    loading="lazy"
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Text bubble */}
        {item.text && item.text !== "分享了一张图片" ? (
          <div
            className={cn(
              "relative rounded-xl border px-3 py-2 text-[14px] leading-[1.65] max-w-full min-w-0 [overflow-wrap:anywhere]",
              item.failed
                ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                : "border border-[var(--border)] bg-[var(--user-bg,var(--bg-panel))] text-[var(--text)] shadow-xs",
            )}
          >
            <div className="whitespace-pre-wrap break-all [overflow-wrap:anywhere]">{item.text}</div>
            {item.failed ? (
              <div className="mt-1.5 flex items-center gap-1 text-[9.5px] text-rose-600 dark:text-rose-300">
                <CircleAlert className="h-2.5 w-2.5" />
                发送失败，请重试
              </div>
            ) : null}
          </div>
        ) : null}
        {/* Pi Web-style bottom meta: timestamp and compact send status, never above the bubble. */}
        <div className="flex items-center gap-1.5 pr-1 text-[9.5px] text-[var(--text-dim)]">
          <span>你</span>
          <span>·</span>
          <span className="font-mono">{formatClock(item.createdAt)}</span>
          {item.pending ? (
            <span className="inline-flex items-center gap-1 text-[var(--accent)] font-medium">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
              发送中
            </span>
          ) : (
            <CheckCheck className="h-2.5 w-2.5 text-[var(--text-dim)]" />
          )}
        </div>

        {/* Lightbox Modal */}
        {lightboxImage ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setLightboxImage(null)}
          >
            <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage}
                alt="图片预览"
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}
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
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (item.text) {
      navigator.clipboard?.writeText(item.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="group relative animate-fade-up w-full">
      {/* Pi Web Style: Minimal Model & Meta Label at the top, full width markdown body */}
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-mono text-[var(--text-dim)]">
        <span className="flex h-4 w-4 items-center justify-center rounded bg-[var(--bg-panel)] text-[var(--accent)] border border-[var(--border)]">
          <BrandMark size={10} />
        </span>
        <span className="font-medium text-[var(--text-muted)] font-sans">Chaite Agent</span>
        <span className="text-[10px] opacity-70">· {formatClock(item.createdAt)}</span>

        {!item.done && streaming ? (
          <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/20 px-1 py-px text-[9px] text-cyan-600 dark:text-cyan-300">
            <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-500" />
            streaming
          </span>
        ) : null}

        {/* Pi Web-style hover actions: Copy */}
        <button
          type="button"
          onClick={handleCopy}
          className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[var(--text-dim)] hover:text-[var(--text)] p-1 rounded hover:bg-[var(--bg-hover)]"
          title="复制回复"
        >
          {copied ? <span className="text-emerald-500 text-[10px] font-medium">已复制</span> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      <div className="min-w-0 w-full">
        {showTyping ? <TypingDots /> : null}
        {item.text ? (
          <div className="relative">
            <Markdown content={item.text} />
            {!item.done && streaming ? (
              <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-cyan-500" />
            ) : null}
          </div>
        ) : null}
        <ImageGrid images={item.images ?? []} />
      </div>

      {/* Bottom Meta (Tokens & Cache info if present) */}
      {item.usage?.totalTokens ? (
        <div className="mt-1 flex items-center gap-2 text-[9px] font-mono text-[var(--text-dim)] opacity-0 group-hover:opacity-100 transition-opacity">
          <span>{formatNumber(item.usage.promptTokens ?? 0)} in · {formatNumber(item.usage.completionTokens ?? 0)} out</span>
          {item.usage.cachedTokens ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {formatNumber(item.usage.cachedTokens)} cached
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex h-7 items-center gap-1">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/70"
          style={{ animationDelay: `${dot * 130}ms`, animationDuration: "1.1s" }}
        />
      ))}
      <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-mist-600">
        <Sparkles className="h-2.5 w-2.5 text-accent/60" />
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
