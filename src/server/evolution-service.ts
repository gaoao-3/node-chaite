import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { EvolutionTrace, EvolutionScores } from '../agent/gateway-contracts'
import { validateEvolutionTrace } from '../agent/gateway-validators'
import type { SkillRegistry } from '../agent/skills/SkillRegistry'
import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError } from './errors'
import type { CollectionPersistence } from './persistence'
import { PersistenceQueue } from './persistence'

export const EVOLUTION_TRACE_STATUSES = [
  'candidate',
  'approved',
  'rejected',
  'merged',
] as const
export type EvolutionTraceStatus = (typeof EVOLUTION_TRACE_STATUSES)[number]

/**
 * The 4-dimensional gate from the Hermes / nekocode loop: every one of
 * correctness, efficiency, safety and reusability must reach 6.0/8.0.
 */
export const EVOLUTION_GATE_THRESHOLD = 0.75

export interface EvolutionTraceRecord {
  id: string
  trace: EvolutionTrace
  status: EvolutionTraceStatus
  averageScore: number
  gatePassed: boolean
  createdAt: number
  updatedAt: number
  reviewedAt?: number
  reviewedBy?: string
  mergedAt?: number
  skillName?: string
}

export interface EvolutionServiceOptions {
  persistence?: CollectionPersistence<EvolutionTraceRecord>
  /** Active skills directory. Required when no registry is available. */
  skillsDir?: string
  /** Registry to reload after a merge. */
  getRegistry?: () => SkillRegistry | undefined
  now?: () => number
  onPersistError?: (error: unknown) => void
}

export interface EvolutionListFilter {
  status?: EvolutionTraceStatus
  sessionId?: string
  minScore?: number
  gatePassed?: boolean
  limit?: number
  offset?: number
}

export interface EvolutionListResult {
  items: EvolutionTraceRecord[]
  total: number
  limit: number
  offset: number
}

export interface MergeEvolutionInput {
  skillName?: string
  overwrite?: boolean
  /** Bypass the 4-dimensional gate. Should only be used by an owner. */
  force?: boolean
  mergedBy?: string
  /** Optional extra system prompt written beside SKILL.md. */
  systemPrompt?: string
}

export interface MergeEvolutionResult {
  record: EvolutionTraceRecord
  skill: {
    name: string
    path: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStatus(value: unknown): value is EvolutionTraceStatus {
  return typeof value === 'string' && (EVOLUTION_TRACE_STATUSES as readonly string[]).includes(value)
}

function scoreAverage(scores: EvolutionScores): number {
  const values = [scores.correctness, scores.efficiency, scores.safety, scores.reusability]
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function passesGate(scores: EvolutionScores): boolean {
  return scores.correctness >= EVOLUTION_GATE_THRESHOLD
    && scores.efficiency >= EVOLUTION_GATE_THRESHOLD
    && scores.safety >= EVOLUTION_GATE_THRESHOLD
    && scores.reusability >= EVOLUTION_GATE_THRESHOLD
}

function normalizeSkillName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function validSkillName(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)
}

function ensureFrontmatter(markdown: string, name: string, trace: EvolutionTrace): string {
  const trimmed = markdown.trimStart()
  if (/^---\s*\r?\n/.test(trimmed)) return markdown
  const description = trace.userIntent.normalized
    ?? trace.userIntent.raw.replace(/\s+/g, ' ').trim().slice(0, 160)
    ?? name
  const lessons = (trace.lessons ?? []).slice(0, 8)
  const keywordLines = lessons.length > 0
    ? lessons.map(lesson => `  - ${JSON.stringify(lesson)}`).join('\n')
    : '  - self-evolution\n  - learned-procedure'
  return [
    '---',
    `name: ${name}`,
    `description: ${JSON.stringify(description || name)}`,
    'version: 1.0.0',
    'executionMode: direct',
    'keywords:',
    keywordLines,
    'metadata:',
    `  sourceTrace: ${JSON.stringify(trace.traceId)}`,
    '---',
    '',
    markdown,
  ].join('\n')
}

/**
 * Hermes-style evolution trace store plus the merge gate that turns a passing
 * trace's draft `SKILL.md` into an active skill.
 */
export class EvolutionService {
  private readonly traces = new Map<string, EvolutionTraceRecord>()
  private readonly now: () => number
  private readonly persistence?: CollectionPersistence<EvolutionTraceRecord>
  private readonly persistQueue: PersistenceQueue<EvolutionTraceRecord>

  constructor(private readonly options: EvolutionServiceOptions = {}) {
    this.now = options.now ?? Date.now
    this.persistence = options.persistence
    this.persistQueue = new PersistenceQueue<EvolutionTraceRecord>(
      () => [...this.traces.values()],
      this.persistence,
      options.onPersistError,
    )
  }

  async hydrate(): Promise<number> {
    if (!this.persistence) return 0
    const items = await this.persistence.load()
    let loaded = 0
    for (const item of items) {
      if (!isRecord(item) || typeof item.id !== 'string' || !isRecord(item.trace)) continue
      if (!validateEvolutionTrace(item.trace).ok) continue
      this.traces.set(item.id, item as unknown as EvolutionTraceRecord)
      loaded += 1
    }
    return loaded
  }

  flush(): Promise<void> {
    return this.persistQueue.flush()
  }

  create(input: unknown): EvolutionTraceRecord {
    const validation = validateEvolutionTrace(input)
    if (!validation.ok || !validation.value) {
      throw new BadRequestError('Invalid EvolutionTrace', {
        code: 'INVALID_EVOLUTION_TRACE',
        details: validation.issues,
      })
    }
    const trace = validation.value
    if (this.traces.has(trace.traceId)) {
      throw new ConflictError(`Evolution trace "${trace.traceId}" already exists`, {
        code: 'EVOLUTION_TRACE_EXISTS',
      })
    }
    const timestamp = this.now()
    const record: EvolutionTraceRecord = {
      id: trace.traceId,
      trace,
      status: 'candidate',
      averageScore: scoreAverage(trace.scores),
      gatePassed: passesGate(trace.scores),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.traces.set(record.id, record)
    this.persistQueue.schedule()
    return record
  }

  get(id: string): EvolutionTraceRecord | undefined {
    return this.traces.get(id)
  }

  getOrThrow(id: string): EvolutionTraceRecord {
    const record = this.traces.get(id)
    if (!record) {
      throw new NotFoundError(`Evolution trace "${id}" not found`, { code: 'EVOLUTION_TRACE_NOT_FOUND' })
    }
    return record
  }

  list(filter: EvolutionListFilter = {}): EvolutionListResult {
    const limit = Math.min(200, Math.max(1, filter.limit ?? 50))
    const offset = Math.max(0, filter.offset ?? 0)
    let items = [...this.traces.values()]
    if (filter.status) items = items.filter(record => record.status === filter.status)
    if (filter.sessionId) items = items.filter(record => record.trace.sessionId === filter.sessionId)
    if (typeof filter.minScore === 'number') {
      items = items.filter(record => record.averageScore >= filter.minScore!)
    }
    if (typeof filter.gatePassed === 'boolean') {
      items = items.filter(record => record.gatePassed === filter.gatePassed)
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt)
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    }
  }

  approve(id: string, reviewedBy?: string): EvolutionTraceRecord {
    return this.setReviewStatus(id, 'approved', reviewedBy)
  }

  reject(id: string, reviewedBy?: string): EvolutionTraceRecord {
    return this.setReviewStatus(id, 'rejected', reviewedBy)
  }

  /**
   * Merge a passing trace into the active skills directory. The write is
   * path-confined and overwriting an existing skill requires `overwrite: true`.
   */
  async merge(id: string, input: MergeEvolutionInput = {}): Promise<MergeEvolutionResult> {
    const record = this.getOrThrow(id)
    if (record.status === 'merged') {
      throw new ConflictError(`Evolution trace "${id}" has already been merged`, {
        code: 'EVOLUTION_ALREADY_MERGED',
      })
    }
    if (!record.gatePassed && !input.force) {
      throw new ConflictError(
        `Evolution trace did not pass the 4-dimensional gate (${EVOLUTION_GATE_THRESHOLD * 8}/8); `
        + 'improve the scores or pass force: true',
        {
          code: 'EVOLUTION_GATE_FAILED',
          details: {
            scores: record.trace.scores,
            threshold: EVOLUTION_GATE_THRESHOLD,
          },
        },
      )
    }
    const draft = record.trace.draftSkillMd?.trim()
    if (!draft) {
      throw new BadRequestError('Evolution trace has no draftSkillMd to merge', {
        code: 'EVOLUTION_NO_DRAFT',
      })
    }

    const requested = input.skillName?.trim()
      || record.trace.draftSkillName?.trim()
      || `evo-${record.trace.traceId}`
    const name = normalizeSkillName(requested)
    if (!name || !validSkillName(name)) {
      throw new BadRequestError(`Invalid skill name "${requested}"`, { code: 'INVALID_SKILL_NAME' })
    }

    const registry = this.options.getRegistry?.()
    const root = this.options.skillsDir ?? registry?.getSkillsDir()
    if (!root) {
      throw new ServiceUnavailableError('Skill registry is not configured', {
        code: 'SKILL_REGISTRY_UNAVAILABLE',
      })
    }
    const rootDir = path.resolve(root)
    const targetDir = path.resolve(rootDir, name)
    if (targetDir !== rootDir && !targetDir.startsWith(rootDir + path.sep)) {
      throw new BadRequestError('Skill path escapes the skills directory', { code: 'INVALID_SKILL_NAME' })
    }
    const skillFile = path.join(targetDir, 'SKILL.md')
    if (fs.existsSync(skillFile) && !input.overwrite) {
      throw new ConflictError(`Skill "${name}" already exists; pass overwrite: true to replace it`, {
        code: 'SKILL_EXISTS',
      })
    }

    const marker = Symbol.for('chaite.evolution.mergePaths')
    const inFlight = ((globalThis as Record<symbol, Set<string>>)[marker] ??= new Set<string>())
    if (inFlight.has(skillFile)) {
      throw new ConflictError(`Skill "${name}" is already being merged`, { code: 'SKILL_MERGE_IN_PROGRESS' })
    }
    inFlight.add(skillFile)
    try {
      fs.mkdirSync(targetDir, { recursive: true })
      const content = ensureFrontmatter(draft, name, record.trace)
      fs.writeFileSync(skillFile, content, 'utf8')
      if (input.systemPrompt && input.systemPrompt.trim()) {
        fs.writeFileSync(path.join(targetDir, 'system-prompt.md'), input.systemPrompt, 'utf8')
      }
    } finally {
      inFlight.delete(skillFile)
    }

    if (registry) {
      // Await the reload so a GET /skills immediately after the merge sees the
      // new skill instead of racing the registry's clear-and-scan.
      await registry.load()
    }

    const timestamp = this.now()
    record.status = 'merged'
    record.skillName = name
    record.mergedAt = timestamp
    record.updatedAt = timestamp
    record.reviewedBy = input.mergedBy ?? record.reviewedBy
    this.persistQueue.schedule()

    return {
      record,
      skill: { name, path: skillFile },
    }
  }

  delete(id: string): boolean {
    const deleted = this.traces.delete(id)
    if (deleted) this.persistQueue.schedule()
    return deleted
  }

  clear(): void {
    this.traces.clear()
    this.persistQueue.schedule()
  }

  stats(): {
    total: number
    byStatus: Record<string, number>
    gatePassed: number
    averageScore: number
  } {
    const byStatus: Record<string, number> = {}
    let gatePassed = 0
    let sum = 0
    for (const record of this.traces.values()) {
      byStatus[record.status] = (byStatus[record.status] ?? 0) + 1
      if (record.gatePassed) gatePassed += 1
      sum += record.averageScore
    }
    return {
      total: this.traces.size,
      byStatus,
      gatePassed,
      averageScore: this.traces.size > 0 ? sum / this.traces.size : 0,
    }
  }

  private setReviewStatus(
    id: string,
    status: 'approved' | 'rejected',
    reviewedBy?: string,
  ): EvolutionTraceRecord {
    const record = this.getOrThrow(id)
    if (record.status === 'merged') {
      throw new ConflictError('Merged traces cannot be re-reviewed', { code: 'EVOLUTION_ALREADY_MERGED' })
    }
    const timestamp = this.now()
    record.status = status
    record.reviewedBy = reviewedBy
    record.reviewedAt = timestamp
    record.updatedAt = timestamp
    this.persistQueue.schedule()
    return record
  }
}

/** Exported for tests and dashboards. */
export function evaluateEvolutionScores(scores: EvolutionScores): {
  average: number
  gatePassed: boolean
} {
  return { average: scoreAverage(scores), gatePassed: passesGate(scores) }
}

/** Utility used by the default web API when seeding a trace without a draft name. */
export function deriveEvolutionSkillName(trace: EvolutionTrace): string {
  return normalizeSkillName(trace.draftSkillName || `evo-${randomUUID()}`)
}
