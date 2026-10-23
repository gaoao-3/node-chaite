import { randomUUID } from 'node:crypto'
import type {
  AgentEventStreamSession,
  AgentSessionSnapshot,
  AgentStreamEvent,
  AgentWebEvent,
  ConnectedEvent,
  HeartbeatEvent,
  SessionSnapshotEvent,
} from './types'

/**
 * How often an agent stream sends `{ type: "heartbeat" }`. It is a data event
 * (not an SSE comment) so `EventSource` clients see it: a stream silent for a
 * few heartbeats is dead and should reconnect.
 */
export const AGENT_EVENT_HEARTBEAT_MS = 30_000

/**
 * How long `tool_status` running/requested updates wait to be coalesced. Every
 * update supersedes the previous one for the same tool call; a chatty tool must
 * not fill the socket with intermediate snapshots.
 */
export const TOOL_UPDATE_COALESCE_MS = 150

/** Above this backlog, deltas that a later event repairs may be dropped. */
export const STREAM_HIGH_WATER_MARK_BYTES = 512 * 1024

/** Above this backlog, the stream is terminated so the client re-snapshots. */
export const DEFAULT_BACKLOG_LIMIT_BYTES = 16 * 1024 * 1024

const BACKPRESSURE_LOG_INTERVAL_MS = 60_000
let lastBackpressureLogAt = 0

export interface AgentEventStreamSessionLike extends AgentEventStreamSession {
  readonly platform: AgentEventStreamSession['platform']
  readonly botId: string
  readonly lastSequence: number
}

export interface AgentEventStreamRequest {
  signal?: AbortSignal
  /** Value of the `Last-Event-ID` header, if the client reconnected. */
  lastEventId?: string | null
  /** Query-string equivalent of `Last-Event-ID`. */
  since?: number | null
}

export interface AgentEventStreamOptions {
  heartbeatMs?: number
  highWaterMarkBytes?: number
  backlogLimitBytes?: number
  snapshotLimit?: number
}

function resolveBacklogLimitBytes(explicit?: number): number {
  if (explicit !== undefined && Number.isFinite(explicit) && explicit > 0) {
    return Math.max(1024, Math.floor(explicit))
  }
  const raw = Number(
    process.env.CHAITE_WEB_SSE_BACKLOG_LIMIT_BYTES
    ?? process.env.PI_WEB_SSE_BACKLOG_LIMIT_BYTES,
  )
  return Number.isFinite(raw) && raw >= 64 * 1024 ? raw : DEFAULT_BACKLOG_LIMIT_BYTES
}

function logBackpressure(
  sessionId: string,
  queuedBytes: number,
  limitBytes: number,
  droppedEvents: number,
  closing: boolean,
): void {
  const now = Date.now()
  if (now - lastBackpressureLogAt < BACKPRESSURE_LOG_INTERVAL_MS) return
  lastBackpressureLogAt = now
  const queued = `${Math.round(queuedBytes / 1024)} KB`
  if (closing) {
    console.warn(
      `[chaite-web] Agent event stream for ${sessionId} closed: client backlog ${queued} `
      + `exceeds ${Math.round(limitBytes / 1024)} KB; it reconnects and re-snapshots.`,
    )
  } else {
    console.warn(
      `[chaite-web] Agent event stream for ${sessionId} is behind (${queued} queued): `
      + `dropping rebuildable deltas (${droppedEvents} so far).`,
    )
  }
}

// Streams must also be closable from the process SIGINT/SIGTERM hook. Next/Node
// may load this module twice (route graph + instrumentation graph), so the
// registry lives on globalThis under a Symbol.for key.
const CLOSER_REGISTRY: symbol = Symbol.for('chaite.web.agentEventStreamClosers')
type StreamCloser = (closeController: boolean | 'error') => void
const activeStreamClosers: Set<StreamCloser> =
  ((globalThis as Record<symbol, Set<StreamCloser>>)[CLOSER_REGISTRY] ??= new Set<StreamCloser>())

/** Close every live SSE stream (called on process shutdown signals). */
export function closeAllAgentEventStreams(): void {
  for (const close of [...activeStreamClosers]) {
    try {
      close('error')
    } catch {
      // stream already closed
    }
  }
}

function parseSince(request: AgentEventStreamRequest): number {
  if (typeof request.since === 'number' && Number.isFinite(request.since) && request.since > 0) {
    return Math.floor(request.since)
  }
  const header = request.lastEventId?.trim()
  if (!header) return 0
  const parsed = Number(header)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

function isDroppableEvent(event: AgentWebEvent): boolean {
  if (event.type === 'text_chunk' || event.type === 'thought_chunk') return true
  if (event.type === 'tool_status') {
    return event.status === 'requested' || event.status === 'running'
  }
  return false
}

function isTerminalToolStatus(event: AgentWebEvent): boolean {
  return event.type === 'tool_status' && event.status !== 'requested' && event.status !== 'running'
}

/**
 * Open the SSE transport immediately, attach the session listener, then send
 * the session snapshot. Events emitted while the snapshot is being written are
 * buffered and flushed afterwards, so no event can fall into the gap between
 * "snapshot taken" and "listener installed".
 */
export function createAgentEventStream(
  request: AgentEventStreamRequest,
  session: AgentEventStreamSessionLike,
  options: AgentEventStreamOptions = {},
): ReadableStream<Uint8Array> {
  const highWaterMark = Math.max(1024, options.highWaterMarkBytes ?? STREAM_HIGH_WATER_MARK_BYTES)
  const backlogLimitBytes = resolveBacklogLimitBytes(options.backlogLimitBytes)
  const heartbeatMs = Math.max(10, options.heartbeatMs ?? AGENT_EVENT_HEARTBEAT_MS)
  const snapshotLimit = Math.max(1, options.snapshotLimit ?? 500)
  let cancelStream: (closeController: boolean | 'error') => void = () => {}

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      let heartbeat: ReturnType<typeof setInterval> | null = null
      let unsubscribe: (() => void) | null = null
      let abortHandler: (() => void) | null = null
      const pendingToolUpdates = new Map<string, AgentWebEvent>()
      let toolUpdateTimer: ReturnType<typeof setTimeout> | null = null
      let droppedEvents = 0

      const cleanup = (closeController: boolean | 'error', reason?: Error) => {
        if (closed) return
        closed = true
        activeStreamClosers.delete(cleanup)
        if (heartbeat !== null) clearInterval(heartbeat)
        if (toolUpdateTimer !== null) clearTimeout(toolUpdateTimer)
        pendingToolUpdates.clear()
        unsubscribe?.()
        unsubscribe = null
        if (abortHandler) request.signal?.removeEventListener('abort', abortHandler)
        if (closeController === 'error') {
          try {
            controller.error(reason ?? new Error('chaite-web server shutting down'))
          } catch {
            // already closed
          }
        } else if (closeController) {
          try {
            controller.close()
          } catch {
            // already closed
          }
        }
      }
      cancelStream = cleanup
      activeStreamClosers.add(cleanup)

      const enqueueText = (text: string, enqueueOptions: { droppable?: boolean } = {}) => {
        if (closed) return
        const desiredSize = controller.desiredSize
        if (desiredSize === null) {
          cleanup(false)
          return
        }
        const queuedBytes = highWaterMark - desiredSize
        if (enqueueOptions.droppable && queuedBytes > highWaterMark) {
          droppedEvents += 1
          logBackpressure(session.id, queuedBytes, backlogLimitBytes, droppedEvents, false)
          return
        }
        if (queuedBytes > backlogLimitBytes) {
          logBackpressure(session.id, queuedBytes, backlogLimitBytes, droppedEvents, true)
          cleanup(
            'error',
            new Error(
              'chaite-web agent event stream closed: client backlog exceeded '
              + `${Math.round(backlogLimitBytes / 1024)} KB`,
            ),
          )
          return
        }
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          cleanup(false)
        }
      }

      const encode = (
        data: unknown,
        encodeOptions: { id?: number; droppable?: boolean } = {},
      ) => {
        const idLine = encodeOptions.id && encodeOptions.id > 0 ? `id: ${encodeOptions.id}\n` : ''
        enqueueText(`${idLine}data: ${JSON.stringify(data)}\n\n`, encodeOptions)
      }

      const flushToolUpdates = () => {
        toolUpdateTimer = null
        const updates = [...pendingToolUpdates.values()]
        pendingToolUpdates.clear()
        for (const update of updates) {
          if (update.type === 'tool_status') encode(update, { id: update.seq, droppable: true })
        }
      }

      const sendEvent = (event: AgentWebEvent) => {
        if (event.type === 'session_closed') {
          encode(event, { id: event.seq })
          cleanup(true)
          return
        }
        if (event.type === 'tool_status' && !isTerminalToolStatus(event)) {
          pendingToolUpdates.set(event.toolCallId, event)
          toolUpdateTimer ??= setTimeout(flushToolUpdates, TOOL_UPDATE_COALESCE_MS)
          const timer = toolUpdateTimer as unknown as { unref?: () => void }
          timer.unref?.()
          return
        }
        if (isTerminalToolStatus(event) && event.type === 'tool_status') {
          pendingToolUpdates.delete(event.toolCallId)
        }
        if (event.type === 'final_reply' || event.type === 'turn_finished' || event.type === 'error') {
          // Running-tool snapshots that arrive after the turn is over would make
          // the UI show a tool that is still active.
          pendingToolUpdates.clear()
          if (toolUpdateTimer !== null) {
            clearTimeout(toolUpdateTimer)
            toolUpdateTimer = null
          }
        }
        encode(event, { id: event.seq, droppable: isDroppableEvent(event) })
      }

      const startStreaming = () => {
        if (closed) return
        if (session.isAlive && !session.isAlive()) {
          cleanup(true)
          return
        }

        const since = parseSince(request)
        const bufferedEvents: AgentWebEvent[] = []
        let snapshotPublished = false

        const stopListening = session.onEvent(event => {
          if (closed) return
          if (!snapshotPublished) {
            bufferedEvents.push(event)
            return
          }
          sendEvent(event)
        })
        if (closed) {
          stopListening()
          return
        }
        if (session.isAlive && !session.isAlive()) {
          stopListening()
          cleanup(true)
          return
        }
        unsubscribe = stopListening

        const snapshot: AgentSessionSnapshot = session.snapshot({ since, limit: snapshotLimit })
        const connected: ConnectedEvent = {
          type: 'connected',
          sessionId: session.id,
          platform: session.platform,
          botId: session.botId,
          isStreaming: session.isStreaming,
          lastSeq: snapshot.lastSeq,
          heartbeatMs,
          pendingApprovalIds: snapshot.pendingApprovals.map(item => item.requestId),
          serverTime: Date.now(),
        }
        encode(connected)

        const snapshotEvent: SessionSnapshotEvent = {
          type: 'session_snapshot',
          eventId: randomUUID(),
          sessionId: session.id,
          platform: session.platform,
          botId: session.botId,
          seq: snapshot.lastSeq,
          timestamp: Date.now(),
          ...snapshot,
        }
        encode(snapshotEvent, { id: snapshotEvent.seq })
        snapshotPublished = true

        for (const event of bufferedEvents) {
          if (event.seq > snapshot.lastSeq) sendEvent(event)
        }

        heartbeat = setInterval(() => {
          const data: HeartbeatEvent = {
            type: 'heartbeat',
            sessionId: session.id,
            timestamp: Date.now(),
          }
          encode(data, { droppable: true })
        }, heartbeatMs)
        const timer = heartbeat as unknown as { unref?: () => void }
        timer.unref?.()
      }

      abortHandler = () => cleanup(true)
      if (request.signal?.aborted) {
        cleanup(true)
        return
      }
      request.signal?.addEventListener('abort', abortHandler, { once: true })

      // Force response headers through before the snapshot is ready.
      enqueueText(':\n\n')
      startStreaming()
    },
    cancel() {
      cancelStream(false)
    },
  }, {
    highWaterMark,
    size: chunk => chunk.byteLength,
  })
}
