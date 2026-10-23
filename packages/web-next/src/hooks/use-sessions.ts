"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  UnauthorizedError,
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  fetchSessions,
  updateSession as apiUpdateSession,
} from "@/lib/api";
import type { AgentSessionInfo, SessionListStats } from "@/lib/types";

export interface UseSessionsOptions {
  token: string | null;
  onUnauthorized?: () => void;
}

export interface UseSessionsResult {
  sessions: AgentSessionInfo[];
  stats: SessionListStats | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: (options?: { quiet?: boolean }) => Promise<void>;
  createSession: (input: Parameters<typeof apiCreateSession>[1]) => Promise<AgentSessionInfo | null>;
  renameSession: (sessionId: string, title: string) => Promise<boolean>;
  removeSession: (sessionId: string) => Promise<boolean>;
}

export function useSessions({ token, onUnauthorized }: UseSessionsOptions): UseSessionsResult {
  const [sessions, setSessions] = useState<AgentSessionInfo[]>([]);
  const [stats, setStats] = useState<SessionListStats | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (quiet = false) => {
      const activeToken = tokenRef.current;
      if (!activeToken) {
        if (mountedRef.current) {
          setSessions([]);
          setStats(null);
          setLoading(false);
        }
        return;
      }
      if (!quiet && mountedRef.current) setLoading(true);
      if (quiet && mountedRef.current) setRefreshing(true);
      try {
        const response = await fetchSessions(activeToken, { limit: 100 });
        if (!mountedRef.current) return;
        setSessions(response.items ?? []);
        setStats(response.stats ?? null);
        setError(null);
      } catch (caught) {
        if (!mountedRef.current) return;
        if (caught instanceof UnauthorizedError) {
          onUnauthorized?.();
          return;
        }
        const message = caught instanceof ApiError ? caught.message : "加载会话列表失败";
        setError(message);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [onUnauthorized],
  );

  useEffect(() => {
    void load();
  }, [load, token]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 12_000);
    return () => window.clearInterval(interval);
  }, [load, token]);

  const createSession = useCallback(
    async (input: Parameters<typeof apiCreateSession>[1]) => {
      if (!tokenRef.current) return null;
      try {
        const session = await apiCreateSession(tokenRef.current, input);
        setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
        await load(true);
        return session;
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          onUnauthorized?.();
          return null;
        }
        setError(caught instanceof ApiError ? caught.message : "创建会话失败");
        return null;
      }
    },
    [load, onUnauthorized],
  );

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      if (!tokenRef.current) return false;
      try {
        const session = await apiUpdateSession(tokenRef.current, sessionId, { title });
        setSessions((current) => current.map((item) => (item.id === session.id ? session : item)));
        return true;
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          onUnauthorized?.();
          return false;
        }
        setError(caught instanceof ApiError ? caught.message : "重命名会话失败");
        return false;
      }
    },
    [onUnauthorized],
  );

  const removeSession = useCallback(
    async (sessionId: string) => {
      if (!tokenRef.current) return false;
      try {
        await apiDeleteSession(tokenRef.current, sessionId);
        setSessions((current) => current.filter((item) => item.id !== sessionId));
        await load(true);
        return true;
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          onUnauthorized?.();
          return false;
        }
        setError(caught instanceof ApiError ? caught.message : "删除会话失败");
        return false;
      }
    },
    [load, onUnauthorized],
  );

  return {
    sessions,
    stats,
    loading,
    refreshing,
    error,
    refresh: (options) => load(options?.quiet),
    createSession,
    renameSession,
    removeSession,
  };
}
