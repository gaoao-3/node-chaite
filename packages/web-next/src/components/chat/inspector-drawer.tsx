"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Code2,
  Cpu,
  GitCompare,
  Layers,
  Puzzle,
  Radio,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchGateways,
  fetchPlugins,
  startGateway,
  stopGateway,
  type GatewayInfo,
  type PluginInfo,
} from "@/lib/api";
import type { EvolutionData, FusionData } from "@/hooks/use-boards";
import type { UseApprovalsFeedResult } from "@/hooks/use-approvals-feed";
import type { EvolutionTraceRecord, FusionTaskRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export type InspectorTab = "fusion" | "evolution" | "approvals" | "plugins";

export interface InspectorDrawerProps {
  open: boolean;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
  token: string | null;
  fusionData: FusionData;
  evolutionData: EvolutionData;
  approvalsFeed?: UseApprovalsFeedResult;
  skillCount: number;
  onOpenSettingsTab?: (tab: "channels" | "skills" | "mcp" | "plugins") => void;
}

export function InspectorDrawer({
  open,
  tab,
  onTabChange,
  onClose,
  token,
  fusionData,
  evolutionData,
  approvalsFeed,
  skillCount,
  onOpenSettingsTab,
}: InspectorDrawerProps) {
  const [gateways, setGateways] = React.useState<GatewayInfo[]>([]);
  const [plugins, setPlugins] = React.useState<PluginInfo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [actionPending, setActionPending] = React.useState<string | null>(null);

  const [expandedSkill, setExpandedSkill] = React.useState<string | null>(null);
  const [expandedDiff, setExpandedDiff] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [gw, pl] = await Promise.all([
        fetchGateways(token).catch(() => []),
        fetchPlugins(token).catch(() => []),
      ]);
      setGateways(gw);
      setPlugins(pl);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  const handleToggleGateway = async (gw: GatewayInfo) => {
    if (!token) return;
    setActionPending(gw.id);
    try {
      if (gw.status === "running") {
        await stopGateway(token, gw.id);
      } else {
        await startGateway(token, gw.id);
      }
      await loadData();
    } finally {
      setActionPending(null);
    }
  };

  const handleClearFusion = async () => {
    if (confirm("确定清空所有副手任务记录？")) {
      await fusionData.clear();
    }
  };

  const handleClearEvolution = async () => {
    if (confirm("确定清空所有自进化候选轨迹？")) {
      await evolutionData.clear();
    }
  };

  if (!open) return null;

  const pendingApprovalsCount = approvalsFeed?.approvals.length ?? 0;

  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="关闭协同面板"
        className="fixed inset-0 z-20 bg-black/40 backdrop-blur-xs md:hidden"
        onClick={onClose}
      />

      <aside
        aria-label="协同与运行中心"
        className={cn(
          "flex w-full flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-xl transition-all duration-200 md:w-96 shrink-0 z-30",
          "fixed inset-y-0 right-0 md:relative",
        )}
      >
        {/* ── Top Header ── */}
        <div className="flex h-[44px] items-center justify-between border-b border-[var(--border)] px-2.5 sm:px-3.5 bg-[var(--bg)] shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="返回聊天"
              title="返回聊天"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors md:hidden shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Layers className="h-4 w-4 text-[var(--accent)] shrink-0 hidden md:inline" />
            <span className="text-[12.5px] font-semibold text-[var(--text)] truncate">协同与运行中心</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              title="刷新数据"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="关闭面板"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Tabs navigation (4 Pills) ── */}
        <div className="flex items-center border-b border-[var(--border)] bg-[var(--bg-hover)] p-1 shrink-0">
          <button
            type="button"
            onClick={() => onTabChange("fusion")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors",
              tab === "fusion"
                ? "bg-[var(--bg-selected)] text-[var(--accent)] shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            <GitCompare className="h-3 w-3" />
            <span>副手协同</span>
            {fusionData.tasks.length > 0 ? (
              <span className="rounded bg-[var(--accent)]/15 px-1 font-mono text-[8.5px] text-[var(--accent)] font-semibold">
                {fusionData.tasks.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => onTabChange("evolution")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors",
              tab === "evolution"
                ? "bg-[var(--bg-selected)] text-[var(--accent)] shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            <Sparkles className="h-3 w-3" />
            <span>自进化</span>
            {evolutionData.traces.length > 0 ? (
              <span className="rounded bg-purple-500/15 border border-purple-500/25 px-1 font-mono text-[8.5px] text-purple-700 dark:text-purple-300 font-semibold">
                {evolutionData.traces.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => onTabChange("approvals")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors",
              tab === "approvals"
                ? "bg-[var(--bg-selected)] text-[var(--accent)] shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            <ShieldAlert className="h-3 w-3" />
            <span>安全审批</span>
            {pendingApprovalsCount > 0 ? (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-700 dark:text-amber-300 font-mono text-[8.5px] px-1 font-bold">
                {pendingApprovalsCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => onTabChange("plugins")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors",
              tab === "plugins"
                ? "bg-[var(--bg-selected)] text-[var(--accent)] shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            <Puzzle className="h-3 w-3" />
            <span>网关插件</span>
          </button>
        </div>

        {/* ── Drawer Content Body ── */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
          {/* ── Tab 1: 副手协同任务 ── */}
          {tab === "fusion" ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                <span>副手执行任务 (Sidekick)</span>
                <div className="flex items-center gap-1.5">
                  {fusionData.tasks.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleClearFusion}
                      title="清空所有副手任务记录"
                      className="text-[10px] text-[var(--text-dim)] hover:text-rose-500 px-1.5 py-0.5 rounded transition-colors"
                    >
                      清空
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={fusionData.refresh}
                    disabled={fusionData.loading}
                    title="刷新任务列表"
                    className="text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    <RefreshCw className={cn("h-3 w-3", fusionData.loading && "animate-spin")} />
                  </button>
                </div>
              </div>

              {fusionData.tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[11px] text-[var(--text-muted)] leading-relaxed">
                  当前暂无副手协同任务。在对话中输入复杂代码实现或重构时，主脑会自主调用 delegate_fusion_task 委派副手。
                </div>
              ) : (
                fusionData.tasks.map((task: FusionTaskRecord) => {
                  const spec = task.spec;
                  const result = task.result;
                  const reviews = task.reviews || [];
                  const isApproved = task.status === "approved";
                  const isRejected = task.status === "rejected" || task.status === "failed";

                  return (
                    <div
                      key={task.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold text-[var(--text)] leading-snug">
                            {spec?.instruction || task.id}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[9.5px]">
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 uppercase font-semibold text-[8.5px]",
                                isApproved
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25"
                                  : isRejected
                                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25"
                                    : "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20",
                              )}
                            >
                              {isApproved ? <Check className="h-2.5 w-2.5" /> : null}
                              {task.status}
                            </span>
                            <span className="text-[var(--text-dim)]">·</span>
                            <span className="text-[var(--text-muted)]">{spec?.target_tools?.map((t) => t.name).join(", ") || "tools"}</span>
                            {task.sidekick ? (
                              <>
                                <span className="text-[var(--text-dim)]">·</span>
                                <span className="text-[var(--text-dim)]">{task.sidekick}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {/* Delete single task button */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm("确定删除此项任务记录？")) {
                              await fusionData.remove(task.id);
                            }
                          }}
                          title="删除此任务记录"
                          className="text-[var(--text-dim)] hover:text-rose-500 p-1 shrink-0 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Unified Diff */}
                      {result?.diff ? (
                        <div className="pt-0.5">
                          <button
                            type="button"
                            onClick={() => setExpandedDiff(expandedDiff === task.id ? null : task.id)}
                            className="flex items-center gap-1 text-[10.5px] font-mono text-[var(--accent)] hover:underline"
                          >
                            <ChevronRight
                              className={cn("h-3 w-3 transition-transform", expandedDiff === task.id && "rotate-90")}
                            />
                            <span>{expandedDiff === task.id ? "收起 Unified Diff 补丁" : "展开 Unified Diff 补丁"}</span>
                            {result.filesChanged ? (
                              <span className="text-[9px] text-[var(--text-dim)] font-normal">({result.filesChanged.join(", ")})</span>
                            ) : null}
                          </button>

                          {expandedDiff === task.id ? (
                            <div className="mt-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 font-mono text-[9.5px] leading-relaxed max-h-56 overflow-y-auto">
                              {result.diff.split("\n").map((line: string, idx: number) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    "px-1 py-0.2 rounded-xs",
                                    line.startsWith("+")
                                      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                                      : line.startsWith("-")
                                        ? "text-rose-700 dark:text-rose-300 bg-rose-500/10"
                                        : "text-[var(--text)]",
                                  )}
                                >
                                  {line}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Review Box - HIGH CONTRAST IN BOTH LIGHT & DARK THEMES */}
                      {reviews.length > 0 ? (
                        <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 dark:bg-purple-500/[0.08] p-2.5 text-[11px] leading-relaxed">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-purple-900 dark:text-purple-300 text-[11px]">
                              主脑评审: {reviews[0].decision}
                            </span>
                            {reviews[0].reviewer ? (
                              <span className="font-mono text-[9.5px] text-purple-700/80 dark:text-purple-300/70">
                                {reviews[0].reviewer}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-purple-950/80 dark:text-purple-200/90 text-[10.5px]">
                            {reviews[0].summary}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {/* ── Tab 2: 自进化技能 ── */}
          {tab === "evolution" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                <span>自进化经验池 (Candidates)</span>
                <div className="flex items-center gap-1.5">
                  {evolutionData.traces.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleClearEvolution}
                      title="清空所有自进化轨迹"
                      className="text-[10px] text-[var(--text-dim)] hover:text-rose-500 px-1.5 py-0.5 rounded transition-colors"
                    >
                      清空
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={evolutionData.refresh}
                    disabled={evolutionData.loading}
                    title="刷新候选技能"
                    className="text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    <RefreshCw className={cn("h-3 w-3", evolutionData.loading && "animate-spin")} />
                  </button>
                </div>
              </div>

              {evolutionData.traces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[11px] text-[var(--text-muted)] leading-relaxed">
                  暂无待合入的候选技能。多步工具调用或排错恢复后，闭环反思器会自动提炼出 SOP 草稿。
                </div>
              ) : (
                evolutionData.traces.map((trace: EvolutionTraceRecord) => {
                  const tr = trace.trace;
                  const score = tr.scores
                    ? ((tr.scores.correctness + tr.scores.efficiency + tr.scores.safety + tr.scores.reusability) * 2).toFixed(1)
                    : "7.0";
                  return (
                    <div
                      key={trace.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold text-[var(--text)] truncate">
                            {tr.draftSkillName || trace.id}
                          </div>
                          <div className="text-[9.5px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                            {tr.userIntent?.raw}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="rounded bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 font-mono text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold">
                            {score} / 8.0
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm("确定删除此项自进化记录？")) {
                                await evolutionData.remove(trace.id);
                              }
                            }}
                            title="删除此自进化记录"
                            className="text-[var(--text-dim)] hover:text-rose-500 p-0.5 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {tr.draftSkillMd ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => setExpandedSkill(expandedSkill === trace.id ? null : trace.id)}
                            className="flex items-center gap-1 text-[10.5px] font-mono text-[var(--accent)] hover:underline"
                          >
                            <ChevronRight
                              className={cn("h-3 w-3 transition-transform", expandedSkill === trace.id && "rotate-90")}
                            />
                            <span>{expandedSkill === trace.id ? "收起 SOP 预览" : "展开 SKILL.md SOP 详情"}</span>
                          </button>

                          {expandedSkill === trace.id ? (
                            <pre className="mt-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 font-mono text-[9.5px] text-[var(--text)] max-h-48 overflow-y-auto whitespace-pre-wrap">
                              {tr.draftSkillMd}
                            </pre>
                          ) : null}
                        </div>
                      ) : null}

                      <Button
                        size="xs"
                        variant="primary"
                        className="w-full text-[10.5px] h-6.5"
                        onClick={() => evolutionData.merge(trace.id)}
                      >
                        <Check className="h-3 w-3" />
                        一键批准并合入系统技能库
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {/* ── Tab 3: 安全审批门禁 ── */}
          {tab === "approvals" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                <span>待决高危审批 (Human Guardrails)</span>
                {approvalsFeed ? (
                  <button
                    type="button"
                    onClick={approvalsFeed.refresh}
                    disabled={approvalsFeed.loading}
                    className="text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    <RefreshCw className={cn("h-3 w-3", approvalsFeed.loading && "animate-spin")} />
                  </button>
                ) : null}
              </div>

              {!approvalsFeed || approvalsFeed.approvals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[11px] text-[var(--text-muted)] leading-relaxed">
                  当前暂无待处理的安全审批请求。当 Agent 尝试执行破坏性高危 Shell 或敏感操作时，将在此阻断等待授权。
                </div>
              ) : (
                approvalsFeed.approvals.map((appr) => {
                  const req = appr.request;
                  return (
                    <div
                      key={req.requestId}
                      className="rounded-xl border border-amber-400/25 bg-amber-400/[0.04] p-3 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/25 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase">
                          <ShieldAlert className="h-3 w-3" />
                          {req.riskLevel || "HIGH"} 风险
                        </span>
                        <span className="font-mono text-[9px] text-[var(--text-muted)]">
                          {appr.session.title || appr.session.id}
                        </span>
                      </div>

                      <div className="text-[12px] font-medium text-[var(--text)]">{req.title || req.summary}</div>
                      {req.summary && req.title ? (
                        <div className="text-[10.5px] text-[var(--text-muted)]">{req.summary}</div>
                      ) : null}

                      {req.metadata ? (
                        <pre className="rounded-lg bg-[var(--bg)] border border-[var(--border)] p-2 font-mono text-[9.5px] text-[var(--text-muted)] max-h-32 overflow-auto">
                          {JSON.stringify(req.metadata, null, 2)}
                        </pre>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {req.options.map((opt) => (
                          <Button
                            key={opt.id}
                            size="xs"
                            variant={opt.outcome === "approve" ? "primary" : "subtle"}
                            className={cn(
                              "flex-1 text-[10.5px] h-7",
                              opt.outcome === "approve" && "bg-emerald-500 hover:bg-emerald-600 text-white",
                            )}
                            disabled={appr.responding}
                            onClick={() => approvalsFeed.respond(req.requestId, opt)}
                          >
                            {opt.outcome === "approve" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {/* ── Tab 4: 插件与网关 ── */}
          {tab === "plugins" ? (
            <div className="space-y-3">
              <div>
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                  <span>网关适配器 (Gateways)</span>
                  <span className="font-mono text-[9px] text-[var(--text-muted)]">进程隔离</span>
                </div>
                <div className="space-y-1.5">
                  {gateways.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-center text-[11px] text-[var(--text-muted)]">
                      暂无已注册网关
                    </div>
                  ) : (
                    gateways.map((gw) => (
                      <div
                        key={gw.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-2.5 shadow-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <Radio
                              className={cn(
                                "h-3 w-3",
                                gw.status === "running" ? "text-emerald-500" : "text-[var(--text-muted)]",
                              )}
                            />
                            <span className="text-[11.5px] font-medium text-[var(--text)] truncate">{gw.name}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] text-[var(--text-muted)]">
                            <span>{gw.platform.toUpperCase()}</span>
                            <span>·</span>
                            <span className={gw.status === "running" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-[var(--text-muted)]"}>
                              {gw.status}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="xs"
                          variant={gw.status === "running" ? "subtle" : "primary"}
                          onClick={() => handleToggleGateway(gw)}
                          disabled={actionPending === gw.id}
                          className="shrink-0 h-6 text-[10px]"
                        >
                          {gw.status === "running" ? "停止" : "启动"}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                  <span>已挂载插件 (Plugins)</span>
                  <span className="font-mono text-[9px] text-[var(--accent)]">Pi / DSH 生态</span>
                </div>
                <div className="space-y-1.5">
                  {plugins.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-center text-[11px] text-[var(--text-muted)]">
                      plugins/ 目录下未检测到外部插件
                    </div>
                  ) : (
                    plugins.map((pl) => (
                      <div
                        key={pl.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-2.5 space-y-1 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Code2 className="h-3 w-3 text-[var(--accent)]" />
                            <span className="text-[11.5px] font-medium text-[var(--text)]">{pl.name}</span>
                          </div>
                          <span className="rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-1.5 py-0.2 font-mono text-[8px] text-[var(--accent)] uppercase font-semibold">
                            {pl.type}
                          </span>
                        </div>
                        {pl.description ? (
                          <div className="text-[10px] text-[var(--text-muted)] leading-relaxed">{pl.description}</div>
                        ) : null}
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {pl.tools.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 rounded bg-[var(--bg-hover)] border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text)]"
                            >
                              <Wrench className="h-2 w-2 text-[var(--text-muted)]" />
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Bottom Quick Navigation To Settings ── */}
        {onOpenSettingsTab ? (
          <div className="shrink-0 border-t border-[var(--border)] p-2.5 pb-[max(12px,env(safe-area-inset-bottom))] bg-[var(--bg)]">
            <div className="mb-1.5 px-0.5 flex items-center justify-between text-[9.5px] text-[var(--text-dim)] font-mono">
              <span>控制台快捷入口</span>
              <span className="text-[8.5px]">Settings Hub</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettingsTab("channels");
                }}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] py-2 sm:py-1.5 text-[10.5px] font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shadow-2xs"
              >
                <Cpu className="h-3 w-3 shrink-0" />
                <span className="text-[10px] sm:text-[10.5px]">渠道设置</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettingsTab("skills");
                }}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] py-2 sm:py-1.5 text-[10.5px] font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shadow-2xs"
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="text-[10px] sm:text-[10.5px]">技能库</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettingsTab("mcp");
                }}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] py-2 sm:py-1.5 text-[10.5px] font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shadow-2xs"
              >
                <Wrench className="h-3 w-3 shrink-0" />
                <span className="text-[10px] sm:text-[10.5px]">MCP 服务</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettingsTab("plugins");
                }}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] py-2 sm:py-1.5 text-[10.5px] font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shadow-2xs"
              >
                <Puzzle className="h-3 w-3 shrink-0" />
                <span className="text-[10px] sm:text-[10.5px]">插件管理</span>
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
