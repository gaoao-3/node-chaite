"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Clock3,
  Fingerprint,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Timer,
} from "lucide-react";
import {
  BoardPage,
  EmptyPanel,
  MetricCard,
  SectionCard,
} from "@/components/boards/board-shell";
import { ApprovalCard } from "@/components/chat/approval-card";
import { PlatformBadge } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import type { FeedApproval, UseApprovalsFeedResult } from "@/hooks/use-approvals-feed";
import { RISK_META } from "@/lib/platform";
import type { ApprovalState } from "@/lib/timeline";
import { cn, formatRelativeTime } from "@/lib/utils";

type RiskFilter = "all" | "high" | "critical";

const FILTERS: { key: RiskFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "high", label: "高风险+" },
  { key: "critical", label: "极高风险" },
];

function toApprovalState(item: FeedApproval): ApprovalState {
  return {
    request: item.request,
    status: "pending",
    responding: item.responding,
    error: item.error,
  };
}

function RiskPolicy() {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {(
        [
          ["low", "低风险", "自动执行并记录审计日志"],
          ["medium", "中风险", "执行前通知，可在事件流中撤回"],
          ["high", "高风险", "必须人工批准，默认仅本次有效"],
          ["critical", "极高风险", "阻断执行，需显式二次确认"],
        ] as const
      ).map(([level, label, text]) => {
        const meta = RISK_META[level];
        return (
          <div key={level} className="flex items-center gap-2 rounded-lg border border-white/[0.055] bg-white/[0.015] px-2.5 py-2">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.bar)} />
            <span className={cn("shrink-0 rounded border px-1 py-px text-[8.5px] font-medium", meta.chip)}>{label}</span>
            <span className="text-[9px] leading-relaxed text-mist-600">{text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ApprovalsBoard({
  feed,
  onOpenSession,
}: {
  feed: UseApprovalsFeedResult;
  onOpenSession: (sessionId: string) => void;
}) {
  const [filter, setFilter] = React.useState<RiskFilter>("all");
  const approvals = feed.approvals;
  const high = approvals.filter(
    (item) => item.request.riskLevel === "high" || item.request.riskLevel === "critical",
  ).length;
  const critical = approvals.filter((item) => item.request.riskLevel === "critical").length;
  const sessions = new Set(approvals.map((item) => item.session.id)).size;
  const oldest = approvals.reduce(
    (min, item) => Math.min(min, item.request.createdAt),
    Number.POSITIVE_INFINITY,
  );

  const filtered = approvals.filter((item) => {
    if (filter === "all") return true;
    if (filter === "critical") return item.request.riskLevel === "critical";
    return item.request.riskLevel === "high" || item.request.riskLevel === "critical";
  });

  return (
    <BoardPage
      icon={<ShieldAlert className="h-4 w-4" />}
      eyebrow="Security"
      title="安全审批"
      description="High-risk actions require explicit human confirmation"
      actions={
        <>
          <span className="hidden items-center gap-1 rounded-full border border-amber-300/15 bg-amber-300/[0.055] px-2 py-1 text-[9px] text-amber-200/80 sm:inline-flex">
            <Siren className="h-3 w-3" />
            Human-in-the-loop
          </span>
          <Button size="icon-sm" variant="ghost" onClick={() => void feed.refresh()} title="刷新审批队列">
            <RefreshCw className={cn("h-3.5 w-3.5", feed.refreshing && "animate-spin")} />
          </Button>
        </>
      }
    >
      {feed.error ? (
        <div className="rounded-xl border border-rose-400/18 bg-rose-400/[0.055] px-3 py-2 text-[10.5px] text-rose-200/90">
          {feed.error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard
          label="Pending"
          value={approvals.length}
          hint="等待人工确认"
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          accent="amber"
        />
        <MetricCard
          label="High risk"
          value={high}
          hint={`${critical} critical`}
          icon={<Siren className="h-3.5 w-3.5" />}
          accent="rose"
        />
        <MetricCard
          label="Sessions"
          value={sessions}
          hint="跨会话聚合"
          icon={<Fingerprint className="h-3.5 w-3.5" />}
          accent="violet"
        />
        <MetricCard
          label="Oldest"
          value={Number.isFinite(oldest) ? formatRelativeTime(oldest) : "—"}
          hint="最早挂起的审批"
          icon={<Timer className="h-3.5 w-3.5" />}
          accent="cyan"
        />
      </div>

      <SectionCard
        title="审批队列"
        hint={`${filtered.length} items`}
        action={
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/20 p-0.5">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  "rounded-md px-2 py-1 text-[9.5px] font-medium transition-colors",
                  filter === item.key
                    ? "bg-white/[0.08] text-mist-100"
                    : "text-mist-500 hover:bg-white/[0.04] hover:text-mist-300",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      >
        {feed.loading && approvals.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyPanel
            icon={<ShieldCheck className="h-4 w-4" />}
            title={approvals.length === 0 ? "审批队列已清空" : "当前筛选下没有审批"}
            description={
              approvals.length === 0
                ? "所有高风险操作都已处理。新的 approval_request 会通过 SSE 实时出现在这里，也会嵌入对应会话的消息流。"
                : "切换筛选条件，查看其他风险等级的待审操作。"
            }
            action={
              approvals.length === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/[0.055] px-2 py-1 text-[9px] text-emerald-200/80">
                  <ShieldCheck className="h-3 w-3" />
                  all clear
                </span>
              ) : (
                <Button size="xs" variant="subtle" onClick={() => setFilter("all")}>
                  查看全部
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.request.requestId} className="animate-fade-up">
                <div className="mb-1.5 flex items-center gap-2 px-1">
                  <PlatformBadge platform={item.session.platform} size="xs" />
                  <button
                    type="button"
                    onClick={() => onOpenSession(item.session.id)}
                    className="min-w-0 truncate text-[10px] font-medium text-mist-300 transition-colors hover:text-mist-100"
                  >
                    {item.session.title}
                  </button>
                  <span className="hidden font-mono text-[8.5px] text-mist-700 sm:inline">
                    {item.session.botId}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-mist-600">
                    <Clock3 className="h-2.5 w-2.5" />
                    {formatRelativeTime(item.request.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenSession(item.session.id)}
                    className="inline-flex items-center gap-0.5 text-[9px] text-violet-300/70 transition-colors hover:text-violet-200"
                  >
                    打开
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  </button>
                </div>
                <ApprovalCard
                  approval={toApprovalState(item)}
                  onRespond={(requestId, option) => feed.respond(requestId, option)}
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="分级策略" hint="risk policy matrix">
        <RiskPolicy />
        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2 text-[9px] leading-relaxed text-mist-600">
          <Fingerprint className="mt-px h-3 w-3 shrink-0 text-mist-500" />
          审批请求携带 SHA-256 integrity digest；响应会广播 approval_result 事件，并在会话时间线内保留审计痕迹。
        </div>
      </SectionCard>
    </BoardPage>
  );
}
