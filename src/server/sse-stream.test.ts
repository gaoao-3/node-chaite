import { AgentSession } from './session-registry'
import { closeAllAgentEventStreams, createAgentEventStream } from './sse-stream'

interface ParsedSseEvent {
  id?: string
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

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (events: ParsedSseEvent[]) => boolean,
  timeoutMs = 1500,
): Promise<ParsedSseEvent[]> {
  const decoder = new TextDecoder()
  let buffer = ''
  const events: ParsedSseEvent[] = []
  while (true) {
    let separator = buffer.indexOf('\n\n')
    while (separator >= 0) {
      const frame = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      if (frame.startsWith(':')) {
        // SSE comment used to flush headers.
      } else {
        const lines = frame.split('\n')
        const idLine = lines.find(line => line.startsWith('id: '))
        const dataLine = lines.find(line => line.startsWith('data: '))
        if (dataLine) {
          events.push({
            id: idLine?.slice(4),
            data: JSON.parse(dataLine.slice(6)) as Record<string, unknown>,
          })
        }
      }
      if (predicate(events)) return events
      separator = buffer.indexOf('\n\n')
    }
    const chunk = await withTimeout(reader.read(), timeoutMs, 'timed out reading SSE stream')
    if (chunk.done) return events
    buffer += decoder.decode(chunk.value, { stream: true })
  }
}

describe('createAgentEventStream', () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  it('sends connected, a session snapshot and periodic heartbeats', async () => {
    const session = new AgentSession({ id: 'sse-heartbeat' })
    session.append({ type: 'text_chunk', delta: 'hello' })
    const stream = createAgentEventStream(
      {},
      session,
      { heartbeatMs: 20, snapshotLimit: 20 },
    )
    const reader = stream.getReader()
    const events = await readUntil(reader, list =>
      list.some(event => event.data.type === 'connected')
      && list.some(event => event.data.type === 'session_snapshot')
      && list.some(event => event.data.type === 'heartbeat'),
    )
    const connected = events.find(event => event.data.type === 'connected')
    expect(connected?.data).toMatchObject({
      sessionId: 'sse-heartbeat',
      isStreaming: false,
      heartbeatMs: 20,
    })
    const snapshot = events.find(event => event.data.type === 'session_snapshot')
    expect(snapshot?.data).toMatchObject({
      sessionId: 'sse-heartbeat',
      lastSeq: 1,
    })
    expect((snapshot?.data.events as Array<{ type: string }>).map(event => event.type)).toContain('text_chunk')
    const heartbeat = events.find(event => event.data.type === 'heartbeat')
    expect(heartbeat?.data.sessionId).toBe('sse-heartbeat')
    await reader.cancel()
  })

  it('forwards live events after the snapshot', async () => {
    const session = new AgentSession({ id: 'sse-live' })
    const stream = createAgentEventStream({}, session, { heartbeatMs: 100_000 })
    const reader = stream.getReader()
    await readUntil(reader, events => events.some(event => event.data.type === 'session_snapshot'))
    session.append({ type: 'thought_chunk', delta: 'live thought' })
    const events = await readUntil(reader, list => list.some(event => event.data.type === 'thought_chunk'))
    const thought = events.find(event => event.data.type === 'thought_chunk')
    expect(thought?.data).toMatchObject({ delta: 'live thought', sessionId: 'sse-live' })
    expect(thought?.id).toBe('1')
    await reader.cancel()
  })

  it('replays only events after Last-Event-ID', async () => {
    const session = new AgentSession({ id: 'sse-replay' })
    session.append({ type: 'text_chunk', delta: 'one' })
    session.append({ type: 'text_chunk', delta: 'two' })
    session.append({ type: 'text_chunk', delta: 'three' })
    const stream = createAgentEventStream({ lastEventId: '1' }, session, { heartbeatMs: 100_000 })
    const reader = stream.getReader()
    const events = await readUntil(reader, list => list.some(event => event.data.type === 'session_snapshot'))
    const snapshot = events.find(event => event.data.type === 'session_snapshot')
    const replayed = (snapshot?.data.events as Array<{ type: string; seq: number }>)
    expect(replayed.map(event => event.seq)).toEqual([2, 3])
    await reader.cancel()
  })

  it('drops rebuildable deltas but keeps the stream alive under backpressure', async () => {
    const session = new AgentSession({ id: 'sse-drop' })
    const stream = createAgentEventStream({}, session, {
      heartbeatMs: 100_000,
      highWaterMarkBytes: 1024,
      backlogLimitBytes: 64 * 1024,
    })
    const reader = stream.getReader()
    for (let index = 0; index < 40; index += 1) {
      session.append({ type: 'text_chunk', delta: 'x'.repeat(2048) })
    }
    session.append({ type: 'final_reply', parts: [{ type: 'text', text: 'done' }], text: 'done', finishReason: 'stop' })
    const events = await readUntil(reader, list => list.some(event => event.data.type === 'final_reply'))
    expect(events.some(event => event.data.type === 'final_reply')).toBe(true)
    await reader.cancel()
  })

  it('terminates the stream when a non-droppable backlog exceeds the limit', async () => {
    const session = new AgentSession({ id: 'sse-overflow' })
    const stream = createAgentEventStream({}, session, {
      heartbeatMs: 100_000,
      highWaterMarkBytes: 1024,
      backlogLimitBytes: 4096,
    })
    const reader = stream.getReader()
    for (let index = 0; index < 20; index += 1) {
      session.append({
        type: 'error',
        fatal: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'x'.repeat(2048),
          retryable: false,
        },
      })
    }
    let rejected = false
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const chunk = await withTimeout(reader.read(), 1000, 'stream did not fail')
        if (chunk.done) break
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        rejected = true
        break
      }
    }
    expect(rejected).toBe(true)
  })

  it('closes every live stream on shutdown', async () => {
    const session = new AgentSession({ id: 'sse-shutdown' })
    const stream = createAgentEventStream({}, session, { heartbeatMs: 100_000 })
    const reader = stream.getReader()
    await readUntil(reader, events => events.some(event => event.data.type === 'session_snapshot'))
    closeAllAgentEventStreams()
    await expect(reader.read()).rejects.toThrow()
  })
})
