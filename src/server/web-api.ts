import express, { type Request, type RequestHandler, type Response, type Router } from 'express'
import { Readable, pipeline } from 'node:stream'
import {
  APPROVAL_DECISIONS,
  GATEWAY_PLATFORMS,
  type ApprovalDecision,
  type ApprovalOptionId,
  type ApprovalScope,
} from '../agent/gateway-contracts'
import { BadRequestError, ServiceUnavailableError, toWebApiError } from './errors'
import type { EvolutionService, MergeEvolutionInput } from './evolution-service'
import { EVOLUTION_TRACE_STATUSES, type EvolutionTraceStatus } from './evolution-service'
import type { FusionTaskService, SubmitFusionResultInput } from './fusion-service'
import { FUSION_TASK_STATUSES, type FusionTaskStatus } from './fusion-service'
import type { SessionRegistry } from './session-registry'
import type { SkillListFilter, SkillsService } from './skills-service'
import { createAgentEventStream, type AgentEventStreamOptions } from './sse-stream'
import type { AgentSessionStatus, SessionCreateInput } from './types'

export interface AgentWebApiDependencies {
  sessions: SessionRegistry
  fusion?: FusionTaskService
  evolution?: EvolutionService
  skills?: SkillsService
  /** Extra middleware (auth, rate limiting) applied to every new route. */
  auth?: RequestHandler[]
  /** SSE tuning; tests use short heartbeats and small backlog limits. */
  sse?: AgentEventStreamOptions
}

const SESSION_STATUSES: readonly AgentSessionStatus[] = [
  'idle',
  'thinking',
  'streaming',
  'waiting_approval',
  'error',
  'closed',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function queryString(req: Request, key: string): string | undefined {
  const value = req.query[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function queryInt(req: Request, key: string, fallback: number, min: number, max: number): number {
  const raw = queryString(req, key)
  const parsed = raw !== undefined ? Number(raw) : Number.NaN
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

function queryBoolean(req: Request, key: string): boolean | undefined {
  const raw = queryString(req, key)
  if (raw === undefined) return undefined
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return undefined
}

function sendOk(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, code: 0, data, message: 'ok' })
}

function sendError(res: Response, error: unknown): void {
  const webError = toWebApiError(error)
  if (res.headersSent) {
    res.destroy(webError)
    return
  }
  res.status(webError.status).json({
    success: false,
    code: -1,
    data: null,
    message: webError.message,
    error: {
      code: webError.code,
      message: webError.message,
      ...(webError.details !== undefined ? { details: webError.details } : {}),
    },
  })
}

function route(
  handler: (req: Request, res: Response) => Promise<void> | void,
): RequestHandler {
  return (req, res) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((error: unknown) => sendError(res, error))
  }
}

function requireService<T>(service: T | undefined, name: string): T {
  if (!service) {
    throw new ServiceUnavailableError(`${name} is not configured`, { code: 'SERVICE_UNAVAILABLE' })
  }
  return service
}

function parseSessionCreate(body: unknown): SessionCreateInput {
  if (!isRecord(body)) return {}
  const platform = body.platform
  if (platform !== undefined && !(GATEWAY_PLATFORMS as readonly unknown[]).includes(platform)) {
    throw new BadRequestError(`platform must be one of ${GATEWAY_PLATFORMS.join(', ')}`)
  }
  const skills = Array.isArray(body.skills)
    ? body.skills.filter((item): item is string => typeof item === 'string')
    : undefined
  return {
    id: typeof body.id === 'string' ? body.id : undefined,
    platform: platform as SessionCreateInput['platform'],
    botId: typeof body.botId === 'string' ? body.botId : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    model: typeof body.model === 'string' ? body.model : undefined,
    skills,
    metadata: isRecord(body.metadata) ? body.metadata : undefined,
  }
}

function parseApprovalInput(body: unknown): {
  decision: ApprovalDecision
  scope?: ApprovalScope
  optionId?: ApprovalOptionId
  reason?: string
} {
  if (!isRecord(body)) throw new BadRequestError('Approval body must be an object')
  const decision = body.decision
  if (typeof decision !== 'string' || !(APPROVAL_DECISIONS as readonly string[]).includes(decision)) {
    throw new BadRequestError(`decision must be one of ${APPROVAL_DECISIONS.join(', ')}`)
  }
  return {
    decision: decision as ApprovalDecision,
    scope: typeof body.scope === 'string' ? body.scope as ApprovalScope : undefined,
    optionId: typeof body.optionId === 'string' ? body.optionId as ApprovalOptionId : undefined,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
  }
}

function parseFusionStatus(value: unknown): FusionTaskStatus | undefined {
  return typeof value === 'string' && (FUSION_TASK_STATUSES as readonly string[]).includes(value)
    ? value as FusionTaskStatus
    : undefined
}

function parseEvolutionStatus(value: unknown): EvolutionTraceStatus | undefined {
  return typeof value === 'string' && (EVOLUTION_TRACE_STATUSES as readonly string[]).includes(value)
    ? value as EvolutionTraceStatus
    : undefined
}

function openSseStream(
  req: Request,
  res: Response,
  dependencies: AgentWebApiDependencies,
  sessionId: string,
): void {
  const session = dependencies.sessions.getOrThrow(sessionId)
  const abortController = new AbortController()
  const lastEventId = typeof req.headers['last-event-id'] === 'string'
    ? req.headers['last-event-id']
    : undefined
  const sinceRaw = queryString(req, 'since')
  const since = sinceRaw !== undefined && Number.isFinite(Number(sinceRaw)) ? Number(sinceRaw) : undefined
  const stream = createAgentEventStream(
    { signal: abortController.signal, lastEventId, since },
    session,
    dependencies.sse,
  )

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const abort = () => {
    if (!abortController.signal.aborted) abortController.abort()
  }
  req.once('close', abort)
  res.once('close', abort)

  const nodeStream = Readable.fromWeb(stream as unknown as Parameters<typeof Readable.fromWeb>[0])
  pipeline(nodeStream, res, () => {
    abort()
  })
}

/**
 * Build the modern `/api/agent` router. It is framework-light: the only
 * Express-specific parts are the request/response adapters and the SSE pipe.
 *
 * Mount it before the legacy router:
 *   app.use('/api/agent', authenticateToken, createAgentWebApiRouter(deps))
 */
export function createAgentWebApiRouter(dependencies: AgentWebApiDependencies): Router {
  const router = express.Router()
  if (dependencies.auth && dependencies.auth.length > 0) {
    router.use(...dependencies.auth)
  }

  // ─── Sessions ──────────────────────────────────────────────────────────────

  router.get('/sessions', route((req, res) => {
    const platform = queryString(req, 'platform')
    if (platform !== undefined && !(GATEWAY_PLATFORMS as readonly string[]).includes(platform)) {
      throw new BadRequestError(`platform must be one of ${GATEWAY_PLATFORMS.join(', ')}`)
    }
    const status = queryString(req, 'status')
    if (status !== undefined && !(SESSION_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestError(`status must be one of ${SESSION_STATUSES.join(', ')}`)
    }
    const limit = queryInt(req, 'limit', 50, 1, 200)
    const offset = queryInt(req, 'offset', 0, 0, Number.MAX_SAFE_INTEGER)
    const result = dependencies.sessions.list({
      platform: platform as SessionCreateInput['platform'],
      status: status as AgentSessionStatus | undefined,
      query: queryString(req, 'query'),
      limit,
      offset,
    })
    sendOk(res, {
      items: result.items.map(session => session.info()),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      stats: dependencies.sessions.stats(),
    })
  }))

  router.get('/sessions/stats', route((_req, res) => {
    sendOk(res, dependencies.sessions.stats())
  }))

  router.post('/sessions', route((req, res) => {
    const session = dependencies.sessions.create(parseSessionCreate(req.body))
    sendOk(res, session.info(), 201)
  }))

  router.get('/sessions/:id', route((req, res) => {
    const session = dependencies.sessions.getOrThrow(req.params.id as string)
    const snapshot = session.snapshot({ limit: 1 })
    sendOk(res, {
      session: session.info(),
      pendingApprovals: snapshot.pendingApprovals,
    })
  }))

  router.patch('/sessions/:id', route((req, res) => {
    const session = dependencies.sessions.getOrThrow(req.params.id as string)
    if (!isRecord(req.body)) throw new BadRequestError('Body must be an object')
    const skills = Array.isArray(req.body.skills)
      ? req.body.skills.filter((item): item is string => typeof item === 'string')
      : undefined
    session.update({
      title: typeof req.body.title === 'string' ? req.body.title : undefined,
      model: typeof req.body.model === 'string' ? req.body.model : undefined,
      skills,
      metadata: isRecord(req.body.metadata) ? req.body.metadata : undefined,
    })
    sendOk(res, session.info())
  }))

  router.delete('/sessions/:id', route((req, res) => {
    const deleted = dependencies.sessions.delete(req.params.id as string)
    sendOk(res, { deleted })
  }))

  router.get('/sessions/:id/events/snapshot', route((req, res) => {
    const session = dependencies.sessions.getOrThrow(req.params.id as string)
    const sinceRaw = queryString(req, 'since')
    const since = sinceRaw !== undefined && Number.isFinite(Number(sinceRaw)) ? Number(sinceRaw) : undefined
    const limit = queryInt(req, 'limit', 500, 1, 2000)
    sendOk(res, session.snapshot({ since, limit }))
  }))

  // SSE: no JSON wrapper, no auth re-parsing. The stream itself carries the
  // snapshot and all subsequent events.
  router.get('/sessions/:id/events', (req, res) => {
    try {
      openSseStream(req, res, dependencies, req.params.id as string)
    } catch (error) {
      sendError(res, error)
    }
  })

  router.post('/sessions/:id/prompt', route((req, res) => {
    const turn = dependencies.sessions.startPrompt(req.params.id as string, req.body)
    sendOk(res, {
      accepted: true,
      sessionId: turn.sessionId,
      turnId: turn.turnId,
      startedAt: turn.startedAt,
    }, 202)
  }))

  router.post('/sessions/:id/cancel', route((req, res) => {
    const reason = isRecord(req.body) && typeof req.body.reason === 'string'
      ? req.body.reason
      : undefined
    const cancelled = dependencies.sessions.cancelPrompt(req.params.id as string, reason)
    sendOk(res, { cancelled })
  }))

  router.post('/sessions/:id/approvals/:requestId', route((req, res) => {
    const input = parseApprovalInput(req.body)
    const response = dependencies.sessions.respondApproval(
      req.params.id as string,
      req.params.requestId as string,
      input,
    )
    sendOk(res, response)
  }))

  // ─── Fusion tasks ──────────────────────────────────────────────────────────

  router.get('/fusion/tasks', route((req, res) => {
    const service = requireService(dependencies.fusion, 'FusionTaskService')
    const status = queryString(req, 'status')
    if (status !== undefined && !parseFusionStatus(status)) {
      throw new BadRequestError(`status must be one of ${FUSION_TASK_STATUSES.join(', ')}`)
    }
    const result = service.list({
      status: parseFusionStatus(status),
      sessionId: queryString(req, 'sessionId'),
      sidekick: queryString(req, 'sidekick'),
      query: queryString(req, 'query'),
      limit: queryInt(req, 'limit', 50, 1, 200),
      offset: queryInt(req, 'offset', 0, 0, Number.MAX_SAFE_INTEGER),
    })
    sendOk(res, result)
  }))

  router.post('/fusion/tasks', route((req, res) => {
    const service = requireService(dependencies.fusion, 'FusionTaskService')
    sendOk(res, service.create(req.body), 201)
  }))

  router.get('/fusion/tasks/:id', route((req, res) => {
    const service = requireService(dependencies.fusion, 'FusionTaskService')
    sendOk(res, service.getOrThrow(req.params.id as string))
  }))

  router.patch('/fusion/tasks/:id/status', route((req, res) => {
    const service = requireService(dependencies.fusion, 'FusionTaskService')
    if (!isRecord(req.body)) throw new BadRequestError('Body must be an object')
    sendOk(res, service.updateStatus(
      req.params.id as string,
      req.body.status,
      typeof req.body.sidekick === 'string' ? req.body.sidekick : undefined,
    ))
  }))

  router.post('/fusion/tasks/:id/result', route((req, res) => {
    const service = requireService(dependencies.fusion, 'FusionTaskService')
    sendOk(res, service.submitResult(req.params.id as string, req.body as SubmitFusionResultInput))
  }))

  router.post('/fusion/tasks/:id/review', route((req, res) => {
    const service = requireService(dependencies.fusion, 'FusionTaskService')
    sendOk(res, service.review(req.params.id as string, req.body))
  }))

  router.get('/fusion/stats', route((_req, res) => {
    const service = requireService(dependencies.fusion, 'FusionTaskService')
    sendOk(res, service.stats())
  }))

  // ─── Evolution traces ──────────────────────────────────────────────────────

  router.get('/evolution/traces', route((req, res) => {
    const service = requireService(dependencies.evolution, 'EvolutionService')
    const status = queryString(req, 'status')
    if (status !== undefined && !parseEvolutionStatus(status)) {
      throw new BadRequestError(`status must be one of ${EVOLUTION_TRACE_STATUSES.join(', ')}`)
    }
    const minScoreRaw = queryString(req, 'minScore')
    const minScore = minScoreRaw !== undefined && Number.isFinite(Number(minScoreRaw))
      ? Number(minScoreRaw)
      : undefined
    const result = service.list({
      status: parseEvolutionStatus(status),
      sessionId: queryString(req, 'sessionId'),
      minScore,
      gatePassed: queryBoolean(req, 'gatePassed'),
      limit: queryInt(req, 'limit', 50, 1, 200),
      offset: queryInt(req, 'offset', 0, 0, Number.MAX_SAFE_INTEGER),
    })
    sendOk(res, result)
  }))

  router.post('/evolution/traces', route((req, res) => {
    const service = requireService(dependencies.evolution, 'EvolutionService')
    sendOk(res, service.create(req.body), 201)
  }))

  router.get('/evolution/traces/:id', route((req, res) => {
    const service = requireService(dependencies.evolution, 'EvolutionService')
    sendOk(res, service.getOrThrow(req.params.id as string))
  }))

  router.post('/evolution/traces/:id/approve', route((req, res) => {
    const service = requireService(dependencies.evolution, 'EvolutionService')
    const reviewer = isRecord(req.body) && typeof req.body.reviewedBy === 'string'
      ? req.body.reviewedBy
      : undefined
    sendOk(res, service.approve(req.params.id as string, reviewer))
  }))

  router.post('/evolution/traces/:id/reject', route((req, res) => {
    const service = requireService(dependencies.evolution, 'EvolutionService')
    const reviewer = isRecord(req.body) && typeof req.body.reviewedBy === 'string'
      ? req.body.reviewedBy
      : undefined
    sendOk(res, service.reject(req.params.id as string, reviewer))
  }))

  router.post('/evolution/traces/:id/merge', route(async (req, res) => {
    const service = requireService(dependencies.evolution, 'EvolutionService')
    sendOk(res, await service.merge(
      req.params.id as string,
      (isRecord(req.body) ? req.body : {}) as MergeEvolutionInput,
    ))
  }))

  router.get('/evolution/stats', route((_req, res) => {
    const service = requireService(dependencies.evolution, 'EvolutionService')
    sendOk(res, service.stats())
  }))

  // ─── Skills ────────────────────────────────────────────────────────────────

  router.get('/skills', route((req, res) => {
    const service = requireService(dependencies.skills, 'SkillsService')
    const limit = queryInt(req, 'pageSize', 20, 1, 200)
    const offset = (queryInt(req, 'page', 1, 1, Number.MAX_SAFE_INTEGER) - 1) * limit
    const result = service.list({
      name: queryString(req, 'name'),
      executionMode: queryString(req, 'executionMode') as SkillListFilter['executionMode'],
      limit,
      offset,
    })
    sendOk(res, {
      items: result.items,
      total: result.total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      available: result.available,
    })
  }))

  router.get('/skills/:name', route(async (req, res) => {
    const service = requireService(dependencies.skills, 'SkillsService')
    sendOk(res, await service.instructions(req.params.name as string))
  }))

  router.post('/skills/reload', route(async (_req, res) => {
    const service = requireService(dependencies.skills, 'SkillsService')
    sendOk(res, { count: await service.reload() })
  }))

  return router
}
