"use client";

import * as React from "react";
import {
  Ban,
  Check,
  Clock3,
  Fingerprint,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { RISK_META } from "@/lib/platform";
import type { ApprovalState } from "@/lib/timeline";
import type { HumanApprovalAction, HumanApprovalOption } from "@/lib/types";
import { cn, formatClock, safeJson } from "@/lib/utils";

function actionLabel(action: HumanApprovalAction): string {
  switch (action.kind) {
    case "tool_call":
      return `工具调用 · ${action.toolName}`;
    case "shell_command":
      return "Shell 命令";
    case "file_write":
      return `文件写入 · ${action.operation}`;
    case "network_request":
      return `网络请求 · ${action.method}`;
    case "external_side_effect":
      return `外部副作用 · ${action.target}`;
    default:
      return `自定义操作 · ${action.name}`;
  }
}

function actionPayload(action: HumanApprovalAction): string {
  switch (action.kind) {
    case "tool_call":
      return safeJson({ toolName: action.toolName, arguments: action.arguments, source: action.source });
    case "shell_command":
      return [action.command, ...(action.args ?? [])].join(" ");
    case "file_write":
      return safeJson({ path: action.path, operation: action.operation, diff: action.diff, sizeBytes: action.sizeBytes });
    case "network_request":
      return `${action.method} ${action.url}\n\n${safeJson({ headers: action.headers, body: action.bodyPreview })}`;
    case "external_side_effect":
      return `${action.target}\n\n${action.description}`;
    default:
      return safeJson({ name: action.name, payload: action.payload });
  }
}

function formatRemaining(expiresAt: number, now: number): string {
  const remaining = Math.max(0, expiresAt - now);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function resolvedMeta(status: ApprovalState["status"]) {
  switch (status) {
    case "approved":
      return { label: "已批准", icon: ShieldCheck, className: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200" };
    case "denied":
      return { label: "已驳回", icon: Ban, className: "border-rose-400/20 bg-rose-400/[0.07] text-rose-200" };
    case "expired":
      return { label: "已过期", icon: Clock3, className: "border-white/[0.08] bg-white/[0.03] text-mist-400" };
    case "cancelled":
      return { label: "已取消", icon: Ban, className: "border-white/[0.08] bg-white/[0.03] text-mist-400" };
    default:
      return null;
  }
}

export function ApprovalCard({
  approval,
  onRespond,
}: {
  approval: ApprovalState;
  onRespond: (requestId: string, option: HumanApprovalOption) => Promise<boolean>;
}) {
  const { request, status, responding, error, preview } = approval;
  const risk = RISK_META[request.riskLevel] ?? RISK_META.medium;
  const [now, setNow] = React.useState(() => Date.now());
  const pending = status === "pending";
  const expired = pending && request.expiresAt > 0 && request.expiresAt <= now;
  const resolved = resolvedMeta(status);
  const selectable = (request.options ?? []).filter((option) => option.outcome !== "edit");
  const options: HumanApprovalOption[] =
    selectable.length > 0
      ? selectable
      : [
          { id: "approve_once", label: "批准", outcome: "approve", scope: "once" },
          { id: "deny", label: "驳回", outcome: "deny", destructive: true },
        ];

  React.useEffect(() => {
    if (!pending) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [pending]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[16px] border bg-[#0c0b0f]/90",
        request.riskLevel === "critical" || request.riskLevel === "high"
          ? "border-amber-300/22 shadow-[0_18px_60px_-30px_rgba(251,191,36,0.45)]"
          : "border-violet-300/18 shadow-[0_18px_60px_-34px_rgba(139,92,246,0.5)]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-300/[0.055] blur-3xl" />

      <div className="flex items-start gap-3 px-4 pt-4">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            request.riskLevel === "critical"
              ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
              : "border-amber-300/22 bg-amber-300/[0.08] text-amber-200",
          )}
        >
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-200/90">
              Approval required
            </span>
            <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-medium", risk.chip)}>
              {risk.label}
            </span>
            {preview ? (
              <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-200">
                预览数据
              </span>
            ) : null}
            {pending && !expired ? (
              <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9.5px] text-mist-500">
                <Clock3 className="h-2.5 w-2.5" />
                {formatRemaining(request.expiresAt, now)}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-[13.5px] font-semibold leading-5 tracking-[-0.015em] text-mist-100">
            {request.title}
          </h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-mist-500">{request.summary}</p>
        </div>
      </div>

      <div className="mx-4 mt-3 overflow-hidden rounded-xl border border-white/[0.065] bg-black/30">
        <div className="flex items-center gap-2 border-b border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5">
          <Terminal className="h-3 w-3 text-mist-600" />
          <span className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-mist-500">
            {actionLabel(request.action)}
          </span>
          <span className="ml-auto">
            <CopyButton value={actionPayload(request.action)} label="复制操作" />
          </span>
        </div>
        <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words p-2.5 font-mono text-[10.5px] leading-[1.65] text-amber-100/75">
          {actionPayload(request.action)}
        </pre>
      </div>

      {request.context?.reason || request.context?.evidence?.length ? (
        <div className="mx-4 mt-2.5 rounded-xl border border-white/[0.055] bg-white/[0.018] px-2.5 py-2">
          {request.context.reason ? (
            <p className="text-[10.5px] leading-relaxed text-mist-400">
              <span className="text-mist-500">原因：</span>
              {request.context.reason}
            </p>
          ) : null}
          {request.context.evidence?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {request.context.evidence.map((evidence) => (
                <span
                  key={evidence}
                  className="rounded border border-white/[0.06] bg-black/25 px-1.5 py-0.5 font-mono text-[9px] text-mist-500"
                >
                  {evidence}
                </span>
              ))}
            </div>
          ) : null}
          {request.context.affectedResources?.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[9.5px] text-mist-600">
              <span>影响范围：</span>
              {request.context.affectedResources.map((resource) => (
                <code key={resource} className="rounded bg-white/[0.04] px-1 py-px text-[9px] text-mist-400">
                  {resource}
                </code>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-2.5 text-[9px] text-mist-600">
        <span className="inline-flex items-center gap-1">
          <Fingerprint className="h-2.5 w-2.5" />
          {request.requestedBy.displayName ?? request.requestedBy.id}
        </span>
        <span className="font-mono">{request.integrity.digest.slice(0, 16)}…</span>
        <span>{formatClock(request.createdAt)}</span>
        {request.taskId ? <span className="font-mono">task:{request.taskId.slice(0, 8)}</span> : null}
      </div>

      {error ? (
        <div className="mx-4 mt-2 flex items-start gap-1.5 rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-2.5 py-1.5 text-[10.5px] text-rose-200">
          <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.055] bg-black/15 px-4 py-3">
        {resolved ? (
          <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium", resolved.className)}>
            <resolved.icon className="h-3 w-3" />
            {resolved.label}
          </div>
        ) : expired ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10.5px] text-mist-400">
            <Clock3 className="h-3 w-3" />
            审批已过期
          </div>
        ) : (
          options.map((option) => {
            const approve = option.outcome === "approve";
            const deny = option.outcome === "deny";
            return (
              <Button
                key={option.id}
                size="sm"
                variant={approve ? "primary" : deny ? "danger" : "subtle"}
                loading={responding}
                disabled={responding || !pending}
                onClick={() => void onRespond(request.requestId, option)}
                className={cn(approve && "min-w-[92px]")}
              >
                {approve ? <Check className="h-3.5 w-3.5" /> : deny ? <Ban className="h-3.5 w-3.5" /> : null}
                {option.label}
              </Button>
            );
          })
        )}
        {pending && !expired ? (
          <span className="ml-auto text-[9.5px] text-mist-700">
            {preview ? "演示视图不会提交到后端" : "决定将同步到 SSE 事件流"}
          </span>
        ) : null}
      </div>
    </div>
  );
}
