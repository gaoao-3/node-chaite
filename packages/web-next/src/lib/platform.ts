import type { AgentSessionStatus, GatewayPlatform, ToolStatusState } from "./types";

export interface PlatformMeta {
  key: GatewayPlatform;
  label: string;
  short: string;
  groupLabel: string;
  description: string;
  accent: string;
  tint: string;
  glow: string;
}

export const PLATFORM_META: Record<GatewayPlatform, PlatformMeta> = {
  qq: {
    key: "qq",
    label: "QQ",
    short: "QQ",
    groupLabel: "QQ 群聊",
    description: "OneBot / 群聊网关",
    accent: "#f0abfc",
    tint: "rgba(240, 171, 252, 0.12)",
    glow: "rgba(240, 171, 252, 0.35)",
  },
  dsh: {
    key: "dsh",
    label: "DSH",
    short: "DSH",
    groupLabel: "DSH 移动端",
    description: "DeepSeek Harness 移动端",
    accent: "#67e8f9",
    tint: "rgba(103, 232, 249, 0.12)",
    glow: "rgba(103, 232, 249, 0.32)",
  },
  web: {
    key: "web",
    label: "Web",
    short: "WEB",
    groupLabel: "Web 控制台",
    description: "浏览器直连工作台",
    accent: "#a78bfa",
    tint: "rgba(167, 139, 250, 0.12)",
    glow: "rgba(167, 139, 250, 0.35)",
  },
};

export const PLATFORM_ORDER: GatewayPlatform[] = ["qq", "dsh", "web"];

export interface SessionStatusMeta {
  label: string;
  dot: string;
  text: string;
  chip: string;
  pulse: boolean;
}

export const SESSION_STATUS_META: Record<AgentSessionStatus, SessionStatusMeta> = {
  idle: {
    label: "Idle",
    dot: "bg-zinc-500",
    text: "text-zinc-400",
    chip: "border-white/[0.07] bg-white/[0.03] text-zinc-400",
    pulse: false,
  },
  thinking: {
    label: "Thinking",
    dot: "bg-violet-400",
    text: "text-violet-300",
    chip: "border-violet-400/20 bg-violet-400/10 text-violet-200",
    pulse: true,
  },
  streaming: {
    label: "Running",
    dot: "bg-cyan-300",
    text: "text-cyan-200",
    chip: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    pulse: true,
  },
  waiting_approval: {
    label: "Waiting",
    dot: "bg-amber-300",
    text: "text-amber-200",
    chip: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    pulse: true,
  },
  error: {
    label: "Error",
    dot: "bg-rose-400",
    text: "text-rose-300",
    chip: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    pulse: false,
  },
  closed: {
    label: "Closed",
    dot: "bg-zinc-600",
    text: "text-zinc-500",
    chip: "border-white/[0.05] bg-white/[0.02] text-zinc-500",
    pulse: false,
  },
};

export const TOOL_STATUS_META: Record<
  ToolStatusState,
  { label: string; dot: string; text: string; chip: string; active: boolean }
> = {
  requested: {
    label: "请求中",
    dot: "bg-violet-500 dark:bg-violet-400",
    text: "text-violet-700 dark:text-violet-300",
    chip: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium",
    active: true,
  },
  running: {
    label: "执行中",
    dot: "bg-cyan-500 dark:bg-cyan-300",
    text: "text-cyan-700 dark:text-cyan-300",
    chip: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-medium",
    active: true,
  },
  succeeded: {
    label: "已完成",
    dot: "bg-emerald-600 dark:bg-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
    chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium",
    active: false,
  },
  failed: {
    label: "失败",
    dot: "bg-rose-600 dark:bg-rose-400",
    text: "text-rose-700 dark:text-rose-300",
    chip: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium",
    active: false,
  },
  denied: {
    label: "已拒绝",
    dot: "bg-amber-600 dark:bg-amber-400",
    text: "text-amber-800 dark:text-amber-300",
    chip: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-medium",
    active: false,
  },
  skipped: {
    label: "已跳过",
    dot: "bg-zinc-500",
    text: "text-zinc-600 dark:text-zinc-400",
    chip: "border-[var(--border)] bg-[var(--bg-hover)] text-zinc-600 dark:text-zinc-400 font-medium",
    active: false,
  },
};

export const RISK_META = {
  low: { label: "低风险", chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" },
  medium: { label: "中风险", chip: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300", bar: "bg-amber-500" },
  high: { label: "高风险", chip: "border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-300", bar: "bg-orange-500" },
  critical: { label: "极高风险", chip: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300", bar: "bg-rose-500" },
} as const;

export const FUSION_STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  queued: { label: "排队中", chip: "border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-muted)]", dot: "bg-zinc-400" },
  dispatched: { label: "已派发", chip: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-400" },
  running: { label: "协同中", chip: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-400" },
  review: { label: "待评审", chip: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300", dot: "bg-amber-400" },
  changes_requested: { label: "需修改", chip: "border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-300", dot: "bg-orange-400" },
  approved: { label: "已通过", chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  rejected: { label: "已驳回", chip: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  failed: { label: "失败", chip: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  cancelled: { label: "已取消", chip: "border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-dim)]", dot: "bg-zinc-500" },
};

export const EVOLUTION_STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  candidate: { label: "候选", chip: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-400" },
  approved: { label: "已批准", chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  rejected: { label: "已驳回", chip: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  merged: { label: "已熔铸", chip: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
};
