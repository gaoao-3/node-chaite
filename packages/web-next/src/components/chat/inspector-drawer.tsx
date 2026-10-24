"use client";

import * as React from "react";
import {
  Check,
  ChevronRight,
  Code2,
  GitCompare,
  Layers,
  Puzzle,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
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

export type InspectorTab = "plugins" | "fusion" | "evolution" | "approvals";

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
  skillCount: _skillCount,
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

  if (!open) return null;

  const pendingApprovalsCount = approvalsFeed?.approvals.length ?? 0;

  return (
    <aside
      className={cn(
        "flex w-full flex-col border-l border-white/[0.06] bg-[var(--bg-panel)] shadow-xl transition-all duration-200 md:w-96 shrink-0 z-30",
        "fixed inset-y-0 right-0 md:relative",
      )}
    >
      {/* ── Top Header ── */}
      <div className="flex h-[52px] items-center justify-between border-b border-white/[0.05] px-3.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <span className="text-[12.5px] font-semibold text-mist-100">协同与资产中心</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="刷新数据"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-500 hover:text-mist-200 hover:bg-white/[0.04] transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="关闭面板"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-500 hover:text-mist-200 hover:bg-white/[0.04] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Tabs navigation (4 Pills) ── */}
      <div className="flex items-center border-b border-white/[0.05] bg-black/15 p-1">
        <button
          type="button"
          onClick={() => onTabChange("plugins")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-medium transition-colors",
            tab === "plugins"
              ? "bg-white/[0.08] text-mist-100 shadow-xs"
              : "text-mist-500 hover:text-mist-300",
          )}
        >
          <Puzzle className="h-3 w-3" />
          <span>插件</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("fusion")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-medium transition-colors",
            tab === "fusion"
              ? "bg-white/[0.08] text-mist-100 shadow-xs"
              : "text-mist-500 hover:text-mist-300",
          )}
        >
          <GitCompare className="h-3 w-3" />
          <span>副手</span>
          {fusionData.tasks.length > 0 ? (
            <span className="rounded bg-accent/20 px-1 font-mono text-[8.5px] text-accent">
              {fusionData.tasks.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => onTabChange("evolution")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-medium transition-colors",
            tab === "evolution"
              ? "bg-white/[0.08] text-mist-100 shadow-xs"
              : "text-mist-500 hover:text-mist-300",
          )}
        >
          <Sparkles className="h-3 w-3" />
          <span>进化</span>
          {evolutionData.traces.length > 0 ? (
            <span className="rounded bg-purple-500/20 px-1 font-mono text-[8.5px] text-purple-300">
              {evolutionData.traces.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => onTabChange("approvals")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-medium transition-colors",
            tab === "approvals"
              ? "bg-white/[0.08] text-mist-100 shadow-xs"
              : "text-mist-500 hover:text-mist-300",
          )}
        >
          <ShieldAlert className="h-3 w-3" />
          <span>审批</span>
          {pendingApprovalsCount > 0 ? (
            <span className="rounded-full bg-amber-400/20 text-amber-300 font-mono text-[8.5px] px-1 font-bold">
              {pendingApprovalsCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* ── Drawer Content Body ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* ── Tab 1: 插件与网关 ── */}
        {tab === "plugins" ? (
          <div className="space-y-3">
            {/* 1. 外部适配器网关 */}
            <div>
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-mist-400">
                <span>网关适配器 (Gateways)</span>
                <span className="font-mono text-[9px] text-mist-600">热插拔隔离</span>
              </div>
              <div className="space-y-1.5">
                {gateways.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.05] bg-black/15 p-3 text-center text-[11px] text-mist-600">
                    暂无已注册网关
                  </div>
                ) : (
                  gateways.map((gw) => (
                    <div
                      key={gw.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-2.5"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <Radio
                            className={cn(
                              "h-3 w-3",
                              gw.status === "running" ? "text-emerald-400" : "text-mist-600",
                            )}
                          />
                          <span className="text-[11.5px] font-medium text-mist-100 truncate">{gw.name}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] text-mist-500">
                          <span>{gw.platform.toUpperCase()}</span>
                          <span>·</span>
                          <span className={gw.status === "running" ? "text-emerald-400" : "text-mist-600"}>
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

            {/* 2. Pi & DSH 插件 */}
            <div>
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-mist-400">
                <span>已挂载插件 (Plugins)</span>
                <span className="font-mono text-[9px] text-accent">Pi/DSH 生态兼容</span>
              </div>
              <div className="space-y-1.5">
                {plugins.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.05] bg-black/15 p-3 text-center text-[11px] text-mist-600">
                    plugins/ 目录下未检测到插件
                  </div>
                ) : (
                  plugins.map((pl) => (
                    <div
                      key={pl.id}
                      className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Code2 className="h-3 w-3 text-accent" />
                          <span className="text-[11.5px] font-medium text-mist-100">{pl.name}</span>
                        </div>
                        <span className="rounded border border-accent/20 bg-accent/10 px-1 py-0.5 font-mono text-[8px] text-accent uppercase">
                          {pl.type}
                        </span>
                      </div>
                      {pl.description ? (
                        <div className="text-[10px] text-mist-500 leading-relaxed">{pl.description}</div>
                      ) : null}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {pl.tools.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded bg-black/30 border border-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-mist-300"
                          >
                            <Wrench className="h-2 w-2 text-mist-500" />
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

        {/* ── Tab 2: Fusion 副手任务 ── */}
        {tab === "fusion" ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-mist-400">
              <span>副手执行任务 (Sidekick)</span>
              <button
                type="button"
                onClick={fusionData.refresh}
                disabled={fusionData.loading}
                className="text-mist-500 hover:text-mist-200"
              >
                <RefreshCw className={cn("h-3 w-3", fusionData.loading && "animate-spin")} />
              </button>
            </div>

            {fusionData.tasks.length === 0 ? (
              <div className="rounded-xl border border-white/[0.05] bg-black/15 p-4 text-center text-[11px] text-mist-600">
                当前暂无副手协同任务。在对话中输入复杂代码实现或重构时，主脑会自主调用 delegate_fusion_task 下发。
              </div>
            ) : (
              fusionData.tasks.map((task: FusionTaskRecord) => {
                const spec = task.spec;
                const result = task.result;
                const reviews = task.reviews || [];
                return (
                  <div
                    key={task.id}
                    className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 space-y-2"
                  >
                    <div>
                      <div className="text-[11.5px] font-medium text-mist-100 leading-snug line-clamp-2">
                        {spec?.instruction || task.id}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-mist-500">
                        <span className="text-accent">{task.status}</span>
                        <span>·</span>
                        <span>{spec?.target_tools?.map((t) => t.name).join(", ") || "tools"}</span>
                      </div>
                    </div>

                    {/* Diff Inspector Toggle */}
                    {result?.diff ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedDiff(expandedDiff === task.id ? null : task.id)}
                          className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 hover:underline"
                        >
                          <ChevronRight
                            className={cn("h-3 w-3 transition-transform", expandedDiff === task.id && "rotate-90")}
                          />
                          {expandedDiff === task.id ? "收起 Unified Diff 补丁" : "展开 Unified Diff 补丁"}
                        </button>

                        {expandedDiff === task.id ? (
                          <div className="mt-1.5 rounded-lg border border-white/[0.06] bg-black/40 p-2 font-mono text-[9.5px] leading-relaxed max-h-52 overflow-y-auto">
                            {result.diff.split("\n").map((line: string, idx: number) => (
                              <div
                                key={idx}
                                className={cn(
                                  line.startsWith("+")
                                    ? "text-emerald-300 bg-emerald-500/10"
                                    : line.startsWith("-")
                                      ? "text-rose-300 bg-rose-500/10"
                                      : "text-mist-400",
                                )}
                              >
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Main agent review comments */}
                    {reviews.length > 0 ? (
                      <div className="rounded-lg border border-purple-500/20 bg-purple-500/[0.06] p-2 text-[10px] text-purple-200 leading-relaxed">
                        <div className="font-semibold text-purple-300">
                          主脑评审: {reviews[0].decision}
                        </div>
                        <div className="mt-0.5 text-mist-400">{reviews[0].summary}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {/* ── Tab 3: 自进化技能 ── */}
        {tab === "evolution" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-mist-400">
              <span>自进化经验池 (Candidates)</span>
              <button
                type="button"
                onClick={evolutionData.refresh}
                disabled={evolutionData.loading}
                className="text-mist-500 hover:text-mist-200"
              >
                <RefreshCw className={cn("h-3 w-3", evolutionData.loading && "animate-spin")} />
              </button>
            </div>

            {evolutionData.traces.length === 0 ? (
              <div className="rounded-xl border border-white/[0.05] bg-black/15 p-4 text-center text-[11px] text-mist-600">
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
                    className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-semibold text-mist-100 truncate">
                          {tr.draftSkillName || trace.id}
                        </div>
                        <div className="text-[9.5px] text-mist-500 mt-0.5 line-clamp-1">
                          {tr.userIntent?.raw}
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-emerald-500/15 border border-emerald-400/20 px-1 py-0.5 font-mono text-[9px] text-emerald-300">
                        {score} / 8.0
                      </span>
                    </div>

                    {/* SOP preview */}
                    {tr.draftSkillMd ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedSkill(expandedSkill === trace.id ? null : trace.id)}
                          className="flex items-center gap-1 text-[10px] font-mono text-purple-300 hover:underline"
                        >
                          <ChevronRight
                            className={cn("h-3 w-3 transition-transform", expandedSkill === trace.id && "rotate-90")}
                          />
                          {expandedSkill === trace.id ? "收起 SOP 预览" : "展开 SKILL.md SOP 详情"}
                        </button>

                        {expandedSkill === trace.id ? (
                          <pre className="mt-1.5 rounded-lg border border-white/[0.06] bg-black/40 p-2 font-mono text-[9.5px] text-mist-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {tr.draftSkillMd}
                          </pre>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Merge button */}
                    <Button
                      size="xs"
                      variant="primary"
                      className="w-full text-[10px] h-6"
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

        {/* ── Tab 4: 安全审批门禁 ── */}
        {tab === "approvals" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-mist-400">
              <span>待决高危审批 (Human Guardrails)</span>
              {approvalsFeed ? (
                <button
                  type="button"
                  onClick={approvalsFeed.refresh}
                  disabled={approvalsFeed.loading}
                  className="text-mist-500 hover:text-mist-200"
                >
                  <RefreshCw className={cn("h-3 w-3", approvalsFeed.loading && "animate-spin")} />
                </button>
              ) : null}
            </div>

            {!approvalsFeed || approvalsFeed.approvals.length === 0 ? (
              <div className="rounded-xl border border-white/[0.05] bg-black/15 p-4 text-center text-[11px] text-mist-600">
                当前暂无待处理的安全审批请求。当 Agent 尝试执行破坏性高危 Shell 或敏感操作时，将在此阻断等待授权。
              </div>
            ) : (
              approvalsFeed.approvals.map((appr) => {
                const req = appr.request;
                return (
                  <div
                    key={req.requestId}
                    className="rounded-xl border border-amber-400/25 bg-amber-400/[0.04] p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 text-amber-300 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase">
                        <ShieldAlert className="h-3 w-3" />
                        {req.riskLevel || "HIGH"} 风险
                      </span>
                      <span className="font-mono text-[9px] text-mist-500">
                        {appr.session.title || appr.session.id}
                      </span>
                    </div>

                    <div className="text-[12px] font-medium text-mist-100">{req.title || req.summary}</div>
                    {req.summary && req.title ? (
                      <div className="text-[10.5px] text-mist-400">{req.summary}</div>
                    ) : null}

                    {req.metadata ? (
                      <pre className="rounded-lg bg-black/40 border border-white/[0.06] p-2 font-mono text-[9.5px] text-mist-400 max-h-32 overflow-auto">
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
      </div>
    </aside>
  );
}
