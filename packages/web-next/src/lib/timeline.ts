import type {
  AgentSessionInfo,
  AgentSessionSnapshot,
  AgentStreamEvent,
  AgentWebEvent,
  ApprovalDecision,
  FinalReplyWebEvent,
  GatewayErrorPayload,
  GatewayUsage,
  HumanApprovalRequest,
  OutboundReplyPart,
  ToolStatusState,
  TurnStartedWebEvent,
} from "./types";

export interface ApprovalState {
  request: HumanApprovalRequest;
  status: ApprovalDecision | "pending";
  responding?: boolean;
  error?: string;
  preview?: boolean;
}

export interface ToolCallState {
  id: string;
  name: string;
  status: ToolStatusState;
  argsPreview?: string;
  resultPreview?: string;
  error?: GatewayErrorPayload;
  attempt?: number;
  startedAt?: number;
  completedAt?: number;
}

export interface AssistantImage {
  url?: string;
  alt?: string;
}

export type TimelineItem =
  | {
      kind: "user";
      id: string;
      text: string;
      createdAt: number;
      turnId?: string;
      pending?: boolean;
      failed?: boolean;
    }
  | {
      kind: "thought";
      id: string;
      text: string;
      createdAt: number;
      turnId?: string;
      done: boolean;
      durationMs?: number;
    }
  | {
      kind: "assistant";
      id: string;
      text: string;
      createdAt: number;
      turnId?: string;
      done: boolean;
      images?: AssistantImage[];
      usage?: GatewayUsage;
      status?: "streaming" | "complete" | "cancelled" | "error";
      error?: string;
      isComplete?: boolean;
    }
  | {
      kind: "tool";
      id: string;
      createdAt: number;
      turnId?: string;
      call: ToolCallState;
    }
  | {
      kind: "approval";
      id: string;
      requestId: string;
      createdAt: number;
      turnId?: string;
    }
  | {
      kind: "error";
      id: string;
      message: string;
      code?: string;
      createdAt: number;
      turnId?: string;
      fatal?: boolean;
    };

export interface StreamView {
  session: AgentSessionInfo | null;
  timeline: TimelineItem[];
  approvals: Record<string, ApprovalState>;
  isStreaming: boolean;
  typing: boolean;
  lastSeq: number;
  lastEventAt: number | null;
  activeTurnId?: string;
  usage?: GatewayUsage;
  truncated: boolean;
}

export function createInitialStreamView(session: AgentSessionInfo | null = null): StreamView {
  return {
    session,
    timeline: [],
    approvals: {},
    isStreaming: false,
    typing: false,
    lastSeq: 0,
    lastEventAt: null,
    truncated: false,
  };
}

function patchSession(
  session: AgentSessionInfo | null,
  patch: Partial<AgentSessionInfo>,
): AgentSessionInfo | null {
  if (!session) return session;
  return { ...session, ...patch };
}

function lastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
}

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  const next = items.slice();
  next[index] = value;
  return next;
}

function imageParts(parts: OutboundReplyPart[]): AssistantImage[] {
  const images: AssistantImage[] = [];
  for (const part of parts) {
    if (part.type !== "image") continue;
    const source = part.source;
    if (source.source === "url" && source.url) {
      images.push({ url: source.url, alt: part.alt });
    } else if (source.source === "base64" && source.data) {
      images.push({ url: `data:${source.mimeType ?? "image/png"};base64,${source.data}`, alt: part.alt });
    }
  }
  return images;
}

function replyText(event: FinalReplyWebEvent): string {
  if (event.text && event.text.trim()) return event.text;
  const chunks: string[] = [];
  for (const part of event.parts ?? []) {
    if (part.type === "markdown") chunks.push(part.markdown);
    else if (part.type === "text") chunks.push(part.text);
  }
  return chunks.join("\n\n");
}

function doneForTurn(item: TimelineItem, turnId?: string): TimelineItem {
  if (!turnId || item.turnId !== turnId) return item;
  if (item.kind === "thought") return { ...item, done: true, durationMs: item.durationMs ?? Math.min(25000, Math.max(200, Date.now() - item.createdAt)) };
  if (item.kind === "assistant") return { ...item, done: true };
  return item;
}

export function applyTurnStarted(view: StreamView, event: TurnStartedWebEvent): StreamView {
  const prompt = event.prompt;
  const pendingIndex = lastIndex(
    view.timeline,
    (item) => item.kind === "user" && item.pending === true && item.text.trim() === prompt.trim(),
  );
  const existingIndex = pendingIndex >= 0
    ? -1
    : lastIndex(view.timeline, (item) => item.kind === "user" && item.turnId === event.turnId);

  let timeline = view.timeline;
  if (pendingIndex >= 0) {
    const item = timeline[pendingIndex];
    if (item.kind === "user") {
      timeline = replaceAt(timeline, pendingIndex, {
        ...item,
        pending: false,
        turnId: event.turnId,
      });
    }
  } else if (existingIndex < 0) {
    timeline = [
      ...timeline,
      {
        kind: "user",
        id: `user:${event.turnId}`,
        text: prompt,
        createdAt: event.timestamp,
        turnId: event.turnId,
      },
    ];
  }

  const session = patchSession(view.session, {
    status: "thinking",
    activeTurn: {
      id: event.turnId,
      prompt,
      startedAt: event.timestamp,
      model: event.model,
      skillName: event.skillName,
    },
    lastActiveAt: event.timestamp,
    turnCount: existingIndex < 0 && pendingIndex < 0 ? (view.session?.turnCount ?? 0) + 1 : view.session?.turnCount,
  });

  return {
    ...view,
    session,
    timeline,
    isStreaming: true,
    typing: false,
    activeTurnId: event.turnId,
    lastEventAt: event.timestamp,
  };
}

function appendThought(view: StreamView, event: AgentWebEvent & { type: "thought_chunk" }): StreamView {
  const previous = view.timeline[view.timeline.length - 1];
  let timeline: TimelineItem[];
  if (
    previous &&
    previous.kind === "thought" &&
    !previous.done &&
    previous.turnId === event.turnId
  ) {
    timeline = replaceAt(view.timeline, view.timeline.length - 1, {
      ...previous,
      text: previous.text + event.delta,
    });
  } else {
    timeline = [
      ...view.timeline,
      {
        kind: "thought",
        id: `thought:${event.eventId}`,
        text: event.delta,
        createdAt: event.timestamp,
        turnId: event.turnId,
        done: false,
      },
    ];
  }

  const session = patchSession(view.session, {
    status: view.session?.status === "waiting_approval" ? "waiting_approval" : "thinking",
    lastActiveAt: event.timestamp,
  });

  return { ...view, timeline, session, lastEventAt: event.timestamp };
}

function appendText(view: StreamView, event: AgentWebEvent & { type: "text_chunk" }): StreamView {
  let baseTimeline = view.timeline;
  const lastItem = baseTimeline[baseTimeline.length - 1];
  if (lastItem && lastItem.kind === "thought" && !lastItem.done) {
    baseTimeline = replaceAt(baseTimeline, baseTimeline.length - 1, {
      ...lastItem,
      done: true,
      durationMs: Math.max(100, event.timestamp - lastItem.createdAt),
    });
  }

  const previous = baseTimeline[baseTimeline.length - 1];
  let timeline: TimelineItem[];
  if (
    previous &&
    previous.kind === "assistant" &&
    !previous.done &&
    previous.turnId === event.turnId
  ) {
    timeline = replaceAt(baseTimeline, baseTimeline.length - 1, {
      ...previous,
      text: previous.text + event.delta,
    });
  } else {
    timeline = [
      ...baseTimeline,
      {
        kind: "assistant",
        id: `assistant:${event.eventId}`,
        text: event.delta,
        createdAt: event.timestamp,
        turnId: event.turnId,
        done: false,
      },
    ];
  }

  const session = patchSession(view.session, {
    status: view.session?.status === "waiting_approval" ? "waiting_approval" : "streaming",
    lastActiveAt: event.timestamp,
  });

  return { ...view, timeline, session, lastEventAt: event.timestamp, typing: false };
}

function upsertTool(view: StreamView, event: AgentWebEvent & { type: "tool_status" }): StreamView {
  const terminal = event.status !== "requested" && event.status !== "running";
  const itemId = `tool:${event.toolCallId}`;
  const index = view.timeline.findIndex((item) => item.kind === "tool" && item.id === itemId);
  let timeline = view.timeline;

  if (index >= 0) {
    const current = view.timeline[index];
    if (current.kind === "tool") {
      const previous = current.call;
      timeline = replaceAt(view.timeline, index, {
        ...current,
        call: {
          id: event.toolCallId,
          name: event.toolName || previous.name,
          status: event.status,
          argsPreview: event.argsPreview ?? previous.argsPreview,
          resultPreview: event.resultPreview ?? previous.resultPreview,
          error: event.error ?? previous.error,
          attempt: event.attempt ?? previous.attempt,
          startedAt: event.startedAt ?? previous.startedAt,
          completedAt: event.completedAt ?? (terminal ? event.timestamp : previous.completedAt),
        },
      });
    }
  } else {
    timeline = [
      ...timeline,
      {
        kind: "tool",
        id: itemId,
        createdAt: event.startedAt ?? event.timestamp,
        turnId: event.turnId,
        call: {
          id: event.toolCallId,
          name: event.toolName,
          status: event.status,
          argsPreview: event.argsPreview,
          resultPreview: event.resultPreview,
          error: event.error,
          attempt: event.attempt,
          startedAt: event.startedAt ?? event.timestamp,
          completedAt: event.completedAt ?? (terminal ? event.timestamp : undefined),
        },
      },
    ];
  }

  const session = patchSession(view.session, {
    status: view.session?.status === "waiting_approval" ? "waiting_approval" : "streaming",
    lastActiveAt: event.timestamp,
  });

  return { ...view, timeline, session, lastEventAt: event.timestamp };
}

function addApproval(view: StreamView, request: HumanApprovalRequest, preview = false): StreamView {
  const existing = view.approvals[request.requestId];
  const approvals = {
    ...view.approvals,
    [request.requestId]: {
      request,
      status: existing?.status && existing.status !== "pending" ? existing.status : "pending",
      responding: existing?.responding,
      error: existing?.error,
      preview: existing?.preview ?? preview,
    } satisfies ApprovalState,
  };

  const hasItem = view.timeline.some(
    (item) => item.kind === "approval" && item.requestId === request.requestId,
  );
  const timeline = hasItem
    ? view.timeline
    : ([
        ...view.timeline,
        {
          kind: "approval",
          id: `approval:${request.requestId}`,
          requestId: request.requestId,
          createdAt: request.createdAt ?? Date.now(),
          turnId: view.activeTurnId,
        },
      ] satisfies TimelineItem[]);

  const pendingApprovalIds = view.session
    ? Array.from(new Set([...view.session.pendingApprovalIds, request.requestId]))
    : [request.requestId];

  return {
    ...view,
    approvals,
    timeline,
    session: patchSession(view.session, {
      status: "waiting_approval",
      pendingApprovalIds,
      lastActiveAt: request.createdAt ?? Date.now(),
    }),
    lastEventAt: request.createdAt ?? Date.now(),
  };
}

export function resolveApprovalLocal(
  view: StreamView,
  requestId: string,
  decision: ApprovalDecision,
  reason?: string,
): StreamView {
  const existing = view.approvals[requestId];
  if (!existing) return view;
  return {
    ...view,
    approvals: {
      ...view.approvals,
      [requestId]: {
        ...existing,
        status: decision,
        responding: false,
        error: reason ?? existing.error,
      },
    },
    session: patchSession(view.session, {
      pendingApprovalIds: view.session?.pendingApprovalIds.filter((id) => id !== requestId) ?? [],
      status: view.isStreaming ? "streaming" : "idle",
      lastActiveAt: Date.now(),
    }),
  };
}

function applyFinalReply(view: StreamView, event: FinalReplyWebEvent): StreamView {
  const text = replyText(event);
  const images = imageParts(event.parts ?? []);
  const index = lastIndex(
    view.timeline,
    (item) => item.kind === "assistant" && item.turnId === event.turnId && !item.done,
  );
  let timeline = view.timeline;

  if (index >= 0) {
    const current = view.timeline[index];
    if (current.kind === "assistant") {
      timeline = replaceAt(timeline, index, {
        ...current,
        text: text || current.text,
        images: images.length > 0 ? images : current.images,
        done: true,
        usage: event.usage ?? current.usage,
      });
    }
  } else if (text || images.length > 0) {
    timeline = [
      ...timeline,
      {
        kind: "assistant",
        id: `assistant:${event.messageId ?? event.eventId}`,
        text,
        images,
        createdAt: event.timestamp,
        turnId: event.turnId,
        done: true,
        usage: event.usage,
      },
    ];
  }

  return {
    ...view,
    timeline,
    typing: false,
    usage: event.usage ?? view.usage,
    lastEventAt: event.timestamp,
    session: patchSession(view.session, { lastActiveAt: event.timestamp }),
  };
}

export function applyAgentEvent(view: StreamView, event: AgentWebEvent): StreamView {
  switch (event.type) {
    case "turn_started":
      return applyTurnStarted(view, event);
    case "thought_chunk":
      return appendThought(view, event);
    case "text_chunk":
      return appendText(view, event);
    case "tool_status":
      return upsertTool(view, event);
    case "approval_request":
      return addApproval(view, event.request);
    case "approval_result":
      return resolveApprovalLocal(view, event.requestId, event.decision, event.reason);
    case "final_reply":
      return applyFinalReply(view, event);
    case "typing":
      return {
        ...view,
        typing: event.state === "start",
        lastEventAt: event.timestamp,
      };
    case "error": {
      const timeline: TimelineItem[] = [
        ...view.timeline,
        {
          kind: "error",
          id: `error:${event.eventId}`,
          message: event.error.message || "Agent 运行出错",
          code: event.error.code,
          createdAt: event.timestamp,
          turnId: event.turnId,
          fatal: event.fatal,
        },
      ];
      return {
        ...view,
        timeline,
        typing: false,
        isStreaming: event.fatal ? false : view.isStreaming,
        lastEventAt: event.timestamp,
        session: patchSession(view.session, {
          status: event.fatal ? "error" : view.session?.status,
          lastActiveAt: event.timestamp,
        }),
      };
    }
    case "turn_finished": {
      const timeline = view.timeline.map((item) => doneForTurn(item, event.turnId));
      return {
        ...view,
        timeline,
        isStreaming: false,
        typing: false,
        activeTurnId: undefined,
        lastEventAt: event.timestamp,
        session: patchSession(view.session, {
          status: event.outcome === "error" ? "error" : "idle",
          activeTurn: undefined,
          lastActiveAt: event.timestamp,
        }),
      };
    }
    case "session_closed":
      return {
        ...view,
        isStreaming: false,
        typing: false,
        lastEventAt: event.timestamp,
        session: patchSession(view.session, {
          status: "closed",
          activeTurn: undefined,
          lastActiveAt: event.timestamp,
        }),
      };
    default:
      return view;
  }
}

export function applySnapshot(
  view: StreamView,
  snapshot: AgentSessionSnapshot,
  reset: boolean,
): StreamView {
  let next = reset ? createInitialStreamView(snapshot.session) : view;
  next = {
    ...next,
    session: snapshot.session,
    isStreaming: snapshot.isStreaming,
    lastSeq: Math.max(next.lastSeq, snapshot.lastSeq),
    truncated: snapshot.truncated,
    lastEventAt: Date.now(),
  };

  if (reset) {
    next.approvals = {};
    next.timeline = [];
  }

  for (const request of snapshot.pendingApprovals) {
    if (next.approvals[request.requestId]?.status === "pending") {
      next = {
        ...next,
        approvals: {
          ...next.approvals,
          [request.requestId]: { ...next.approvals[request.requestId], request },
        },
      };
    } else {
      next = addApproval(next, request);
    }
  }

  return next;
}

export function appendOptimisticPrompt(view: StreamView, prompt: string, createdAt = Date.now()): StreamView {
  const id = `local:${createdAt}:${Math.random().toString(36).slice(2, 8)}`;
  return {
    ...view,
    timeline: [
      ...view.timeline,
      { kind: "user", id, text: prompt, createdAt, pending: true },
    ],
    isStreaming: true,
    lastEventAt: createdAt,
    session: patchSession(view.session, { status: "thinking" }),
  };
}

export function markOptimisticFailed(view: StreamView, message: string): StreamView {
  let index = -1;
  for (let cursor = view.timeline.length - 1; cursor >= 0; cursor -= 1) {
    const item = view.timeline[cursor];
    if (item.kind === "user" && item.pending) {
      index = cursor;
      break;
    }
  }
  if (index < 0) {
    return {
      ...view,
      isStreaming: false,
      timeline: [
        ...view.timeline,
        {
          kind: "error",
          id: `local-error:${Date.now()}`,
          message,
          code: "NETWORK_ERROR",
          createdAt: Date.now(),
          fatal: true,
        },
      ],
    };
  }
  const item = view.timeline[index];
  if (item.kind !== "user") return view;
  return {
    ...view,
    isStreaming: false,
    timeline: replaceAt(view.timeline, index, { ...item, pending: false, failed: true }),
    session: patchSession(view.session, { status: "error" }),
  };
}

export function setApprovalResponding(view: StreamView, requestId: string, responding: boolean): StreamView {
  const existing = view.approvals[requestId];
  if (!existing) return view;
  return {
    ...view,
    approvals: { ...view.approvals, [requestId]: { ...existing, responding } },
  };
}

export function setApprovalError(view: StreamView, requestId: string, error: string): StreamView {
  const existing = view.approvals[requestId];
  if (!existing) return view;
  return {
    ...view,
    approvals: { ...view.approvals, [requestId]: { ...existing, responding: false, error } },
  };
}

/** Is this a transport envelope rather than a persisted session event? */
export function isTransportEvent(event: AgentStreamEvent): boolean {
  return event.type === "connected" || event.type === "session_snapshot" || event.type === "heartbeat";
}
