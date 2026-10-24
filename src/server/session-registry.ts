import { randomUUID } from 'node:crypto'
import type {
  ApprovalDecision,
  ApprovalOptionId,
  ApprovalScope,
  GatewayErrorPayload,
  GatewayPlatform,
  HumanApprovalRequest,
} from '../agent/gateway-contracts'
import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError, WebApiError } from './errors'
import type {
  AgentEventDraft,
  AgentSessionInfo,
  AgentSessionSnapshot,
  AgentSessionStatus,
  AgentSessionTurnInfo,
  AgentWebEvent,
  ApprovalResponseLike,
  PromptDriverResult,
  PromptReceipt,
  PromptTurn,
  PromptTurnResult,
  SessionCreateInput,
  SessionListFilter,
  SessionPromptDriver,
} from './types'
import type { SessionPersistence, SessionRecord } from './session-persistence'

const DEFAULT_MAX_EVENTS = 800
const DEFAULT_MAX_EVENT_BYTES = 2 * 1024 * 1024
const MAX_PROMPT_CHARS = 256 * 1024
const MAX_TITLE_CHARS = 80

export interface SessionRegistryOptions {
  /** Driver used by production; tests can inject a deterministic fake. */
  driver?: SessionPromptDriver
  maxEvents?: number
  maxEventBytes?: number
  now?: () => number
  idFactory?: () => string
  /** Durable store so sessions, timelines and titles survive a restart. */
  persistence?: SessionPersistence
}

export interface ApprovalResponseInput {
  decision: ApprovalDecision
  scope?: ApprovalScope
  optionId?: ApprovalOptionId
  reason?: string
  respondedAt?: number
  /** Echoed back to the driver when present. */
  metadata?: Record<string, unknown>
}

interface PendingApproval {
  request: HumanApprovalRequest
  resolve: (response: ApprovalResponseLike) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout> | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function estimateEventBytes(event: AgentWebEvent): number {
  try {
    return JSON.stringify(event).length
  } catch {
    return 256
  }
}

function normaliseTitle(prompt: string): string {
  const oneLine = prompt.replace(/\s+/g, ' ').trim()
  return oneLine.length > MAX_TITLE_CHARS ? `${oneLine.slice(0, MAX_TITLE_CHARS - 1)}…` : oneLine
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'AbortError' || error.name === 'AbortSignal'
}

function toErrorPayload(error: unknown): GatewayErrorPayload {
  if (error instanceof WebApiError) {
    const code = error.status === 499
      ? 'CANCELLED'
      : error.status === 400
        ? 'BAD_REQUEST'
        : error.status === 401
          ? 'UNAUTHORIZED'
          : error.status === 403
            ? 'FORBIDDEN'
            : error.status === 409
              ? 'TOOL_ERROR'
              : error.status === 503
                ? 'UPSTREAM_ERROR'
                : 'INTERNAL_ERROR'
    return {
      code,
      message: error.message,
      retryable: error.status >= 500,
      details: isRecord(error.details) ? error.details : undefined,
    }
  }
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : String(error),
    retryable: false,
  }
}

/**
 * One live agent session. Owns its event ring buffer, listeners and pending
 * approvals. All mutations happen on the Node event loop, so no extra locking
 * is needed; the registry still rejects a second concurrent prompt explicitly.
 */
export class AgentSession {
  readonly id: string
  readonly platform: GatewayPlatform
  readonly botId: string
  createdAt: number

  private title: string
  private status: AgentSessionStatus = 'idle'
  private lastActiveAt: number
  private turnCount = 0
  private skills: string[]
  private model?: string
  private metadata: Record<string, unknown>
  private activeTurn?: AgentSessionTurnInfo
  private abortController: AbortController | null = null

  private lastSeq = 0
  private eventLog: AgentWebEvent[] = []
  private eventBytes = 0
  private truncated = false
  private lastFinalTurnId?: string
  private activeTurnText = ''

  private readonly listeners = new Set<(event: AgentWebEvent) => void>()
  private readonly pendingApprovals = new Map<string, PendingApproval>()

  private readonly now: () => number
  private readonly maxEvents: number
  private readonly maxEventBytes: number

  constructor(input: SessionCreateInput, options: SessionRegistryOptions = {}) {
    this.now = options.now ?? Date.now
    this.maxEvents = Math.max(1, options.maxEvents ?? DEFAULT_MAX_EVENTS)
    this.maxEventBytes = Math.max(1024, options.maxEventBytes ?? DEFAULT_MAX_EVENT_BYTES)
    this.id = input.id ?? randomUUID()
    this.platform = input.platform ?? 'web'
    this.botId = input.botId ?? 'web-console'
    this.title = input.title ?? 'New session'
    this.createdAt = this.now()
    this.lastActiveAt = this.createdAt
    this.skills = [...(input.skills ?? [])]
    this.model = input.model
    this.metadata = { ...(input.metadata ?? {}) }
  }

  get isStreaming(): boolean {
    return this.status === 'thinking' || this.status === 'streaming' || this.status === 'waiting_approval'
  }

  get isClosed(): boolean {
    return this.status === 'closed'
  }

  isAlive(): boolean {
    return this.status !== 'closed'
  }

  get currentStatus(): AgentSessionStatus {
    return this.status
  }

  get currentTurn(): AgentSessionTurnInfo | undefined {
    return this.activeTurn
  }

  get lastSequence(): number {
    return this.lastSeq
  }

  get mountedSkills(): string[] {
    return [...this.skills]
  }

  info(): AgentSessionInfo {
    return {
      id: this.id,
      platform: this.platform,
      botId: this.botId,
      title: this.title,
      status: this.status,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
      turnCount: this.turnCount,
      skills: [...this.skills],
      model: this.model,
      activeTurn: this.activeTurn ? { ...this.activeTurn } : undefined,
      pendingApprovalIds: [...this.pendingApprovals.keys()],
      lastSeq: this.lastSeq,
      eventCount: this.eventLog.length,
      metadata: { ...this.metadata },
    }
  }

  /** Serialise into a persistable record (events included, transient state dropped). */
  toRecord(): SessionRecord {
    return {
      version: 1,
      id: this.id,
      platform: this.platform,
      botId: this.botId,
      title: this.title,
      status: this.status,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
      turnCount: this.turnCount,
      skills: [...this.skills],
      model: this.model,
      metadata: { ...this.metadata },
      lastSeq: this.lastSeq,
      events: this.eventLog,
    }
  }

  /** Rehydrate a session from a persisted record. Interrupted turns come back as idle. */
  static restore(record: SessionRecord, options: SessionRegistryOptions = {}): AgentSession {
    const session = new AgentSession(
      {
        id: record.id,
        platform: record.platform as SessionCreateInput['platform'],
        botId: record.botId,
        title: record.title,
        skills: record.skills,
        model: record.model,
        metadata: record.metadata,
      },
      options,
    )
    session.createdAt = record.createdAt ?? session.createdAt
    session.turnCount = Math.max(0, record.turnCount ?? 0)
    session.lastActiveAt = record.lastActiveAt ?? session.createdAt
    session.status = record.status === 'closed' ? 'closed' : 'idle'
    const events = Array.isArray(record.events) ? record.events : []
    session.eventLog = events
    session.eventBytes = events.reduce((total, event) => total + estimateEventBytes(event), 0)
    session.lastSeq = Math.max(record.lastSeq ?? 0, events[events.length - 1]?.seq ?? 0)
    session.trimLog()
    return session
  }
  snapshot(options: { since?: number; limit?: number } = {}): AgentSessionSnapshot {
    const { since, limit = 500 } = options
    let events: AgentWebEvent[]
    if (since !== undefined && since > 0) {
      events = this.eventLog.filter(event => event.seq > since)
    } else {
      events = this.eventLog.slice(-Math.max(1, limit))
    }
    events = events.slice(-Math.max(1, limit))
    const firstAvailable = this.eventLog[0]?.seq
    const truncated = this.truncated
      || (since !== undefined && since > 0 && firstAvailable !== undefined && firstAvailable > since + 1)

    return {
      session: this.info(),
      activeTurn: this.activeTurn ? { ...this.activeTurn } : undefined,
      pendingApprovals: [...this.pendingApprovals.values()].map(item => item.request),
      events,
      lastSeq: this.lastSeq,
      isStreaming: this.isStreaming,
      truncated,
    }
  }

  onEvent(listener: (event: AgentWebEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  update(patch: Partial<Pick<SessionCreateInput, 'title' | 'model' | 'skills' | 'metadata'>>): void {
    if (patch.title !== undefined) this.title = patch.title
    if (patch.model !== undefined) this.model = patch.model
    if (patch.skills !== undefined) this.skills = [...patch.skills]
    if (patch.metadata !== undefined) this.metadata = { ...this.metadata, ...patch.metadata }
    this.lastActiveAt = this.now()
  }

  /** Append one event, assign its sequence id, trim the log and notify streams. */
  append(draft: AgentEventDraft): AgentWebEvent {
    const turnId = draft.turnId ?? this.activeTurn?.id
    const base = {
      eventId: randomUUID(),
      sessionId: this.id,
      platform: this.platform,
      botId: this.botId,
      seq: ++this.lastSeq,
      timestamp: this.now(),
      ...(turnId ? { turnId } : {}),
    }

    const event = {
      ...base,
      ...draft,
      ...(draft.type === 'error' ? { fatal: draft.fatal ?? false } : {}),
    } as AgentWebEvent
    if (event.type === 'text_chunk') {
      this.activeTurnText += event.delta
    }
    if (event.type === 'final_reply') {
      this.lastFinalTurnId = event.turnId ?? this.activeTurn?.id
      if (event.text === undefined) {
        event.text = event.parts
          .map(part => (part.type === 'markdown' ? part.markdown : part.type === 'text' ? part.text : ''))
          .filter(Boolean)
          .join('\n')
      }
    }

    this.eventLog.push(event)
    this.eventBytes += estimateEventBytes(event)
    this.trimLog()
    this.lastActiveAt = event.timestamp

    for (const listener of [...this.listeners]) {
      try {
        listener(event)
      } catch {
        // A broken SSE consumer must never break the agent loop.
      }
    }
    return event
  }

  private trimLog(): void {
    while (this.eventLog.length > this.maxEvents || (this.eventBytes > this.maxEventBytes && this.eventLog.length > 1)) {
      const removed = this.eventLog.shift()
      if (!removed) break
      this.eventBytes -= estimateEventBytes(removed)
      this.truncated = true
    }
    if (this.eventBytes < 0) this.eventBytes = 0
  }

  hasFinalForTurn(turnId: string): boolean {
    return this.lastFinalTurnId === turnId
  }

  beginTurn(
    turnId: string,
    prompt: string,
    options: {
      model?: string
      skillName?: string
      thinkingLevel?: 'none' | 'low' | 'medium' | 'high' | 'max'
      reasoningEffort?: string
    } = {},
  ): AgentSessionTurnInfo {
    if (this.activeTurn) {
      throw new ConflictError('Session already has an active turn', { code: 'SESSION_BUSY' })
    }
    this.turnCount += 1
    this.activeTurn = {
      id: turnId,
      prompt,
      startedAt: this.now(),
      model: options.model ?? this.model,
      skillName: options.skillName,
      thinkingLevel: options.thinkingLevel,
      reasoningEffort: options.reasoningEffort,
    }
    if (this.turnCount === 1 && (this.title === 'New session' || this.title.trim() === '')) {
      this.title = normaliseTitle(prompt)
    }
    if (options.model !== undefined) this.model = options.model
    if (options.skillName !== undefined && !this.skills.includes(options.skillName)) {
      this.skills.push(options.skillName)
    }
    this.status = 'thinking'
    this.lastActiveAt = this.now()
    this.activeTurnText = ''
    this.lastFinalTurnId = undefined
    return { ...this.activeTurn }
  }

  setStatus(status: AgentSessionStatus): void {
    this.status = status
    this.lastActiveAt = this.now()
  }

  attachAbortController(controller: AbortController): void {
    this.abortController = controller
  }

  clearAbortController(): void {
    this.abortController = null
  }

  cancel(reason = 'cancelled by client'): boolean {
    if (!this.abortController || !this.activeTurn) return false
    this.abortController.abort(new Error(reason))
    return true
  }

  finishTurn(outcome: 'success' | 'error' | 'cancelled'): void {
    this.activeTurn = undefined
    this.abortController = null
    this.activeTurnText = ''
    this.status = outcome === 'success' ? 'idle' : outcome === 'cancelled' ? 'idle' : 'error'
    this.lastActiveAt = this.now()
  }

  get activeTurnTextSoFar(): string {
    return this.activeTurnText
  }

  requestApproval(request: HumanApprovalRequest): Promise<ApprovalResponseLike> {
    if (!this.activeTurn) {
      return Promise.reject(new BadRequestError('Session has no active turn'))
    }
    if (this.pendingApprovals.has(request.requestId)) {
      return Promise.reject(new ConflictError(`Approval request "${request.requestId}" already exists`))
    }

    return new Promise<ApprovalResponseLike>((resolve, reject) => {
      const pending: PendingApproval = {
        request,
        resolve,
        reject,
        timer: null,
      }
      const expiresIn = Math.max(1, request.expiresAt - this.now())
      if (Number.isFinite(expiresIn)) {
        pending.timer = setTimeout(() => {
          this.settleApproval(request.requestId, {
            requestId: request.requestId,
            decision: 'expired',
            respondedAt: this.now(),
            reason: 'approval request expired',
          })
        }, expiresIn)
        const timer = pending.timer as unknown as { unref?: () => void }
        timer.unref?.()
      }
      this.pendingApprovals.set(request.requestId, pending)
      this.setStatus('waiting_approval')
      this.append({ type: 'approval_request', request })
    })
  }

  settleApproval(requestId: string, response: ApprovalResponseLike): boolean {
    const pending = this.pendingApprovals.get(requestId)
    if (!pending) return false
    if (pending.timer) clearTimeout(pending.timer)
    this.pendingApprovals.delete(requestId)
    this.append({
      type: 'approval_result',
      requestId,
      decision: response.decision,
      scope: response.scope,
      optionId: response.optionId,
      reason: response.reason,
    })
    if (this.activeTurn && this.pendingApprovals.size === 0 && this.status === 'waiting_approval') {
      this.status = 'thinking'
    }
    pending.resolve(response)
    return true
  }

  /** Reject every open approval because the turn ended or the session closed. */
  cancelAllApprovals(reason: string): void {
    for (const requestId of [...this.pendingApprovals.keys()]) {
      this.settleApproval(requestId, {
        requestId,
        decision: 'cancelled',
        reason,
        respondedAt: this.now(),
      })
    }
  }

  close(reason = 'session closed'): void {
    if (this.status === 'closed') return
    this.abortController?.abort(new Error(reason))
    this.abortController = null
    this.cancelAllApprovals(reason)
    this.activeTurn = undefined
    this.append({ type: 'session_closed', reason })
    this.status = 'closed'
    this.listeners.clear()
  }
}

export interface SessionListResult {
  items: AgentSession[]
  total: number
  limit: number
  offset: number
}

/**
 * In-process registry of every live session (QQ, DSH, Web console). Gateways
 * call `ensure()` for inbound platform messages; the web console lists and
 * drives the same records through the HTTP API.
 */
export class SessionRegistry {
  private readonly sessions = new Map<string, AgentSession>()
  private driver?: SessionPromptDriver
  private readonly options: SessionRegistryOptions
  private readonly persistence?: SessionPersistence
  private persistTimer: NodeJS.Timeout | null = null
  private persistChain: Promise<void> = Promise.resolve()
  private hydrated = false

  constructor(options: SessionRegistryOptions = {}) {
    this.options = options
    this.driver = options.driver
    this.persistence = options.persistence
  }

  /** True when a durable store is attached and sessions have been replayed. */
  get isPersistent(): boolean {
    return Boolean(this.persistence)
  }

  /**
   * Replay persisted sessions (metadata + full event timeline) into memory.
   * Safe to call once at boot; a no-op when no store is attached.
   */
  async hydrate(): Promise<number> {
    if (!this.persistence || this.hydrated) return this.sessions.size
    this.hydrated = true
    const records = await this.persistence.load()
    let restored = 0
    for (const record of records) {
      if (!record?.id || this.sessions.has(record.id)) continue
      try {
        const session = AgentSession.restore(record, this.options)
        this.attachPersistence(session)
        this.sessions.set(session.id, session)
        restored += 1
      } catch (error) {
        console.warn(`[session-registry] Failed to restore session ${record.id}:`, (error as Error).message)
      }
    }
    return restored
  }

  /** Coalesce writes: state changes land on disk at most once per 400ms. */
  schedulePersist(): void {
    if (!this.persistence) return
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void this.flushPersist()
    }, 400)
    this.persistTimer.unref?.()
  }

  /** Immediately write the current snapshot to the durable store. */
  flushPersist(): Promise<void> {
    if (!this.persistence) return Promise.resolve()
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    const records = [...this.sessions.values()].map(session => session.toRecord())
    this.persistChain = this.persistChain
      .then(() => this.persistence!.save(records))
      .catch(error => {
        console.warn('[session-registry] Failed to persist sessions:', (error as Error).message)
      })
    return this.persistChain
  }

  private attachPersistence(session: AgentSession): void {
    if (!this.persistence) return
    session.onEvent(() => this.schedulePersist())
  }

  setDriver(driver: SessionPromptDriver | undefined): void {
    this.driver = driver
  }

  getDriver(): SessionPromptDriver | undefined {
    return this.driver
  }

  create(input: SessionCreateInput = {}): AgentSession {
    const id = input.id?.trim() || this.newId()
    if (this.sessions.has(id)) {
      throw new ConflictError(`Session "${id}" already exists`, { code: 'SESSION_EXISTS' })
    }
    const session = new AgentSession({ ...input, id }, this.options)
    this.attachPersistence(session)
    this.sessions.set(id, session)
    this.schedulePersist()
    return session
  }

  /** Idempotent create used by gateway adapters. */
  ensure(input: SessionCreateInput & { id: string }): AgentSession {
    const existing = this.sessions.get(input.id)
    if (existing) return existing
    return this.create(input)
  }

  get(id: string): AgentSession | undefined {
    return this.sessions.get(id)
  }

  getOrThrow(id: string): AgentSession {
    const session = this.sessions.get(id)
    if (!session) {
      throw new NotFoundError(`Session "${id}" not found`, { code: 'SESSION_NOT_FOUND' })
    }
    return session
  }

  has(id: string): boolean {
    return this.sessions.has(id)
  }

  list(filter: SessionListFilter = {}): SessionListResult {
    const limit = Math.min(200, Math.max(1, filter.limit ?? 50))
    const offset = Math.max(0, filter.offset ?? 0)
    const query = filter.query?.trim().toLowerCase()
    let items = [...this.sessions.values()]
    if (filter.platform) items = items.filter(session => session.platform === filter.platform)
    if (filter.status) items = items.filter(session => session.currentStatus === filter.status)
    if (query) {
      items = items.filter(session => {
        const info = session.info()
        return session.id.toLowerCase().includes(query)
          || info.title.toLowerCase().includes(query)
          || info.botId.toLowerCase().includes(query)
      })
    }
    items.sort((a, b) => b.info().lastActiveAt - a.info().lastActiveAt)
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    }
  }

  delete(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.close('session deleted')
    const removed = this.sessions.delete(id)
    if (removed) void this.flushPersist()
    return removed
  }

  closeAll(reason = 'server shutting down'): void {
    for (const session of this.sessions.values()) {
      session.close(reason)
    }
  }

  /** Accept a prompt and start the agent loop without waiting for completion. */
  startPrompt(sessionId: string, input: unknown): PromptTurn {
    const session = this.getOrThrow(sessionId)
    const driver = this.driver
    if (!driver) {
      throw new ServiceUnavailableError('No agent prompt driver is configured', { code: 'DRIVER_UNAVAILABLE' })
    }
    const normalized = normalizePromptInput(input)
    if (session.currentTurn) {
      throw new ConflictError('Session already has an active turn', { code: 'SESSION_BUSY' })
    }
    if (session.isClosed) {
      throw new ConflictError('Session is closed', { code: 'SESSION_CLOSED' })
    }

    const turnId = this.newId()
    const startedAt = this.options.now?.() ?? Date.now()
    session.beginTurn(turnId, normalized.prompt, {
      model: normalized.model,
      skillName: normalized.skillName,
      thinkingLevel: normalized.thinkingLevel,
      reasoningEffort: normalized.reasoningEffort,
    })
    const controller = new AbortController()
    session.attachAbortController(controller)

    session.append({ type: 'typing', state: 'start' })
    session.append({
      type: 'turn_started',
      turnId,
      prompt: normalized.prompt,
      model: normalized.model,
      skillName: normalized.skillName,
    })

    const done = this.runTurn(session, driver, normalized, turnId, startedAt, controller.signal)
    // The HTTP route returns a 202 receipt immediately; keep the rejection
    // handled here even when the caller does not await `done`.
    void done.catch(() => {})

    return {
      accepted: true,
      sessionId: session.id,
      turnId,
      startedAt,
      done,
    }
  }

  /** Alias kept for gateway integrations that call it `dispatchPrompt`. */
  dispatchPrompt(sessionId: string, input: unknown): PromptTurn {
    return this.startPrompt(sessionId, input)
  }

  cancelPrompt(sessionId: string, reason?: string): boolean {
    return this.getOrThrow(sessionId).cancel(reason)
  }

  requestApproval(sessionId: string, request: HumanApprovalRequest): Promise<ApprovalResponseLike> {
    return this.getOrThrow(sessionId).requestApproval(request)
  }

  respondApproval(sessionId: string, requestId: string, input: ApprovalResponseInput): ApprovalResponseLike {
    const session = this.getOrThrow(sessionId)
    const pending = session.snapshot({ limit: 1 }).pendingApprovals.find(item => item.requestId === requestId)
    if (!pending) {
      throw new NotFoundError(`Approval request "${requestId}" not found`, { code: 'APPROVAL_NOT_FOUND' })
    }
    if (!input || typeof input.decision !== 'string') {
      throw new BadRequestError('decision is required')
    }
    const response: ApprovalResponseLike = {
      requestId,
      decision: input.decision,
      scope: input.scope,
      optionId: input.optionId,
      reason: input.reason,
      respondedAt: input.respondedAt ?? (this.options.now?.() ?? Date.now()),
    }
    if (!session.settleApproval(requestId, response)) {
      throw new NotFoundError(`Approval request "${requestId}" not found`, { code: 'APPROVAL_NOT_FOUND' })
    }
    return response
  }

  stats(): { total: number; streaming: number; waitingApproval: number; byPlatform: Record<string, number> } {
    const byPlatform: Record<string, number> = {}
    let streaming = 0
    let waitingApproval = 0
    for (const session of this.sessions.values()) {
      byPlatform[session.platform] = (byPlatform[session.platform] ?? 0) + 1
      if (session.isStreaming) streaming += 1
      if (session.currentStatus === 'waiting_approval') waitingApproval += 1
    }
    return { total: this.sessions.size, streaming, waitingApproval, byPlatform }
  }

  private newId(): string {
    return this.options.idFactory?.() ?? randomUUID()
  }

  private async runTurn(
    session: AgentSession,
    driver: SessionPromptDriver,
    input: NormalisedPromptInput,
    turnId: string,
    startedAt: number,
    signal: AbortSignal,
  ): Promise<PromptTurnResult> {
    let outcome: 'success' | 'error' | 'cancelled' = 'success'
    let result: PromptDriverResult | undefined

    try {
      const driverResult = await driver.run({
        session: session.info(),
        prompt: input.prompt,
        turnId,
        signal,
        images: input.images,
        emit: event => {
          if (!signal.aborted) session.append(event)
        },
        requestApproval: request => session.requestApproval({
          ...request,
          sessionId: session.id,
          platform: session.platform,
          botId: session.botId,
        }),
      })
      if (driverResult) result = driverResult
      if (signal.aborted) {
        throw new WebApiError('Turn cancelled', { status: 499, code: 'CANCELLED' })
      }

      if (!session.hasFinalForTurn(turnId)) {
        const text = result?.text ?? session.activeTurnTextSoFar
        const parts = result?.parts
          ?? (text
            ? [{ type: 'markdown' as const, markdown: text }]
            : [{ type: 'text' as const, text: '' }])
        session.append({
          type: 'final_reply',
          messageId: result?.messageId,
          parts,
          text,
          finishReason: result?.finishReason ?? 'stop',
          usage: result?.usage,
        })
      }
    } catch (error) {
      const cancelled = signal.aborted || isAbortError(error) || (error instanceof WebApiError && error.status === 499)
      outcome = cancelled ? 'cancelled' : 'error'
      if (!cancelled) {
        const payload = toErrorPayload(error)
        session.append({ type: 'error', error: payload, fatal: true })
        session.setStatus('error')
      }
    } finally {
      session.cancelAllApprovals(outcome === 'cancelled' ? 'turn cancelled' : 'turn finished')
      const durationMs = (this.options.now?.() ?? Date.now()) - startedAt
      session.append({ type: 'typing', state: 'stop', durationMs })
      session.append({
        type: 'turn_finished',
        turnId,
        outcome,
        durationMs,
        finishReason: result?.finishReason,
        error: outcome === 'error'
          ? { code: 'INTERNAL_ERROR', message: 'Agent turn failed', retryable: false }
          : undefined,
      })
      session.finishTurn(outcome)
    }

    if (outcome !== 'success') {
      const error = new WebApiError(outcome === 'cancelled' ? 'Turn cancelled' : 'Agent turn failed', {
        status: outcome === 'cancelled' ? 499 : 500,
        code: outcome === 'cancelled' ? 'CANCELLED' : 'AGENT_TURN_FAILED',
      })
      throw error
    }

    return {
      sessionId: session.id,
      turnId,
      startedAt,
      durationMs: (this.options.now?.() ?? Date.now()) - startedAt,
      outcome,
      result,
    }
  }
}

interface NormalisedPromptInput {
  prompt: string
  displayText?: string
  model?: string
  skillName?: string
  metadata?: Record<string, unknown>
  images?: Array<{ url?: string; base64?: string; mimeType?: string }>
  thinkingLevel?: 'none' | 'low' | 'medium' | 'high' | 'max'
  reasoningEffort?: string
}

function normalizePromptInput(input: unknown): NormalisedPromptInput {
  if (typeof input === 'string') {
    return validatePromptText(input)
  }
  if (!isRecord(input)) {
    throw new BadRequestError('Prompt body must be an object or a string')
  }
  const raw = input.prompt ?? input.message ?? input.text
  if (typeof raw !== 'string') {
    throw new BadRequestError('prompt must be a string')
  }
  const normalized: NormalisedPromptInput = validatePromptText(raw)
  if (typeof input.displayText === 'string') normalized.displayText = input.displayText
  if (typeof input.model === 'string' && input.model.trim()) normalized.model = input.model.trim()
  if (typeof input.skillName === 'string' && input.skillName.trim()) normalized.skillName = input.skillName.trim()
  if (isRecord(input.metadata)) normalized.metadata = input.metadata
  if (typeof input.thinkingLevel === 'string') normalized.thinkingLevel = input.thinkingLevel as any
  if (typeof input.reasoningEffort === 'string') normalized.reasoningEffort = input.reasoningEffort
  if (typeof input.thinkingBudget === 'string') normalized.thinkingLevel = input.thinkingBudget as any
  if (Array.isArray(input.images)) {
    normalized.images = input.images
      .filter(isRecord)
      .map(item => ({
        url: typeof item.url === 'string' ? item.url : undefined,
        base64: typeof item.base64 === 'string' ? item.base64 : undefined,
        mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
      }))
      .filter(item => item.url || item.base64)
  }
  return normalized
}

function validatePromptText(text: string): NormalisedPromptInput {
  const prompt = text.trim()
  if (!prompt) throw new BadRequestError('prompt must not be empty')
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new BadRequestError(`prompt exceeds ${MAX_PROMPT_CHARS} characters`, { code: 'PROMPT_TOO_LARGE' })
  }
  return { prompt }
}
