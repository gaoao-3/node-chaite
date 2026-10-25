/**
 * Wire types shared by the Chaite Agent web console and the `/api/agent`
 * backend. Kept intentionally close to the server contracts in
 * `src/server/types.ts` and `src/agent/gateway-contracts.ts`.
 */

export const GATEWAY_PLATFORMS = ["qq", "dsh", "web"] as const;
export type GatewayPlatform = (typeof GATEWAY_PLATFORMS)[number];

export const SESSION_STATUSES = [
  "idle",
  "thinking",
  "streaming",
  "waiting_approval",
  "error",
  "closed",
] as const;
export type AgentSessionStatus = (typeof SESSION_STATUSES)[number];

export type ToolStatusState =
  | "requested"
  | "running"
  | "succeeded"
  | "failed"
  | "denied"
  | "skipped";

export type ApprovalDecision = "approved" | "denied" | "cancelled" | "expired";
export type ApprovalScope = "once" | "session" | "always";
export type ApprovalOptionId =
  | "approve_once"
  | "approve_session"
  | "approve_always"
  | "deny"
  | "cancel"
  | "edit";
export type ApprovalOptionOutcome = "approve" | "deny" | "cancel" | "edit";
export type ApprovalRiskLevel = "low" | "medium" | "high" | "critical";

export interface GatewayErrorPayload {
  code: string;
  message: string;
  retryable?: boolean;
  details?: unknown;
}

export interface AgentSessionTurnInfo {
  id: string;
  prompt: string;
  startedAt: number;
  model?: string;
  skillName?: string;
}

export interface AgentSessionInfo {
  id: string;
  platform: GatewayPlatform;
  botId: string;
  title: string;
  status: AgentSessionStatus;
  createdAt: number;
  lastActiveAt: number;
  turnCount: number;
  skills: string[];
  model?: string;
  activeTurn?: AgentSessionTurnInfo;
  pendingApprovalIds: string[];
  lastSeq: number;
  eventCount: number;
  metadata: Record<string, unknown>;
}

export interface SessionListStats {
  total: number;
  streaming: number;
  waitingApproval: number;
  byPlatform: Record<string, number>;
}

export interface SessionListResponse {
  items: AgentSessionInfo[];
  total: number;
  limit: number;
  offset: number;
  stats: SessionListStats;
}

export interface HumanApprovalOption {
  id: ApprovalOptionId;
  label: string;
  outcome: ApprovalOptionOutcome;
  scope?: ApprovalScope;
  requiresReason?: boolean;
  destructive?: boolean;
}

export type HumanApprovalAction =
  | { kind: "tool_call"; toolName: string; arguments: Record<string, unknown>; source?: string }
  | { kind: "file_write"; path: string; operation: "create" | "update" | "delete"; diff?: string; sizeBytes?: number }
  | { kind: "shell_command"; command: string; args?: string[]; cwd?: string }
  | { kind: "network_request"; method: string; url: string; headers?: Record<string, string>; bodyPreview?: string }
  | { kind: "external_side_effect"; target: string; description: string }
  | { kind: "custom"; name: string; payload: Record<string, unknown> };

export interface HumanApprovalRequest {
  platform: GatewayPlatform;
  botId: string;
  requestId: string;
  sessionId: string;
  runId?: string;
  taskId?: string;
  title: string;
  summary: string;
  riskLevel: ApprovalRiskLevel;
  action: HumanApprovalAction;
  options: HumanApprovalOption[];
  createdAt: number;
  expiresAt: number;
  requestedBy: { id: string; kind: string; displayName?: string };
  integrity: { algorithm: "sha256"; digest: string };
  context?: {
    reason?: string;
    evidence?: string[];
    affectedResources?: string[];
  };
  metadata?: Record<string, unknown>;
}

export interface MediaSource {
  source: "url" | "base64" | "file_id";
  url?: string;
  data?: string;
  mimeType?: string;
  fileId?: string;
}

export type OutboundReplyPart =
  | { type: "text"; text: string }
  | { type: "markdown"; markdown: string }
  | { type: "image"; source: MediaSource; alt?: string }
  | { type: "audio"; source: MediaSource; durationMs?: number }
  | { type: "video"; source: MediaSource; durationMs?: number }
  | { type: "file"; source: MediaSource; name?: string; mimeType?: string };

export interface GatewayUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

interface AgentWebEventBase {
  eventId: string;
  sessionId: string;
  platform: GatewayPlatform;
  botId: string;
  seq: number;
  timestamp: number;
  turnId?: string;
}

export interface ThoughtChunkWebEvent extends AgentWebEventBase {
  type: "thought_chunk";
  delta: string;
  index?: number;
  done?: boolean;
  signature?: string;
}

export interface TextChunkWebEvent extends AgentWebEventBase {
  type: "text_chunk";
  delta: string;
  index?: number;
  done?: boolean;
}

export interface ToolStatusWebEvent extends AgentWebEventBase {
  type: "tool_status";
  toolCallId: string;
  toolName: string;
  status: ToolStatusState;
  attempt?: number;
  argsPreview?: string;
  resultPreview?: string;
  error?: GatewayErrorPayload;
  startedAt?: number;
  completedAt?: number;
}

export interface ApprovalRequestWebEvent extends AgentWebEventBase {
  type: "approval_request";
  request: HumanApprovalRequest;
}

export interface ApprovalResultWebEvent extends AgentWebEventBase {
  type: "approval_result";
  requestId: string;
  decision: ApprovalDecision;
  scope?: ApprovalScope;
  optionId?: ApprovalOptionId;
  reason?: string;
}

export interface FinalReplyWebEvent extends AgentWebEventBase {
  type: "final_reply";
  messageId?: string;
  parts: OutboundReplyPart[];
  text?: string;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | "error" | "cancelled";
  usage?: GatewayUsage;
}

export interface TypingWebEvent extends AgentWebEventBase {
  type: "typing";
  state: "start" | "stop";
  durationMs?: number;
}

export interface ErrorWebEvent extends AgentWebEventBase {
  type: "error";
  error: GatewayErrorPayload;
  fatal: boolean;
}

export interface TurnStartedWebEvent extends AgentWebEventBase {
  type: "turn_started";
  turnId: string;
  prompt: string;
  model?: string;
  skillName?: string;
  images?: Array<{ url?: string; base64?: string; mimeType?: string }>;
}

export interface TurnFinishedWebEvent extends AgentWebEventBase {
  type: "turn_finished";
  turnId: string;
  outcome: "success" | "error" | "cancelled";
  durationMs: number;
  finishReason?: FinalReplyWebEvent["finishReason"];
  error?: GatewayErrorPayload;
}

export interface SessionClosedWebEvent extends AgentWebEventBase {
  type: "session_closed";
  reason?: string;
}

export type AgentWebEvent =
  | ThoughtChunkWebEvent
  | TextChunkWebEvent
  | ToolStatusWebEvent
  | ApprovalRequestWebEvent
  | ApprovalResultWebEvent
  | FinalReplyWebEvent
  | TypingWebEvent
  | ErrorWebEvent
  | TurnStartedWebEvent
  | TurnFinishedWebEvent
  | SessionClosedWebEvent;

export interface AgentSessionSnapshot {
  session: AgentSessionInfo;
  activeTurn?: AgentSessionTurnInfo;
  pendingApprovals: HumanApprovalRequest[];
  events: AgentWebEvent[];
  lastSeq: number;
  isStreaming: boolean;
  truncated: boolean;
}

/** Transport events are not persisted in the session event log. */
export interface ConnectedEvent {
  type: "connected";
  sessionId: string;
  platform: GatewayPlatform;
  botId: string;
  isStreaming: boolean;
  lastSeq: number;
  heartbeatMs: number;
  pendingApprovalIds: string[];
  serverTime: number;
}

export interface HeartbeatEvent {
  type: "heartbeat";
  sessionId: string;
  timestamp: number;
}

export interface SessionSnapshotEvent extends AgentSessionSnapshot {
  type: "session_snapshot";
  eventId: string;
  sessionId: string;
  platform: GatewayPlatform;
  botId: string;
  seq: number;
  timestamp: number;
}

export type AgentStreamEvent = AgentWebEvent | ConnectedEvent | SessionSnapshotEvent | HeartbeatEvent;
export type AgentStreamPayload = AgentStreamEvent & { seq?: number };

// ─── Fusion ──────────────────────────────────────────────────────────────────

export interface FusionCriterionReview {
  criterionId: string;
  passed: boolean;
  score?: number;
  comment?: string;
}

export interface FusionTestResult {
  name: string;
  passed: boolean;
  output?: string;
}

export interface FusionReviewCriterion {
  id: string;
  description: string;
  weight: number;
  required?: boolean;
  evaluator?: string;
}

export interface FusionTaskSpec {
  task_id: string;
  parent_task_id?: string;
  session_id: string;
  parent_run_id?: string;
  target_tools: { name: string; source?: string; server?: string; required?: boolean; notes?: string }[];
  instruction: string;
  context?: string;
  constraints?: string[];
  diff_schema: { format: string; path_scope?: string[]; required_fields?: string[]; max_files?: number; max_changed_lines?: number };
  review_criteria: FusionReviewCriterion[];
  delegation?: Record<string, unknown>;
  budget?: Record<string, unknown>;
  deadline_at?: number;
  created_at: number;
  metadata?: Record<string, unknown>;
}

export type FusionTaskStatus =
  | "queued"
  | "dispatched"
  | "running"
  | "review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "failed"
  | "cancelled";

export interface FusionTaskRecord {
  id: string;
  spec: FusionTaskSpec;
  status: FusionTaskStatus;
  sidekick?: string;
  createdAt: number;
  updatedAt: number;
  dispatchedAt?: number;
  completedAt?: number;
  result?: {
    summary?: string;
    diff?: string;
    diffFormat?: string;
    filesChanged?: string[];
    tests?: FusionTestResult[];
    notes?: string;
  };
  reviews: {
    reviewer: string;
    decision: "approved" | "rejected" | "changes_requested";
    summary?: string;
    criteria?: FusionCriterionReview[];
    score?: number;
    createdAt: number;
  }[];
  metadata: Record<string, unknown>;
}

export interface FusionTaskListResponse {
  items: FusionTaskRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface FusionStats {
  total: number;
  byStatus: Record<string, number>;
  bySession: Record<string, number>;
}

// ─── Evolution ───────────────────────────────────────────────────────────────

export interface EvolutionScores {
  correctness: number;
  efficiency: number;
  safety: number;
  reusability: number;
}

export type EvolutionTraceStatus = "candidate" | "approved" | "rejected" | "merged";

export interface EvolutionTraceRecord {
  id: string;
  trace: {
    traceId: string;
    sessionId: string;
    platform?: GatewayPlatform;
    botId?: string;
    userIntent: { raw: string; normalized?: string; category?: string; confidence?: number };
    outcome: "success" | "partial" | "failure";
    toolCalls: {
      callId: string;
      name: string;
      arguments: Record<string, unknown>;
      status: string;
      attempt: number;
      resultPreview?: string;
      startedAt?: number;
      completedAt?: number;
    }[];
    errorRetries: { attempt: number; reason: string; recovered: boolean; occurredAt: number }[];
    scores: EvolutionScores;
    draftSkillMd: string;
    draftSkillName?: string;
    draftSkillPath?: string;
    lessons?: string[];
    startedAt: number;
    completedAt: number;
    metadata?: Record<string, unknown>;
  };
  status: EvolutionTraceStatus;
  averageScore: number;
  gatePassed: boolean;
  createdAt: number;
  updatedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  mergedAt?: number;
  skillName?: string;
}

export interface EvolutionListResponse {
  items: EvolutionTraceRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface EvolutionStats {
  total: number;
  byStatus: Record<string, number>;
  gatePassed: number;
  averageScore: number;
}

export interface SkillMeta {
  id?: string;
  frontmatter?: {
    name?: string;
    description?: string;
    version?: string;
    executionMode?: string;
    readonly?: boolean;
    keywords?: string[];
    allowedTools?: string[];
  };
  name?: string;
  description?: string;
}

export interface SkillListResponse {
  items: SkillMeta[];
  total: number;
  page: number;
  pageSize: number;
  available: boolean;
}
