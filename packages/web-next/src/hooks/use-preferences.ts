"use client";

import { useCallback, useEffect, useState } from "react";
import type { GatewayPlatform } from "@/lib/types";
import { applyTheme } from "@/lib/theme";

export type Density = "comfortable" | "compact";

export interface ConsolePreferences {
  theme: string;
  density: Density;
  reduceMotion: boolean;
  autoScroll: boolean;
  preview: boolean;
  defaultPlatform: GatewayPlatform;
  defaultModel: string;
  temperature: number;
  thinkingBudget: "none" | "low" | "medium" | "high";
  webSearchDefault: boolean;
  workspaceToolsDefault: boolean;
  autoSynthesize: boolean;
  userTitle: string;
  customSystemPrompt: string;
}

const STORAGE_KEY = "chaite.console.preferences";

export const DEFAULTS: ConsolePreferences = {
  theme: "slate",
  density: "comfortable",
  reduceMotion: false,
  autoScroll: true,
  preview: false,
  defaultPlatform: "web",
  defaultModel: "gemini-3.8-flash-high",
  temperature: 0.7,
  thinkingBudget: "medium",
  webSearchDefault: false,
  workspaceToolsDefault: true,
  autoSynthesize: true,
  userTitle: "老师",
  customSystemPrompt: "",
};

function readPreferences(): ConsolePreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ConsolePreferences>;
    return {
      theme: typeof parsed.theme === "string" ? parsed.theme : DEFAULTS.theme,
      density: parsed.density === "compact" ? "compact" : "comfortable",
      reduceMotion: parsed.reduceMotion === true,
      autoScroll: parsed.autoScroll !== false,
      preview: parsed.preview === true,
      defaultPlatform:
        parsed.defaultPlatform === "qq" || parsed.defaultPlatform === "dsh" || parsed.defaultPlatform === "web"
          ? parsed.defaultPlatform
          : "web",
      defaultModel: typeof parsed.defaultModel === "string" ? parsed.defaultModel : DEFAULTS.defaultModel,
      temperature: typeof parsed.temperature === "number" ? parsed.temperature : DEFAULTS.temperature,
      thinkingBudget:
        parsed.thinkingBudget === "none" ||
        parsed.thinkingBudget === "low" ||
        parsed.thinkingBudget === "medium" ||
        parsed.thinkingBudget === "high"
          ? parsed.thinkingBudget
          : DEFAULTS.thinkingBudget,
      webSearchDefault: parsed.webSearchDefault === true,
      workspaceToolsDefault: parsed.workspaceToolsDefault !== false,
      autoSynthesize: parsed.autoSynthesize !== false,
      userTitle: typeof parsed.userTitle === "string" ? parsed.userTitle : DEFAULTS.userTitle,
      customSystemPrompt: typeof parsed.customSystemPrompt === "string" ? parsed.customSystemPrompt : "",
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
    const initial = readPreferences();
    setPreferences(initial);
    applyTheme(initial.theme);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      applyTheme(preferences.theme);
    } catch {
      // storage may be unavailable in private mode
    }
  }, [preferences, ready]);

  const update = useCallback((patch: Partial<ConsolePreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      if (patch.theme) {
        applyTheme(patch.theme);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPreferences(DEFAULTS);
    applyTheme(DEFAULTS.theme);
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { preferences, ready, update, reset };
}
