/**
 * Runtime validators for the gateway contracts.
 *
 * TypeScript types disappear at runtime, but gateway payloads arrive from
 * untrusted platform adapters, HTTP/WebSocket clients and remote workers. The
 * guards below enforce the same invariants as `gateway-contracts.ts` and report
 * precise JSON paths for rejected payloads.
 *
 * Keep this file dependency-free; it is imported by adapters and tests.
 */

import {
  AGENT_ERROR_KINDS,
  AGENT_TOOL_SOURCES,
  APPROVAL_ACTION_KINDS,
  APPROVAL_DECISIONS,
  APPROVAL_OPTION_IDS,
  APPROVAL_OPTION_OUTCOMES,
  APPROVAL_REQUESTER_KINDS,
  APPROVAL_RISK_LEVELS,
  APPROVAL_SCOPES,
  EVOLUTION_OUTCOMES,
  EVOLUTION_SCORE_KEYS,
  EVOLUTION_TOOL_CALL_STATUSES,
  FILE_WRITE_OPERATIONS,
  FINAL_REPLY_FINISH_REASONS,
  FUSION_DIFF_FORMATS,
  FUSION_REVIEW_EVALUATORS,
  GATEWAY_CONVERSATION_KINDS,
  GATEWAY_ERROR_CODES,
  GATEWAY_PLATFORMS,
  INBOUND_CONTENT_TYPES,
  INBOUND_SENDER_ROLES,
  MEDIA_SOURCE_KINDS,
  NETWORK_REQUEST_METHODS,
  OUTBOUND_EVENT_TYPES,
  OUTBOUND_REPLY_PART_TYPES,
  TOOL_STATUS_STATES,
  TYPING_STATES,
  type ApprovalResponse,
  type EvolutionTrace,
  type FusionTaskSpec,
  type HumanApprovalRequest,
  type InboundMessage,
  type OutboundEvent,
} from './gateway-contracts'

// ─── Result types ─────────────────────────────────────────────────────────────

export interface GatewayContractIssue {
  /** JSON path, e.g. `$.content[2].source.url`. */
  path: string
  message: string
}

export interface GatewayValidationResult<T> {
  ok: boolean
  value?: T
  issues: GatewayContractIssue[]
}

export class GatewayContractValidationError extends Error {
  readonly contract: string
  readonly issues: GatewayContractIssue[]

  constructor(contract: string, issues: GatewayContractIssue[]) {
    super(`${contract} validation failed: ${issues.map(issue => `${issue.path} ${issue.message}`).join('; ')}`)
    this.name = 'GatewayContractValidationError'
    this.contract = contract
    this.issues = issues
  }
}

// ─── Primitive helpers ────────────────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>

interface IssueSink {
  issues: GatewayContractIssue[]
}

interface NumberOptions {
  min?: number
  max?: number
  exclusiveMin?: number
  integer?: boolean
}

function fail(sink: IssueSink, path: string, message: string): void {
  sink.issues.push({ path, message })
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordValue(value: unknown, path: string, sink: IssueSink): value is UnknownRecord {
  if (isRecord(value)) return true
  fail(sink, path, 'must be an object')
  return false
}

function stringValue(
  value: unknown,
  path: string,
  sink: IssueSink,
  options: { nonEmpty?: boolean } = {},
): value is string {
  if (typeof value !== 'string') {
    fail(sink, path, 'must be a string')
    return false
  }
  if (options.nonEmpty !== false && value.length === 0) {
    fail(sink, path, 'must be a non-empty string')
    return false
  }
  return true
}

function optionalString(value: unknown, path: string, sink: IssueSink, options: { nonEmpty?: boolean } = {}): void {
  if (value !== undefined) stringValue(value, path, sink, options)
}

function numberValue(value: unknown, path: string, sink: IssueSink, options: NumberOptions = {}): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(sink, path, 'must be a finite number')
    return false
  }
  if (options.integer && !Number.isInteger(value)) {
    fail(sink, path, 'must be an integer')
    return false
  }
  if (options.min !== undefined && value < options.min) {
    fail(sink, path, `must be >= ${options.min}`)
    return false
  }
  if (options.max !== undefined && value > options.max) {
    fail(sink, path, `must be <= ${options.max}`)
    return false
  }
  if (options.exclusiveMin !== undefined && value <= options.exclusiveMin) {
    fail(sink, path, `must be > ${options.exclusiveMin}`)
    return false
  }
  return true
}

function optionalNumber(value: unknown, path: string, sink: IssueSink, options: NumberOptions = {}): void {
  if (value !== undefined) numberValue(value, path, sink, options)
}

function booleanValue(value: unknown, path: string, sink: IssueSink): value is boolean {
  if (typeof value === 'boolean') return true
  fail(sink, path, 'must be a boolean')
  return false
}

function optionalBoolean(value: unknown, path: string, sink: IssueSink): void {
  if (value !== undefined) booleanValue(value, path, sink)
}

function arrayValue(
  value: unknown,
  path: string,
  sink: IssueSink,
  options: { minLength?: number } = {},
): value is unknown[] {
  if (!Array.isArray(value)) {
    fail(sink, path, 'must be an array')
    return false
  }
  if (options.minLength !== undefined && value.length < options.minLength) {
    fail(sink, path, `must contain at least ${options.minLength} item(s)`)
    return false
  }
  return true
}

function stringArrayValue(value: unknown, path: string, sink: IssueSink): value is string[] {
  if (!arrayValue(value, path, sink)) return false
  let ok = true
  value.forEach((item, index) => {
    if (!stringValue(item, `${path}[${index}]`, sink)) ok = false
  })
  return ok
}

function stringRecordValue(value: unknown, path: string, sink: IssueSink): value is Record<string, string> {
  if (!recordValue(value, path, sink)) return false
  let ok = true
  for (const [key, item] of Object.entries(value)) {
    if (!stringValue(item, `${path}.${key}`, sink)) ok = false
  }
  return ok
}

function oneOfValue<T extends string>(
  value: unknown,
  path: string,
  sink: IssueSink,
  allowed: readonly T[],
): value is T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return true
  fail(sink, path, `must be one of: ${allowed.join(', ')}`)
  return false
}

function buildResult<T>(value: unknown, sink: IssueSink): GatewayValidationResult<T> {
  return sink.issues.length === 0
    ? { ok: true, value: value as T, issues: [] }
    : { ok: false, issues: sink.issues }
}

// ─── Shared validators ────────────────────────────────────────────────────────

function validateIsolationScope(value: UnknownRecord, path: string, sink: IssueSink): void {
  oneOfValue(value.platform, `${path}.platform`, sink, GATEWAY_PLATFORMS)
  stringValue(value.botId, `${path}.botId`, sink)
  optionalString(value.tenantId, `${path}.tenantId`, sink)
  optionalString(value.gatewayId, `${path}.gatewayId`, sink)
}

function validateTraceContext(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  optionalString(value.traceId, `${path}.traceId`, sink)
  optionalString(value.spanId, `${path}.spanId`, sink)
  optionalString(value.parentSpanId, `${path}.parentSpanId`, sink)
}

function validateMediaSource(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  const source = value.source
  if (!oneOfValue(source, `${path}.source`, sink, MEDIA_SOURCE_KINDS)) return

  switch (source) {
  case 'url':
    stringValue(value.url, `${path}.url`, sink)
    break
  case 'base64':
    stringValue(value.data, `${path}.data`, sink)
    stringValue(value.mimeType, `${path}.mimeType`, sink)
    break
  case 'file_id':
    stringValue(value.fileId, `${path}.fileId`, sink)
    break
  }
}

function validateGatewayError(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  oneOfValue(value.code, `${path}.code`, sink, GATEWAY_ERROR_CODES)
  stringValue(value.message, `${path}.message`, sink)
  booleanValue(value.retryable, `${path}.retryable`, sink)
  if (value.kind !== undefined) oneOfValue(value.kind, `${path}.kind`, sink, AGENT_ERROR_KINDS)
  if (value.details !== undefined) recordValue(value.details, `${path}.details`, sink)
}

// ─── Inbound message ──────────────────────────────────────────────────────────

function validateInboundSender(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  stringValue(value.id, `${path}.id`, sink)
  optionalString(value.nickname, `${path}.nickname`, sink)
  optionalString(value.card, `${path}.card`, sink)
  oneOfValue(value.role, `${path}.role`, sink, INBOUND_SENDER_ROLES)
  optionalBoolean(value.isBot, `${path}.isBot`, sink)
  optionalString(value.avatarUrl, `${path}.avatarUrl`, sink)
  optionalString(value.locale, `${path}.locale`, sink)
}

function validateInboundContent(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  const contentType = value.type
  if (!oneOfValue(contentType, `${path}.type`, sink, INBOUND_CONTENT_TYPES)) return

  switch (contentType) {
  case 'text':
    stringValue(value.text, `${path}.text`, sink, { nonEmpty: false })
    break
  case 'image':
    validateMediaSource(value.source, `${path}.source`, sink)
    optionalString(value.mimeType, `${path}.mimeType`, sink)
    optionalString(value.alt, `${path}.alt`, sink)
    optionalNumber(value.width, `${path}.width`, sink, { min: 0, integer: true })
    optionalNumber(value.height, `${path}.height`, sink, { min: 0, integer: true })
    break
  case 'audio':
    validateMediaSource(value.source, `${path}.source`, sink)
    optionalString(value.mimeType, `${path}.mimeType`, sink)
    optionalNumber(value.durationMs, `${path}.durationMs`, sink, { min: 0 })
    optionalString(value.transcript, `${path}.transcript`, sink, { nonEmpty: false })
    break
  case 'video':
    validateMediaSource(value.source, `${path}.source`, sink)
    optionalString(value.mimeType, `${path}.mimeType`, sink)
    optionalNumber(value.durationMs, `${path}.durationMs`, sink, { min: 0 })
    optionalNumber(value.width, `${path}.width`, sink, { min: 0, integer: true })
    optionalNumber(value.height, `${path}.height`, sink, { min: 0, integer: true })
    break
  case 'file':
    validateMediaSource(value.source, `${path}.source`, sink)
    optionalString(value.name, `${path}.name`, sink)
    optionalString(value.mimeType, `${path}.mimeType`, sink)
    optionalNumber(value.sizeBytes, `${path}.sizeBytes`, sink, { min: 0, integer: true })
    break
  case 'mention':
    stringValue(value.userId, `${path}.userId`, sink)
    optionalString(value.displayName, `${path}.displayName`, sink)
    optionalBoolean(value.all, `${path}.all`, sink)
    break
  case 'reply':
    stringValue(value.messageId, `${path}.messageId`, sink)
    optionalString(value.senderId, `${path}.senderId`, sink)
    optionalString(value.excerpt, `${path}.excerpt`, sink, { nonEmpty: false })
    break
  case 'face':
    stringValue(value.faceId, `${path}.faceId`, sink)
    optionalString(value.text, `${path}.text`, sink, { nonEmpty: false })
    break
  case 'location':
    numberValue(value.latitude, `${path}.latitude`, sink, { min: -90, max: 90 })
    numberValue(value.longitude, `${path}.longitude`, sink, { min: -180, max: 180 })
    optionalString(value.name, `${path}.name`, sink)
    optionalString(value.address, `${path}.address`, sink)
    break
  case 'unknown':
    stringValue(value.rawType, `${path}.rawType`, sink)
    // `raw` is intentionally opaque.
    break
  }
}

function validateInboundMessageInto(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return

  validateIsolationScope(value, path, sink)
  stringValue(value.messageId, `${path}.messageId`, sink)
  stringValue(value.sessionId, `${path}.sessionId`, sink)
  oneOfValue(value.kind, `${path}.kind`, sink, GATEWAY_CONVERSATION_KINDS)
  numberValue(value.timestamp, `${path}.timestamp`, sink, { min: 0 })

  if (recordValue(value.sender, `${path}.sender`, sink)) {
    validateInboundSender(value.sender, `${path}.sender`, sink)
  }

  if (arrayValue(value.content, `${path}.content`, sink, { minLength: 1 })) {
    value.content.forEach((item, index) => validateInboundContent(item, `${path}.content[${index}]`, sink))
  }

  optionalNumber(value.receivedAt, `${path}.receivedAt`, sink, { min: 0 })
  optionalString(value.conversationId, `${path}.conversationId`, sink)
  optionalString(value.threadId, `${path}.threadId`, sink)
  optionalString(value.parentMessageId, `${path}.parentMessageId`, sink)
  optionalString(value.groupId, `${path}.groupId`, sink)
  optionalString(value.groupName, `${path}.groupName`, sink)
  optionalString(value.channelId, `${path}.channelId`, sink)
  optionalString(value.channelName, `${path}.channelName`, sink)
  optionalString(value.locale, `${path}.locale`, sink)
  optionalBoolean(value.mentionedBot, `${path}.mentionedBot`, sink)
  optionalString(value.idempotencyKey, `${path}.idempotencyKey`, sink)
  if (value.metadata !== undefined) recordValue(value.metadata, `${path}.metadata`, sink)
  if (value.traceId !== undefined || value.spanId !== undefined || value.parentSpanId !== undefined) {
    validateTraceContext(value, path, sink)
  }
}

export function validateInboundMessage(value: unknown): GatewayValidationResult<InboundMessage> {
  const sink: IssueSink = { issues: [] }
  validateInboundMessageInto(value, '$', sink)
  return buildResult<InboundMessage>(value, sink)
}

export function isInboundMessage(value: unknown): value is InboundMessage {
  return validateInboundMessage(value).ok
}

export function assertInboundMessage(value: unknown): asserts value is InboundMessage {
  const result = validateInboundMessage(value)
  if (!result.ok) throw new GatewayContractValidationError('InboundMessage', result.issues)
}

// ─── Outbound events ──────────────────────────────────────────────────────────

function validateGatewayUsage(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  optionalNumber(value.promptTokens, `${path}.promptTokens`, sink, { min: 0, integer: true })
  optionalNumber(value.completionTokens, `${path}.completionTokens`, sink, { min: 0, integer: true })
  optionalNumber(value.totalTokens, `${path}.totalTokens`, sink, { min: 0, integer: true })
  optionalNumber(value.cachedTokens, `${path}.cachedTokens`, sink, { min: 0, integer: true })
  optionalNumber(value.reasoningTokens, `${path}.reasoningTokens`, sink, { min: 0, integer: true })
}

function validateCitation(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  stringValue(value.title, `${path}.title`, sink)
  stringValue(value.url, `${path}.url`, sink)
  optionalString(value.excerpt, `${path}.excerpt`, sink, { nonEmpty: false })
}

function validateReplyPart(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  const partType = value.type
  if (!oneOfValue(partType, `${path}.type`, sink, OUTBOUND_REPLY_PART_TYPES)) return

  switch (partType) {
  case 'text':
    stringValue(value.text, `${path}.text`, sink, { nonEmpty: false })
    break
  case 'markdown':
    stringValue(value.markdown, `${path}.markdown`, sink, { nonEmpty: false })
    break
  case 'image':
    validateMediaSource(value.source, `${path}.source`, sink)
    optionalString(value.alt, `${path}.alt`, sink)
    break
  case 'audio':
    validateMediaSource(value.source, `${path}.source`, sink)
    optionalNumber(value.durationMs, `${path}.durationMs`, sink, { min: 0 })
    break
  case 'video':
    validateMediaSource(value.source, `${path}.source`, sink)
    optionalNumber(value.durationMs, `${path}.durationMs`, sink, { min: 0 })
    break
  case 'file':
    validateMediaSource(value.source, `${path}.source`, sink)
    optionalString(value.name, `${path}.name`, sink)
    optionalString(value.mimeType, `${path}.mimeType`, sink)
    break
  }
}

function validateOutboundEventInto(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return

  validateIsolationScope(value, path, sink)
  stringValue(value.eventId, `${path}.eventId`, sink)
  stringValue(value.sessionId, `${path}.sessionId`, sink)
  numberValue(value.sequence, `${path}.sequence`, sink, { min: 0, integer: true })
  numberValue(value.timestamp, `${path}.timestamp`, sink, { min: 0 })
  optionalString(value.replyToMessageId, `${path}.replyToMessageId`, sink)
  optionalString(value.runId, `${path}.runId`, sink)
  if (value.traceId !== undefined || value.spanId !== undefined || value.parentSpanId !== undefined) {
    validateTraceContext(value, path, sink)
  }

  const eventType = value.type
  if (!oneOfValue(eventType, `${path}.type`, sink, OUTBOUND_EVENT_TYPES)) return

  switch (eventType) {
  case 'typing':
    oneOfValue(value.state, `${path}.state`, sink, TYPING_STATES)
    optionalNumber(value.durationMs, `${path}.durationMs`, sink, { min: 0 })
    break

  case 'thought_chunk':
    stringValue(value.delta, `${path}.delta`, sink, { nonEmpty: false })
    optionalNumber(value.index, `${path}.index`, sink, { min: 0, integer: true })
    optionalBoolean(value.done, `${path}.done`, sink)
    optionalString(value.signature, `${path}.signature`, sink)
    break

  case 'text_chunk':
    stringValue(value.delta, `${path}.delta`, sink, { nonEmpty: false })
    optionalNumber(value.index, `${path}.index`, sink, { min: 0, integer: true })
    optionalBoolean(value.done, `${path}.done`, sink)
    break

  case 'tool_status': {
    stringValue(value.toolCallId, `${path}.toolCallId`, sink)
    stringValue(value.toolName, `${path}.toolName`, sink)
    oneOfValue(value.status, `${path}.status`, sink, TOOL_STATUS_STATES)
    optionalNumber(value.attempt, `${path}.attempt`, sink, { min: 1, integer: true })
    optionalString(value.argsPreview, `${path}.argsPreview`, sink, { nonEmpty: false })
    optionalString(value.resultPreview, `${path}.resultPreview`, sink, { nonEmpty: false })
    if (value.error !== undefined) validateGatewayError(value.error, `${path}.error`, sink)
    const startedAt = value.startedAt
    const completedAt = value.completedAt
    optionalNumber(startedAt, `${path}.startedAt`, sink, { min: 0 })
    optionalNumber(completedAt, `${path}.completedAt`, sink, { min: 0 })
    if (
      typeof startedAt === 'number' &&
        typeof completedAt === 'number' &&
        Number.isFinite(startedAt) &&
        Number.isFinite(completedAt) &&
        completedAt < startedAt
    ) {
      fail(sink, `${path}.completedAt`, 'must be >= startedAt')
    }
    break
  }

  case 'approval_request':
    validateHumanApprovalRequestInto(value.request, `${path}.request`, sink)
    // Isolation is part of the protocol: a request embedded in an event must
    // belong to exactly the same platform/bot/session as the event itself.
    if (isRecord(value.request)) {
      const request = value.request
      if (typeof request.platform === 'string' && typeof value.platform === 'string' && request.platform !== value.platform) {
        fail(sink, `${path}.request.platform`, 'must match the event platform')
      }
      if (typeof request.botId === 'string' && typeof value.botId === 'string' && request.botId !== value.botId) {
        fail(sink, `${path}.request.botId`, 'must match the event botId')
      }
      if (typeof request.sessionId === 'string' && typeof value.sessionId === 'string' && request.sessionId !== value.sessionId) {
        fail(sink, `${path}.request.sessionId`, 'must match the event sessionId')
      }
    }
    break

  case 'final_reply': {
    optionalString(value.messageId, `${path}.messageId`, sink)
    oneOfValue(value.finishReason, `${path}.finishReason`, sink, FINAL_REPLY_FINISH_REASONS)
    if (arrayValue(value.parts, `${path}.parts`, sink)) {
      value.parts.forEach((part, index) => validateReplyPart(part, `${path}.parts[${index}]`, sink))
    }
    const hasText = typeof value.text === 'string' && value.text.length > 0
    if (value.text !== undefined) stringValue(value.text, `${path}.text`, sink, { nonEmpty: false })
    if (Array.isArray(value.parts) && value.parts.length === 0 && !hasText) {
      fail(sink, `${path}.parts`, 'final_reply requires at least one part or non-empty text')
    }
    if (value.usage !== undefined) validateGatewayUsage(value.usage, `${path}.usage`, sink)
    if (value.citations !== undefined) {
      if (arrayValue(value.citations, `${path}.citations`, sink)) {
        value.citations.forEach((citation, index) => validateCitation(citation, `${path}.citations[${index}]`, sink))
      }
    }
    break
  }

  case 'error':
    validateGatewayError(value.error, `${path}.error`, sink)
    booleanValue(value.fatal, `${path}.fatal`, sink)
    break
  }
}

export function validateOutboundEvent(value: unknown): GatewayValidationResult<OutboundEvent> {
  const sink: IssueSink = { issues: [] }
  validateOutboundEventInto(value, '$', sink)
  return buildResult<OutboundEvent>(value, sink)
}

export function isOutboundEvent(value: unknown): value is OutboundEvent {
  return validateOutboundEvent(value).ok
}

export function assertOutboundEvent(value: unknown): asserts value is OutboundEvent {
  const result = validateOutboundEvent(value)
  if (!result.ok) throw new GatewayContractValidationError('OutboundEvent', result.issues)
}

// ─── Human approvals ──────────────────────────────────────────────────────────

function validateApprovalIntegrity(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  if (value.algorithm !== 'sha256') {
    fail(sink, `${path}.algorithm`, 'must be "sha256"')
  }
  if (stringValue(value.digest, `${path}.digest`, sink) && !/^[a-f0-9]{64}$/i.test(value.digest)) {
    fail(sink, `${path}.digest`, 'must be a 64-character hex SHA-256 digest')
  }
}

function validateApprovalAction(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  const kind = value.kind
  if (!oneOfValue(kind, `${path}.kind`, sink, APPROVAL_ACTION_KINDS)) return

  switch (kind) {
  case 'tool_call':
    stringValue(value.toolName, `${path}.toolName`, sink)
    recordValue(value.arguments, `${path}.arguments`, sink)
    if (value.source !== undefined) oneOfValue(value.source, `${path}.source`, sink, AGENT_TOOL_SOURCES)
    break

  case 'file_write':
    stringValue(value.path, `${path}.path`, sink)
    oneOfValue(value.operation, `${path}.operation`, sink, FILE_WRITE_OPERATIONS)
    optionalString(value.diff, `${path}.diff`, sink, { nonEmpty: false })
    optionalNumber(value.sizeBytes, `${path}.sizeBytes`, sink, { min: 0, integer: true })
    break

  case 'shell_command':
    stringValue(value.command, `${path}.command`, sink)
    if (value.args !== undefined) stringArrayValue(value.args, `${path}.args`, sink)
    optionalString(value.cwd, `${path}.cwd`, sink)
    break

  case 'network_request':
    oneOfValue(value.method, `${path}.method`, sink, NETWORK_REQUEST_METHODS)
    if (stringValue(value.url, `${path}.url`, sink)) {
      try {
        const url = new URL(value.url)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          fail(sink, `${path}.url`, 'must use http or https')
        }
      } catch {
        fail(sink, `${path}.url`, 'must be an absolute URL')
      }
    }
    if (value.headers !== undefined) stringRecordValue(value.headers, `${path}.headers`, sink)
    optionalString(value.bodyPreview, `${path}.bodyPreview`, sink, { nonEmpty: false })
    break

  case 'external_side_effect':
    stringValue(value.target, `${path}.target`, sink)
    stringValue(value.description, `${path}.description`, sink)
    break

  case 'custom':
    stringValue(value.name, `${path}.name`, sink)
    recordValue(value.payload, `${path}.payload`, sink)
    break
  }
}

function validateApprovalOption(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  oneOfValue(value.id, `${path}.id`, sink, APPROVAL_OPTION_IDS)
  stringValue(value.label, `${path}.label`, sink)
  oneOfValue(value.outcome, `${path}.outcome`, sink, APPROVAL_OPTION_OUTCOMES)
  if (value.scope !== undefined) oneOfValue(value.scope, `${path}.scope`, sink, APPROVAL_SCOPES)
  optionalBoolean(value.requiresReason, `${path}.requiresReason`, sink)
  optionalBoolean(value.destructive, `${path}.destructive`, sink)
}

function validateApprovalRequestedBy(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  stringValue(value.id, `${path}.id`, sink)
  oneOfValue(value.kind, `${path}.kind`, sink, APPROVAL_REQUESTER_KINDS)
  optionalString(value.displayName, `${path}.displayName`, sink)
}

function validateHumanApprovalRequestInto(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return

  validateIsolationScope(value, path, sink)
  stringValue(value.requestId, `${path}.requestId`, sink)
  stringValue(value.sessionId, `${path}.sessionId`, sink)
  optionalString(value.runId, `${path}.runId`, sink)
  optionalString(value.taskId, `${path}.taskId`, sink)
  stringValue(value.title, `${path}.title`, sink)
  stringValue(value.summary, `${path}.summary`, sink)
  oneOfValue(value.riskLevel, `${path}.riskLevel`, sink, APPROVAL_RISK_LEVELS)
  validateApprovalAction(value.action, `${path}.action`, sink)

  if (arrayValue(value.options, `${path}.options`, sink, { minLength: 1 })) {
    const seen = new Set<string>()
    value.options.forEach((option, index) => {
      const optionPath = `${path}.options[${index}]`
      validateApprovalOption(option, optionPath, sink)
      if (isRecord(option) && typeof option.id === 'string') {
        if (seen.has(option.id)) {
          fail(sink, `${optionPath}.id`, `duplicate approval option id "${option.id}"`)
        }
        seen.add(option.id)
      }
    })
  }

  const createdAt = value.createdAt
  const expiresAt = value.expiresAt
  optionalNumber(createdAt, `${path}.createdAt`, sink, { min: 0 })
  optionalNumber(expiresAt, `${path}.expiresAt`, sink, { min: 0 })
  if (
    typeof createdAt === 'number' &&
    typeof expiresAt === 'number' &&
    Number.isFinite(createdAt) &&
    Number.isFinite(expiresAt) &&
    expiresAt <= createdAt
  ) {
    fail(sink, `${path}.expiresAt`, 'must be greater than createdAt')
  }

  validateApprovalRequestedBy(value.requestedBy, `${path}.requestedBy`, sink)
  validateApprovalIntegrity(value.integrity, `${path}.integrity`, sink)

  if (value.context !== undefined && recordValue(value.context, `${path}.context`, sink)) {
    optionalString(value.context.reason, `${path}.context.reason`, sink)
    if (value.context.evidence !== undefined) stringArrayValue(value.context.evidence, `${path}.context.evidence`, sink)
    if (value.context.affectedResources !== undefined) {
      stringArrayValue(value.context.affectedResources, `${path}.context.affectedResources`, sink)
    }
  }
  if (value.metadata !== undefined) recordValue(value.metadata, `${path}.metadata`, sink)
}

export function validateHumanApprovalRequest(value: unknown): GatewayValidationResult<HumanApprovalRequest> {
  const sink: IssueSink = { issues: [] }
  validateHumanApprovalRequestInto(value, '$', sink)
  return buildResult<HumanApprovalRequest>(value, sink)
}

export function isHumanApprovalRequest(value: unknown): value is HumanApprovalRequest {
  return validateHumanApprovalRequest(value).ok
}

export function assertHumanApprovalRequest(value: unknown): asserts value is HumanApprovalRequest {
  const result = validateHumanApprovalRequest(value)
  if (!result.ok) throw new GatewayContractValidationError('HumanApprovalRequest', result.issues)
}

function validateApprovalResponder(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  oneOfValue(value.platform, `${path}.platform`, sink, GATEWAY_PLATFORMS)
  stringValue(value.userId, `${path}.userId`, sink)
  oneOfValue(value.role, `${path}.role`, sink, INBOUND_SENDER_ROLES)
  optionalString(value.displayName, `${path}.displayName`, sink)
}

function validateApprovalResponseInto(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return

  stringValue(value.requestId, `${path}.requestId`, sink)
  stringValue(value.botId, `${path}.botId`, sink)
  stringValue(value.sessionId, `${path}.sessionId`, sink)
  const decisionValid = oneOfValue(value.decision, `${path}.decision`, sink, APPROVAL_DECISIONS)

  if (value.scope !== undefined) {
    oneOfValue(value.scope, `${path}.scope`, sink, APPROVAL_SCOPES)
    if (decisionValid && value.decision !== 'approved') {
      fail(sink, `${path}.scope`, 'is only allowed when decision is "approved"')
    }
  }

  validateApprovalResponder(value.responder, `${path}.responder`, sink)
  numberValue(value.respondedAt, `${path}.respondedAt`, sink, { min: 0 })

  if (value.optionId !== undefined) oneOfValue(value.optionId, `${path}.optionId`, sink, APPROVAL_OPTION_IDS)
  optionalString(value.reason, `${path}.reason`, sink, { nonEmpty: false })

  if (value.editedAction !== undefined) {
    validateApprovalAction(value.editedAction, `${path}.editedAction`, sink)
    if (decisionValid && value.decision !== 'approved') {
      fail(sink, `${path}.editedAction`, 'is only allowed when decision is "approved"')
    }
  }

  if (value.requestDigest !== undefined) validateApprovalIntegrity(value.requestDigest, `${path}.requestDigest`, sink)
  if (value.metadata !== undefined) recordValue(value.metadata, `${path}.metadata`, sink)
}

export function validateApprovalResponse(value: unknown): GatewayValidationResult<ApprovalResponse> {
  const sink: IssueSink = { issues: [] }
  validateApprovalResponseInto(value, '$', sink)
  return buildResult<ApprovalResponse>(value, sink)
}

export function isApprovalResponse(value: unknown): value is ApprovalResponse {
  return validateApprovalResponse(value).ok
}

export function assertApprovalResponse(value: unknown): asserts value is ApprovalResponse {
  const result = validateApprovalResponse(value)
  if (!result.ok) throw new GatewayContractValidationError('ApprovalResponse', result.issues)
}

// ─── Fusion task spec ─────────────────────────────────────────────────────────

function validateFusionToolTarget(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  stringValue(value.name, `${path}.name`, sink)
  if (value.source !== undefined) oneOfValue(value.source, `${path}.source`, sink, AGENT_TOOL_SOURCES)
  optionalString(value.server, `${path}.server`, sink)
  optionalBoolean(value.required, `${path}.required`, sink)
  optionalString(value.notes, `${path}.notes`, sink)
}

function validateFusionDiffSchema(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  oneOfValue(value.format, `${path}.format`, sink, FUSION_DIFF_FORMATS)
  if (value.path_scope !== undefined) stringArrayValue(value.path_scope, `${path}.path_scope`, sink)
  if (value.required_fields !== undefined) stringArrayValue(value.required_fields, `${path}.required_fields`, sink)
  if (value.schema !== undefined) recordValue(value.schema, `${path}.schema`, sink)
  optionalNumber(value.max_files, `${path}.max_files`, sink, { min: 1, integer: true })
  optionalNumber(value.max_changed_lines, `${path}.max_changed_lines`, sink, { min: 0, integer: true })
  optionalBoolean(value.allow_binary, `${path}.allow_binary`, sink)
}

function validateFusionTaskSpecInto(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return

  stringValue(value.task_id, `${path}.task_id`, sink)
  optionalString(value.parent_task_id, `${path}.parent_task_id`, sink)
  stringValue(value.session_id, `${path}.session_id`, sink)
  optionalString(value.parent_run_id, `${path}.parent_run_id`, sink)
  stringValue(value.instruction, `${path}.instruction`, sink)
  optionalString(value.context, `${path}.context`, sink, { nonEmpty: false })
  if (value.constraints !== undefined) stringArrayValue(value.constraints, `${path}.constraints`, sink)

  if (arrayValue(value.target_tools, `${path}.target_tools`, sink, { minLength: 1 })) {
    value.target_tools.forEach((tool, index) => {
      validateFusionToolTarget(tool, `${path}.target_tools[${index}]`, sink)
    })
  }

  validateFusionDiffSchema(value.diff_schema, `${path}.diff_schema`, sink)

  if (arrayValue(value.review_criteria, `${path}.review_criteria`, sink, { minLength: 1 })) {
    const seen = new Set<string>()
    let weightSum = 0
    let allWeightsValid = true

    value.review_criteria.forEach((criterion, index) => {
      const criterionPath = `${path}.review_criteria[${index}]`
      if (!recordValue(criterion, criterionPath, sink)) {
        allWeightsValid = false
        return
      }

      const id = criterion.id
      if (stringValue(id, `${criterionPath}.id`, sink)) {
        if (seen.has(id)) {
          fail(sink, `${criterionPath}.id`, `duplicate review criterion id "${id}"`)
        }
        seen.add(id)
      }

      stringValue(criterion.description, `${criterionPath}.description`, sink)
      const weight = criterion.weight
      if (numberValue(weight, `${criterionPath}.weight`, sink, { min: 0, max: 1 })) {
        weightSum += weight
      } else {
        allWeightsValid = false
      }

      optionalBoolean(criterion.required, `${criterionPath}.required`, sink)
      if (criterion.evaluator !== undefined) {
        oneOfValue(criterion.evaluator, `${criterionPath}.evaluator`, sink, FUSION_REVIEW_EVALUATORS)
      }
      optionalString(criterion.pass_condition, `${criterionPath}.pass_condition`, sink, { nonEmpty: false })
    })

    if (allWeightsValid && Math.abs(weightSum - 1) > 1e-6) {
      fail(sink, `${path}.review_criteria`, `weights must sum to 1 (received ${weightSum})`)
    }
  }

  if (value.delegation !== undefined && recordValue(value.delegation, `${path}.delegation`, sink)) {
    optionalString(value.delegation.reason, `${path}.delegation.reason`, sink)
    optionalNumber(value.delegation.confidence, `${path}.delegation.confidence`, sink, { min: 0, max: 1 })
  }

  if (value.budget !== undefined && recordValue(value.budget, `${path}.budget`, sink)) {
    optionalNumber(value.budget.max_tool_calls, `${path}.budget.max_tool_calls`, sink, { min: 0, integer: true })
    optionalNumber(value.budget.max_wall_clock_ms, `${path}.budget.max_wall_clock_ms`, sink, { min: 0, integer: true })
    optionalNumber(value.budget.max_tokens, `${path}.budget.max_tokens`, sink, { min: 1, integer: true })
    optionalNumber(value.budget.max_attempts, `${path}.budget.max_attempts`, sink, { min: 1, integer: true })
  }

  const createdAt = value.created_at
  const deadlineAt = value.deadline_at
  optionalNumber(createdAt, `${path}.created_at`, sink, { min: 0 })
  optionalNumber(deadlineAt, `${path}.deadline_at`, sink, { min: 0 })
  if (
    typeof createdAt === 'number' &&
    typeof deadlineAt === 'number' &&
    Number.isFinite(createdAt) &&
    Number.isFinite(deadlineAt) &&
    deadlineAt <= createdAt
  ) {
    fail(sink, `${path}.deadline_at`, 'must be greater than created_at')
  }

  if (value.metadata !== undefined) recordValue(value.metadata, `${path}.metadata`, sink)
}

export function validateFusionTaskSpec(value: unknown): GatewayValidationResult<FusionTaskSpec> {
  const sink: IssueSink = { issues: [] }
  validateFusionTaskSpecInto(value, '$', sink)
  return buildResult<FusionTaskSpec>(value, sink)
}

export function isFusionTaskSpec(value: unknown): value is FusionTaskSpec {
  return validateFusionTaskSpec(value).ok
}

export function assertFusionTaskSpec(value: unknown): asserts value is FusionTaskSpec {
  const result = validateFusionTaskSpec(value)
  if (!result.ok) throw new GatewayContractValidationError('FusionTaskSpec', result.issues)
}

// ─── Evolution trace ──────────────────────────────────────────────────────────

function validateEvolutionUserIntent(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  stringValue(value.raw, `${path}.raw`, sink)
  optionalString(value.normalized, `${path}.normalized`, sink, { nonEmpty: false })
  optionalString(value.category, `${path}.category`, sink)
  optionalNumber(value.confidence, `${path}.confidence`, sink, { min: 0, max: 1 })
  if (value.entities !== undefined) recordValue(value.entities, `${path}.entities`, sink)
}

function validateEvolutionToolError(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  oneOfValue(value.kind, `${path}.kind`, sink, AGENT_ERROR_KINDS)
  stringValue(value.message, `${path}.message`, sink)
  optionalString(value.code, `${path}.code`, sink)
}

function validateEvolutionToolCall(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return

  stringValue(value.callId, `${path}.callId`, sink)
  stringValue(value.name, `${path}.name`, sink)
  recordValue(value.arguments, `${path}.arguments`, sink)
  oneOfValue(value.status, `${path}.status`, sink, EVOLUTION_TOOL_CALL_STATUSES)
  numberValue(value.attempt, `${path}.attempt`, sink, { min: 1, integer: true })
  optionalString(value.resultPreview, `${path}.resultPreview`, sink, { nonEmpty: false })
  if (value.error !== undefined) validateEvolutionToolError(value.error, `${path}.error`, sink)
  if (value.source !== undefined) oneOfValue(value.source, `${path}.source`, sink, AGENT_TOOL_SOURCES)

  const startedAt = value.startedAt
  const completedAt = value.completedAt
  optionalNumber(startedAt, `${path}.startedAt`, sink, { min: 0 })
  optionalNumber(completedAt, `${path}.completedAt`, sink, { min: 0 })
  if (
    typeof startedAt === 'number' &&
    typeof completedAt === 'number' &&
    Number.isFinite(startedAt) &&
    Number.isFinite(completedAt) &&
    completedAt < startedAt
  ) {
    fail(sink, `${path}.completedAt`, 'must be >= startedAt')
  }
}

function validateEvolutionRetry(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return

  numberValue(value.attempt, `${path}.attempt`, sink, { min: 1, integer: true })
  optionalString(value.toolCallId, `${path}.toolCallId`, sink)
  stringValue(value.reason, `${path}.reason`, sink)
  if (value.errorKind !== undefined) oneOfValue(value.errorKind, `${path}.errorKind`, sink, AGENT_ERROR_KINDS)
  optionalNumber(value.backoffMs, `${path}.backoffMs`, sink, { min: 0 })
  booleanValue(value.recovered, `${path}.recovered`, sink)
  numberValue(value.occurredAt, `${path}.occurredAt`, sink, { min: 0 })
}

function validateEvolutionScores(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return
  for (const key of EVOLUTION_SCORE_KEYS) {
    const score = value[key]
    if (score === undefined) {
      fail(sink, `${path}.${key}`, 'is required')
    } else {
      numberValue(score, `${path}.${key}`, sink, { min: 0, max: 1 })
    }
  }
}

function validateEvolutionTraceInto(value: unknown, path: string, sink: IssueSink): void {
  if (!recordValue(value, path, sink)) return

  stringValue(value.traceId, `${path}.traceId`, sink)
  stringValue(value.sessionId, `${path}.sessionId`, sink)
  if (value.platform !== undefined) oneOfValue(value.platform, `${path}.platform`, sink, GATEWAY_PLATFORMS)
  optionalString(value.botId, `${path}.botId`, sink)

  validateEvolutionUserIntent(value.userIntent, `${path}.userIntent`, sink)
  oneOfValue(value.outcome, `${path}.outcome`, sink, EVOLUTION_OUTCOMES)

  if (arrayValue(value.toolCalls, `${path}.toolCalls`, sink)) {
    value.toolCalls.forEach((call, index) => validateEvolutionToolCall(call, `${path}.toolCalls[${index}]`, sink))
  }

  if (arrayValue(value.errorRetries, `${path}.errorRetries`, sink)) {
    value.errorRetries.forEach((retry, index) => validateEvolutionRetry(retry, `${path}.errorRetries[${index}]`, sink))
  }

  validateEvolutionScores(value.scores, `${path}.scores`, sink)
  stringValue(value.draftSkillMd, `${path}.draftSkillMd`, sink)
  optionalString(value.draftSkillName, `${path}.draftSkillName`, sink)
  optionalString(value.draftSkillPath, `${path}.draftSkillPath`, sink)
  if (value.lessons !== undefined) stringArrayValue(value.lessons, `${path}.lessons`, sink)
  if (value.approvalRequestIds !== undefined) {
    stringArrayValue(value.approvalRequestIds, `${path}.approvalRequestIds`, sink)
  }

  const startedAt = value.startedAt
  const completedAt = value.completedAt
  optionalNumber(startedAt, `${path}.startedAt`, sink, { min: 0 })
  optionalNumber(completedAt, `${path}.completedAt`, sink, { min: 0 })
  if (
    typeof startedAt === 'number' &&
    typeof completedAt === 'number' &&
    Number.isFinite(startedAt) &&
    Number.isFinite(completedAt) &&
    completedAt < startedAt
  ) {
    fail(sink, `${path}.completedAt`, 'must be >= startedAt')
  }

  if (value.metadata !== undefined) recordValue(value.metadata, `${path}.metadata`, sink)
}

export function validateEvolutionTrace(value: unknown): GatewayValidationResult<EvolutionTrace> {
  const sink: IssueSink = { issues: [] }
  validateEvolutionTraceInto(value, '$', sink)
  return buildResult<EvolutionTrace>(value, sink)
}

export function isEvolutionTrace(value: unknown): value is EvolutionTrace {
  return validateEvolutionTrace(value).ok
}

export function assertEvolutionTrace(value: unknown): asserts value is EvolutionTrace {
  const result = validateEvolutionTrace(value)
  if (!result.ok) throw new GatewayContractValidationError('EvolutionTrace', result.issues)
}
