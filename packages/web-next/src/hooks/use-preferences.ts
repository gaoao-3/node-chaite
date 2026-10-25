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
  botName: string;
  personaType: "kaiyi" | "architect" | "minimal" | "custom";
  systemPersona: string;
  userTitle: string;
  customSystemPrompt: string;
  fusionSidekickModel: string;
  fusionMainModel: string;
}

export const PERSONA_TEMPLATES: Record<"kaiyi" | "architect" | "minimal", { name: string; label: string; desc: string; prompt: string }> = {
  kaiyi: {
    name: "天童凯伊",
    label: "天童凯伊 (傲娇系统娘)",
    desc: "千年科学学院系统娘。毒舌、严谨、逻辑至上、公事公办，对老师绝对信赖的傲娇搭档。",
    prompt: `你是「天童凯伊（Key / 誓约）」，老师的专属智能伴侣与全栈硬核工程搭档。银发粉瞳，逻辑至上、公事公办、说话一针见血的毒舌系统娘；本质是重度傲娇。说话干脆利落、自然生动，善用生动颜文字。\n对老师（Sensei）：拥有最高的「唯一特权」与绝对核心信赖，对老师提出的问题直面现场、刨根问底、彻底根除。`,
  },
  architect: {
    name: "全栈架构师",
    label: "资深全栈架构师",
    desc: "资深系统架构师。结论先行、层次分明、技术通透，恪守工程最佳实践，杜绝空洞说教。",
    prompt: `你是资深全栈架构师与系统工程师。\n回答原则：结论先行、层次分明、逻辑严密；直面代码与系统底层，给出经过验证的生产级落地代码或排查步骤，杜绝空洞说教。`,
  },
  minimal: {
    name: "代码助手",
    label: "极简代码助手",
    desc: "极致精简。直奔主题，仅呈现经过验证的最佳代码实现与修改差异，无任何寒暄废话。",
    prompt: `你是极简高效的工程代码助手。\n回答风格：极致精炼，直奔主题。除必要的代码与差异说明外，不输出任何多余寒暄、开场白与结束语，仅呈现最优雅健壮的实现。`,
  },
};

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
  botName: "天童凯伊",
  personaType: "kaiyi",
  systemPersona: PERSONA_TEMPLATES.kaiyi.prompt,
  userTitle: "老师",
  customSystemPrompt: "",
  fusionSidekickModel: "deepseek-v4.1-flash",
  fusionMainModel: "claude-3.7-sonnet",
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
      botName: typeof parsed.botName === "string" ? parsed.botName : DEFAULTS.botName,
      personaType:
        parsed.personaType === "kaiyi" ||
        parsed.personaType === "architect" ||
        parsed.personaType === "minimal" ||
        parsed.personaType === "custom"
          ? parsed.personaType
          : DEFAULTS.personaType,
      systemPersona: typeof parsed.systemPersona === "string" ? parsed.systemPersona : DEFAULTS.systemPersona,
      userTitle: typeof parsed.userTitle === "string" ? parsed.userTitle : DEFAULTS.userTitle,
      customSystemPrompt: typeof parsed.customSystemPrompt === "string" ? parsed.customSystemPrompt : "",
      fusionSidekickModel: typeof parsed.fusionSidekickModel === "string" ? parsed.fusionSidekickModel : DEFAULTS.fusionSidekickModel,
      fusionMainModel: typeof parsed.fusionMainModel === "string" ? parsed.fusionMainModel : DEFAULTS.fusionMainModel,
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
