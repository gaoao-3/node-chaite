"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, clearStoredToken, getStoredToken, loginWithPassword } from "@/lib/api";

export interface AuthState {
  token: string | null;
  ready: boolean;
  loading: boolean;
  error: string | null;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(getStoredToken());
    setReady(true);
  }, []);

  const login = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const nextToken = await loginWithPassword(password.trim());
      setToken(nextToken);
      return true;
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.status === 401
            ? "口令无效，请重试"
            : caught.message
          : "登录失败，请稍后再试";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { token, ready, loading, error, login, logout, clearError };
}
