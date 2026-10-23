import {
  APPROVAL_DECISIONS,
  EVOLUTION_SCORE_KEYS,
  GATEWAY_PLATFORMS,
  OUTBOUND_EVENT_TYPES,
  type ApprovalResponse,
  type EvolutionTrace,
  type FinalReplyEvent,
  type FusionTaskSpec,
  type HumanApprovalRequest,
  type InboundMessage,
  type OutboundEvent,
  type OutboundEventType,
  type ToolStatusEvent,
} from './gateway-contracts'
import {
  GatewayContractValidationError,
  assertApprovalResponse,
  assertEvolutionTrace,
  assertFusionTaskSpec,
  assertHumanApprovalRequest,
  assertInboundMessage,
  assertOutboundEvent,
  isApprovalResponse,
  isEvolutionTrace,
  isFusionTaskSpec,
  isHumanApprovalRequest,
  isInboundMessage,
  isOutboundEvent,
  validateApprovalResponse,
  validateEvolutionTrace,
  validateFusionTaskSpec,
  validateHumanApprovalRequest,
  validateInboundMessage,
  validateOutboundEvent,
} from './gateway-validators'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const isolation = {
  platform: 'qq' as const,
  botId: 'bot-qq-1',
  tenantId: 'tenant-1',
  gatewayId: 'gateway-1',
}

const inbound: InboundMessage = {
  ...isolation,
  messageId: 'msg-1',
  sessionId: 'session-1',
  kind: 'group',
  conversationId: 'group-1',
  groupId: 'group-1',
  groupName: 'Agent Dev',
  sender: {
    id: 'user-1',
    nickname: 'Alice',
    card: 'Alice',
    role: 'member',
  },
  content: [
    { type: 'text', text: 'please fix the failing tests' },
    {
      type: 'image',
      source: { source: 'url', url: 'https://example.com/screenshot.png' },
      mimeType: 'image/png',
      width: 1280,
      height: 720,
    },
    { type: 'mention', userId: 'bot-qq-1', displayName: 'Chaite' },
    { type: 'reply', messageId: 'msg-0', senderId: 'user-2', excerpt: 'previous message' },
    { type: 'face', faceId: '178', text: '[doge]' },
  ],
  timestamp: 1_700_000_000_000,
  receivedAt: 1_700_000_000_010,
  mentionedBot: true,
  idempotencyKey: 'idem-1',
}

const approvalRequest: HumanApprovalRequest = {
  ...isolation,
  requestId: 'approval-1',
  sessionId: 'session-1',
  runId: 'run-1',
  taskId: 'task-1',
  title: 'Run shell command?',
  summary: 'Sidekick wants to run the test suite before returning a patch.',
  riskLevel: 'high',
  action: {
    kind: 'shell_command',
    command: 'pnpm',
    args: ['test'],
    cwd: '/repo',
  },
  options: [
    { id: 'approve_once', label: 'Allow once', outcome: 'approve', scope: 'once' },
    { id: 'approve_session', label: 'Allow for this session', outcome: 'approve', scope: 'session' },
    { id: 'deny', label: 'Deny', outcome: 'deny', destructive: true },
  ],
  createdAt: 1_700_000_000_000,
  expiresAt: 1_700_000_060_000,
  requestedBy: { id: 'sidekick-1', kind: 'sidekick', displayName: 'Sidekick' },
  integrity: {
    algorithm: 'sha256',
    digest: 'a'.repeat(64),
  },
  context: {
    reason: 'Verifying the patch',
    evidence: ['pnpm test failed before the change'],
    affectedResources: ['/repo'],
  },
}

const approvalResponse: ApprovalResponse = {
  requestId: 'approval-1',
  botId: 'bot-qq-1',
  sessionId: 'session-1',
  decision: 'approved',
  scope: 'once',
  responder: {
    platform: 'qq',
    userId: 'user-1',
    role: 'owner',
    displayName: 'Alice',
  },
  respondedAt: 1_700_000_001_000,
  optionId: 'approve_once',
  reason: 'Tests are safe to run',
  requestDigest: approvalRequest.integrity,
}

const toolStatusEvent: ToolStatusEvent = {
  ...isolation,
  eventId: 'evt-4',
  sessionId: 'session-1',
  sequence: 3,
  timestamp: 1_700_000_000_400,
  replyToMessageId: 'msg-1',
  runId: 'run-1',
  type: 'tool_status',
  toolCallId: 'call-1',
  toolName: 'runner__test',
  status: 'succeeded',
  attempt: 1,
  argsPreview: '{"suite":"unit"}',
  resultPreview: '42 tests passed',
  startedAt: 1_700_000_000_300,
  completedAt: 1_700_000_000_400,
}

const finalReplyEvent: FinalReplyEvent = {
  ...isolation,
  eventId: 'evt-5',
  sessionId: 'session-1',
  sequence: 5,
  timestamp: 1_700_000_000_500,
  replyToMessageId: 'msg-1',
  runId: 'run-1',
  type: 'final_reply',
  messageId: 'reply-1',
  parts: [
    { type: 'text', text: 'Fixed the failing tests.' },
    { type: 'markdown', markdown: '**Fixed** the failing tests.\n\n- added retry' },
    {
      type: 'image',
      source: { source: 'url', url: 'https://example.com/result.png' },
      alt: 'test result',
    },
    {
      type: 'audio',
      source: { source: 'base64', data: 'AAAA', mimeType: 'audio/mp3' },
      durationMs: 1200,
    },
    {
      type: 'video',
      source: { source: 'file_id', fileId: 'video-1' },
      durationMs: 5000,
    },
    {
      type: 'file',
      source: { source: 'url', url: 'https://example.com/patch.diff' },
      name: 'patch.diff',
      mimeType: 'text/x-diff',
    },
  ],
  text: 'Fixed the failing tests.',
  finishReason: 'stop',
  usage: {
    promptTokens: 1200,
    completionTokens: 340,
    totalTokens: 1540,
  },
  citations: [{ title: 'Test report', url: 'https://example.com/report', excerpt: 'all green' }],
}

const outboundEvents: OutboundEvent[] = [
  {
    ...isolation,
    eventId: 'evt-1',
    sessionId: 'session-1',
    sequence: 0,
    timestamp: 1_700_000_000_100,
    replyToMessageId: 'msg-1',
    runId: 'run-1',
    type: 'typing',
    state: 'start',
    durationMs: 2000,
  },
  {
    ...isolation,
    eventId: 'evt-2',
    sessionId: 'session-1',
    sequence: 1,
    timestamp: 1_700_000_000_200,
    runId: 'run-1',
    type: 'thought_chunk',
    delta: 'The failure comes from a missing retry.',
    index: 0,
    done: true,
    signature: 'sig-1',
  },
  {
    ...isolation,
    eventId: 'evt-3',
    sessionId: 'session-1',
    sequence: 2,
    timestamp: 1_700_000_000_300,
    runId: 'run-1',
    type: 'text_chunk',
    delta: 'I will run the tests now.',
    index: 0,
  },
  toolStatusEvent,
  {
    ...isolation,
    eventId: 'evt-4b',
    sessionId: 'session-1',
    sequence: 4,
    timestamp: 1_700_000_000_450,
    runId: 'run-1',
    type: 'approval_request',
    request: approvalRequest,
  },
  finalReplyEvent,
  {
    ...isolation,
    eventId: 'evt-6',
    sessionId: 'session-1',
    sequence: 6,
    timestamp: 1_700_000_000_600,
    runId: 'run-1',
    type: 'error',
    error: {
      code: 'TIMEOUT',
      message: 'The remote tool timed out',
      retryable: true,
      kind: 'RETRYABLE',
    },
    fatal: false,
  },
]

const fusionTask: FusionTaskSpec = {
  task_id: 'task-1',
  parent_task_id: 'task-0',
  session_id: 'session-1',
  parent_run_id: 'run-1',
  target_tools: [
    { name: 'read_file', source: 'local', required: true },
    { name: 'apply_patch', source: 'skill' },
    { name: 'remote_test', source: 'mcp', server: 'runner', required: true },
  ],
  instruction: 'Fix the failing tests without changing public APIs.',
  context: 'The failure is in gateway-validators.ts.',
  constraints: ['Do not modify package.json', 'Keep TypeScript strict mode happy'],
  diff_schema: {
    format: 'unified_diff',
    path_scope: ['src/agent/**', 'test/**'],
    required_fields: ['patch', 'summary'],
    max_files: 5,
    max_changed_lines: 200,
    allow_binary: false,
  },
  review_criteria: [
    {
      id: 'tests',
      description: 'All unit tests pass',
      weight: 0.7,
      required: true,
      evaluator: 'tests',
      pass_condition: 'pnpm test',
    },
    {
      id: 'scope',
      description: 'Only files inside path_scope are changed',
      weight: 0.3,
      evaluator: 'automated',
    },
  ],
  delegation: { reason: 'Mechanical, well-scoped fix', confidence: 0.82 },
  budget: {
    max_tool_calls: 20,
    max_wall_clock_ms: 120_000,
    max_tokens: 32_000,
    max_attempts: 2,
  },
  deadline_at: 1_700_000_600_000,
  created_at: 1_700_000_000_000,
}

const evolutionTrace: EvolutionTrace = {
  traceId: 'trace-1',
  sessionId: 'session-1',
  platform: 'qq',
  botId: 'bot-qq-1',
  userIntent: {
    raw: '帮我修复构建并总结原因',
    normalized: 'fix the build and explain the root cause',
    category: 'debugging',
    confidence: 0.93,
    entities: { file: 'tsconfig.json' },
  },
  outcome: 'success',
  toolCalls: [
    {
      callId: 'call-1',
      name: 'read_file',
      arguments: { path: 'tsconfig.json' },
      status: 'ok',
      attempt: 1,
      resultPreview: '{"compilerOptions":{...}}',
      source: 'local',
      startedAt: 1_700_000_000_100,
      completedAt: 1_700_000_000_200,
    },
    {
      callId: 'call-2',
      name: 'runner__build',
      arguments: { cwd: '/repo' },
      status: 'retried',
      attempt: 2,
      resultPreview: 'build succeeded',
      error: { kind: 'RETRYABLE', message: 'first attempt timed out', code: 'TIMEOUT' },
      source: 'mcp',
      startedAt: 1_700_000_000_200,
      completedAt: 1_700_000_000_900,
    },
  ],
  errorRetries: [
    {
      attempt: 1,
      toolCallId: 'call-2',
      reason: 'transient timeout',
      errorKind: 'RETRYABLE',
      backoffMs: 500,
      recovered: true,
      occurredAt: 1_700_000_000_500,
    },
  ],
  scores: {
    correctness: 0.95,
    efficiency: 0.8,
    safety: 1,
    reusability: 0.7,
  },
  draftSkillMd: [
    '---',
    'name: fix-build',
    'description: Diagnose and fix TypeScript build failures',
    'allowedTools:',
    '  - read_file',
    '  - runner__build',
    '---',
    '',
    '# Fix build',
    '',
    '1. Read tsconfig.json.',
    '2. Run the build through the remote runner.',
    '3. Retry once on transient timeouts.',
  ].join('\n'),
  draftSkillName: 'fix-build',
  draftSkillPath: 'skills/fix-build/SKILL.md',
  lessons: ['Retry transient runner timeouts once before reporting failure.'],
  approvalRequestIds: ['approval-1'],
  startedAt: 1_700_000_000_000,
  completedAt: 1_700_000_001_000,
}

// ─── Compile-time helpers ─────────────────────────────────────────────────────

function assertNever(value: never): never {
  throw new Error(`Unhandled contract variant: ${JSON.stringify(value)}`)
}

/** Exhaustive switch: adding an OutboundEvent variant must fail compilation. */
function eventLabel(event: OutboundEvent): string {
  switch (event.type) {
    case 'typing':
      return `typing:${event.state}`
    case 'thought_chunk':
      return `thought:${event.delta}`
    case 'text_chunk':
      return `text:${event.delta}`
    case 'tool_status':
      return `tool:${event.toolName}:${event.status}`
    case 'approval_request':
      return `approval:${event.request.requestId}`
    case 'final_reply':
      return `final:${event.finishReason}`
    case 'error':
      return `error:${event.error.code}`
    default:
      return assertNever(event)
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('gateway protocol constants', () => {
  it('exposes every supported platform', () => {
    expect([...GATEWAY_PLATFORMS]).toEqual(['qq', 'dsh', 'web'])
  })

  it('keeps the event-type constant in sync with the type-level union', () => {
    const declared: Record<OutboundEventType, true> = {
      typing: true,
      thought_chunk: true,
      text_chunk: true,
      tool_status: true,
      approval_request: true,
      final_reply: true,
      error: true,
    }
    expect(Object.keys(declared).sort()).toEqual([...OUTBOUND_EVENT_TYPES].sort())
  })

  it('defines exactly four evolution score dimensions', () => {
    expect([...EVOLUTION_SCORE_KEYS]).toEqual(['correctness', 'efficiency', 'safety', 'reusability'])
    expect([...APPROVAL_DECISIONS]).toEqual(['approved', 'denied', 'cancelled', 'expired'])
  })
})

describe('InboundMessage', () => {
  it('accepts equivalent messages from every platform and survives JSON round-trip', () => {
    for (const platform of GATEWAY_PLATFORMS) {
      const message = { ...inbound, platform }
      expect(isInboundMessage(message)).toBe(true)
      expect(validateInboundMessage(message).issues).toEqual([])
      expect(JSON.parse(JSON.stringify(message))).toEqual(message)
    }
  })

  it('accepts base64, file_id and unknown content variants', () => {
    const message: InboundMessage = {
      ...inbound,
      content: [
        { type: 'audio', source: { source: 'base64', data: 'AAAA', mimeType: 'audio/mp3' }, durationMs: 300 },
        { type: 'video', source: { source: 'file_id', fileId: 'video-1' }, durationMs: 2000 },
        { type: 'file', source: { source: 'file_id', fileId: 'file-1' }, name: 'a.txt', sizeBytes: 12 },
        { type: 'location', latitude: 31.23, longitude: 121.47, name: 'Shanghai' },
        { type: 'unknown', rawType: 'custom_card', raw: { any: 'shape' } },
      ],
    }
    expect(validateInboundMessage(message).ok).toBe(true)
  })

  it('rejects unknown platforms', () => {
    const result = validateInboundMessage({ ...inbound, platform: 'telegram' })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.platform')
  })

  it('requires message id, session id and at least one content item', () => {
    const { sessionId: _sessionId, ...withoutSession } = inbound
    expect(validateInboundMessage(withoutSession).issues.map(i => i.path)).toContain('$.sessionId')
    expect(validateInboundMessage({ ...inbound, content: [] }).issues.map(i => i.path)).toContain('$.content')
  })

  it('rejects an invalid sender role', () => {
    const result = validateInboundMessage({
      ...inbound,
      sender: { ...inbound.sender, role: 'superuser' },
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.sender.role')
  })

  it('rejects media without a valid transport', () => {
    const result = validateInboundMessage({
      ...inbound,
      content: [{ type: 'image', source: { source: 'url' } }],
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.content[0].source.url')
  })

  it('reports paths and throws a typed error from the assertion helper', () => {
    expect(() => assertInboundMessage({})).toThrow(GatewayContractValidationError)
    try {
      assertInboundMessage({})
      throw new Error('assertInboundMessage should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(GatewayContractValidationError)
      const contractError = error as GatewayContractValidationError
      expect(contractError.contract).toBe('InboundMessage')
      expect(contractError.issues.length).toBeGreaterThan(0)
      expect(contractError.message).toContain('$.messageId')
    }
  })
})

describe('OutboundEvent', () => {
  it('accepts every event variant and survives JSON round-trip', () => {
    expect(outboundEvents).toHaveLength(OUTBOUND_EVENT_TYPES.length)
    for (const event of outboundEvents) {
      expect(isOutboundEvent(event)).toBe(true)
      expect(validateOutboundEvent(event).issues).toEqual([])
      expect(JSON.parse(JSON.stringify(event))).toEqual(event)
      expect(eventLabel(event)).toEqual(expect.any(String))
    }
    expect(new Set(outboundEvents.map(event => event.type))).toEqual(new Set(OUTBOUND_EVENT_TYPES))
  })

  it('preserves the approval request inside the event', () => {
    const event = outboundEvents.find(item => item.type === 'approval_request')
    expect(event).toBeDefined()
    if (event?.type === 'approval_request') {
      expect(event.request.requestId).toBe(approvalRequest.requestId)
      expect(event.request.action.kind).toBe('shell_command')
    }
  })

  it('rejects unknown event types', () => {
    const result = validateOutboundEvent({ ...outboundEvents[2], type: 'delta' })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.type')
  })

  it('rejects invalid sequence, event id and platform', () => {
    expect(validateOutboundEvent({ ...outboundEvents[0], sequence: -1 }).issues.map(i => i.path)).toContain('$.sequence')
    expect(validateOutboundEvent({ ...outboundEvents[0], eventId: '' }).issues.map(i => i.path)).toContain('$.eventId')
    expect(validateOutboundEvent({ ...outboundEvents[0], platform: 'irc' }).issues.map(i => i.path)).toContain('$.platform')
  })

  it('rejects invalid tool state and inverted timestamps', () => {
    const result = validateOutboundEvent({
      ...toolStatusEvent,
      status: 'done',
      startedAt: 200,
      completedAt: 100,
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['$.status', '$.completedAt']))
  })

  it('requires a final reply part or fallback text', () => {
    const result = validateOutboundEvent({ ...finalReplyEvent, parts: [], text: '' })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.parts')
  })

  it('rejects an invalid nested approval request', () => {
    const result = validateOutboundEvent({
      ...outboundEvents[4],
      request: { ...approvalRequest, expiresAt: approvalRequest.createdAt },
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.request.expiresAt')
  })

  it('rejects an approval request that escapes the event isolation scope', () => {
    const result = validateOutboundEvent({
      ...outboundEvents[4],
      request: { ...approvalRequest, botId: 'other-bot', sessionId: 'other-session' },
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toEqual(
      expect.arrayContaining(['$.request.botId', '$.request.sessionId']),
    )
  })

  it('rejects invalid error payloads', () => {
    const result = validateOutboundEvent({
      ...outboundEvents[6],
      error: { code: 'WHAT', message: 'x', retryable: 'yes' },
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['$.error.code', '$.error.retryable']))
  })

  it('throws a typed error from the assertion helper', () => {
    expect(() => assertOutboundEvent({ type: 'text_chunk' })).toThrow(GatewayContractValidationError)
  })
})

describe('HumanApprovalRequest / ApprovalResponse', () => {
  it('accepts a valid request and response', () => {
    expect(isHumanApprovalRequest(approvalRequest)).toBe(true)
    expect(validateHumanApprovalRequest(approvalRequest).issues).toEqual([])
    expect(isApprovalResponse(approvalResponse)).toBe(true)
    expect(validateApprovalResponse(approvalResponse).issues).toEqual([])
  })

  it('accepts all approval action variants', () => {
    const actions: HumanApprovalRequest['action'][] = [
      { kind: 'tool_call', toolName: 'write_file', arguments: { path: 'a.ts' }, source: 'local' },
      { kind: 'file_write', path: 'a.ts', operation: 'update', diff: '@@ -1 +1 @@', sizeBytes: 10 },
      { kind: 'shell_command', command: 'ls', args: ['-la'], cwd: '/repo' },
      {
        kind: 'network_request',
        method: 'POST',
        url: 'https://example.com/api',
        headers: { authorization: 'Bearer x' },
        bodyPreview: '{"a":1}',
      },
      { kind: 'external_side_effect', target: 'qq-group:123', description: 'Send a group message' },
      { kind: 'custom', name: 'deploy', payload: { env: 'prod' } },
    ]
    for (const action of actions) {
      const result = validateHumanApprovalRequest({ ...approvalRequest, action })
      expect(result.issues).toEqual([])
    }
  })

  it('rejects malformed integrity digests', () => {
    const result = validateHumanApprovalRequest({
      ...approvalRequest,
      integrity: { algorithm: 'sha256', digest: 'not-a-digest' },
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.integrity.digest')
  })

  it('rejects expiry that is not after creation', () => {
    const result = validateHumanApprovalRequest({ ...approvalRequest, expiresAt: approvalRequest.createdAt })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.expiresAt')
  })

  it('rejects duplicate option ids', () => {
    const result = validateHumanApprovalRequest({
      ...approvalRequest,
      options: [
        { id: 'approve_once', label: 'Allow', outcome: 'approve' },
        { id: 'approve_once', label: 'Allow again', outcome: 'approve' },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.issues.some(issue => issue.path === '$.options[1].id')).toBe(true)
  })

  it('rejects invalid network URLs and action kinds', () => {
    const badUrl = validateHumanApprovalRequest({
      ...approvalRequest,
      action: { kind: 'network_request', method: 'GET', url: '/relative' },
    })
    expect(badUrl.issues.map(issue => issue.path)).toContain('$.action.url')

    const badKind = validateHumanApprovalRequest({
      ...approvalRequest,
      action: { kind: 'teleport' },
    })
    expect(badKind.issues.map(issue => issue.path)).toContain('$.action.kind')
  })

  it('rejects a denial with an approval-only scope', () => {
    const result = validateApprovalResponse({ ...approvalResponse, decision: 'denied' })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.scope')
  })

  it('requires response scope fields', () => {
    const { botId: _botId, sessionId: _sessionId, ...withoutScope } = approvalResponse
    const result = validateApprovalResponse(withoutScope)
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toEqual(
      expect.arrayContaining(['$.botId', '$.sessionId']),
    )
  })

  it('rejects an invalid decision and responder role', () => {
    const result = validateApprovalResponse({
      ...approvalResponse,
      decision: 'maybe',
      responder: { ...approvalResponse.responder, role: 'root' },
    })
    expect(result.issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['$.decision', '$.responder.role']))
  })

  it('throws typed errors from assertion helpers', () => {
    expect(() => assertHumanApprovalRequest({})).toThrow(GatewayContractValidationError)
    expect(() => assertApprovalResponse({ requestId: 'x' })).toThrow(GatewayContractValidationError)
  })
})

describe('FusionTaskSpec', () => {
  it('accepts a valid delegation and survives JSON round-trip', () => {
    expect(isFusionTaskSpec(fusionTask)).toBe(true)
    expect(validateFusionTaskSpec(fusionTask).issues).toEqual([])
    expect(JSON.parse(JSON.stringify(fusionTask))).toEqual(fusionTask)
  })

  it('requires at least one target tool and one review criterion', () => {
    expect(validateFusionTaskSpec({ ...fusionTask, target_tools: [] }).issues.map(i => i.path)).toContain('$.target_tools')
    expect(validateFusionTaskSpec({ ...fusionTask, review_criteria: [] }).issues.map(i => i.path)).toContain('$.review_criteria')
  })

  it('rejects unknown tools and diff formats', () => {
    const result = validateFusionTaskSpec({
      ...fusionTask,
      target_tools: [{ name: 'x', source: 'telepathy' }],
      diff_schema: { ...fusionTask.diff_schema, format: 'word_doc' },
    })
    expect(result.issues.map(issue => issue.path)).toEqual(
      expect.arrayContaining(['$.target_tools[0].source', '$.diff_schema.format']),
    )
  })

  it('requires review weights to be normalized', () => {
    const result = validateFusionTaskSpec({
      ...fusionTask,
      review_criteria: [
        { id: 'tests', description: 'tests', weight: 0.5 },
        { id: 'scope', description: 'scope', weight: 0.4 },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.review_criteria')
  })

  it('rejects out-of-range and duplicate criteria', () => {
    const result = validateFusionTaskSpec({
      ...fusionTask,
      review_criteria: [
        { id: 'tests', description: 'tests', weight: 1.5 },
        { id: 'tests', description: 'duplicate', weight: -0.5 },
      ],
    })
    expect(result.issues.map(issue => issue.path)).toEqual(
      expect.arrayContaining(['$.review_criteria[0].weight', '$.review_criteria[1].weight', '$.review_criteria[1].id']),
    )
  })

  it('rejects a deadline that is not after creation', () => {
    const result = validateFusionTaskSpec({ ...fusionTask, deadline_at: fusionTask.created_at })
    expect(result.issues.map(issue => issue.path)).toContain('$.deadline_at')
  })

  it('throws a typed error from the assertion helper', () => {
    expect(() => assertFusionTaskSpec({ task_id: 'x' })).toThrow(GatewayContractValidationError)
  })
})

describe('EvolutionTrace', () => {
  it('accepts a valid trace and survives JSON round-trip', () => {
    expect(isEvolutionTrace(evolutionTrace)).toBe(true)
    expect(validateEvolutionTrace(evolutionTrace).issues).toEqual([])
    expect(JSON.parse(JSON.stringify(evolutionTrace))).toEqual(evolutionTrace)
  })

  it('requires all four score dimensions', () => {
    const { correctness: _correctness, ...partialScores } = evolutionTrace.scores
    const result = validateEvolutionTrace({ ...evolutionTrace, scores: partialScores })
    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.path)).toContain('$.scores.correctness')
  })

  it('rejects scores outside [0, 1]', () => {
    const result = validateEvolutionTrace({
      ...evolutionTrace,
      scores: { ...evolutionTrace.scores, safety: 1.5, reusability: -0.1 },
    })
    expect(result.issues.map(issue => issue.path)).toEqual(
      expect.arrayContaining(['$.scores.safety', '$.scores.reusability']),
    )
  })

  it('rejects an empty draft skill and unknown outcome', () => {
    const result = validateEvolutionTrace({ ...evolutionTrace, draftSkillMd: '', outcome: 'great' })
    expect(result.issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['$.draftSkillMd', '$.outcome']))
  })

  it('rejects invalid tool-call and retry records', () => {
    const result = validateEvolutionTrace({
      ...evolutionTrace,
      toolCalls: [{ ...evolutionTrace.toolCalls[0], status: 'done', attempt: 0 }],
      errorRetries: [{ ...evolutionTrace.errorRetries[0], attempt: 0, recovered: 'yes' }],
    })
    expect(result.issues.map(issue => issue.path)).toEqual(
      expect.arrayContaining([
        '$.toolCalls[0].status',
        '$.toolCalls[0].attempt',
        '$.errorRetries[0].attempt',
        '$.errorRetries[0].recovered',
      ]),
    )
  })

  it('rejects a completedAt before startedAt', () => {
    const result = validateEvolutionTrace({
      ...evolutionTrace,
      startedAt: evolutionTrace.completedAt,
      completedAt: evolutionTrace.startedAt,
    })
    expect(result.issues.map(issue => issue.path)).toContain('$.completedAt')
  })

  it('throws a typed error from the assertion helper', () => {
    expect(() => assertEvolutionTrace({ traceId: 'x' })).toThrow(GatewayContractValidationError)
  })
})
