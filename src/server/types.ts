/**
 * Wire types for the Chaite Agent web backend.
 *
 * These are intentionally separate from Pi Web's concrete event names while
 * following the same transport contract:
 *
 *  - one SSE stream per session (`GET /api/agent/sessions/:id/events`);
 *  - every stream starts with `connected`, followed by a `session_snapshot`;
 *  - events carry a monotonically increasing `seq` (also sent as the SSE `id`)
 *    so a reconnecting client can resume with `Last-Event-ID`;
 *  - heartbeat data events keep proxies and mobile browsers from killing an
 *    otherwise idle stream.
 *
 * Event names mirror the gateway contracts (`thought_chunk`, `text_chunk`,
 * `tool_status`, `approval_request`, `final_reply`, `error`) so the QQ/DSH
 * gateways and the Web console share one vocabulary.
 */

import type {
  ApprovalDecision,
  ApprovalOptionId,
  ApprovalScope,
  FinalReplyFinishReason,
  GatewayErrorPayload,
  GatewayPlatform,
  GatewayUsage,
  HumanApprovalRequest,
  OutboundReplyPart,
  ToolStatusState,
  TypingState,
} from '../agent/gateway-contracts'

// ─── Session snapshots ────────────────────────────────────────────────────────

export const AGENT_SESSION_STATUSES = [
  'idle',
  'thinking',
  'streaming',
  'waiting_approval',
  'error',
  'closed',
] as const
export type AgentSessionStatus = (typeof AGENT_SESSION_STATUSES)[number]

export interface AgentSessionTurnInfo {
  id: string
  prompt: string
  startedAt: number
  /** Optional model/skill selected for this turn. */
  model?: string
  skillName?: string
  thinkingLevel?: 'none' | 'low' | 'medium' | 'high' | 'max'
  reasoningEffort?: string
}

/** Public, serialisable view of one multi-platform session. */
export interface AgentSessionInfo {
  id: string
  platform: GatewayPlatform
  botId: string
  title: string
  status: AgentSessionStatus
  createdAt: number
  lastActiveAt: number
  /** Number of user prompts accepted for this session. */
  turnCount: number
  /** Skills currently mounted on the session. */
  skills: string[]
  model?: string
  activeTurn?: AgentSessionTurnInfo
  pendingApprovalIds: string[]
  lastSeq: number
  eventCount: number
  metadata: Record<string, unknown>
}

export interface AgentSessionSnapshot {
  session: AgentSessionInfo
  activeTurn?: AgentSessionTurnInfo
  pendingApprovals: HumanApprovalRequest[]
  /** Most recent events (or only events after `since` for a resume). */
  events: AgentWebEvent[]
  lastSeq: number
  isStreaming: boolean
  /** True when older events were trimmed from the in-memory log. */
  truncated: boolean
}

/** Structural contract the SSE transport needs from a live session. */
export interface AgentEventStreamSession {
  readonly id: string
  readonly platform: GatewayPlatform
  readonly botId: string
  readonly isStreaming: boolean
  readonly lastSequence: number
  isAlive?(): boolean
  onEvent(listener: (event: AgentWebEvent) => void): () => void
  snapshot(options?: { since?: number; limit?: number }): AgentSessionSnapshot
}

// ─── Event payloads ───────────────────────────────────────────────────────────

export interface AgentWebEventBase {
  eventId: string
  sessionId: string
  platform: GatewayPlatform
  botId: string
  /** Monotonically increasing per session, starting at 1. */
  seq: number
  timestamp: number
  turnId?: string
}

export interface ThoughtChunkWebEvent extends AgentWebEventBase {
  type: 'thought_chunk'
  delta: string
  index?: number
  done?: boolean
  /** Provider thought signature that must survive a round trip. */
  signature?: string
}

export interface TextChunkWebEvent extends AgentWebEventBase {
  type: 'text_chunk'
  delta: string
  index?: number
  done?: boolean
}

export interface ToolStatusWebEvent extends AgentWebEventBase {
  type: 'tool_status'
  toolCallId: string
  toolName: string
  status: ToolStatusState
  attempt?: number
  /** Short, already-redacted preview. Never include secrets. */
  argsPreview?: string
  resultPreview?: string
  error?: GatewayErrorPayload
  startedAt?: number
  completedAt?: number
}

export interface ApprovalRequestWebEvent extends AgentWebEventBase {
  type: 'approval_request'
  request: HumanApprovalRequest
}

export interface ApprovalResultWebEvent extends AgentWebEventBase {
  type: 'approval_result'
  requestId: string
  decision: ApprovalDecision
  scope?: ApprovalScope
  optionId?: ApprovalOptionId
  reason?: string
}

export interface FinalReplyWebEvent extends AgentWebEventBase {
  type: 'final_reply'
  messageId?: string
  parts: OutboundReplyPart[]
  /** Plain-text fallback for clients without rich-part rendering. */
  text?: string
  finishReason: FinalReplyFinishReason
  usage?: GatewayUsage
}

export interface TypingWebEvent extends AgentWebEventBase {
  type: 'typing'
  state: TypingState
  durationMs?: number
}

export interface ErrorWebEvent extends AgentWebEventBase {
  type: 'error'
  error: GatewayErrorPayload
  fatal: boolean
}

export interface TurnStartedWebEvent extends AgentWebEventBase {
  type: 'turn_started'
  turnId: string
  prompt: string
  model?: string
  skillName?: string
}

export interface TurnFinishedWebEvent extends AgentWebEventBase {
  type: 'turn_finished'
  turnId: string
  outcome: 'success' | 'error' | 'cancelled'
  durationMs: number
  finishReason?: FinalReplyFinishReason
  error?: GatewayErrorPayload
}

export interface SessionClosedWebEvent extends AgentWebEventBase {
  type: 'session_closed'
  reason?: string
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
  | SessionClosedWebEvent

/** Input accepted by {@link AgentSession.append}; base fields are filled in. */
export type AgentEventDraft =
  | { type: 'thought_chunk'; delta: string; index?: number; done?: boolean; signature?: string; turnId?: string }
  | { type: 'text_chunk'; delta: string; index?: number; done?: boolean; turnId?: string }
  | {
      type: 'tool_status'
      toolCallId: string
      toolName: string
      status: ToolStatusState
      attempt?: number
      argsPreview?: string
      resultPreview?: string
      error?: GatewayErrorPayload
      startedAt?: number
      completedAt?: number
      turnId?: string
    }
  | { type: 'approval_request'; request: HumanApprovalRequest; turnId?: string }
  | {
      type: 'approval_result'
      requestId: string
      decision: ApprovalDecision
      scope?: ApprovalScope
      optionId?: ApprovalOptionId
      reason?: string
      turnId?: string
    }
  | {
      type: 'final_reply'
      messageId?: string
      parts: OutboundReplyPart[]
      text?: string
      finishReason: FinalReplyFinishReason
      usage?: GatewayUsage
      turnId?: string
    }
  | { type: 'typing'; state: TypingState; durationMs?: number; turnId?: string }
  | { type: 'error'; error: GatewayErrorPayload; fatal?: boolean; turnId?: string }
  | { type: 'turn_started'; turnId: string; prompt: string; model?: string; skillName?: string }
  | {
      type: 'turn_finished'
      turnId: string
      outcome: 'success' | 'error' | 'cancelled'
      durationMs: number
      finishReason?: FinalReplyFinishReason
      error?: GatewayErrorPayload
    }
  | { type: 'session_closed'; reason?: string; turnId?: string }

// ─── Transport events (not persisted in the session event log) ────────────────

export interface ConnectedEvent {
  type: 'connected'
  sessionId: string
  platform: GatewayPlatform
  botId: string
  isStreaming: boolean
  lastSeq: number
  heartbeatMs: number
  /** Approvals the session still holds; a reconnecting client can discard the rest. */
  pendingApprovalIds: string[]
  serverTime: number
}

export interface HeartbeatEvent {
  type: 'heartbeat'
  sessionId: string
  timestamp: number
}

export interface SessionSnapshotEvent extends AgentSessionSnapshot {
  type: 'session_snapshot'
  eventId: string
  sessionId: string
  platform: GatewayPlatform
  botId: string
  seq: number
  timestamp: number
}

export type AgentStreamEvent = AgentWebEvent | ConnectedEvent | SessionSnapshotEvent

// ─── Prompt dispatch ──────────────────────────────────────────────────────────

export interface AgentPromptInput {
  /** Natural-language instruction. */
  prompt: string
  /** Optional text for the transcript when it differs from the model prompt. */
  displayText?: string
  model?: string
  skillName?: string
  metadata?: Record<string, unknown>
  images?: Array<{ url?: string; base64?: string; mimeType?: string }>
}

export interface PromptDriverResult {
  finishReason?: FinalReplyFinishReason
  /** Full reply text when the driver did not already emit `final_reply`. */
  text?: string
  /** Rich reply parts. When omitted, `text` is converted to a markdown part. */
  parts?: OutboundReplyPart[]
  messageId?: string
  usage?: GatewayUsage
}

export interface PromptDriverContext {
  session: AgentSessionInfo
  prompt: string
  turnId: string
  signal: AbortSignal
  images?: Array<{ url?: string; base64?: string; mimeType?: string }>
  /** Append one event to the session and broadcast it to SSE clients. */
  emit(event: AgentEventDraft): void
  /**
   * Ask a human to approve a risky action. The promise resolves with the
   * decision; when the turn ends first it resolves with `decision: "cancelled"`.
   */
  requestApproval(request: HumanApprovalRequest): Promise<ApprovalResponseLike>
}

/** Subset of the gateway `ApprovalResponse` exposed to drivers. */
export interface ApprovalResponseLike {
  requestId: string
  decision: ApprovalDecision
  scope?: ApprovalScope
  optionId?: ApprovalOptionId
  reason?: string
  respondedAt: number
}

/** A prompt driver owns the agent loop for exactly one turn. */
export interface SessionPromptDriver {
  run(context: PromptDriverContext): Promise<PromptDriverResult | void>
}

export interface PromptReceipt {
  accepted: true
  sessionId: string
  turnId: string
  startedAt: number
}

export interface PromptTurnResult {
  sessionId: string
  turnId: string
  startedAt: number
  durationMs: number
  outcome: 'success' | 'error' | 'cancelled'
  result?: PromptDriverResult
}

export interface PromptTurn extends PromptReceipt {
  /** Resolves when the agent loop finishes; rejects on failure. */
  done: Promise<PromptTurnResult>
}

// ─── Session create/list ──────────────────────────────────────────────────────

export interface SessionCreateInput {
  id?: string
  platform?: GatewayPlatform
  botId?: string
  title?: string
  model?: string
  skills?: string[]
  metadata?: Record<string, unknown>
}

export interface SessionListFilter {
  platform?: GatewayPlatform
  status?: AgentSessionStatus
  /** Substring match against id/title/botId. */
  query?: string
  limit?: number
  offset?: number
}
