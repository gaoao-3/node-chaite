"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  UnauthorizedError,
  fetchSessionSnapshot,
  fetchSessions,
  respondApproval,
} from "@/lib/api";
import type { AgentSessionInfo, ApprovalDecision, HumanApprovalOption, HumanApprovalRequest } from "@/lib/types";

export interface FeedApproval {
  request: HumanApprovalRequest;
  session: AgentSessionInfo;
  responding?: boolean;
  error?: string;
}

export interface UseApprovalsFeedOptions {
  token: string | null;
  onUnauthorized?: () => void;
  onChanged?: () => void;
}

export interface UseApprovalsFeedResult {
  approvals: FeedApproval[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  respond: (requestId: string, option: HumanApprovalOption) => Promise<boolean>;
}

function decisionOf(option: HumanApprovalOption): ApprovalDecision {
  if (option.outcome === "approve") return "approved";
  if (option.outcome === "cancel") return "cancelled";
  return "denied";
}

export function useApprovalsFeed({
  token,
  onUnauthorized,
  onChanged,
}: UseApprovalsFeedOptions): UseApprovalsFeedResult {
  const [approvals, setApprovals] = useState<FeedApproval[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (quiet = false) => {
    const activeToken = tokenRef.current;
    if (!activeToken) {
      if (mountedRef.current) {
        setApprovals([]);
        setLoading(false);
      }
      return;
    }
    if (!quiet && mountedRef.current) setLoading(true);
    if (quiet && mountedRef.current) setRefreshing(true);
    try {
      const list = await fetchSessions(activeToken, { limit: 100 });
      const targets = (list.items ?? []).filter(
        (session) =>
          session.pendingApprovalIds.length > 0 ||
          session.status === "waiting_approval",
      );
      const snapshots = await Promise.all(
        targets.map((session) =>
          fetchSessionSnapshot(activeToken, session.id, 1)
            .then((snapshot) => ({ session, snapshot }))
            .catch(() => null),
        ),
      );
      if (!mountedRef.current) return;
      const next: FeedApproval[] = [];
      for (const entry of snapshots) {
        if (!entry) continue;
        for (const request of entry.snapshot.pendingApprovals ?? []) {
          next.push({ request, session: entry.session });
        }
      }
      const unique = new Map<string, FeedApproval>();
      for (const item of next) unique.set(item.request.requestId, item);
      setApprovals(
        [...unique.values()].sort((a, b) => a.request.createdAt - b.request.createdAt),
      );
      setError(null);
    } catch (caught) {
      if (!mountedRef.current) return;
      if (caught instanceof UnauthorizedError) {
        unauthorizedRef.current?.();
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "加载审批队列失败");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, token]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [load, token]);

  const respond = useCallback(
    async (requestId: string, option: HumanApprovalOption) => {
      const activeToken = tokenRef.current;
      const entry = approvals.find((item) => item.request.requestId === requestId);
      if (!activeToken || !entry) return false;
      setApprovals((current) =>
        current.map((item) =>
          item.request.requestId === requestId ? { ...item, responding: true, error: undefined } : item,
        ),
      );
      try {
        await respondApproval(activeToken, entry.session.id, requestId, {
          decision: decisionOf(option),
          scope: option.scope,
          optionId: option.id,
        });
        setApprovals((current) => current.filter((item) => item.request.requestId !== requestId));
        onChanged?.();
        void load(true);
        return true;
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          unauthorizedRef.current?.();
          return false;
        }
        const message = caught instanceof ApiError ? caught.message : "审批操作失败";
        setApprovals((current) =>
          current.map((item) =>
            item.request.requestId === requestId
              ? { ...item, responding: false, error: message }
              : item,
          ),
        );
        setError(message);
        return false;
      }
    },
    [approvals, load, onChanged],
  );

  const refresh = useCallback(() => load(true), [load]);

  const sorted = useMemo(
    () => [...approvals].sort((a, b) => a.request.createdAt - b.request.createdAt),
    [approvals],
  );

  return {
    approvals: sorted,
    loading,
    refreshing,
    error,
    refresh,
    respond,
  };
}
