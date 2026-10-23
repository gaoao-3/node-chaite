import { SessionRegistry } from './session-registry'
import { ConflictError, NotFoundError } from './errors'
import type { PromptDriverContext, SessionPromptDriver } from './types'
import type { HumanApprovalRequest } from '../agent/gateway-contracts'

function approvalRequest(sessionId: string, requestId = 'req-1'): HumanApprovalRequest {
  const now = Date.now()
  return {
    platform: 'web',
    botId: 'web-console',
    sessionId,
    requestId,
    title: 'Run shell command',
    summary: 'The agent wants to run rm -rf build',
    riskLevel: 'high',
    action: {
      kind: 'shell_command',
      command: 'rm',
      args: ['-rf', 'build'],
      cwd: '/tmp/project',
    },
    options: [
      { id: 'approve_once', label: 'Approve once', outcome: 'approve', scope: 'once' },
      { id: 'deny', label: 'Deny', outcome: 'deny', destructive: true },
    ],
    createdAt: now,
    expiresAt: now + 60_000,
    requestedBy: { id: 'agent', kind: 'agent', displayName: 'Chaite' },
    integrity: { algorithm: 'sha256', digest: 'a'.repeat(64) },
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('Timed out waiting for condition')
}

describe('SessionRegistry', () => {
  it('dispatches a prompt through the driver and records a complete event stream', async () => {
    let counter = 0
    const driver: SessionPromptDriver = {
      async run(context: PromptDriverContext) {
        context.emit({ type: 'thought_chunk', delta: 'thinking...' })
        context.emit({ type: 'text_chunk', delta: 'Hello ' })
        context.emit({ type: 'text_chunk', delta: 'world' })
        context.emit({
          type: 'tool_status',
          toolCallId: 'call-1',
          toolName: 'search',
          status: 'running',
          argsPreview: '{"q":"chaite"}',
        })
        return {
          finishReason: 'stop',
          text: 'Hello world',
          usage: { totalTokens: 12 },
        }
      },
    }
    const registry = new SessionRegistry({
      driver,
      idFactory: () => `turn-${++counter}`,
    })
    const session = registry.create({ id: 'web-1', title: 'New session', model: 'test-model' })
    const seen: string[] = []
    session.onEvent(event => seen.push(event.type))

    const turn = registry.startPrompt('web-1', { prompt: 'Say hello' })
    expect(turn.turnId).toBe('turn-1')
    const result = await turn.done

    expect(result.outcome).toBe('success')
    expect(result.result?.text).toBe('Hello world')
    expect(seen).toEqual([
      'typing',
      'turn_started',
      'thought_chunk',
      'text_chunk',
      'text_chunk',
      'tool_status',
      'final_reply',
      'typing',
      'turn_finished',
    ])

    const info = session.info()
    expect(info.status).toBe('idle')
    expect(info.turnCount).toBe(1)
    expect(info.title).toBe('Say hello')
    expect(info.model).toBe('test-model')
    expect(info.lastSeq).toBe(9)
    expect(info.pendingApprovalIds).toEqual([])

    const final = session.snapshot().events.find(event => event.type === 'final_reply')
    expect(final).toMatchObject({
      type: 'final_reply',
      text: 'Hello world',
      finishReason: 'stop',
      usage: { totalTokens: 12 },
    })
  })

  it('rejects a second prompt while a turn is active', async () => {
    let release: (() => void) | undefined
    const driver: SessionPromptDriver = {
      async run() {
        await new Promise<void>((resolve) => { release = resolve })
        return { text: 'done' }
      },
    }
    const registry = new SessionRegistry({ driver })
    registry.create({ id: 'busy' })
    const turn = registry.startPrompt('busy', 'first')
    expect(() => registry.startPrompt('busy', 'second')).toThrow(ConflictError)
    release?.()
    await turn.done
  })

  it('cancels an active turn and records a cancelled turn_finished event', async () => {
    const driver: SessionPromptDriver = {
      run(context) {
        return new Promise((_resolve, reject) => {
          context.signal.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          }, { once: true })
        })
      },
    }
    const registry = new SessionRegistry({ driver })
    const session = registry.create({ id: 'cancel-me' })
    const turn = registry.startPrompt('cancel-me', 'long task')
    await waitFor(() => session.info().status === 'thinking')
    expect(registry.cancelPrompt('cancel-me', 'user clicked stop')).toBe(true)
    await expect(turn.done).rejects.toMatchObject({ status: 499 })
    const info = session.info()
    expect(info.status).toBe('idle')
    const finished = session.snapshot().events.filter(event => event.type === 'turn_finished')
    expect(finished.at(-1)).toMatchObject({ outcome: 'cancelled' })
  })

  it('routes an approval request through the session and resolves the driver promise', async () => {
    const driver: SessionPromptDriver = {
      async run(context) {
        const response = await context.requestApproval(approvalRequest(context.session.id))
        return { text: `decision:${response.decision}` }
      },
    }
    const registry = new SessionRegistry({ driver })
    const session = registry.create({ id: 'approval-session' })
    const turn = registry.startPrompt('approval-session', 'clean the build')

    await waitFor(() => session.snapshot().pendingApprovals.length === 1)
    expect(session.info().status).toBe('waiting_approval')
    const resolved = registry.respondApproval('approval-session', 'req-1', {
      decision: 'approved',
      scope: 'once',
      optionId: 'approve_once',
      reason: 'owner approved',
    })
    expect(resolved.decision).toBe('approved')

    await turn.done
    expect(session.info().status).toBe('idle')
    expect(session.info().pendingApprovalIds).toEqual([])
    const eventTypes = session.snapshot().events.map(event => event.type)
    expect(eventTypes).toContain('approval_request')
    expect(eventTypes).toContain('approval_result')
    const final = session.snapshot().events.find(event => event.type === 'final_reply')
    expect(final).toMatchObject({ text: 'decision:approved' })
  })

  it('lists, filters and deletes sessions across platforms', () => {
    const registry = new SessionRegistry()
    registry.create({ id: 'qq-1', platform: 'qq', botId: 'bot-1', title: 'QQ chat' })
    registry.create({ id: 'dsh-1', platform: 'dsh', botId: 'phone', title: 'Mobile' })
    registry.create({ id: 'web-1', platform: 'web', botId: 'console', title: 'Console' })

    expect(registry.stats()).toMatchObject({
      total: 3,
      byPlatform: { qq: 1, dsh: 1, web: 1 },
    })
    const qq = registry.list({ platform: 'qq' })
    expect(qq.total).toBe(1)
    expect(qq.items[0].id).toBe('qq-1')
    const searched = registry.list({ query: 'mobile' })
    expect(searched.items.map(session => session.id)).toEqual(['dsh-1'])
    expect(() => registry.getOrThrow('missing')).toThrow(NotFoundError)
    expect(registry.delete('web-1')).toBe(true)
    expect(registry.has('web-1')).toBe(false)
  })
})
