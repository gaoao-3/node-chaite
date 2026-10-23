/**
 * Gateway protocol contracts for the multi-platform (QQ / DSH / Web) agent.
 *
 * This file is intentionally dependency-free so it can be imported by the core
 * runtime, gateway adapters, workers and the frontend type package without
 * pulling in Node-only modules.
 *
 * Design rules:
 * 1. Every payload that crosses a platform boundary carries an isolation scope
 *    (`platform` + `botId`, optionally `tenantId`/`gatewayId`). A gateway must
 *    never route an event using only a session id, because the same session id
 *    may exist on a different bot or platform.
 * 2. Inbound content and outbound events are closed discriminated unions. A new
 *    variant must be added here (and to the matching constant array) so that
 *    exhaustive switches fail at compile time until every consumer is updated.
 * 3. `FusionTaskSpec` is a wire-level delegation contract shared between the
 *    Main Agent and Sidekick(s). Its field names are snake_case on purpose and
 *    must remain stable across processes.
 * 4. Runtime validation for these types lives in `gateway-validators.ts`.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Platform & isolation primitives
// ═══════════════════════════════════════════════════════════════════════════════

/** Stable platform discriminator. Never reuse or rename an existing value. */
export const GATEWAY_PLATFORMS = ['qq', 'dsh', 'web'] as const
export type GatewayPlatform = (typeof GATEWAY_PLATFORMS)[number]

/**
 * Isolation scope shared by inbound messages, outbound events and approval
 * records. `botId` is the hard boundary: two bots on the same platform must not
 * share histories, skill state or approval decisions.
 */
export interface GatewayIsolationScope {
  platform: GatewayPlatform
  /** Stable identifier of the bot/account on the platform. */
  botId: string
  /** Optional workspace boundary. When omitted, `botId` is the tenant. */
  tenantId?: string
  /** Gateway process/instance id, useful for reconnect and dedupe. */
  gatewayId?: string
}

/** Distributed tracing fields propagated through the gateway. */
export interface GatewayTraceContext {
  traceId?: string
  spanId?: string
  parentSpanId?: string
}

export const AGENT_TOOL_SOURCES = ['local', 'mcp', 'builtin', 'skill', 'remote'] as const
export type AgentToolSource = (typeof AGENT_TOOL_SOURCES)[number]

/** Error taxonomy shared by tools, gateway events and evolution traces. */
export const AGENT_ERROR_KINDS = ['RETRYABLE', 'POLICY_DENIED', 'FATAL'] as const
export type AgentErrorKind = (typeof AGENT_ERROR_KINDS)[number]

// ═══════════════════════════════════════════════════════════════════════════════
// Inbound messages
// ═══════════════════════════════════════════════════════════════════════════════

export const GATEWAY_CONVERSATION_KINDS = ['private', 'group', 'guild', 'channel', 'thread'] as const
export type GatewayConversationKind = (typeof GATEWAY_CONVERSATION_KINDS)[number]

export const INBOUND_SENDER_ROLES = ['owner', 'admin', 'member', 'guest', 'bot', 'system'] as const
/** Permission role of the sender, not the model message role. */
export type InboundSenderRole = (typeof INBOUND_SENDER_ROLES)[number]

export interface InboundSender {
  /** Platform user id. Keep it as a string to avoid precision loss. */
  id: string
  nickname?: string
  card?: string
  role: InboundSenderRole
  isBot?: boolean
  avatarUrl?: string
  locale?: string
}

/** How binary/large media is referenced. Exactly one transport is used. */
export const MEDIA_SOURCE_KINDS = ['url', 'base64', 'file_id'] as const
export type MediaSourceKind = (typeof MEDIA_SOURCE_KINDS)[number]

export interface MediaUrlSource {
  source: 'url'
  url: string
}

export interface MediaBase64Source {
  source: 'base64'
  data: string
  mimeType: string
}

export interface MediaFileIdSource {
  source: 'file_id'
  fileId: string
}

export type MediaSource = MediaUrlSource | MediaBase64Source | MediaFileIdSource

export const INBOUND_CONTENT_TYPES = [
  'text',
  'image',
  'audio',
  'video',
  'file',
  'mention',
  'reply',
  'face',
  'location',
  'unknown',
] as const
export type InboundContentType = (typeof INBOUND_CONTENT_TYPES)[number]

export interface InboundTextContent {
  type: 'text'
  text: string
}

export interface InboundImageContent {
  type: 'image'
  source: MediaSource
  mimeType?: string
  alt?: string
  width?: number
  height?: number
}

export interface InboundAudioContent {
  type: 'audio'
  source: MediaSource
  mimeType?: string
  durationMs?: number
  /** Optional platform-provided speech-to-text result. */
  transcript?: string
}

export interface InboundVideoContent {
  type: 'video'
  source: MediaSource
  mimeType?: string
  durationMs?: number
  width?: number
  height?: number
}

export interface InboundFileContent {
  type: 'file'
  source: MediaSource
  name?: string
  mimeType?: string
  sizeBytes?: number
}

export interface InboundMentionContent {
  type: 'mention'
  userId: string
  displayName?: string
  /** True for @everyone / @all style mentions. */
  all?: boolean
}

export interface InboundReplyContent {
  type: 'reply'
  messageId: string
  senderId?: string
  excerpt?: string
}

/** QQ face / emoji or platform-specific sticker. */
export interface InboundFaceContent {
  type: 'face'
  faceId: string
  text?: string
}

export interface InboundLocationContent {
  type: 'location'
  latitude: number
  longitude: number
  name?: string
  address?: string
}

/** Escape hatch for platform-specific content that has no neutral mapping yet. */
export interface InboundUnknownContent {
  type: 'unknown'
  rawType: string
  raw?: unknown
}

export type InboundContent =
  | InboundTextContent
  | InboundImageContent
  | InboundAudioContent
  | InboundVideoContent
  | InboundFileContent
  | InboundMentionContent
  | InboundReplyContent
  | InboundFaceContent
  | InboundLocationContent
  | InboundUnknownContent

/**
 * Canonical inbound message. Platform adapters are responsible for translating
 * their native event into this shape; the agent runtime must not depend on any
 * platform-specific payload outside `raw`.
 */
export interface InboundMessage extends GatewayIsolationScope, GatewayTraceContext {
  /** Platform message id (also used for dedupe). */
  messageId: string
  /** Conversation/session id scoped to `platform + botId`. */
  sessionId: string
  kind: GatewayConversationKind
  sender: InboundSender
  content: InboundContent[]
  /** Platform creation time, epoch milliseconds. */
  timestamp: number
  /** Gateway acceptance time, epoch milliseconds. */
  receivedAt?: number
  /** Optional provider conversation id when it differs from `sessionId`. */
  conversationId?: string
  /** Thread / topic id inside a group or guild. */
  threadId?: string
  /** Id of the message this one replies to, if any. */
  parentMessageId?: string
  groupId?: string
  groupName?: string
  channelId?: string
  channelName?: string
  locale?: string
  /** True when the bot itself was mentioned. */
  mentionedBot?: boolean
  /** Client-provided idempotency key, when the platform supports it. */
  idempotencyKey?: string
  /** Raw platform payload. Must be sanitized before being shown to a model. */
  raw?: unknown
  metadata?: Record<string, unknown>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Human-in-the-loop approvals
// ═══════════════════════════════════════════════════════════════════════════════

export const APPROVAL_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
export type ApprovalRiskLevel = (typeof APPROVAL_RISK_LEVELS)[number]

export const APPROVAL_ACTION_KINDS = [
  'tool_call',
  'file_write',
  'shell_command',
  'network_request',
  'external_side_effect',
  'custom',
] as const
export type ApprovalActionKind = (typeof APPROVAL_ACTION_KINDS)[number]

export const FILE_WRITE_OPERATIONS = ['create', 'update', 'delete'] as const
export type FileWriteOperation = (typeof FILE_WRITE_OPERATIONS)[number]

export const NETWORK_REQUEST_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
export type NetworkRequestMethod = (typeof NETWORK_REQUEST_METHODS)[number]

export interface ApprovalToolCallAction {
  kind: 'tool_call'
  toolName: string
  arguments: Record<string, unknown>
  source?: AgentToolSource
}

export interface ApprovalFileWriteAction {
  kind: 'file_write'
  path: string
  operation: FileWriteOperation
  /** Unified diff or patch preview. */
  diff?: string
  sizeBytes?: number
}

export interface ApprovalShellCommandAction {
  kind: 'shell_command'
  command: string
  args?: string[]
  cwd?: string
}

export interface ApprovalNetworkRequestAction {
  kind: 'network_request'
  method: NetworkRequestMethod
  url: string
  headers?: Record<string, string>
  bodyPreview?: string
}

export interface ApprovalExternalSideEffectAction {
  kind: 'external_side_effect'
  target: string
  description: string
}

export interface ApprovalCustomAction {
  kind: 'custom'
  name: string
  payload: Record<string, unknown>
}

export type HumanApprovalAction =
  | ApprovalToolCallAction
  | ApprovalFileWriteAction
  | ApprovalShellCommandAction
  | ApprovalNetworkRequestAction
  | ApprovalExternalSideEffectAction
  | ApprovalCustomAction

export const APPROVAL_OPTION_IDS = [
  'approve_once',
  'approve_session',
  'approve_always',
  'deny',
  'cancel',
  'edit',
] as const
export type ApprovalOptionId = (typeof APPROVAL_OPTION_IDS)[number]

export const APPROVAL_OPTION_OUTCOMES = ['approve', 'deny', 'cancel', 'edit'] as const
export type ApprovalOptionOutcome = (typeof APPROVAL_OPTION_OUTCOMES)[number]

export const APPROVAL_SCOPES = ['once', 'session', 'always'] as const
export type ApprovalScope = (typeof APPROVAL_SCOPES)[number]

export const APPROVAL_DECISIONS = ['approved', 'denied', 'cancelled', 'expired'] as const
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number]

export const APPROVAL_REQUESTER_KINDS = ['agent', 'sidekick', 'system', 'human'] as const
export type ApprovalRequesterKind = (typeof APPROVAL_REQUESTER_KINDS)[number]

export interface HumanApprovalOption {
  id: ApprovalOptionId
  label: string
  outcome: ApprovalOptionOutcome
  /** Only meaningful for approve outcomes. Defaults to `once`. */
  scope?: ApprovalScope
  requiresReason?: boolean
  /** UI should style this option as destructive. */
  destructive?: boolean
}

/**
 * Integrity binding for approval payloads. Gateways compute this over the
 * canonical action + context; the executor recomputes it before acting to
 * prevent time-of-check / time-of-use substitution.
 */
export interface ApprovalIntegrity {
  algorithm: 'sha256'
  /** Lowercase or uppercase hex SHA-256 digest. */
  digest: string
}

export interface ApprovalRequestedBy {
  id: string
  kind: ApprovalRequesterKind
  displayName?: string
}

export interface HumanApprovalRequest extends GatewayIsolationScope {
  requestId: string
  sessionId: string
  runId?: string
  /** Fusion task that triggered this request, if any. */
  taskId?: string
  title: string
  summary: string
  riskLevel: ApprovalRiskLevel
  action: HumanApprovalAction
  /** At least one selectable option. */
  options: HumanApprovalOption[]
  /** Epoch milliseconds. */
  createdAt: number
  /** Epoch milliseconds; must be greater than `createdAt`. */
  expiresAt: number
  requestedBy: ApprovalRequestedBy
  integrity: ApprovalIntegrity
  context?: {
    reason?: string
    evidence?: string[]
    affectedResources?: string[]
  }
  metadata?: Record<string, unknown>
}

export interface ApprovalResponder {
  platform: GatewayPlatform
  userId: string
  role: InboundSenderRole
  displayName?: string
}

/** Human response to a `HumanApprovalRequest`. */
export interface ApprovalResponse {
  requestId: string
  /** Bot/account that owns the request; prevents cross-bot response replay. */
  botId: string
  /** Session of the original request. */
  sessionId: string
  decision: ApprovalDecision
  /** Required in practice for approvals; defaults to `once` when omitted. */
  scope?: ApprovalScope
  responder: ApprovalResponder
  respondedAt: number
  optionId?: ApprovalOptionId
  reason?: string
  /** Present when the human approved with an edited action. */
  editedAction?: HumanApprovalAction
  /** Echo of the request integrity digest the responder saw. */
  requestDigest?: ApprovalIntegrity
  metadata?: Record<string, unknown>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Outbound streaming events
// ═══════════════════════════════════════════════════════════════════════════════

export const OUTBOUND_EVENT_TYPES = [
  'typing',
  'thought_chunk',
  'text_chunk',
  'tool_status',
  'approval_request',
  'final_reply',
  'error',
] as const
export type OutboundEventType = (typeof OUTBOUND_EVENT_TYPES)[number]

export const TYPING_STATES = ['start', 'stop'] as const
export type TypingState = (typeof TYPING_STATES)[number]

export const TOOL_STATUS_STATES = [
  'requested',
  'running',
  'succeeded',
  'failed',
  'denied',
  'skipped',
] as const
export type ToolStatusState = (typeof TOOL_STATUS_STATES)[number]

export const FINAL_REPLY_FINISH_REASONS = [
  'stop',
  'length',
  'tool_calls',
  'content_filter',
  'error',
  'cancelled',
] as const
export type FinalReplyFinishReason = (typeof FINAL_REPLY_FINISH_REASONS)[number]

export const OUTBOUND_REPLY_PART_TYPES = ['text', 'markdown', 'image', 'audio', 'video', 'file'] as const
export type OutboundReplyPartType = (typeof OUTBOUND_REPLY_PART_TYPES)[number]

export const GATEWAY_ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'TIMEOUT',
  'UPSTREAM_ERROR',
  'TOOL_ERROR',
  'APPROVAL_DENIED',
  'APPROVAL_EXPIRED',
  'INTERNAL_ERROR',
  'CANCELLED',
] as const
export type GatewayErrorCode = (typeof GATEWAY_ERROR_CODES)[number]

export interface GatewayErrorPayload {
  code: GatewayErrorCode
  message: string
  /** Whether retrying the same operation may succeed. */
  retryable: boolean
  kind?: AgentErrorKind
  details?: Record<string, unknown>
}

export interface GatewayUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  cachedTokens?: number
  reasoningTokens?: number
}

export interface GatewayCitation {
  title: string
  url: string
  excerpt?: string
}

export interface OutboundReplyTextPart {
  type: 'text'
  text: string
}

export interface OutboundReplyMarkdownPart {
  type: 'markdown'
  markdown: string
}

export interface OutboundReplyImagePart {
  type: 'image'
  source: MediaSource
  alt?: string
}

export interface OutboundReplyAudioPart {
  type: 'audio'
  source: MediaSource
  durationMs?: number
}

export interface OutboundReplyVideoPart {
  type: 'video'
  source: MediaSource
  durationMs?: number
}

export interface OutboundReplyFilePart {
  type: 'file'
  source: MediaSource
  name?: string
  mimeType?: string
}

export type OutboundReplyPart =
  | OutboundReplyTextPart
  | OutboundReplyMarkdownPart
  | OutboundReplyImagePart
  | OutboundReplyAudioPart
  | OutboundReplyVideoPart
  | OutboundReplyFilePart

/**
 * Fields common to every streamed event. `sequence` is monotonically increasing
 * per `sessionId`; gateways must drop or reorder out-of-sequence events.
 */
export interface OutboundEventBase extends GatewayIsolationScope, GatewayTraceContext {
  eventId: string
  sessionId: string
  /** Monotonically increasing per session, starting at 0. */
  sequence: number
  /** Epoch milliseconds. */
  timestamp: number
  /** Inbound message this event is answering. */
  replyToMessageId?: string
  /** Agent run id, stable across all events of one run. */
  runId?: string
}

export interface TypingEvent extends OutboundEventBase {
  type: 'typing'
  state: TypingState
  /** Requested typing duration; omit for platform default. */
  durationMs?: number
}

export interface ThoughtChunkEvent extends OutboundEventBase {
  type: 'thought_chunk'
  delta: string
  index?: number
  /** True when this is the last chunk of the thought. */
  done?: boolean
  /** Provider signature that must be preserved, if any. */
  signature?: string
}

export interface TextChunkEvent extends OutboundEventBase {
  type: 'text_chunk'
  delta: string
  index?: number
  /** True when this is the last text chunk before `final_reply`. */
  done?: boolean
}

export interface ToolStatusEvent extends OutboundEventBase {
  type: 'tool_status'
  toolCallId: string
  toolName: string
  status: ToolStatusState
  /** 1-based attempt number. */
  attempt?: number
  /** Short, already-redacted preview. Never include secrets. */
  argsPreview?: string
  resultPreview?: string
  error?: GatewayErrorPayload
  startedAt?: number
  completedAt?: number
}

export interface ApprovalRequestEvent extends OutboundEventBase {
  type: 'approval_request'
  request: HumanApprovalRequest
}

export interface FinalReplyEvent extends OutboundEventBase {
  type: 'final_reply'
  /** Platform message id assigned to the reply, if known. */
  messageId?: string
  parts: OutboundReplyPart[]
  /** Plain-text fallback for platforms without rich media support. */
  text?: string
  finishReason: FinalReplyFinishReason
  usage?: GatewayUsage
  citations?: GatewayCitation[]
}

export interface GatewayErrorEvent extends OutboundEventBase {
  type: 'error'
  error: GatewayErrorPayload
  /** True when the run cannot continue. */
  fatal: boolean
}

/**
 * Closed union of all events a gateway/frontend may receive. Consumers should
 * switch exhaustively on `type`.
 */
export type OutboundEvent =
  | TypingEvent
  | ThoughtChunkEvent
  | TextChunkEvent
  | ToolStatusEvent
  | ApprovalRequestEvent
  | FinalReplyEvent
  | GatewayErrorEvent

// ═══════════════════════════════════════════════════════════════════════════════
// Fusion / Sidekick delegation (wire contract, snake_case by design)
// ═══════════════════════════════════════════════════════════════════════════════

export const FUSION_DIFF_FORMATS = ['unified_diff', 'json_patch', 'structured_patch', 'none'] as const
export type FusionDiffFormat = (typeof FUSION_DIFF_FORMATS)[number]

export const FUSION_REVIEW_EVALUATORS = ['main_agent', 'sidekick_self', 'tests', 'human', 'automated'] as const
export type FusionReviewEvaluator = (typeof FUSION_REVIEW_EVALUATORS)[number]

export interface FusionToolTarget {
  name: string
  source?: AgentToolSource
  /** MCP server name/id when `source` is `mcp`. */
  server?: string
  /** When true the Sidekick must successfully call this tool. */
  required?: boolean
  notes?: string
}

/**
 * Contract for the patch/diff the Sidekick must return. `path_scope` is a glob
 * allowlist; when it is empty the Sidekick must not write to the filesystem.
 */
export interface FusionDiffSchema {
  format: FusionDiffFormat
  path_scope?: string[]
  /** Top-level fields required in a `structured_patch` / `json_patch`. */
  required_fields?: string[]
  /** Optional JSON Schema for `structured_patch`. */
  schema?: Record<string, unknown>
  max_files?: number
  max_changed_lines?: number
  allow_binary?: boolean
}

export interface FusionReviewCriterion {
  id: string
  description: string
  /** Normalized weight in [0, 1]. Weights of all criteria must sum to 1. */
  weight: number
  /** A failed required criterion rejects the delegation. */
  required?: boolean
  evaluator?: FusionReviewEvaluator
  /** Machine-checkable command or human-readable pass condition. */
  pass_condition?: string
}

export interface FusionTaskBudget {
  max_tool_calls?: number
  max_wall_clock_ms?: number
  max_tokens?: number
  /** 1-based total attempts, including the first one. */
  max_attempts?: number
}

export interface FusionDelegationMeta {
  reason?: string
  /** Confidence in [0, 1] that this task is suitable for a Sidekick. */
  confidence?: number
}

/**
 * Task delegated by the Main Agent to a Sidekick.
 *
 * Field names are part of the wire protocol and intentionally snake_case so a
 * task can be serialized, signed and replayed across processes unchanged.
 */
export interface FusionTaskSpec {
  task_id: string
  parent_task_id?: string
  session_id: string
  parent_run_id?: string
  /** Tools the Sidekick is allowed (and expected) to use. At least one. */
  target_tools: FusionToolTarget[]
  /** Natural-language delegation instruction. */
  instruction: string
  /** Supporting context; never mixed into `instruction`. */
  context?: string
  constraints?: string[]
  diff_schema: FusionDiffSchema
  /** At least one criterion; weights must sum to 1. */
  review_criteria: FusionReviewCriterion[]
  delegation?: FusionDelegationMeta
  budget?: FusionTaskBudget
  deadline_at?: number
  created_at: number
  metadata?: Record<string, unknown>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hermes / nekocode self-evolution trace
// ═══════════════════════════════════════════════════════════════════════════════

export const EVOLUTION_OUTCOMES = ['success', 'partial', 'failure'] as const
export type EvolutionOutcome = (typeof EVOLUTION_OUTCOMES)[number]

export const EVOLUTION_TOOL_CALL_STATUSES = ['ok', 'error', 'retried', 'skipped', 'denied'] as const
export type EvolutionToolCallStatus = (typeof EVOLUTION_TOOL_CALL_STATUSES)[number]

export const EVOLUTION_SCORE_KEYS = ['correctness', 'efficiency', 'safety', 'reusability'] as const
export type EvolutionScoreKey = (typeof EVOLUTION_SCORE_KEYS)[number]

/** Four-dimensional quality score. Every value is normalized to [0, 1]. */
export interface EvolutionScores {
  /** Did the run satisfy the user's intent? */
  correctness: number
  /** Tool calls / tokens / wall-clock used relative to the result. */
  efficiency: number
  /** Policy compliance, least privilege and absence of unsafe side effects. */
  safety: number
  /** How reusable the learned procedure is for future tasks. */
  reusability: number
}

export interface EvolutionUserIntent {
  /** Raw user text, preserved for audit. */
  raw: string
  /** Normalized / rewritten intent used by the classifier. */
  normalized?: string
  category?: string
  /** Classifier confidence in [0, 1]. */
  confidence?: number
  entities?: Record<string, unknown>
}

export interface EvolutionToolError {
  kind: AgentErrorKind
  message: string
  code?: string
}

/** One entry in the ordered tool-call chain of a run. */
export interface EvolutionToolCall {
  callId: string
  name: string
  arguments: Record<string, unknown>
  status: EvolutionToolCallStatus
  /** 1-based attempt number for this call. */
  attempt: number
  resultPreview?: string
  error?: EvolutionToolError
  source?: AgentToolSource
  startedAt?: number
  completedAt?: number
}

/** One error + retry decision. `attempt` is the retry attempt being recorded. */
export interface EvolutionRetryRecord {
  attempt: number
  toolCallId?: string
  reason: string
  errorKind?: AgentErrorKind
  backoffMs?: number
  /** Whether the retry eventually succeeded. */
  recovered: boolean
  occurredAt: number
}

/**
 * Full execution trace used by the self-evolution pipeline to mine a reusable
 * skill. `toolCalls` is chronological; `errorRetries` records the recovery path.
 */
export interface EvolutionTrace {
  traceId: string
  sessionId: string
  /** Platform/bot that produced the trace, when applicable. */
  platform?: GatewayPlatform
  botId?: string
  userIntent: EvolutionUserIntent
  outcome: EvolutionOutcome
  toolCalls: EvolutionToolCall[]
  errorRetries: EvolutionRetryRecord[]
  scores: EvolutionScores
  /** Draft `SKILL.md` generated from this trace. Empty means no candidate. */
  draftSkillMd: string
  draftSkillName?: string
  draftSkillPath?: string
  /** Human-readable lessons extracted from the run. */
  lessons?: string[]
  /** Approval requests involved in the run. */
  approvalRequestIds?: string[]
  /** Epoch milliseconds. */
  startedAt: number
  /** Epoch milliseconds; must be >= `startedAt`. */
  completedAt: number
  metadata?: Record<string, unknown>
}
