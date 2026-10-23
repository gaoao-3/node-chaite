"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  UnauthorizedError,
  fetchEvolutionStats,
  fetchEvolutionTraces,
  fetchFusionStats,
  fetchFusionTasks,
  mergeEvolutionTrace,
  reviewEvolutionTrace,
  updateFusionStatus,
} from "@/lib/api";
import type {
  EvolutionStats,
  EvolutionTraceRecord,
  FusionStats,
  FusionTaskRecord,
} from "@/lib/types";

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

export interface FusionData {
  tasks: FusionTaskRecord[];
  stats: FusionStats | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  advance: (taskId: string, status: string) => Promise<boolean>;
}

export function useFusionData(token: string | null, onUnauthorized?: () => void): FusionData {
  const [tasks, setTasks] = useState<FusionTaskRecord[]>([]);
  const [stats, setStats] = useState<FusionStats | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const authRef = useRef(onUnauthorized);
  authRef.current = onUnauthorized;

  const load = useCallback(async (quiet = false) => {
    if (!tokenRef.current) {
      setTasks([]);
      setStats(null);
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [taskList, stat] = await Promise.all([
        fetchFusionTasks(tokenRef.current, { limit: 50 }),
        fetchFusionStats(tokenRef.current),
      ]);
      setTasks(taskList.items ?? []);
      setStats(stat);
      setError(null);
    } catch (caught) {
      if (caught instanceof UnauthorizedError) {
        authRef.current?.();
        return;
      }
      setError(messageOf(caught, "加载 Fusion 任务失败"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, token]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [load, token]);

  const advance = useCallback(
    async (taskId: string, status: string) => {
      if (!tokenRef.current) return false;
      try {
        await updateFusionStatus(tokenRef.current, taskId, status);
        await load(true);
        return true;
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          authRef.current?.();
          return false;
        }
        setError(messageOf(caught, "更新任务状态失败"));
        return false;
      }
    },
    [load],
  );

  return { tasks, stats, loading, refreshing, error, refresh: () => load(true), advance };
}

export interface EvolutionData {
  traces: EvolutionTraceRecord[];
  stats: EvolutionStats | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  review: (traceId: string, action: "approve" | "reject") => Promise<boolean>;
  merge: (traceId: string) => Promise<boolean>;
}

export function useEvolutionData(token: string | null, onUnauthorized?: () => void): EvolutionData {
  const [traces, setTraces] = useState<EvolutionTraceRecord[]>([]);
  const [stats, setStats] = useState<EvolutionStats | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const authRef = useRef(onUnauthorized);
  authRef.current = onUnauthorized;

  const load = useCallback(async (quiet = false) => {
    if (!tokenRef.current) {
      setTraces([]);
      setStats(null);
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [list, stat] = await Promise.all([
        fetchEvolutionTraces(tokenRef.current, { limit: 50 }),
        fetchEvolutionStats(tokenRef.current),
      ]);
      setTraces(list.items ?? []);
      setStats(stat);
      setError(null);
    } catch (caught) {
      if (caught instanceof UnauthorizedError) {
        authRef.current?.();
        return;
      }
      setError(messageOf(caught, "加载自进化轨迹失败"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, token]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [load, token]);

  const review = useCallback(
    async (traceId: string, action: "approve" | "reject") => {
      if (!tokenRef.current) return false;
      try {
        await reviewEvolutionTrace(tokenRef.current, traceId, action);
        await load(true);
        return true;
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          authRef.current?.();
          return false;
        }
        setError(messageOf(caught, "评审操作失败"));
        return false;
      }
    },
    [load],
  );

  const merge = useCallback(
    async (traceId: string) => {
      if (!tokenRef.current) return false;
      try {
        await mergeEvolutionTrace(tokenRef.current, traceId, { mergedBy: "web-console" });
        await load(true);
        return true;
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          authRef.current?.();
          return false;
        }
        setError(messageOf(caught, "技能熔铸失败"));
        return false;
      }
    },
    [load],
  );

  return {
    traces,
    stats,
    loading,
    refreshing,
    error,
    refresh: () => load(true),
    review,
    merge,
  };
}
