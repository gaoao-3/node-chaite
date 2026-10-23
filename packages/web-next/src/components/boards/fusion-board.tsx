"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCheck,
  CircleDashed,
  GitBranch,
  GitPullRequestArrow,
  ListChecks,
  MessageSquareText,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import {
  BoardPage,
  EmptyPanel,
  MetricCard,
  SectionCard,
} from "@/components/boards/board-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import type { FusionData } from "@/hooks/use-boards";
import { FUSION_STATUS_META } from "@/lib/platform";
import type { FusionTaskRecord } from "@/lib/types";
import { cn, formatPercent, formatRelativeTime, truncate } from "@/lib/utils";

function TaskCard({ task, onAdvance }: { task: FusionTaskRecord; onAdvance: (id: string, status: string) => void }) {
  const meta = FUSION_STATUS_META[task.status] ?? FUSION_STATUS_META.queued;
  const criteria = task.spec.review_criteria ?? [];
  const tools = task.spec.target_tools ?? [];
  const latestReview = task.reviews?.[task.reviews.length - 1];
  const nextStatus =
    task.status === "queued"
      ? "dispatched"
      : task.status === "dispatched"
        ? "running"
        : task.status === "running"
          ? "review"
          : task.status === "review"
            ? "approved"
            : null;

  return (
    <div className="group rounded-[14px] border border-white/[0.06] bg-white/[0.018] p-3.5 transition-colors hover:border-white/[0.1] hover:bg-white/[0.028]">
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]", meta.chip)}>
          <GitBranch className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium", meta.chip)}>
              <span className={cn("h-1 w-1 rounded-full", meta.dot)} />
              {meta.label}
            </span>
            <span className="font-mono text-[8.5px] text-mist-700">{task.id.slice(0, 12)}</span>
            {task.sidekick ? (
              <span className="rounded border border-cyan-300/15 bg-cyan-300/[0.05] px-1 py-px font-mono text-[8.5px] text-cyan-200/70">
                {task.sidekick}
              </span>
            ) : null}
            <span className="ml-auto text-[9px] text-mist-700">{formatRelativeTime(task.updatedAt)}</span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-mist-300">{task.spec.instruction}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            {tools.slice(0, 4).map((tool) => (
              <span
                key={tool.name}
                className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-0.5 font-mono text-[8.5px] text-mist-500"
              >
                {tool.name}
              </span>
            ))}
            {tools.length > 4 ? <span className="text-[8.5px] text-mist-700">+{tools.length - 4}</span> : null}
            <span className="mx-1 text-mist-700">|</span>
            <span className="inline-flex items-center gap-1 text-[8.5px] text-mist-600">
              <ListChecks className="h-2.5 w-2.5" />
              {criteria.length} criteria
            </span>
            {task.spec.diff_schema?.format ? (
              <span className="rounded bg-white/[0.03] px-1 py-0.5 font-mono text-[8.5px] text-mist-600">
                {task.spec.diff_schema.format}
              </span>
            ) : null}
          </div>

          {latestReview ? (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/[0.055] bg-black/20 px-2 py-1.5 text-[9.5px] text-mist-500">
              <ShieldCheck className="h-3 w-3 text-emerald-300/70" />
              <span>{latestReview.reviewer}</span>
              <span className="text-mist-700">·</span>
              <span className="text-emerald-200/80">{latestReview.decision}</span>
              {latestReview.score !== undefined ? (
                <span className="ml-auto font-mono text-mist-600">{formatPercent(latestReview.score, 0)}</span>
              ) : null}
            </div>
          ) : null}

          {task.result?.summary ? (
            <div className="mt-2 rounded-lg border border-white/[0.055] bg-white/[0.018] px-2.5 py-1.5 text-[10px] leading-relaxed text-mist-500">
              {truncate(task.result.summary, 220)}
            </div>
          ) : null}
        </div>

        {nextStatus ? (
          <Button
            size="xs"
            variant="subtle"
            onClick={() => onAdvance(task.id, nextStatus)}
            className="shrink-0"
            title={`推进到 ${nextStatus}`}
          >
            推进
            <ArrowRight className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AgentNode({
  icon,
  label,
  role,
  accent,
  value,
  hint,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  role: string;
  accent: "violet" | "cyan" | "amber";
  value: string;
  hint: string;
  active?: boolean;
}) {
  const accents = {
    violet: "border-violet-300/20 from-violet-400/[0.13] text-violet-200",
    cyan: "border-cyan-300/20 from-cyan-300/[0.1] text-cyan-200",
    amber: "border-amber-300/20 from-amber-300/[0.08] text-amber-200",
  } as const;
  return (
    <div
      className={cn(
        "relative flex-1 overflow-hidden rounded-[15px] border bg-gradient-to-br to-transparent p-3.5",
        accents[accent],
        active && "shadow-[0_0_34px_-16px_rgba(103,232,249,0.6)]",
      )}
    >
      {active ? (
        <span className="absolute right-2.5 top-2.5 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-cyan-300" />
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-black/20">
          {icon}
        </span>
        <div>
          <div className="text-[11.5px] font-semibold tracking-[-0.01em] text-mist-100">{label}</div>
          <div className="text-[8.5px] uppercase tracking-[0.13em] text-mist-600">{role}</div>
        </div>
      </div>
      <div className="mt-3 text-[19px] font-semibold leading-none tracking-[-0.03em] text-mist-100 tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[9px] text-mist-600">{hint}</div>
    </div>
  );
}

function Connector({ label, vertical = false }: { label: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="flex flex-col items-center gap-1 py-0.5 sm:hidden">
        <ArrowDown className="h-3.5 w-3.5 text-mist-700" />
      </div>
    );
  }
  return (
    <div className="hidden flex-col items-center gap-1 px-1 sm:flex">
      <span className="whitespace-nowrap font-mono text-[7.5px] uppercase tracking-[0.12em] text-mist-700">
        {label}
      </span>
      <div className="relative h-px w-10 bg-gradient-to-r from-violet-300/30 via-white/20 to-cyan-300/30">
        <span className="absolute right-0 top-1/2 h-1 w-1 -translate-y-1/2 rotate-45 border-r border-t border-white/40" />
      </div>
    </div>
  );
}

export function FusionBoard({
  data,
  onGoChat,
}: {
  data: FusionData;
  onGoChat: () => void;
}) {
  const byStatus = data.stats?.byStatus ?? {};
  const running = (byStatus.running ?? 0) + (byStatus.dispatched ?? 0) + (byStatus.queued ?? 0);
  const review = (byStatus.review ?? 0) + (byStatus.changes_requested ?? 0);
  const approved = (byStatus.approved ?? 0) + (byStatus.merged ?? 0);
  const activeTasks = data.tasks.filter((task) => task.status === "running" || task.status === "dispatched");

  return (
    <BoardPage
      icon={<Rocket className="h-4 w-4" />}
      eyebrow="Orchestration"
      title="Fusion 协同"
      description="Main Agent 拆解任务 · Sidekick 执行 · 评审门禁合流"
      actions={
        <>
          <Button size="sm" variant="subtle" onClick={onGoChat}>
            <MessageSquareText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">前往对话派发</span>
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => void data.refresh()} title="刷新 Fusion 数据">
            <RefreshCw className={cn("h-3.5 w-3.5", data.refreshing && "animate-spin")} />
          </Button>
        </>
      }
    >
      {data.error ? (
        <div className="rounded-xl border border-rose-400/18 bg-rose-400/[0.055] px-3 py-2 text-[10.5px] text-rose-200/90">
          {data.error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard
          label="Total tasks"
          value={data.stats?.total ?? 0}
          hint="已登记的 Fusion 委派"
          icon={<Workflow className="h-3.5 w-3.5" />}
          accent="violet"
        />
        <MetricCard
          label="In flight"
          value={running}
          hint="queued / dispatched / running"
          icon={<Zap className="h-3.5 w-3.5" />}
          accent="cyan"
        />
        <MetricCard
          label="Awaiting review"
          value={review}
          hint="review / changes requested"
          icon={<GitPullRequestArrow className="h-3.5 w-3.5" />}
          accent="amber"
        />
        <MetricCard
          label="Approved"
          value={approved}
          hint="已通过评审并合流"
          icon={<CheckCheck className="h-3.5 w-3.5" />}
          accent="emerald"
        />
      </div>

      <SectionCard
        title="协同拓扑"
        hint="Main ↔ Sidekick ↔ Review gate"
        action={
          <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-0.5 text-[8.5px] text-mist-500">
            <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-300" />
            graph synced
          </span>
        }
      >
        <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
          <AgentNode
            icon={<Bot className="h-3.5 w-3.5" />}
            label="Main Agent"
            role="Planner"
            accent="violet"
            value={`${byStatus.queued ?? 0} queued`}
            hint="拆解意图 · 生成 FusionTaskSpec"
          />
          <Connector label="delegate" vertical />
          <AgentNode
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Sidekick"
            role="Executor"
            accent="cyan"
            value={`${activeTasks.length || byStatus.running || 0} active`}
            hint="调用工具 · 产出 diff 与测试"
            active={activeTasks.length > 0}
          />
          <Connector label="submit" vertical />
          <AgentNode
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label="Review Gate"
            role="Arbiter"
            accent="amber"
            value={`${review} pending`}
            hint="权重评分 · 决定合流或返工"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.05] pt-2.5 text-[9px] text-mist-600">
          <span className="inline-flex items-center gap-1">
            <CircleDashed className="h-3 w-3" />
            任务队列 {byStatus.queued ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3 text-cyan-300/70" />
            执行中 {(byStatus.running ?? 0) + (byStatus.dispatched ?? 0)}
          </span>
          <span className="inline-flex items-center gap-1">
            <GitPullRequestArrow className="h-3 w-3 text-amber-300/70" />
            待评审 {byStatus.review ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckCheck className="h-3 w-3 text-emerald-300/70" />
            已通过 {byStatus.approved ?? 0}
          </span>
          <span className="ml-auto font-mono text-mist-700">spec: fusion.task.v1</span>
        </div>
      </SectionCard>

      <SectionCard
        title="任务队列"
        hint={`${data.tasks.length} tasks`}
        action={
          data.loading ? (
            <span className="text-[9.5px] text-mist-600">loading…</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9px] text-mist-600">
              <Users className="h-3 w-3" />
              sidekick pool
            </span>
          )
        }
      >
        {data.loading && data.tasks.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : data.tasks.length === 0 ? (
          <EmptyPanel
            icon={<GitBranch className="h-4 w-4" />}
            title="暂无 Fusion 任务"
            description="当 Main Agent 识别到可委派子任务时，会在这里生成 FusionTaskSpec，并交给 Sidekick 执行。"
            action={
              <Button size="sm" variant="outline" onClick={onGoChat}>
                <MessageSquareText className="h-3.5 w-3.5" />
                去对话里派发任务
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {data.tasks.map((task) => (
              <TaskCard key={task.id} task={task} onAdvance={(id, status) => void data.advance(id, status)} />
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-2.5 md:grid-cols-3">
        {[
          {
            icon: Sparkles,
            title: "独立上下文",
            text: "Sidekick 只接收 instruction 与显式 context，避免主会话的噪声污染。",
          },
          {
            icon: ListChecks,
            title: "加权评审",
            text: "review_criteria 权重和为 1，required 项失败会直接驳回委派。",
          },
          {
            icon: ShieldCheck,
            title: "路径白名单",
            text: "diff_schema.path_scope 限制写入范围，越界改动不允许合流。",
          },
        ].map((item) => (
          <div key={item.title} className="panel rounded-[15px] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-mist-200">
              <item.icon className="h-3.5 w-3.5 text-violet-300/70" />
              {item.title}
              <ArrowUpRight className="ml-auto h-3 w-3 text-mist-700" />
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-mist-600">{item.text}</p>
          </div>
        ))}
      </div>
    </BoardPage>
  );
}
