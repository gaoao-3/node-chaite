"use client";

import * as React from "react";
import {
  Check,
  Cpu,
  Eye,
  EyeOff,
  Flame,
  Globe,
  KeyRound,
  Layers3,
  LogOut,
  Palette,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  User,
  Wrench,
} from "lucide-react";
import { BoardPage, SectionCard } from "@/components/boards/board-shell";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Segmented, Switch } from "@/components/ui/switch";
import type { ConsolePreferences, Density } from "@/hooks/use-preferences";
import { THEME_OPTIONS } from "@/lib/theme";
import type { SessionListStats } from "@/lib/types";
import { cn } from "@/lib/utils";

function maskToken(token: string | null): string {
  if (!token) return "未登录";
  if (token.length <= 18) return `${token.slice(0, 4)}••••${token.slice(-2)}`;
  return `${token.slice(0, 14)}••••••••••${token.slice(-6)}`;
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-white/[0.04] last:border-0 last:pb-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1 pr-2">
        <div className="text-[13px] font-medium text-mist-100">{title}</div>
        {description ? <div className="mt-0.5 text-[11px] leading-relaxed text-mist-500">{description}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsBoard({
  preferences,
  update,
  reset,
  token,
  stats,
  sessionCount,
  onLogout,
  onReconnect,
  onMenu,
  onBack,
}: {
  preferences: ConsolePreferences;
  update: (patch: Partial<ConsolePreferences>) => void;
  reset: () => void;
  token: string | null;
  stats: SessionListStats | null;
  sessionCount: number;
  onLogout: () => void;
  onReconnect: () => void;
  onMenu?: () => void;
  onBack?: () => void;
}) {
  const [reveal, setReveal] = React.useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3300";

  const POPULAR_MODELS = [
    { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash" },
    { id: "claude-3.7-sonnet", label: "Claude 3.7 Sonnet" },
    { id: "deepseek-v4.1-flash", label: "DeepSeek V4.1" },
    { id: "gpt-4o", label: "GPT-4o" },
  ];

  const PRIMARY_THEMES = [
    { id: "slate", label: "石板冷灰", dot: "#38bdf8" },
    { id: "dark", label: "暗黑经典", dot: "#60a5fa" },
    { id: "midnight", label: "纯黑极客", dot: "#818cf8" },
    { id: "light", label: "纯净浅白", dot: "#2563eb" },
  ];

  return (
    <BoardPage
      onMenu={onMenu}
      onBack={onBack}
      icon={<Settings2 className="h-4 w-4" />}
      eyebrow="Preferences"
      title="偏好设置"
      description="管理外观主题、推理参数、助理人格与认证状态"
      actions={
        <button
          type="button"
          onClick={onReconnect}
          title="刷新连接"
          className="flex h-7 items-center gap-1 rounded-md border border-white/[0.08] px-2 text-[11px] text-mist-400 hover:bg-white/[0.04] hover:text-mist-200 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>刷新</span>
        </button>
      }
    >
      <div className="space-y-4">
        {/* ── 1. 外观与主题 ── */}
        <SectionCard title="外观与显示" hint="Appearance">
          <SettingRow
            title="色彩主题"
            description="切换界面的全局配色与光暗模式。"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {PRIMARY_THEMES.map((t) => {
                const active = preferences.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update({ theme: t.id })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-white/[0.07] bg-white/[0.02] text-mist-400 hover:border-white/[0.14] hover:text-mist-200",
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.dot }} />
                    <span>{t.label}</span>
                  </button>
                );
              })}

              {/* Extra Themes Dropdown */}
              <select
                value={preferences.theme}
                onChange={(e) => update({ theme: e.target.value })}
                aria-label="更多主题选项"
                className="h-7 rounded-md border border-white/[0.07] bg-black/20 px-2 text-[11px] font-mono text-mist-400 outline-none hover:border-white/[0.14]"
              >
                <option value="" disabled>更多主题…</option>
                {THEME_OPTIONS.map((theme) => (
                  <option key={theme.id} value={theme.id} className="bg-zinc-900 text-mist-200">
                    {theme.label} ({theme.scheme})
                  </option>
                ))}
              </select>
            </div>
          </SettingRow>

          <SettingRow
            title="界面密度"
            description="紧凑模式缩小间距与字号，提高长篇对话信息呈现密度。"
          >
            <Segmented<Density>
              value={preferences.density}
              onChange={(density) => update({ density })}
              ariaLabel="界面密度"
              options={[
                { value: "comfortable", label: "舒适" },
                { value: "compact", label: "紧凑" },
              ]}
            />
          </SettingRow>

          <SettingRow
            title="自动平滑滚屏"
            description="流式推理生成内容与工具执行时自动跟随至底部。"
          >
            <Switch
              checked={preferences.autoScroll}
              onChange={(autoScroll) => update({ autoScroll })}
              label="自动平滑滚屏"
            />
          </SettingRow>

          <SettingRow
            title="减弱动效"
            description="减少界面动画和过渡效果，提升低配设备运行流畅度。"
          >
            <Switch
              checked={preferences.reduceMotion}
              onChange={(reduceMotion) => update({ reduceMotion })}
              label="减弱动效"
            />
          </SettingRow>
        </SectionCard>

        {/* ── 2. 模型与推理 ── */}
        <SectionCard title="模型与推理参数" hint="Inference">
          <SettingRow
            title="默认模型"
            description="新会话与未指定时优先调用的驱动模型。"
          >
            <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
              <div className="flex flex-wrap gap-1 justify-end">
                {POPULAR_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => update({ defaultModel: m.id })}
                    className={cn(
                      "rounded border px-2 py-0.5 text-[9.5px] font-medium transition-colors",
                      preferences.defaultModel === m.id
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-white/[0.08] bg-white/[0.02] text-mist-400 hover:text-mist-200",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={preferences.defaultModel}
                onChange={(e) => update({ defaultModel: e.target.value })}
                placeholder="模型标识，如 gemini-3.8-flash-high"
                className="w-full max-w-[240px] rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[11px] text-mist-100 outline-none focus:border-accent"
              />
            </div>
          </SettingRow>

          <SettingRow
            title="思考预算 (Thinking Effort)"
            description="针对 Claude 3.7 / Gemini 等支持推理模型的思考预算等级。"
          >
            <Segmented
              value={preferences.thinkingBudget}
              onChange={(thinkingBudget) => update({ thinkingBudget })}
              ariaLabel="思考预算"
              options={[
                { value: "none", label: "关闭" },
                { value: "low", label: "轻度" },
                { value: "medium", label: "平衡" },
                { value: "high", label: "深度" },
              ]}
            />
          </SettingRow>

          <SettingRow
            title="生成温度 (Temperature)"
            description={`当前: ${preferences.temperature} · 越低越严谨精确，越高越生动多变。`}
          >
            <div className="flex items-center gap-1.5">
              {[0.2, 0.7, 1.0].map((temp) => (
                <button
                  key={temp}
                  type="button"
                  onClick={() => update({ temperature: temp })}
                  className={cn(
                    "rounded border px-2 py-0.5 text-[10px] font-mono transition-colors",
                    preferences.temperature === temp
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-white/[0.08] bg-white/[0.02] text-mist-400 hover:text-mist-200",
                  )}
                >
                  {temp === 0.2 ? "0.2 严谨" : temp === 0.7 ? "0.7 平衡" : "1.0 创意"}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow
            title="默认开启联网搜索"
            description="遇到最新资讯、文档与未知异常时自主使用 Web Search MCP。"
          >
            <Switch
              checked={preferences.webSearchDefault}
              onChange={(webSearchDefault) => update({ webSearchDefault })}
              label="默认联网搜索"
            />
          </SettingRow>

          <SettingRow
            title="自动沉淀踩坑技能"
            description="多步工具调用或异常自愈后，由反思器自动提炼并记录 candidate SKILL.md。"
          >
            <Switch
              checked={preferences.autoSynthesize}
              onChange={(autoSynthesize) => update({ autoSynthesize })}
              label="自动沉淀技能"
            />
          </SettingRow>
        </SectionCard>

        {/* ── 3. 角色人格 ── */}
        <SectionCard title="助理人格与指令" hint="Persona">
          <SettingRow
            title="用户称呼"
            description="Agent 对你的称呼，默认尊称「老师 (Sensei)」。"
          >
            <input
              type="text"
              value={preferences.userTitle}
              onChange={(e) => update({ userTitle: e.target.value })}
              placeholder="老师"
              className="w-24 rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 text-[11px] text-mist-100 outline-none focus:border-accent text-right"
            />
          </SettingRow>

          <div className="pt-2">
            <div className="text-[12.5px] font-medium text-mist-200">附加系统提示词 (Custom Instructions)</div>
            <div className="mt-0.5 text-[11px] text-mist-500">
              全局追加到 System Prompt 末尾的额外约束（如代码语言偏好、格式风格等）。
            </div>
            <textarea
              value={preferences.customSystemPrompt}
              onChange={(e) => update({ customSystemPrompt: e.target.value })}
              rows={2}
              placeholder="例如：优先使用 TypeScript 并给出可直接运行的完整代码…"
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/20 p-2 text-[11.5px] text-mist-100 outline-none focus:border-accent placeholder:text-mist-600 resize-none"
            />
          </div>
        </SectionCard>

        {/* ── 4. 凭据与服务状态 ── */}
        <SectionCard title="认证凭据与服务状态" hint="System & Auth">
          <SettingRow
            title="后端服务端点"
            description="当前 API 代理源与 Express SSE 服务端口。"
          >
            <code className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-0.5 font-mono text-[9.5px] text-mist-400">
              {origin} → :3200
            </code>
          </SettingRow>

          <SettingRow
            title="Bearer JWT 凭据"
            description="本地安全认证口令。"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-mist-400">
                {reveal ? token ?? "未登录" : maskToken(token)}
              </span>
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="text-mist-500 hover:text-mist-200"
                title={reveal ? "隐藏" : "显示"}
              >
                {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
              {token ? <CopyButton value={token} label="复制" /> : null}
            </div>
          </SettingRow>

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
            <Button size="xs" variant="ghost" onClick={reset}>
              <RefreshCw className="h-3 w-3" />
              恢复默认偏好
            </Button>

            <Button variant="danger" size="xs" onClick={onLogout}>
              <LogOut className="h-3 w-3" />
              退出登录
            </Button>
          </div>
        </SectionCard>
      </div>
    </BoardPage>
  );
}
