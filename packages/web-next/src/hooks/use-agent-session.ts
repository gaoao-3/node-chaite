"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  UnauthorizedError,
  cancelPrompt as apiCancelPrompt,
  respondApproval as apiRespondApproval,
  sendPrompt as apiSendPrompt,
} from "@/lib/api";
import { createDemoStreamView } from "@/lib/demo";
import {
  applyAgentEvent,
  applySnapshot,
  appendOptimisticPrompt,
  createInitialStreamView,
  markOptimisticFailed,
  resolveApprovalLocal,
  setApprovalError,
  setApprovalResponding,
  type ApprovalState,
  type StreamView,
} from "@/lib/timeline";
import type {
  AgentStreamEvent,
  AgentWebEvent,
  ApprovalDecision,
  HumanApprovalOption,
  HumanApprovalRequest,
  SessionSnapshotEvent,
} from "@/lib/types";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline"
  | "unauthorized"
  | "error"
  | "preview";

interface UseAgentSessionOptions {
  token: string | null;
  sessionId: string | null;
  enabled?: boolean;
  preview?: boolean;
  onUnauthorized?: () => void;
}

export interface UseAgentSessionResult {
  view: StreamView;
  connection: ConnectionState;
  loading: boolean;
  error: string | null;
  lastHeartbeatAt: number | null;
  pendingApprovals: ApprovalState[];
  promptPending: boolean;
  sendPrompt: (
    prompt: string,
    options?: {
      model?: string;
      skillName?: string;
      images?: Array<{ url?: string; base64?: string; mimeType?: string }>;
      thinkingLevel?: "none" | "low" | "medium" | "high" | "max";
    },
  ) => Promise<boolean>;
  cancel: () => Promise<void>;
  respond: (requestId: string, option: HumanApprovalOption) => Promise<boolean>;
  refresh: () => void;
  clearError: () => void;
}

type QueueEntry =
  | { kind: "connected"; event: Extract<AgentStreamEvent, { type: "connected" }> }
  | { kind: "snapshot"; event: SessionSnapshotEvent }
  | { kind: "agent"; event: AgentWebEvent };

function optionDecision(option: HumanApprovalOption): ApprovalDecision {
  switch (option.outcome) {
    case "approve":
      return "approved";
    case "deny":
      return "denied";
    case "cancel":
      return "cancelled";
    default:
      return "denied";
  }
}

function parseSseBlock(block: string): string | null {
  const dataLines: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon >= 0 ? line.slice(0, colon) : line;
    let value = colon >= 0 ? line.slice(colon + 1) : "";
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return dataLines.join("\n");
}

function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError) return caught.message;
  if (caught instanceof Error) return caught.message;
  return "未知错误";
}

export function useAgentSession({
  token,
  sessionId,
  enabled = true,
  preview = false,
  onUnauthorized,
}: UseAgentSessionOptions): UseAgentSessionResult {
  const [view, setViewState] = useState<StreamView>(() => createInitialStreamView());
  const viewRef = useRef(view);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const [promptPending, setPromptPending] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const mountedRef = useRef(true);
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const commit = useCallback((next: StreamView) => {
    viewRef.current = next;
    if (mountedRef.current) setViewState(next);
  }, []);

  const replaceView = useCallback((next: StreamView) => {
    viewRef.current = next;
    if (mountedRef.current) setViewState(next);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnection("idle");
      return;
    }

    if (preview) {
      const demo = createDemoStreamView();
      replaceView(demo);
      setConnection("preview");
      setLoading(false);
      setError(null);
      return;
    }

    if (!token || !sessionId) {
      replaceView(createInitialStreamView());
      setConnection("idle");
      setLoading(false);
      return;
    }

    let stopped = false;
    let closed = false;
    let resetPending = true;
    let attempt = 0;
    let lastBeat = Date.now();
    let controller: AbortController | null = null;
    let retryTimer: number | null = null;
    let watchdog: number | null = null;
    let raf: number | null = null;
    const seen = new Set<number>();
    const queue: QueueEntry[] = [];

    setLoading(true);
    setError(null);
    setConnection("connecting");

    const flush = () => {
      raf = null;
      if (stopped) return;
      const entries = queue.splice(0, queue.length);
      if (entries.length === 0) return;
      let next = viewRef.current;
      let firstSnapshot = false;

      for (const entry of entries) {
        if (entry.kind === "connected") {
          const { event } = entry;
          next = {
            ...next,
            isStreaming: event.isStreaming,
            lastSeq: Math.max(next.lastSeq, event.lastSeq || 0),
          };
          setConnection("live");
          setError(null);
          attempt = 0;
          lastBeat = Date.now();
          setLastHeartbeatAt(Date.now());
          continue;
        }

        if (entry.kind === "snapshot") {
          const snapshot = entry.event;
          const reset = resetPending || snapshot.truncated;
          resetPending = false;
          firstSnapshot = true;
          if (reset) {
            seen.clear();
            next = createInitialStreamView(snapshot.session);
          }
          for (const event of snapshot.events ?? []) {
            if (typeof event.seq === "number" && event.seq > 0) {
              if (seen.has(event.seq)) continue;
              seen.add(event.seq);
            }
            next = applyAgentEvent(next, event);
          }
          next = applySnapshot(next, snapshot, false);
          setLoading(false);
          continue;
        }

        const { event } = entry;
        if (typeof event.seq === "number" && event.seq > 0) {
          if (seen.has(event.seq)) continue;
          seen.add(event.seq);
        }
        next = applyAgentEvent(next, event);
        if (event.type === "session_closed") {
          closed = true;
        }
      }

      if (firstSnapshot) setLoading(false);
      commit(next);
    };

    const enqueue = (entry: QueueEntry) => {
      if (stopped) return;
      queue.push(entry);
      if (raf === null) raf = window.requestAnimationFrame(flush);
    };

    const dispatch = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const event = payload as AgentStreamEvent;
      if (event.type === "heartbeat") {
        lastBeat = Date.now();
        setLastHeartbeatAt(lastBeat);
        setConnection((current) => (current === "live" ? current : "live"));
        return;
      }
      if (event.type === "connected") {
        enqueue({ kind: "connected", event });
        return;
      }
      if (event.type === "session_snapshot") {
        enqueue({ kind: "snapshot", event });
        return;
      }
      if (typeof event.type !== "string") return;
      enqueue({ kind: "agent", event: event as AgentWebEvent });
    };

    const scheduleRetry = () => {
      if (stopped || closed) return;
      attempt += 1;
      if (attempt > 6) setConnection("offline");
      else setConnection("reconnecting");
      const delay = Math.min(12_000, 900 * 2 ** Math.min(attempt - 1, 4));
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void connect();
      }, delay);
    };

    const connect = async (): Promise<void> => {
      if (stopped || closed) return;
      controller?.abort();
      controller = new AbortController();
      const since = viewRef.current.lastSeq;
      const query = since > 0 ? `?since=${since}` : "";
      const url = `/api/agent/sessions/${encodeURIComponent(sessionId)}/events${query}`;

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          setConnection("unauthorized");
          setLoading(false);
          unauthorizedRef.current?.();
          return;
        }

        if (!response.ok || !response.body) {
          throw new ApiError(`SSE 连接失败 (${response.status})`, response.status, "SSE_HTTP_ERROR");
        }

        setConnection("live");
        setError(null);
        attempt = 0;
        lastBeat = Date.now();
        setLastHeartbeatAt(Date.now());

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const data = parseSseBlock(block);
            if (data) {
              try {
                dispatch(JSON.parse(data) as unknown);
              } catch {
                // Ignore malformed frames; the next snapshot repairs state.
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }

        if (!stopped && !closed) {
          scheduleRetry();
        }
      } catch (caught) {
        if (stopped) return;
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        const message = errorMessage(caught);
        setError(message);
        setLoading(false);
        scheduleRetry();
      }
    };

    void connect();

    watchdog = window.setInterval(() => {
      if (stopped || closed) return;
      const elapsed = Date.now() - lastBeat;
      if (elapsed > 95_000) {
        controller?.abort();
        scheduleRetry();
      } else if (elapsed > 60_000) {
        setConnection((current) => (current === "live" ? "reconnecting" : current));
      }
    }, 20_000);

    const handleOnline = () => {
      if (!stopped && !closed) {
        controller?.abort();
        void connect();
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      stopped = true;
      window.removeEventListener("online", handleOnline);
      if (raf !== null) window.cancelAnimationFrame(raf);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (watchdog !== null) window.clearInterval(watchdog);
      controller?.abort();
    };
  }, [commit, enabled, preview, reconnectKey, replaceView, sessionId, token]);

  const sendPrompt = useCallback(
    async (
      prompt: string,
      options: {
        model?: string;
        skillName?: string;
        images?: Array<{ url?: string; base64?: string; mimeType?: string }>;
        thinkingLevel?: "none" | "low" | "medium" | "high" | "max";
      } = {},
    ) => {
      const text = prompt.trim();
      if (!text || !token || !sessionId || preview) return false;
      const current = viewRef.current;
      if (current.isStreaming) return false;
      commit(appendOptimisticPrompt(current, text));
      setPromptPending(true);
      setError(null);
      try {
        await apiSendPrompt(token, sessionId, {
          prompt: text,
          displayText: text,
          model: options.model,
          skillName: options.skillName,
          images: options.images,
          thinkingLevel: options.thinkingLevel,
        });
        return true;
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          unauthorizedRef.current?.();
          commit(markOptimisticFailed(viewRef.current, "登录状态已失效"));
          return false;
        }
        const message = errorMessage(caught);
        commit(markOptimisticFailed(viewRef.current, message));
        setError(message);
        return false;
      } finally {
        if (mountedRef.current) setPromptPending(false);
      }
    },
    [commit, preview, sessionId, token],
  );

  const cancel = useCallback(async () => {
    if (!token || !sessionId || preview) return;
    const currentView = viewRef.current;
    // 即时回滚乐观状态，避免按钮卡在 loading
    const clearedView = {
      ...currentView,
      isStreaming: false,
      timeline: currentView.timeline.map(item => {
        if (item.kind === "assistant" && !item.done) {
          return {
            ...item,
            status: "cancelled" as const,
            error: "已手动取消生成",
            isComplete: true,
          };
        }
        return item;
      }),
    };
    commit(clearedView);

    try {
      await apiCancelPrompt(token, sessionId, "用户从 Web 控制台终止");
    } catch (caught) {
      if (caught instanceof UnauthorizedError) {
        unauthorizedRef.current?.();
        return;
      }
      setError(errorMessage(caught));
    }
  }, [commit, preview, sessionId, token]);

  const respond = useCallback(
    async (requestId: string, option: HumanApprovalOption) => {
      const approval = viewRef.current.approvals[requestId];
      if (!approval || approval.status !== "pending") return false;

      if (preview) {
        commit(resolveApprovalLocal(viewRef.current, requestId, optionDecision(option)));
        return true;
      }

      if (!token || !sessionId) return false;
      commit(setApprovalResponding(viewRef.current, requestId, true));
      try {
        const result = await apiRespondApproval(token, sessionId, requestId, {
          decision: optionDecision(option),
          scope: option.scope,
          optionId: option.id,
        });
        commit(resolveApprovalLocal(viewRef.current, requestId, result.decision ?? optionDecision(option)));
        return true;
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          unauthorizedRef.current?.();
          commit(setApprovalError(viewRef.current, requestId, "登录状态已失效"));
          return false;
        }
        const message = errorMessage(caught);
        commit(setApprovalError(viewRef.current, requestId, message));
        setError(message);
        return false;
      }
    },
    [commit, preview, sessionId, token],
  );

  const refresh = useCallback(() => {
    setError(null);
    setReconnectKey((value) => value + 1);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const pendingApprovals = useMemo(
    () =>
      Object.values(view.approvals)
        .filter((item) => item.status === "pending")
        .sort((a, b) => a.request.createdAt - b.request.createdAt),
    [view.approvals],
  );

  return {
    view,
    connection,
    loading,
    error,
    lastHeartbeatAt,
    pendingApprovals,
    promptPending,
    sendPrompt,
    cancel,
    respond,
    refresh,
    clearError,
  };
}

export type { ApprovalState };
export type { HumanApprovalRequest };
