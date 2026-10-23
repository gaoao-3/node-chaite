"use client";

import * as React from "react";
import {
  ArrowRight,
  Ban,
  Check,
  CheckCheck,
  Dna,
  Flame,
  Gauge,
  GitMerge,
  ListChecks,
  Recycle,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  BoardPage,
  EmptyPanel,
  MetricCard,
  SectionCard,
} from "@/components/boards/board-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import type { EvolutionData } from "@/hooks/use-boards";
import { EVOLUTION_STATUS_META } from "@/lib/platform";
import type { EvolutionScores, EvolutionTraceRecord } from "@/lib/types";
import { cn, formatPercent, formatRelativeTime, truncate } from "@/lib/utils";

const GATE = 0.75;

const DIMENSIONS: { key: keyof EvolutionScores; label: string; short: string; icon: React.ReactNode }[] = [
  { key: "correctness", label: "正确性 · Correctness", short: "正确性", icon: <CheckCheck className="h-3 w-3" /> },
  { key: "efficiency", label: "效率 · Efficiency", short: "效率", icon: <Gauge className="h-3 w-3" /> },
  { key: "safety", label: "安全 · Safety", short: "安全", icon: <ShieldCheck className="h-3 w-3" /> },
  { key: "reusability", label: "复用 · Reusability", short: "复用", icon: <Recycle className="h-3 w-3" /> },
];

function averageScores(traces: EvolutionTraceRecord[]): EvolutionScores {
  if (traces.length === 0) return { correctness: 0, efficiency: 0, safety: 0, reusability: 0 };
  const totals = { correctness: 0, efficiency: 0, safety: 0, reusability: 0 };
  for (const trace of traces) {
    totals.correctness += trace.trace.scores?.correctness ?? 0;
    totals.efficiency += trace.trace.scores?.efficiency ?? 0;
    totals.safety += trace.trace.scores?.safety ?? 0;
    totals.reusability += trace.trace.scores?.reusability ?? 0;
  }
  return {
    correctness: totals.correctness / traces.length,
    efficiency: totals.efficiency / traces.length,
    safety: totals.safety / traces.length,
    reusability: totals.reusability / traces.length,
  };
}

function Radar({ scores }: { scores: EvolutionScores }) {
  const size = 196;
  const center = size / 2;
  const radius = 67;
  const axes: { key: keyof EvolutionScores; label: string; dx: number; dy: number }[] = [
    { key: "correctness", label: "正确性", dx: 0, dy: -1 },
    { key: "efficiency", label: "效率", dx: 1, dy: 0 },
    { key: "safety", label: "安全", dx: 0, dy: 1 },
    { key: "reusability", label: "复用", dx: -1, dy: 0 },
  ];

  const point = (value: number, dx: number, dy: number) => {
    const r = Math.max(0, Math.min(1, value)) * radius;
    return [center + dx * r, center + dy * r] as const;
  };

  const polygon = (values: number[]) =>
    values
      .map((value, index) => {
        const axis = axes[index];
        return point(value, axis.dx, axis.dy).join(",");
      })
      .join(" ");

  const dataPoints = axes.map((axis) => scores[axis.key]);
  const dataPolygon = polygon(dataPoints);
  const gatePoints = axes.map(() => GATE);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-[196px] w-[196px] shrink-0" aria-label="四维能力雷达图">
      <defs>
        <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.06" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={polygon(axes.map(() => ring))}
          fill="none"
          stroke="rgba(255,255,255,0.055)"
          strokeWidth="1"
        />
      ))}
      {axes.map((axis) => {
        const [x, y] = point(1, axis.dx, axis.dy);
        return (
          <line
            key={axis.key}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        );
      })}
      <polygon
        points={polygon(gatePoints)}
        fill="none"
        stroke="rgba(251,191,36,0.38)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <polygon points={dataPolygon} fill="url(#radar-fill)" stroke="#A78BFA" strokeWidth="1.4" strokeLinejoin="round" />
      {axes.map((axis, index) => {
        const [x, y] = point(dataPoints[index], axis.dx, axis.dy);
        return <circle key={axis.key} cx={x} cy={y} r="2.3" fill="#C4B5FD" />;
      })}
      {axes.map((axis) => {
        const x = center + axis.dx * (radius + 19);
        const y = center + axis.dy * (radius + 13);
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(154,154,171,0.78)"
            fontSize="8.5"
            fontFamily="var(--font-geist-sans), sans-serif"
          >
            {axis.label}
          </text>
        );
      })}
      <circle cx={center} cy={center} r="1.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function GatePanel({ scores, average }: { scores: EvolutionScores; average: number }) {
  return (
    <SectionCard
      title="4 维门禁"
      hint="Gate threshold 75%"
      action={
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-medium",
            average >= GATE
              ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200"
              : "border-amber-300/20 bg-amber-300/[0.07] text-amber-200",
          )}
        >
          <span className={cn("h-1 w-1 rounded-full", average >= GATE ? "bg-emerald-300" : "bg-amber-300")} />
          avg {formatPercent(average, 0)}
        </span>
      }
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="relative">
          <div className="pointer-events-none absolute inset-4 rounded-full bg-violet-500/[0.06] blur-2xl" />
          <Radar scores={scores} />
        </div>

        <div className="grid w-full flex-1 gap-2">
          {DIMENSIONS.map((dimension) => {
            const value = scores[dimension.key] ?? 0;
            const passed = value >= GATE;
            return (
              <div key={dimension.key} className="rounded-xl border border-white/[0.055] bg-white/[0.018] px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-mist-500", passed ? "text-emerald-300/80" : "text-amber-300/80")}>
                    {dimension.icon}
                  </span>
                  <span className="text-[10px] font-medium text-mist-300">{dimension.label}</span>
                  <span
                    className={cn(
                      "ml-auto font-mono text-[10px] tabular-nums",
                      passed ? "text-emerald-200" : "text-amber-200",
                    )}
                  >
                    {formatPercent(value, 0)}
                  </span>
                </div>
                <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700",
                      passed
                        ? "bg-gradient-to-r from-emerald-400/70 to-cyan-300/80"
                        : "bg-gradient-to-r from-amber-400/70 to-rose-400/60",
                    )}
                    style={{ width: `${Math.max(0, value * 100)}%` }}
                  />
                  <span
                    className="absolute top-0 h-full w-px bg-white/30"
                    style={{ left: `${GATE * 100}%` }}
                    title="75% gate"
                  />
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[9px] text-mist-600">
            <span className="h-2 w-px bg-white/30" />
            虚线 / 竖线为 75% 门禁；四项全部通过才允许熔铸。
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function TraceCard({
  trace,
  busy,
  onReview,
  onMerge,
}: {
  trace: EvolutionTraceRecord;
  busy: string | null;
  onReview: (id: string, action: "approve" | "reject") => void;
  onMerge: (id: string) => void;
}) {
  const meta = EVOLUTION_STATUS_META[trace.status] ?? EVOLUTION_STATUS_META.candidate;
  const scores = trace.trace.scores;
  const canReview = trace.status === "candidate" || trace.status === "rejected";
  const canMerge = trace.status === "approved";

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.018] p-3.5 transition-colors hover:border-white/[0.1]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium", meta.chip)}>
          <span className={cn("h-1 w-1 rounded-full", meta.dot)} />
          {meta.label}
        </span>
        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 text-[8.5px] font-medium",
            trace.gatePassed
              ? "border-emerald-300/18 bg-emerald-300/[0.06] text-emerald-200/80"
              : "border-amber-300/18 bg-amber-300/[0.06] text-amber-200/80",
          )}
        >
          {trace.gatePassed ? "gate passed" : "gate blocked"}
        </span>
        <span className="font-mono text-[8.5px] text-mist-700">{trace.id.slice(0, 16)}</span>
        <span className="ml-auto text-[9px] text-mist-700">{formatRelativeTime(trace.createdAt)}</span>
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-mist-300">{truncate(trace.trace.userIntent.raw, 260)}</p>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {DIMENSIONS.map((dimension) => {
          const value = scores?.[dimension.key] ?? 0;
          return (
            <div key={dimension.key} className="rounded-lg border border-white/[0.05] bg-black/20 px-1.5 py-1">
              <div className="text-[8px] text-mist-600">{dimension.short}</div>
              <div className={cn("mt-0.5 font-mono text-[10px]", value >= GATE ? "text-emerald-200" : "text-amber-200")}>
                {formatPercent(value, 0)}
              </div>
              <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cn("h-full rounded-full", value >= GATE ? "bg-emerald-300/70" : "bg-amber-300/70")}
                  style={{ width: `${Math.max(0, value * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {trace.trace.lessons?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {trace.trace.lessons.slice(0, 4).map((lesson) => (
            <span
              key={lesson}
              className="rounded border border-white/[0.055] bg-white/[0.02] px-1.5 py-0.5 text-[8.5px] text-mist-500"
            >
              {truncate(lesson, 54)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.05] pt-2.5">
        <span className="inline-flex items-center gap-1 text-[8.5px] text-mist-600">
          <ScrollText className="h-2.5 w-2.5" />
          {trace.trace.toolCalls?.length ?? 0} tool calls
        </span>
        <span className="text-mist-700">·</span>
        <span className="font-mono text-[8.5px] text-mist-600">
          {trace.trace.draftSkillName ?? "draft-skill"}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {canReview ? (
            <>
              <Button
                size="xs"
                variant="subtle"
                loading={busy === `${trace.id}:approve`}
                disabled={Boolean(busy)}
                onClick={() => onReview(trace.id, "approve")}
              >
                <Check className="h-3 w-3" />
                批准
              </Button>
              <Button
                size="xs"
                variant="ghost"
                loading={busy === `${trace.id}:reject`}
                disabled={Boolean(busy)}
                onClick={() => onReview(trace.id, "reject")}
                className="text-rose-300/80 hover:bg-rose-400/10 hover:text-rose-200"
              >
                <Ban className="h-3 w-3" />
                驳回
              </Button>
            </>
          ) : null}
          {canMerge ? (
            <Button
              size="xs"
              variant="primary"
              loading={busy === `${trace.id}:merge`}
              disabled={Boolean(busy)}
              onClick={() => onMerge(trace.id)}
            >
              <GitMerge className="h-3 w-3" />
              熔铸技能
            </Button>
          ) : null}
          {trace.status === "merged" ? (
            <span className="inline-flex items-center gap-1 text-[9px] text-cyan-200/80">
              <Sparkles className="h-3 w-3" />
              {trace.skillName ?? "skill merged"}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

export function EvolutionBoard({ data, onMenu }: { data: EvolutionData; onMenu?: () => void }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const scores = React.useMemo(() => averageScores(data.traces), [data.traces]);
  const average =
    (scores.correctness + scores.efficiency + scores.safety + scores.reusability) / 4;
  const merged = data.traces.filter((trace) => trace.status === "merged").length;
  const candidates = data.traces.filter((trace) => trace.status === "candidate").length;

  const review = async (id: string, action: "approve" | "reject") => {
    setBusy(`${id}:${action}`);
    await data.review(id, action);
    setBusy(null);
  };

  const merge = async (id: string) => {
    setBusy(`${id}:merge`);
    await data.merge(id);
    setBusy(null);
  };

  return (
    <BoardPage
      onMenu={onMenu}
      icon={<Dna className="h-4 w-4" />}
      eyebrow="Self-evolution"
      title="自进化熔炉"
      description="Trace → Score → 4D Gate → Skill merge"
      actions={
        <>
          <span className="hidden items-center gap-1 rounded-full border border-amber-300/15 bg-amber-300/[0.055] px-2 py-1 text-[9px] text-amber-200/80 sm:inline-flex">
            <Flame className="h-3 w-3" />
            GATE {formatPercent(GATE, 0)}
          </span>
          <Button size="icon-sm" variant="ghost" onClick={() => void data.refresh()} title="刷新进化数据">
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
          label="Traces"
          value={data.stats?.total ?? 0}
          hint="已采集的执行轨迹"
          icon={<Dna className="h-3.5 w-3.5" />}
          accent="violet"
        />
        <MetricCard
          label="Gate passed"
          value={data.stats?.gatePassed ?? 0}
          hint="四维全部 ≥ 75%"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          accent="emerald"
        />
        <MetricCard
          label="Average score"
          value={formatPercent(data.stats?.averageScore ?? 0, 0)}
          hint="所有轨迹的四维均值"
          icon={<Gauge className="h-3.5 w-3.5" />}
          accent="cyan"
        />
        <MetricCard
          label="Merged skills"
          value={merged}
          hint={`${candidates} candidates waiting`}
          icon={<GitMerge className="h-3.5 w-3.5" />}
          accent="amber"
        />
      </div>

      <GatePanel scores={scores} average={average} />

      <SectionCard
        title="熔炉管线"
        hint="Hermes / nekocode loop"
        action={<span className="font-mono text-[8.5px] text-mist-700">evolution.trace.v1</span>}
      >
        <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
          {[
            { label: "Trace", text: `${data.traces.length} 条轨迹`, icon: ScrollText, accent: "text-violet-200" },
            { label: "Score", text: "四维归一化", icon: Gauge, accent: "text-cyan-200" },
            { label: "Gate", text: "全部 ≥ 75%", icon: ShieldCheck, accent: "text-amber-200" },
            { label: "Merge", text: `${merged} 个技能`, icon: GitMerge, accent: "text-emerald-200" },
          ].map((step, index) => (
            <React.Fragment key={step.label}>
              <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-2.5">
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-black/20", step.accent)}>
                  <step.icon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <div className="text-[10.5px] font-medium text-mist-200">{step.label}</div>
                  <div className="text-[9px] text-mist-600">{step.text}</div>
                </div>
              </div>
              {index < 3 ? (
                <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-mist-700 sm:block" />
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="候选轨迹"
        hint={`${data.traces.length} traces`}
        action={
          <span className="inline-flex items-center gap-1 text-[9px] text-mist-600">
            <ListChecks className="h-3 w-3" />
            review queue
          </span>
        }
      >
        {data.loading && data.traces.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : data.traces.length === 0 ? (
          <EmptyPanel
            icon={<Dna className="h-4 w-4" />}
            title="熔炉尚未点火"
            description="当一次执行产生完整的工具链、重试记录与四维评分后，Evolution Trace 会出现在这里，等待评审与熔铸。"
            action={
              <span className="inline-flex items-center gap-1 text-[9.5px] text-mist-600">
                <Flame className="h-3 w-3 text-amber-300/60" />
                等待第一条 Evolution Trace
              </span>
            }
          />
        ) : (
          <div className="space-y-2">
            {data.traces.map((trace) => (
              <TraceCard
                key={trace.id}
                trace={trace}
                busy={busy}
                onReview={(id, action) => void review(id, action)}
                onMerge={(id) => void merge(id)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-2.5 md:grid-cols-3">
        {[
          {
            icon: ScrollText,
            title: "轨迹即证据",
            text: "每次工具调用、重试与恢复路径都会被记录，确保技能来自可复现的成功经验。",
          },
          {
            icon: ShieldCheck,
            title: "四维门禁",
            text: "正确性、效率、安全、复用四项独立评分，任何一项低于阈值都会阻止熔铸。",
          },
          {
            icon: Recycle,
            title: "可撤销演进",
            text: "候选技能先落在 skills/active，可被评审驳回，也可在后续轨迹中继续迭代。",
          },
        ].map((item) => (
          <div key={item.title} className="panel rounded-[15px] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-mist-200">
              <item.icon className="h-3.5 w-3.5 text-violet-300/70" />
              {item.title}
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-mist-600">{item.text}</p>
          </div>
        ))}
      </div>
    </BoardPage>
  );
}
