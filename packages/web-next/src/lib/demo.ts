import type { AgentSessionInfo, HumanApprovalRequest } from "./types";
import { createInitialStreamView, type ApprovalState, type StreamView, type TimelineItem } from "./timeline";

const MINUTE = 60_000;

function at(offsetMs: number): number {
  return Date.now() - offsetMs;
}

export const DEMO_SESSION: AgentSessionInfo = {
  id: "demo:web:design-preview",
  platform: "web",
  botId: "web-console",
  title: "Agent 控制台 · 设计预览",
  status: "waiting_approval",
  createdAt: at(42 * MINUTE),
  lastActiveAt: at(8 * MINUTE),
  turnCount: 3,
  skills: ["fusion-sidekick", "web-research"],
  model: "deepseek-v4.1-flash",
  pendingApprovalIds: ["demo-approval-clean"],
  lastSeq: 0,
  eventCount: 0,
  metadata: { preview: true },
};

const DEMO_APPROVAL: HumanApprovalRequest = {
  platform: "web",
  botId: "web-console",
  sessionId: DEMO_SESSION.id,
  requestId: "demo-approval-clean",
  title: "清理 node-chaite 的过期构建缓存",
  summary: "Agent 准备递归删除 packages/web-next/.next/cache 下 184 MB 的过期产物，操作不可撤销。",
  riskLevel: "high",
  action: {
    kind: "shell_command",
    command: "rm",
    args: ["-rf", "packages/web-next/.next/cache"],
    cwd: "/home/hina/数据盘/projects/node-chaite",
  },
  options: [
    { id: "approve_once", label: "仅批准本次", outcome: "approve", scope: "once" },
    { id: "approve_session", label: "本会话内允许", outcome: "approve", scope: "session" },
    { id: "deny", label: "驳回", outcome: "deny", destructive: true },
  ],
  createdAt: at(8 * MINUTE),
  expiresAt: Date.now() + 22 * MINUTE,
  requestedBy: { id: "chaite-agent", kind: "agent", displayName: "Chaite Agent" },
  integrity: { algorithm: "sha256", digest: "9f2c7a1e0b3d4c5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f" },
  context: {
    reason: "检测到缓存目录已超过 30 天未命中，且包含旧版 Turbopack chunk。",
    evidence: ["du -sh .next/cache → 184M", "last hit: 32 days ago"],
    affectedResources: ["packages/web-next/.next/cache"],
  },
};

const TOOL_ARGS = JSON.stringify(
  {
    sessionId: "web:design-preview",
    query: "recent tool failures",
    limit: 5,
  },
  null,
  2,
);

const TOOL_RESULT = JSON.stringify(
  {
    ok: true,
    matched: 3,
    items: [
      { tool: "open_websearch", failures: 0, avgMs: 812 },
      { tool: "query_action", failures: 1, avgMs: 146 },
      { tool: "exec_bash", failures: 0, avgMs: 233 },
    ],
  },
  null,
  2,
);

const DEMO_REPLY = `## 会话体检完成

我检查了当前会话的事件流、工具调用与审批链路，整体状态健康。

| 维度 | 观测值 | 状态 |
| --- | --- | --- |
| SSE 延迟 | 42 ms | 🟢 稳定 |
| 工具成功率 | 96.4% | 🟢 正常 |
| 待审批 | 1 项 | 🟡 需处理 |
| 上下文占用 | 31.2k / 128k | 🟢 充裕 |

关键发现：\`query_action\` 有一次瞬时超时，但重试后恢复。建议保留当前的 150 ms 工具状态合并窗口，它让高频工具更新不会淹没消息流。

\`\`\`bash
# 重新验证事件总线
pnpm --filter web-next build
curl -N -H "Authorization: Bearer $TOKEN" \\
  http://127.0.0.1:3200/api/agent/sessions/$SESSION/events
\`\`\`

如果你希望，我可以继续生成一份 **周报摘要**，或把这次诊断沉淀成可复用的 \`session-doctor\` 技能。`;

const DEMO_TIMELINE: TimelineItem[] = [
  {
    kind: "user",
    id: "demo-user-1",
    text: "帮我体检一下当前的 Agent 会话，重点看 SSE、工具调用和审批链路。",
    createdAt: at(20 * MINUTE),
    turnId: "demo-turn-1",
  },
  {
    kind: "thought",
    id: "demo-thought-1",
    text:
      "用户希望做端到端体检。先读取会话快照与最近事件，再聚合工具状态；审批链路需要单独检查 pendingApprovals。注意不要暴露 token 或内部路径中的敏感片段。",
    createdAt: at(19 * MINUTE),
    turnId: "demo-turn-1",
    done: true,
  },
  {
    kind: "tool",
    id: "tool:demo-query-action",
    createdAt: at(18 * MINUTE),
    turnId: "demo-turn-1",
    call: {
      id: "demo-query-action",
      name: "query_action",
      status: "succeeded",
      argsPreview: TOOL_ARGS,
      resultPreview: TOOL_RESULT,
      attempt: 1,
      startedAt: at(18 * MINUTE),
      completedAt: at(18 * MINUTE) + 146,
    },
  },
  {
    kind: "tool",
    id: "tool:demo-websearch",
    createdAt: at(17 * MINUTE),
    turnId: "demo-turn-1",
    call: {
      id: "demo-websearch",
      name: "open_websearch",
      status: "succeeded",
      argsPreview: JSON.stringify({ query: "SSE Last-Event-ID reconnect best practice", maxResults: 4 }, null, 2),
      resultPreview: JSON.stringify(
        { ok: true, results: 4, top: "MDN · Using server-sent events", cached: true },
        null,
        2,
      ),
      attempt: 1,
      startedAt: at(17 * MINUTE),
      completedAt: at(17 * MINUTE) + 812,
    },
  },
  {
    kind: "assistant",
    id: "demo-assistant-1",
    text: DEMO_REPLY,
    createdAt: at(16 * MINUTE),
    turnId: "demo-turn-1",
    done: true,
    usage: { promptTokens: 18_420, completionTokens: 612, totalTokens: 19_032, cachedTokens: 12_800 },
  },
  {
    kind: "user",
    id: "demo-user-2",
    text: "顺便把 data/ 下过期构建缓存清掉，能省点磁盘。",
    createdAt: at(10 * MINUTE),
    turnId: "demo-turn-2",
  },
  {
    kind: "thought",
    id: "demo-thought-2",
    text:
      "这是不可逆的递归删除。目标路径已在工作区内，但仍需展示完整命令、影响范围与体积，并等待人工批准后执行。",
    createdAt: at(9 * MINUTE),
    turnId: "demo-turn-2",
    done: true,
  },
  {
    kind: "tool",
    id: "tool:demo-exec-bash",
    createdAt: at(8 * MINUTE) - 120,
    turnId: "demo-turn-2",
    call: {
      id: "demo-exec-bash",
      name: "exec_bash",
      status: "requested",
      argsPreview: JSON.stringify({ command: "rm -rf packages/web-next/.next/cache", cwd: "/home/hina/数据盘/projects/node-chaite" }, null, 2),
      attempt: 1,
      startedAt: at(8 * MINUTE) - 120,
    },
  },
  {
    kind: "approval",
    id: "approval:demo-approval-clean",
    requestId: DEMO_APPROVAL.requestId,
    createdAt: at(8 * MINUTE),
    turnId: "demo-turn-2",
  },
];

export function createDemoStreamView(): StreamView {
  const approvals: Record<string, ApprovalState> = {
    [DEMO_APPROVAL.requestId]: {
      request: DEMO_APPROVAL,
      status: "pending",
      preview: true,
    },
  };

  return {
    ...createInitialStreamView(DEMO_SESSION),
    timeline: DEMO_TIMELINE,
    approvals,
    lastEventAt: Date.now(),
    usage: { promptTokens: 18_420, completionTokens: 612, totalTokens: 19_032 },
  };
}
