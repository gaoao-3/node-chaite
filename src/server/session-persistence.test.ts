import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { SessionRegistry } from './session-registry'
import { FileSessionPersistence } from './session-persistence'

function tempFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaite-sessions-'))
  return path.join(dir, 'sessions.json')
}

describe('session persistence', () => {
  it('restores sessions, titles and timelines after a restart', async () => {
    const file = tempFile()

    const first = new SessionRegistry({ persistence: new FileSessionPersistence(file) })
    const session = first.create({ id: 'web:persisted', platform: 'web', title: '持久化会话' })
    session.append({ type: 'turn_started', turnId: 'turn-1', prompt: '你好' })
    session.append({ type: 'text_chunk', turnId: 'turn-1', delta: '你好，老师' })
    session.append({
      type: 'final_reply',
      turnId: 'turn-1',
      parts: [{ type: 'markdown', markdown: '你好，老师' }],
      finishReason: 'stop',
    })
    await first.flushPersist()

    expect(fs.existsSync(file)).toBe(true)

    const second = new SessionRegistry({ persistence: new FileSessionPersistence(file) })
    const restored = await second.hydrate()
    expect(restored).toBe(1)

    const reloaded = second.getOrThrow('web:persisted')
    const info = reloaded.info()
    expect(info.title).toBe('持久化会话')
    expect(info.platform).toBe('web')
    expect(info.status).toBe('idle')
    expect(info.eventCount).toBe(3)

    const snapshot = reloaded.snapshot()
    const types = snapshot.events.map(event => event.type)
    expect(types).toContain('turn_started')
    expect(types).toContain('final_reply')
    expect(snapshot.lastSeq).toBe(3)

    // Sequence numbers must keep increasing after rehydration.
    const next = reloaded.append({ type: 'typing', state: 'start' })
    expect(next.seq).toBe(4)
  })

  it('freezes interrupted turns instead of restoring a zombie streaming state', async () => {
    const file = tempFile()

    const first = new SessionRegistry({ persistence: new FileSessionPersistence(file) })
    const session = first.create({ id: 'web:interrupted', title: '被中断的会话' })
    session.beginTurn('turn-x', '长期任务')
    session.setStatus('streaming')
    await first.flushPersist()

    const second = new SessionRegistry({ persistence: new FileSessionPersistence(file) })
    await second.hydrate()
    const reloaded = second.getOrThrow('web:interrupted')
    expect(reloaded.currentStatus).toBe('idle')
    expect(reloaded.isStreaming).toBe(false)
    expect(reloaded.info().activeTurn).toBeUndefined()
  })

  it('drops deleted sessions on the next boot', async () => {
    const file = tempFile()

    const first = new SessionRegistry({ persistence: new FileSessionPersistence(file) })
    first.create({ id: 'web:keep', title: '保留' })
    first.create({ id: 'web:drop', title: '删除' })
    await first.flushPersist()

    first.delete('web:drop')
    await first.flushPersist()

    const second = new SessionRegistry({ persistence: new FileSessionPersistence(file) })
    await second.hydrate()
    expect(second.has('web:keep')).toBe(true)
    expect(second.has('web:drop')).toBe(false)
  })

  it('works without a persistence store attached', async () => {
    const registry = new SessionRegistry()
    registry.create({ id: 'web:memory', title: '纯内存' })
    expect(registry.isPersistent).toBe(false)
    expect(await registry.hydrate()).toBe(1)
    expect(registry.has('web:memory')).toBe(true)
  })
})
