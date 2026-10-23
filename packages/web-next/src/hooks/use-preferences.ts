"use client";

import { useCallback, useEffect, useState } from "react";
import type { GatewayPlatform } from "@/lib/types";

export type Density = "comfortable" | "compact";

export interface ConsolePreferences {
  density: Density;
  reduceMotion: boolean;
  autoScroll: boolean;
  preview: boolean;
  defaultPlatform: GatewayPlatform;
}

const STORAGE_KEY = "chaite.console.preferences";

const DEFAULTS: ConsolePreferences = {
  density: "comfortable",
  reduceMotion: false,
  autoScroll: true,
  preview: false,
  defaultPlatform: "web",
};

function readPreferences(): ConsolePreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ConsolePreferences>;
    return {
      density: parsed.density === "compact" ? "compact" : "comfortable",
      reduceMotion: parsed.reduceMotion === true,
      autoScroll: parsed.autoScroll !== false,
      preview: parsed.preview === true,
      defaultPlatform:
        parsed.defaultPlatform === "qq" || parsed.defaultPlatform === "dsh" || parsed.defaultPlatform === "web"
          ? parsed.defaultPlatform
          : "web",
    };
  } catch {
    return DEFAULTS;
  }
}

export interface UsePreferencesResult {
  preferences: ConsolePreferences;
  ready: boolean;
  update: (patch: Partial<ConsolePreferences>) => void;
  reset: () => void;
}

export function usePreferences(): UsePreferencesResult {
  const [preferences, setPreferences] = useState<ConsolePreferences>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreferences(readPreferences());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // storage may be unavailable in private mode
    }
  }, [preferences, ready]);

  const update = useCallback((patch: Partial<ConsolePreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setPreferences(DEFAULTS);
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { preferences, ready, update, reset };
}
