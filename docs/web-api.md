# Chaite Agent Web API

Modern, headless backend for the Chaite Agent Web console. It replaces the
Nova-Admin/NaiveUI-specific API surface with a clean session/SSE protocol while
reusing Chaite's gateway contracts for multi-platform isolation, Fusion tasks
and Hermes evolution traces.

## Modules

| File | Responsibility |
| --- | --- |
| `src/server/types.ts` | SSE / session / prompt wire types |
| `src/server/session-registry.ts` | Multi-platform session registry, prompt lifecycle, approvals, event ring buffer |
| `src/server/sse-stream.ts` | SSE transport: heartbeat, snapshot, resume, backpressure, tool-update coalescing |
| `src/server/chaite-driver.ts` | Bridges a session prompt to `Chaite.sendMessage()` and its streaming callback |
| `src/server/fusion-service.ts` | Fusion task lifecycle + review, backed by `FusionTaskSpec` |
| `src/server/evolution-service.ts` | Hermes traces, 4-dimensional gate, `SKILL.md` merge |
| `src/server/skills-service.ts` | Read-only view of the active `SkillRegistry` |
| `src/server/web-api.ts` | Express router and SSE response adapter |
| `src/server/default-web-api.ts` | Production dependency graph; lazily resolves the Chaite singleton |

The router is mounted automatically in `createApp()` at `/api/agent` before the
legacy CRUD router. Routes not handled by the new router (for example
`POST /api/agent/skills`) fall through to the legacy controller.

## Endpoints

All JSON responses use:

```json
{ "success": true, "code": 0, "data": {}, "message": "ok" }
```

Errors use `success: false`, `code: -1`, and `error.code` with a stable code
such as `SESSION_NOT_FOUND`, `SESSION_BUSY`, `INVALID_FUSION_TASK`,
`EVOLUTION_GATE_FAILED`.

### Sessions

- `GET /api/agent/sessions?platform=&status=&query=&limit=&offset=`
- `POST /api/agent/sessions` — `{ id?, platform?, botId?, title?, model?, skills?, metadata? }`
- `GET /api/agent/sessions/stats`
- `GET /api/agent/sessions/:id`
- `PATCH /api/agent/sessions/:id`
- `DELETE /api/agent/sessions/:id`
- `GET /api/agent/sessions/:id/events/snapshot?since=&limit=`
- `GET /api/agent/sessions/:id/events` — SSE
- `POST /api/agent/sessions/:id/prompt` — `{ prompt, model?, skillName? }` → `202`
- `POST /api/agent/sessions/:id/cancel`
- `POST /api/agent/sessions/:id/approvals/:requestId` — `{ decision, scope?, optionId?, reason? }`

A session accepts one active turn. A concurrent prompt returns `409
SESSION_BUSY`; this keeps the event sequence and tool state unambiguous.

### Fusion

- `GET /api/agent/fusion/tasks?status=&sessionId=&sidekick=&query=`
- `POST /api/agent/fusion/tasks` — `FusionTaskSpec` or `{ spec, sidekick?, status? }`
- `GET /api/agent/fusion/tasks/:id`
- `PATCH /api/agent/fusion/tasks/:id/status`
- `POST /api/agent/fusion/tasks/:id/result`
- `POST /api/agent/fusion/tasks/:id/review`
- `GET /api/agent/fusion/stats`

Task specs are validated with `validateFusionTaskSpec()` from
`src/agent/gateway-validators.ts`.

### Evolution

- `GET /api/agent/evolution/traces?status=&sessionId=&minScore=&gatePassed=`
- `POST /api/agent/evolution/traces` — `EvolutionTrace`
- `GET /api/agent/evolution/traces/:id`
- `POST /api/agent/evolution/traces/:id/approve`
- `POST /api/agent/evolution/traces/:id/reject`
- `POST /api/agent/evolution/traces/:id/merge` — `{ skillName?, overwrite?, force?, mergedBy? }`
- `GET /api/agent/evolution/stats`

A merge requires all four scores (`correctness`, `efficiency`, `safety`,
`reusability`) to reach `0.75` (6.0/8.0). `force: true` is the owner override.
The write is confined to the active skills directory and hot-reloads the
registry before returning.

### Skills

- `GET /api/agent/skills?name=&executionMode=&page=&pageSize=`
- `GET /api/agent/skills/:name` — metadata plus lazily loaded instructions
- `POST /api/agent/skills/reload`

## SSE protocol

```
GET /api/agent/sessions/:id/events
Accept: text/event-stream
Last-Event-ID: 42          # optional; resume after sequence 42
```

1. `:` comment — flushes response headers immediately.
2. `data: {"type":"connected",...}` — session id, streaming flag, last sequence,
   heartbeat interval, pending approval ids.
3. `data: {"type":"session_snapshot",...}` — session metadata, pending approvals
   and recent events. `Last-Event-ID` / `?since=` only returns newer events.
4. Live events follow with `id: <seq>`:
   - `thought_chunk`, `text_chunk`
   - `tool_status` (`requested` → `running` → `succeeded`/`failed`)
   - `approval_request`, `approval_result`
   - `final_reply`, `error`
   - `typing`, `turn_started`, `turn_finished`
   - `session_closed`
5. `data: {"type":"heartbeat"}` every 30 s (configurable).

Reconnecting clients should open a new `EventSource` and send the last seen
`seq` as `Last-Event-ID`. The server re-snapshots and replays only newer events.

### Backpressure

The stream uses a byte-sized `ReadableStream` queue:

- above 512 KiB queued, rebuildable events (`thought_chunk`, `text_chunk`,
  non-terminal `tool_status`) are dropped;
- above the backlog limit (16 MiB by default; override with
  `CHAITE_WEB_SSE_BACKLOG_LIMIT_BYTES`), the stream is terminated with an error
  so the client reconnects and re-snapshots;
- rapid `tool_status` updates are coalesced per tool call for 150 ms.

`closeAllAgentEventStreams()` terminates every live stream for a clean SIGTERM.

## Persistence

Fusion tasks and evolution traces are held in memory and flushed atomically to:

- `data/web-fusion-tasks.json`
- `data/web-evolution-traces.json`

Override the directory with `CHAITE_WEB_STATE_DIR`. Both services expose
`hydrate()` and `flush()` and accept a custom `CollectionPersistence<T>`.

## Mounting standalone

```ts
import express from 'express'
import {
  SessionRegistry,
  FusionTaskService,
  EvolutionService,
  SkillsService,
  createAgentWebApiRouter,
  createChaitePromptDriver,
} from './server'

const sessions = new SessionRegistry({
  driver: createChaitePromptDriver({ chaite }),
})
const app = express()
app.use(express.json())
app.use('/api/agent', createAgentWebApiRouter({
  sessions,
  fusion: new FusionTaskService(),
  evolution: new EvolutionService({ getRegistry: () => chaite.getSkillRegistry() }),
  skills: new SkillsService(() => chaite.getSkillRegistry()),
}))
```

## Testing

```bash
pnpm test:web-api
```

The suite covers prompt lifecycle, concurrent-prompt rejection, cancellation,
approval responses, SSE snapshot/heartbeat/resume, backpressure dropping and
termination, Fusion validation/review, evolution gate/merge, persistence and a
full Express + HTTP integration test for REST and SSE.
