import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { FusionTaskSpec } from '../agent/gateway-contracts'
import type { EvolutionTrace } from '../agent/gateway-contracts'
import { EvolutionService, EVOLUTION_GATE_THRESHOLD, evaluateEvolutionScores } from './evolution-service'
import { FusionTaskService } from './fusion-service'
import { JsonFilePersistence } from './persistence'
import { BadRequestError, ConflictError } from './errors'

function fusionSpec(overrides: Partial<FusionTaskSpec> = {}): FusionTaskSpec {
  return {
    task_id: 'task-1',
    session_id: 'session-1',
    instruction: 'Implement the parser and return a patch',
    target_tools: [{ name: 'write_file', source: 'local', required: true }],
    diff_schema: { format: 'unified_diff', path_scope: ['src/**'] },
    review_criteria: [
      { id: 'correctness', description: 'Tests pass', weight: 0.6, required: true },
      { id: 'safety', description: 'No unsafe writes', weight: 0.4 },
    ],
    created_at: 1_700_000_000_000,
    ...overrides,
  }
}

function evolutionTrace(overrides: Partial<EvolutionTrace> = {}): EvolutionTrace {
  return {
    traceId: 'trace-1',
    sessionId: 'session-1',
    platform: 'web',
    botId: 'web-console',
    userIntent: {
      raw: 'Build a safe release checklist',
      normalized: 'build release checklist',
      category: 'release',
      confidence: 0.9,
    },
    outcome: 'success',
    toolCalls: [
      {
        callId: 'call-1',
        name: 'read_file',
        arguments: { path: 'package.json' },
        status: 'ok',
        attempt: 1,
        resultPreview: '{"name":"chaite"}',
        startedAt: 1_700_000_000_000,
        completedAt: 1_700_000_000_100,
      },
    ],
    errorRetries: [],
    scores: {
      correctness: 0.9,
      efficiency: 0.85,
      safety: 0.95,
      reusability: 0.8,
    },
    draftSkillMd: '# Release checklist\n\n1. Run tests.\n2. Build.\n3. Publish.\n',
    draftSkillName: 'release-checklist',
    lessons: ['Always run the full test suite first'],
    startedAt: 1_700_000_000_000,
    completedAt: 1_700_000_001_000,
    ...overrides,
  }
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chaite-web-test-'))
}

describe('FusionTaskService', () => {
  it('creates, lists, submits and reviews a Fusion task', () => {
    const service = new FusionTaskService({ now: () => 1_700_000_000_500 })
    const created = service.create(fusionSpec())
    expect(created).toMatchObject({
      id: 'task-1',
      status: 'queued',
      spec: { session_id: 'session-1' },
    })
    expect(service.list({ sessionId: 'session-1' }).total).toBe(1)
    expect(service.list({ status: 'approved' }).total).toBe(0)

    const submitted = service.submitResult('task-1', {
      summary: 'parser implemented',
      diff: '--- a/src/parser.ts\n+++ b/src/parser.ts\n',
      tests: [{ name: 'jest', passed: true }],
    })
    expect(submitted.status).toBe('review')
    expect(submitted.result?.diffFormat).toBe('unified_diff')

    const reviewed = service.review('task-1', {
      decision: 'approved',
      reviewer: 'main-agent',
      criteria: [
        { criterionId: 'correctness', passed: true },
        { criterionId: 'safety', passed: true },
      ],
    })
    expect(reviewed.status).toBe('approved')
    expect(reviewed.reviews).toHaveLength(1)
    expect(reviewed.reviews[0].score).toBeCloseTo(1)
    expect(service.stats().byStatus.approved).toBe(1)
  })

  it('rejects invalid specs and duplicate task ids', () => {
    const service = new FusionTaskService()
    expect(() => service.create(fusionSpec({
      review_criteria: [
        { id: 'only', description: 'bad weights', weight: 0.5 },
      ],
    }))).toThrow(BadRequestError)
    service.create(fusionSpec())
    expect(() => service.create(fusionSpec())).toThrow(ConflictError)
  })

  it('accepts an explicit approval without per-criterion scores', () => {
    const service = new FusionTaskService()
    service.create(fusionSpec())
    const reviewed = service.review('task-1', { decision: 'approved', reviewer: 'teacher' })
    expect(reviewed.status).toBe('approved')
    expect(reviewed.reviews[0].score).toBeUndefined()
  })

  it('turns a review with a failed required criterion into a rejection', () => {
    const service = new FusionTaskService()
    service.create(fusionSpec())
    const reviewed = service.review('task-1', {
      decision: 'approved',
      criteria: [
        { criterionId: 'correctness', passed: false },
        { criterionId: 'safety', passed: true },
      ],
    })
    expect(reviewed.status).toBe('rejected')
    expect(reviewed.reviews[0].score).toBeCloseTo(0.4)
  })

  it('persists and hydrates tasks', async () => {
    const directory = tempDir()
    const file = path.join(directory, 'fusion.json')
    const first = new FusionTaskService({ persistence: new JsonFilePersistence(file) })
    first.create(fusionSpec())
    await first.flush()

    const second = new FusionTaskService({ persistence: new JsonFilePersistence(file) })
    expect(await second.hydrate()).toBe(1)
    expect(second.get('task-1')?.spec.instruction).toContain('Implement the parser')
  })
})

describe('EvolutionService', () => {
  it('evaluates the 4-dimensional gate', () => {
    const pass = evaluateEvolutionScores(evolutionTrace().scores)
    expect(pass.gatePassed).toBe(true)
    expect(pass.average).toBeGreaterThan(EVOLUTION_GATE_THRESHOLD)
    const fail = evaluateEvolutionScores({ correctness: 0.9, efficiency: 0.9, safety: 0.5, reusability: 0.9 })
    expect(fail.gatePassed).toBe(false)
  })

  it('merges a passing trace into the skills directory with frontmatter', async () => {
    const skillsDir = tempDir()
    const service = new EvolutionService({ skillsDir })
    const record = service.create(evolutionTrace())
    expect(record.gatePassed).toBe(true)
    expect(record.averageScore).toBeCloseTo(0.875)

    const merged = await service.merge('trace-1', { mergedBy: 'teacher' })
    expect(merged.skill.name).toBe('release-checklist')
    const content = fs.readFileSync(merged.skill.path, 'utf8')
    expect(content).toContain('name: release-checklist')
    expect(content).toContain('sourceTrace: "trace-1"')
    expect(content).toContain('# Release checklist')
    expect(merged.record.status).toBe('merged')
    expect(merged.record.mergedAt).toBeDefined()
    await expect(service.merge('trace-1')).rejects.toThrow(ConflictError)
  })

  it('refuses to merge a failing trace unless force is set', async () => {
    const skillsDir = tempDir()
    const service = new EvolutionService({ skillsDir })
    service.create(evolutionTrace({
      traceId: 'trace-weak',
      draftSkillName: 'weak-skill',
      scores: { correctness: 0.5, efficiency: 0.5, safety: 0.5, reusability: 0.5 },
    }))
    await expect(service.merge('trace-weak')).rejects.toThrow(/did not pass/)
    const forced = await service.merge('trace-weak', { force: true, skillName: 'forced-skill' })
    expect(forced.skill.name).toBe('forced-skill')
    expect(fs.existsSync(forced.skill.path)).toBe(true)
  })

  it('rejects an invalid trace', () => {
    const service = new EvolutionService({ skillsDir: tempDir() })
    expect(() => service.create({ traceId: 'bad' })).toThrow(BadRequestError)
  })

  it('persists and hydrates traces', async () => {
    const directory = tempDir()
    const file = path.join(directory, 'traces.json')
    const first = new EvolutionService({
      persistence: new JsonFilePersistence(file),
      skillsDir: directory,
    })
    first.create(evolutionTrace())
    await first.flush()
    const second = new EvolutionService({
      persistence: new JsonFilePersistence(file),
      skillsDir: directory,
    })
    expect(await second.hydrate()).toBe(1)
    expect(second.get('trace-1')?.gatePassed).toBe(true)
  })
})
