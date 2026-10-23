import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { FusionTaskSpec, EvolutionTrace } from '../agent/gateway-contracts'
import { SkillRegistry } from '../agent/skills/SkillRegistry'
import { EvolutionService } from './evolution-service'
import { FusionTaskService } from './fusion-service'
import { SessionRegistry } from './session-registry'
import { SkillsService } from './skills-service'
import { createAgentWebApiRouter } from './web-api'
import type { SessionPromptDriver } from './types'

interface SseFrame {
  data: Record<string, unknown>
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}

async function readSseUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (frames: SseFrame[]) => boolean,
  timeoutMs = 3000,
): Promise<SseFrame[]> {
  const decoder = new TextDecoder()
  let buffer = ''
  const frames: SseFrame[] = []
  while (true) {
    let separator = buffer.indexOf('\n\n')
    while (separator >= 0) {
      const raw = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      const dataLine = raw.split('\n').find(line => line.startsWith('data: '))
      if (dataLine) frames.push({ data: JSON.parse(dataLine.slice(6)) as Record<string, unknown> })
      if (predicate(frames)) return frames
      separator = buffer.indexOf('\n\n')
    }
    const chunk = await withTimeout(reader.read(), timeoutMs, 'timed out reading SSE')
    if (chunk.done) return frames
    buffer += decoder.decode(chunk.value, { stream: true })
  }
}

function fusionSpec(): FusionTaskSpec {
  return {
    task_id: 'api-fusion-1',
    session_id: 'api-session',
    instruction: 'Return a patch for the greeting endpoint',
    target_tools: [{ name: 'write_file', source: 'local' }],
    diff_schema: { format: 'unified_diff' },
    review_criteria: [
      { id: 'correctness', description: 'Tests pass', weight: 0.7, required: true },
      { id: 'safety', description: 'Safe write', weight: 0.3 },
    ],
    created_at: 1_700_000_000_000,
  }
}

function evolutionTrace(): EvolutionTrace {
  return {
    traceId: 'api-trace-1',
    sessionId: 'api-session',
    platform: 'web',
    userIntent: { raw: 'Create a greeting endpoint' },
    outcome: 'success',
    toolCalls: [],
    errorRetries: [],
    scores: { correctness: 0.9, efficiency: 0.9, safety: 0.9, reusability: 0.9 },
    draftSkillMd: '# Greeting endpoint\n\n1. Create route.\n2. Add test.\n',
    draftSkillName: 'greeting-endpoint',
    startedAt: 1_700_000_000_000,
    completedAt: 1_700_000_001_000,
  }
}

describe('Agent web API', () => {
  let server: Server
  let baseUrl: string
  let registry: SkillRegistry
  let skillsDir: string
  let dataDir: string
  let sessions: SessionRegistry
  let fusion: FusionTaskService
  let evolution: EvolutionService

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaite-api-test-'))
    skillsDir = path.join(dataDir, 'skills')
    const skillDir = path.join(skillsDir, 'demo-skill')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: demo-skill',
      'description: Demo skill used by the API test',
      'version: 1.2.3',
      'executionMode: direct',
      'keywords:',
      '  - demo',
      'allowedTools:',
      '  - read_file',
      'readonly: true',
      '---',
      '',
      '# Demo instructions',
    ].join('\n'), 'utf8')
    registry = new SkillRegistry(skillsDir)
    await registry.load()

    const driver: SessionPromptDriver = {
      async run(context) {
        context.emit({ type: 'thought_chunk', delta: 'planning' })
        context.emit({ type: 'text_chunk', delta: 'pong' })
        return { text: 'pong', finishReason: 'stop', usage: { totalTokens: 3 } }
      },
    }
    sessions = new SessionRegistry({ driver })
    fusion = new FusionTaskService()
    evolution = new EvolutionService({ skillsDir, getRegistry: () => registry })
    const app = express()
    app.use(express.json())
    app.use('/api/agent', createAgentWebApiRouter({
      sessions,
      fusion,
      evolution,
      skills: new SkillsService(() => registry),
      sse: { heartbeatMs: 100_000 },
    }))
    server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', () => resolve()))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}/api/agent`
  })

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  async function jsonRequest(pathname: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    return { status: response.status, body: await response.json() as Record<string, unknown> }
  }

  it('creates and lists sessions', async () => {
    const created = await jsonRequest('/sessions', {
      method: 'POST',
      body: JSON.stringify({ id: 'api-session', title: 'API session', platform: 'web', model: 'test-model' }),
    })
    expect(created.status).toBe(201)
    expect(created.body.success).toBe(true)
    expect((created.body.data as Record<string, unknown>).id).toBe('api-session')

    const listed = await jsonRequest('/sessions?platform=web')
    expect(listed.status).toBe(200)
    const data = listed.body.data as { total: number; items: Array<Record<string, unknown>> }
    expect(data.total).toBe(1)
    expect(data.items[0].status).toBe('idle')
  })

  it('streams prompt events over SSE and completes the turn', async () => {
    const abort = new AbortController()
    const sseResponse = await fetch(`${baseUrl}/sessions/api-session/events`, { signal: abort.signal })
    expect(sseResponse.status).toBe(200)
    expect(sseResponse.headers.get('content-type')).toContain('text/event-stream')
    const reader = sseResponse.body!.getReader()

    const prompt = await jsonRequest('/sessions/api-session/prompt', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'ping' }),
    })
    expect(prompt.status).toBe(202)
    expect((prompt.body.data as Record<string, unknown>).accepted).toBe(true)

    const frames = await readSseUntil(reader, list => list.some(frame => frame.data.type === 'final_reply'))
    const types = frames.map(frame => frame.data.type)
    expect(types).toContain('connected')
    expect(types).toContain('session_snapshot')
    expect(types).toContain('thought_chunk')
    expect(types).toContain('text_chunk')
    expect(types).toContain('final_reply')
    const final = frames.find(frame => frame.data.type === 'final_reply')
    expect(final?.data).toMatchObject({ text: 'pong', finishReason: 'stop' })

    abort.abort()
    await reader.cancel().catch(() => {})

    const session = await jsonRequest('/sessions/api-session')
    expect((session.body.data as { session: Record<string, unknown> }).session).toMatchObject({
      status: 'idle',
      turnCount: 1,
    })
  })

  it('serves Fusion task creation, listing and validation errors', async () => {
    const created = await jsonRequest('/fusion/tasks', {
      method: 'POST',
      body: JSON.stringify(fusionSpec()),
    })
    expect(created.status).toBe(201)
    expect((created.body.data as Record<string, unknown>).status).toBe('queued')

    const listed = await jsonRequest('/fusion/tasks?sessionId=api-session')
    expect(listed.status).toBe(200)
    expect((listed.body.data as { total: number }).total).toBe(1)

    const invalid = await jsonRequest('/fusion/tasks', {
      method: 'POST',
      body: JSON.stringify({ ...fusionSpec(), task_id: 'bad-fusion', review_criteria: [] }),
    })
    expect(invalid.status).toBe(400)
    expect(invalid.body.success).toBe(false)
    expect((invalid.body.error as Record<string, unknown>).code).toBe('INVALID_FUSION_TASK')
  })

  it('serves evolution traces and merges a passing trace into a skill', async () => {
    const created = await jsonRequest('/evolution/traces', {
      method: 'POST',
      body: JSON.stringify(evolutionTrace()),
    })
    expect(created.status).toBe(201)
    expect((created.body.data as Record<string, unknown>).gatePassed).toBe(true)

    const listed = await jsonRequest('/evolution/traces?gatePassed=true')
    expect((listed.body.data as { total: number }).total).toBe(1)

    const merged = await jsonRequest('/evolution/traces/api-trace-1/merge', {
      method: 'POST',
      body: JSON.stringify({ skillName: 'api-learned-skill', mergedBy: 'teacher' }),
    })
    expect(merged.status).toBe(200)
    const data = merged.body.data as { record: Record<string, unknown>; skill: { name: string; path: string } }
    expect(data.record.status).toBe('merged')
    expect(data.skill.name).toBe('api-learned-skill')
    expect(fs.existsSync(data.skill.path)).toBe(true)
    expect(fs.readFileSync(data.skill.path, 'utf8')).toContain('name: api-learned-skill')
  })

  it('serves the mounted skill catalogue and instructions', async () => {
    const listed = await jsonRequest('/skills')
    expect(listed.status).toBe(200)
    const data = listed.body.data as { items: Array<Record<string, unknown>>; total: number; available: boolean }
    expect(data.available).toBe(true)
    expect(data.total).toBeGreaterThanOrEqual(1)
    const demo = data.items.find(item => item.name === 'demo-skill')
    expect(demo).toMatchObject({
      executionMode: 'direct',
      readonly: true,
      allowedTools: ['read_file'],
    })

    const detail = await jsonRequest('/skills/demo-skill')
    expect(detail.status).toBe(200)
    expect((detail.body.data as Record<string, unknown>).instructions).toContain('# Demo instructions')
  })

  it('maps missing resources to stable error envelopes', async () => {
    const missing = await jsonRequest('/sessions/does-not-exist')
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({
      success: false,
      code: -1,
      error: { code: 'SESSION_NOT_FOUND' },
    })
  })
})
