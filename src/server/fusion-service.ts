import { randomUUID } from 'node:crypto'
import type {
  FusionDiffFormat,
  FusionReviewCriterion,
  FusionTaskSpec,
} from '../agent/gateway-contracts'
import { validateFusionTaskSpec } from '../agent/gateway-validators'
import { BadRequestError, ConflictError, NotFoundError } from './errors'
import type { CollectionPersistence } from './persistence'
import { PersistenceQueue } from './persistence'

export const FUSION_TASK_STATUSES = [
  'queued',
  'dispatched',
  'running',
  'review',
  'changes_requested',
  'approved',
  'rejected',
  'failed',
  'cancelled',
] as const
export type FusionTaskStatus = (typeof FUSION_TASK_STATUSES)[number]

export interface FusionTestResult {
  name: string
  passed: boolean
  output?: string
}

/** What the Sidekick returns to the Main Agent for review. */
export interface FusionTaskResult {
  summary?: string
  /** Unified diff / JSON patch / structured patch, depending on the spec. */
  diff?: string
  diffFormat?: FusionDiffFormat
  filesChanged?: string[]
  tests?: FusionTestResult[]
  notes?: string
  raw?: unknown
}

export interface FusionCriterionReview {
  criterionId: string
  passed: boolean
  /** Normalized [0, 1]. Defaults to 1 for pass, 0 for fail. */
  score?: number
  comment?: string
}

export interface FusionTaskReview {
  reviewer: string
  decision: 'approved' | 'rejected' | 'changes_requested'
  summary?: string
  criteria?: FusionCriterionReview[]
  /** Weighted criteria score, normalized to [0, 1]. */
  score?: number
  createdAt: number
}

export interface FusionTaskRecord {
  id: string
  spec: FusionTaskSpec
  status: FusionTaskStatus
  sidekick?: string
  createdAt: number
  updatedAt: number
  dispatchedAt?: number
  completedAt?: number
  result?: FusionTaskResult
  reviews: FusionTaskReview[]
  metadata: Record<string, unknown>
}

export interface FusionServiceOptions {
  persistence?: CollectionPersistence<FusionTaskRecord>
  now?: () => number
  idFactory?: () => string
  onPersistError?: (error: unknown) => void
}

export interface FusionTaskListFilter {
  status?: FusionTaskStatus
  sessionId?: string
  sidekick?: string
  query?: string
  limit?: number
  offset?: number
}

export interface FusionTaskListResult {
  items: FusionTaskRecord[]
  total: number
  limit: number
  offset: number
}

export interface SubmitFusionResultInput {
  summary?: string
  diff?: string
  diffFormat?: FusionDiffFormat
  filesChanged?: string[]
  tests?: FusionTestResult[]
  notes?: string
  raw?: unknown
  /** Defaults to `review`; set `running` to keep the task in progress. */
  status?: FusionTaskStatus
}

export interface FusionReviewInput {
  reviewer?: string
  decision: 'approved' | 'rejected' | 'changes_requested'
  summary?: string
  criteria?: FusionCriterionReview[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter((item): item is string => typeof item === 'string')
  return items.length === value.length ? items : undefined
}

function isStatus(value: unknown): value is FusionTaskStatus {
  return typeof value === 'string' && (FUSION_TASK_STATUSES as readonly string[]).includes(value)
}

function normalizeTests(value: unknown): FusionTestResult[] | undefined {
  if (!Array.isArray(value)) return undefined
  const tests: FusionTestResult[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    if (typeof entry.name !== 'string' || typeof entry.passed !== 'boolean') continue
    tests.push({
      name: entry.name,
      passed: entry.passed,
      output: typeof entry.output === 'string' ? entry.output : undefined,
    })
  }
  return tests
}

function cloneSpec(raw: Record<string, unknown>, now: () => number, idFactory: () => string): Record<string, unknown> {
  const spec: Record<string, unknown> = { ...raw }

  // 兼容前端/上层可能传入的 camelCase 字段
  if (spec.taskId && !spec.task_id) spec.task_id = spec.taskId
  if (spec.sessionId && !spec.session_id) spec.session_id = spec.sessionId
  if (spec.parentTaskId && !spec.parent_task_id) spec.parent_task_id = spec.parentTaskId
  if (spec.parentRunId && !spec.parent_run_id) spec.parent_run_id = spec.parentRunId
  if (spec.targetTools && !spec.target_tools) spec.target_tools = spec.targetTools
  if (spec.diffSchema && !spec.diff_schema) spec.diff_schema = spec.diffSchema
  if (spec.reviewCriteria && !spec.review_criteria) spec.review_criteria = spec.reviewCriteria
  if (spec.createdAt && !spec.created_at) spec.created_at = spec.createdAt
  if (spec.deadlineAt && !spec.deadline_at) spec.deadline_at = spec.deadlineAt

  if (isRecord(spec.diff_schema)) {
    const diff = { ...spec.diff_schema }
    if (diff.pathScope && !diff.path_scope) diff.path_scope = diff.pathScope
    if (diff.requiredFields && !diff.required_fields) diff.required_fields = diff.requiredFields
    if (diff.maxFiles && !diff.max_files) diff.max_files = diff.maxFiles
    if (diff.maxChangedLines && !diff.max_changed_lines) diff.max_changed_lines = diff.maxChangedLines
    if (diff.allowBinary !== undefined && diff.allow_binary === undefined) diff.allow_binary = diff.allowBinary
    spec.diff_schema = diff
  }

  if (typeof spec.task_id !== 'string' || spec.task_id.trim() === '') {
    spec.task_id = idFactory()
  }
  if (typeof spec.created_at !== 'number' || !Number.isFinite(spec.created_at)) {
    spec.created_at = now()
  }
  return spec
}

/**
 * In-memory Fusion task registry with optional JSON persistence.
 *
 * The wire contract is `FusionTaskSpec` from `agent/gateway-contracts.ts`; this
 * service only adds lifecycle/status/review bookkeeping around it.
 */
export class FusionTaskService {
  private readonly tasks = new Map<string, FusionTaskRecord>()
  private readonly now: () => number
  private readonly idFactory: () => string
  private readonly persistence?: CollectionPersistence<FusionTaskRecord>
  private readonly persistQueue: PersistenceQueue<FusionTaskRecord>

  constructor(options: FusionServiceOptions = {}) {
    this.now = options.now ?? Date.now
    this.idFactory = options.idFactory ?? (() => `fusion-${randomUUID()}`)
    this.persistence = options.persistence
    this.persistQueue = new PersistenceQueue<FusionTaskRecord>(
      () => [...this.tasks.values()],
      this.persistence,
      options.onPersistError,
    )
  }

  async hydrate(): Promise<number> {
    if (!this.persistence) return 0
    const items = await this.persistence.load()
    let loaded = 0
    for (const item of items) {
      if (!isRecord(item) || typeof item.id !== 'string' || !isRecord(item.spec)) continue
      if (!validateFusionTaskSpec(item.spec).ok) continue
      this.tasks.set(item.id, item as unknown as FusionTaskRecord)
      loaded += 1
    }
    return loaded
  }

  flush(): Promise<void> {
    return this.persistQueue.flush()
  }

  create(input: unknown): FusionTaskRecord {
    if (!isRecord(input)) {
      throw new BadRequestError('Fusion task must be an object')
    }
    const wrapper = isRecord(input.spec) ? input : null
    const rawSpec = wrapper ? wrapper.spec as Record<string, unknown> : input
    const validation = validateFusionTaskSpec(cloneSpec(rawSpec, this.now, this.idFactory))
    if (!validation.ok || !validation.value) {
      throw new BadRequestError('Invalid FusionTaskSpec', {
        code: 'INVALID_FUSION_TASK',
        details: validation.issues,
      })
    }
    const spec = validation.value
    if (this.tasks.has(spec.task_id)) {
      throw new ConflictError(`Fusion task "${spec.task_id}" already exists`, {
        code: 'FUSION_TASK_EXISTS',
      })
    }

    const rawStatus = wrapper ? wrapper.status : input.status
    const status: FusionTaskStatus = isStatus(rawStatus) ? rawStatus : 'queued'
    const sidekick = typeof (wrapper ? wrapper.sidekick : input.sidekick) === 'string'
      ? String(wrapper ? wrapper.sidekick : input.sidekick)
      : undefined
    const metadata = isRecord(wrapper?.metadata)
      ? wrapper.metadata
      : isRecord(input.metadata)
        ? input.metadata
        : {}

    const timestamp = this.now()
    const record: FusionTaskRecord = {
      id: spec.task_id,
      spec,
      status,
      sidekick,
      createdAt: timestamp,
      updatedAt: timestamp,
      reviews: [],
      metadata: { ...metadata },
    }
    if (status === 'dispatched' || status === 'running') record.dispatchedAt = timestamp
    if (status === 'approved' || status === 'rejected' || status === 'failed' || status === 'cancelled') {
      record.completedAt = timestamp
    }
    this.tasks.set(record.id, record)
    this.persistQueue.schedule()
    return record
  }

  get(id: string): FusionTaskRecord | undefined {
    return this.tasks.get(id)
  }

  getOrThrow(id: string): FusionTaskRecord {
    const task = this.tasks.get(id)
    if (!task) throw new NotFoundError(`Fusion task "${id}" not found`, { code: 'FUSION_TASK_NOT_FOUND' })
    return task
  }

  list(filter: FusionTaskListFilter = {}): FusionTaskListResult {
    const limit = Math.min(200, Math.max(1, filter.limit ?? 50))
    const offset = Math.max(0, filter.offset ?? 0)
    const query = filter.query?.trim().toLowerCase()
    let items = [...this.tasks.values()]
    if (filter.status) items = items.filter(task => task.status === filter.status)
    if (filter.sessionId) items = items.filter(task => task.spec.session_id === filter.sessionId)
    if (filter.sidekick) items = items.filter(task => task.sidekick === filter.sidekick)
    if (query) {
      items = items.filter(task =>
        task.id.toLowerCase().includes(query)
        || task.spec.instruction.toLowerCase().includes(query)
        || (task.spec.context ?? '').toLowerCase().includes(query),
      )
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt)
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    }
  }

  updateStatus(id: string, status: unknown, sidekick?: string): FusionTaskRecord {
    if (!isStatus(status)) {
      throw new BadRequestError(`status must be one of ${FUSION_TASK_STATUSES.join(', ')}`)
    }
    const task = this.getOrThrow(id)
    const timestamp = this.now()
    task.status = status
    task.updatedAt = timestamp
    if (sidekick !== undefined) task.sidekick = sidekick
    if (status === 'dispatched' || status === 'running') {
      task.dispatchedAt ??= timestamp
    }
    if (status === 'approved' || status === 'rejected' || status === 'failed' || status === 'cancelled') {
      task.completedAt = timestamp
    }
    this.persistQueue.schedule()
    return task
  }

  submitResult(id: string, input: unknown): FusionTaskRecord {
    if (!isRecord(input)) throw new BadRequestError('Result must be an object')
    const task = this.getOrThrow(id)
    const result: FusionTaskResult = {
      summary: typeof input.summary === 'string' ? input.summary : undefined,
      diff: typeof input.diff === 'string' ? input.diff : undefined,
      diffFormat: typeof input.diffFormat === 'string'
        ? input.diffFormat as FusionDiffFormat
        : task.spec.diff_schema.format,
      filesChanged: stringArray(input.filesChanged),
      tests: normalizeTests(input.tests),
      notes: typeof input.notes === 'string' ? input.notes : undefined,
      raw: input.raw,
    }
    task.result = result
    const requestedStatus = isStatus(input.status) ? input.status : 'review'
    this.updateStatus(id, requestedStatus)
    return task
  }

  review(id: string, input: unknown): FusionTaskRecord {
    if (!isRecord(input)) throw new BadRequestError('Review must be an object')
    const decision = input.decision
    if (decision !== 'approved' && decision !== 'rejected' && decision !== 'changes_requested') {
      throw new BadRequestError('decision must be approved, rejected or changes_requested')
    }
    const task = this.getOrThrow(id)
    const criteria = this.normalizeCriteriaReview(task.spec.review_criteria, input.criteria)
    const requiredFailure = criteria.some(review => {
      const criterion = task.spec.review_criteria.find(item => item.id === review.criterionId)
      return criterion?.required && !review.passed
    })
    const weighted = criteria.length > 0
      ? this.weightedScore(task.spec.review_criteria, criteria)
      : undefined
    const finalDecision = requiredFailure || (decision === 'approved' && weighted !== undefined && weighted < 0.75)
      ? 'rejected'
      : decision
    const review: FusionTaskReview = {
      reviewer: typeof input.reviewer === 'string' && input.reviewer.trim() ? input.reviewer : 'main-agent',
      decision: finalDecision,
      summary: typeof input.summary === 'string' ? input.summary : undefined,
      criteria,
      score: weighted,
      createdAt: this.now(),
    }
    task.reviews.push(review)
    task.status = finalDecision === 'approved'
      ? 'approved'
      : finalDecision === 'rejected'
        ? 'rejected'
        : 'changes_requested'
    task.updatedAt = this.now()
    if (task.status !== 'changes_requested') task.completedAt = task.updatedAt
    this.persistQueue.schedule()
    return task
  }
  delete(id: string): boolean {
    const deleted = this.tasks.delete(id)
    if (deleted) this.persistQueue.schedule()
    return deleted
  }

  clear(): void {
    this.tasks.clear()
    this.persistQueue.schedule()
  }


  stats(): { total: number; byStatus: Record<string, number>; bySession: Record<string, number> } {
    const byStatus: Record<string, number> = {}
    const bySession: Record<string, number> = {}
    for (const task of this.tasks.values()) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1
      bySession[task.spec.session_id] = (bySession[task.spec.session_id] ?? 0) + 1
    }
    return { total: this.tasks.size, byStatus, bySession }
  }

  private normalizeCriteriaReview(
    criteria: readonly FusionReviewCriterion[],
    raw: unknown,
  ): FusionCriterionReview[] {
    if (!Array.isArray(raw)) return []
    const known = new Set(criteria.map(item => item.id))
    const reviews: FusionCriterionReview[] = []
    for (const entry of raw) {
      if (!isRecord(entry)) continue
      if (typeof entry.criterionId !== 'string' || !known.has(entry.criterionId)) continue
      if (typeof entry.passed !== 'boolean') continue
      reviews.push({
        criterionId: entry.criterionId,
        passed: entry.passed,
        score: typeof entry.score === 'number' && entry.score >= 0 && entry.score <= 1
          ? entry.score
          : undefined,
        comment: typeof entry.comment === 'string' ? entry.comment : undefined,
      })
    }
    return reviews
  }

  private weightedScore(
    criteria: readonly FusionReviewCriterion[],
    reviews: readonly FusionCriterionReview[],
  ): number {
    if (criteria.length === 0) return 1
    let score = 0
    let weight = 0
    for (const criterion of criteria) {
      const review = reviews.find(item => item.criterionId === criterion.id)
      if (!review) continue
      score += criterion.weight * (review.score ?? (review.passed ? 1 : 0))
      weight += criterion.weight
    }
    return weight > 0 ? score / weight : 0
  }
}