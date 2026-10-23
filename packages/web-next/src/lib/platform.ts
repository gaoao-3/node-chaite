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
    dot: "bg-violet-400",
    text: "text-violet-300",
    chip: "border-violet-400/20 bg-violet-400/10 text-violet-200",
    active: true,
  },
  running: {
    label: "执行中",
    dot: "bg-cyan-300",
    text: "text-cyan-200",
    chip: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    active: true,
  },
  succeeded: {
    label: "已完成",
    dot: "bg-emerald-300",
    text: "text-emerald-200",
    chip: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    active: false,
  },
  failed: {
    label: "失败",
    dot: "bg-rose-400",
    text: "text-rose-300",
    chip: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    active: false,
  },
  denied: {
    label: "已拒绝",
    dot: "bg-amber-300",
    text: "text-amber-200",
    chip: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    active: false,
  },
  skipped: {
    label: "已跳过",
    dot: "bg-zinc-500",
    text: "text-zinc-400",
    chip: "border-white/[0.07] bg-white/[0.03] text-zinc-400",
    active: false,
  },
};

export const RISK_META = {
  low: { label: "低风险", chip: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200", bar: "bg-emerald-300" },
  medium: { label: "中风险", chip: "border-amber-300/20 bg-amber-300/10 text-amber-200", bar: "bg-amber-300" },
  high: { label: "高风险", chip: "border-orange-400/25 bg-orange-400/10 text-orange-200", bar: "bg-orange-400" },
  critical: { label: "极高风险", chip: "border-rose-400/25 bg-rose-400/10 text-rose-200", bar: "bg-rose-400" },
} as const;

export const FUSION_STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  queued: { label: "排队中", chip: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300", dot: "bg-zinc-400" },
  dispatched: { label: "已派发", chip: "border-violet-400/20 bg-violet-400/10 text-violet-200", dot: "bg-violet-400" },
  running: { label: "协同中", chip: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100", dot: "bg-cyan-300" },
  review: { label: "待评审", chip: "border-amber-300/20 bg-amber-300/10 text-amber-100", dot: "bg-amber-300" },
  changes_requested: { label: "需修改", chip: "border-orange-400/20 bg-orange-400/10 text-orange-200", dot: "bg-orange-400" },
  approved: { label: "已通过", chip: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100", dot: "bg-emerald-300" },
  rejected: { label: "已驳回", chip: "border-rose-400/20 bg-rose-400/10 text-rose-200", dot: "bg-rose-400" },
  failed: { label: "失败", chip: "border-rose-400/20 bg-rose-400/10 text-rose-200", dot: "bg-rose-400" },
  cancelled: { label: "已取消", chip: "border-white/[0.07] bg-white/[0.03] text-zinc-400", dot: "bg-zinc-500" },
};

export const EVOLUTION_STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  candidate: { label: "候选", chip: "border-violet-400/20 bg-violet-400/10 text-violet-200", dot: "bg-violet-400" },
  approved: { label: "已批准", chip: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100", dot: "bg-emerald-300" },
  rejected: { label: "已驳回", chip: "border-rose-400/20 bg-rose-400/10 text-rose-200", dot: "bg-rose-400" },
  merged: { label: "已熔铸", chip: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100", dot: "bg-cyan-300" },
};
