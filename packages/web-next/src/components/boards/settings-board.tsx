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
  MonitorSmartphone,
  Palette,
  Radio,
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
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platform";
import type { SessionListStats } from "@/lib/types";
import { cn } from "@/lib/utils";

function maskToken(token: string | null): string {
  if (!token) return "未登录";
  if (token.length <= 18) return `${token.slice(0, 4)}••••${token.slice(-2)}`;
  return `${token.slice(0, 14)}••••••••••${token.slice(-6)}`;
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-white/[0.05] py-3.5 last:border-0 last:pb-1 first:pt-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-start gap-3 min-w-0 flex-1 pr-2">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-mist-400">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-mist-100">{title}</div>
          {description ? <div className="mt-0.5 text-[11px] leading-relaxed text-mist-500">{description}</div> : null}
        </div>
      </div>
      <div className="shrink-0 pl-12 sm:pl-0">{children}</div>
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
}) {
  const [reveal, setReveal] = React.useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3300";

  const POPULAR_MODELS = [
    { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash (高速)" },
    { id: "claude-3.7-sonnet", label: "Claude 3.7 Sonnet (主脑)" },
    { id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 (副手)" },
    { id: "gpt-4o", label: "GPT-4o (全能)" },
  ];

  return (
    <BoardPage
      onMenu={onMenu}
      icon={<Settings2 className="h-4 w-4" />}
      eyebrow="Preferences"
      title="设置"
      description="个性化主题、模型参数、角色人格、工具集成与连接配置"
      actions={
        <Button size="sm" variant="subtle" onClick={onReconnect}>
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">刷新连接</span>
        </Button>
      }
    >
      <div className="grid gap-3.5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3.5">
          {/* ── 1. 主题与界面外观 ── */}
          <SectionCard
            title="外观与色彩主题"
            hint="Theme & Aesthetics"
            action={<span className="font-mono text-[9px] text-accent">Active: {preferences.theme}</span>}
          >
            {/* Visual Swatch Grid */}
            <div className="mb-4">
              <div className="mb-2 text-[11px] font-medium text-mist-400">选择界面主题风格</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {THEME_OPTIONS.map((theme) => {
                  const active = preferences.theme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => update({ theme: theme.id })}
                      className={cn(
                        "group relative flex flex-col rounded-xl border p-2.5 text-left transition-all",
                        active
                          ? "border-accent bg-white/[0.08] shadow-[0_0_15px_-4px_var(--accent)]"
                          : "border-white/[0.07] bg-black/20 hover:border-white/[0.14] hover:bg-white/[0.04]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/20 shadow-sm"
                            style={{ backgroundColor: theme.accent }}
                          />
                          <span className="text-[12px] font-semibold text-mist-100">{theme.label}</span>
                        </div>
                        {active ? <Check className="h-3 w-3 text-accent" /> : null}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className="h-2 w-5 rounded-sm border border-white/10"
                          style={{ backgroundColor: theme.bg }}
                        />
                        <span
                          className="h-2 w-5 rounded-sm border border-white/10"
                          style={{ backgroundColor: theme.panel }}
                        />
                        <span className="text-[9px] text-mist-500">{theme.scheme}</span>
                      </div>
                      <div className="mt-1 text-[9.5px] leading-tight text-mist-500 line-clamp-1">
                        {theme.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <SettingRow
              icon={<Palette className="h-3.5 w-3.5" />}
              title="界面密度"
              description="紧凑模式收窄间距与字号，适合长篇代码与多行回复。"
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
              icon={<Sparkles className="h-3.5 w-3.5" />}
              title="减少动态动效"
              description="关闭漂浮与平滑过渡动画，显著降低低性能设备的渲染开销。"
            >
              <Switch
                checked={preferences.reduceMotion}
                onChange={(reduceMotion) => update({ reduceMotion })}
                label="减少动态效果"
              />
            </SettingRow>

            <SettingRow
              icon={<Layers3 className="h-3.5 w-3.5" />}
              title="自动平滑滚屏"
              description="模型流式生成正文与工具调用时自动平滑跟随至底部。"
            >
              <Switch
                checked={preferences.autoScroll}
                onChange={(autoScroll) => update({ autoScroll })}
                label="自动平滑滚屏"
              />
            </SettingRow>
          </SectionCard>

          {/* ── 2. 模型与推理参数 ── */}
          <SectionCard title="模型与推理参数" hint="Inference Defaults">
            <SettingRow
              icon={<Cpu className="h-3.5 w-3.5" />}
              title="默认驱动模型"
              description="底栏与新建会话默认采用的模型标识。"
            >
              <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                <div className="flex flex-wrap gap-1 justify-end">
                  {POPULAR_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => update({ defaultModel: m.id })}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[9.5px] font-medium transition-colors",
                        preferences.defaultModel === m.id
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-white/[0.08] bg-black/20 text-mist-400 hover:text-mist-200",
                      )}
                    >
                      {m.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={preferences.defaultModel}
                  onChange={(e) => update({ defaultModel: e.target.value })}
                  placeholder="自定义模型标识，如 gemini-3.8-flash-high"
                  className="w-full max-w-[240px] rounded-md border border-white/[0.1] bg-black/30 px-2.5 py-1 font-mono text-[11px] text-mist-100 outline-none focus:border-accent"
                />
              </div>
            </SettingRow>

            <SettingRow
              icon={<Sliders className="h-3.5 w-3.5" />}
              title="生成温度 (Temperature)"
              description={`当前设置: ${preferences.temperature} · 越低越严谨精确，越高越生动多变。`}
            >
              <div className="flex items-center gap-2">
                {[0.2, 0.7, 1.0].map((temp) => (
                  <button
                    key={temp}
                    type="button"
                    onClick={() => update({ temperature: temp })}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[10.5px] font-mono transition-colors",
                      preferences.temperature === temp
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-white/[0.08] bg-black/20 text-mist-500 hover:text-mist-200",
                    )}
                  >
                    {temp === 0.2 ? "0.2 严谨" : temp === 0.7 ? "0.7 平衡" : "1.0 创意"}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              icon={<Flame className="h-3.5 w-3.5" />}
              title="深度思考预算 (Thinking Effort)"
              description="针对 Claude 3.7 / Gemini 思考模型分配的推理深度等级。"
            >
              <Segmented
                value={preferences.thinkingBudget}
                onChange={(thinkingBudget) => update({ thinkingBudget })}
                ariaLabel="深度思考预算"
                options={[
                  { value: "none", label: "关闭" },
                  { value: "low", label: "轻度" },
                  { value: "medium", label: "适中" },
                  { value: "high", label: "深度" },
                ]}
              />
            </SettingRow>

            <SettingRow
              icon={<Globe className="h-3.5 w-3.5" />}
              title="默认开启联网搜索"
              description="对话时默认注入 Open-WebSearch MCP 实时获取最新全网信息。"
            >
              <Switch
                checked={preferences.webSearchDefault}
                onChange={(webSearchDefault) => update({ webSearchDefault })}
                label="默认开启联网搜索"
              />
            </SettingRow>

            <SettingRow
              icon={<Wrench className="h-3.5 w-3.5" />}
              title="工作区文件读写工具"
              description="允许 Agent 自动调用 read_workspace_file / list_files 探查项目结构。"
            >
              <Switch
                checked={preferences.workspaceToolsDefault}
                onChange={(workspaceToolsDefault) => update({ workspaceToolsDefault })}
                label="工作区工具"
              />
            </SettingRow>
          </SectionCard>

          {/* ── 3. 助理人格与个性设定 ── */}
          <SectionCard title="角色人格与称谓" hint="Persona & Custom Instructions">
            <SettingRow
              icon={<User className="h-3.5 w-3.5" />}
              title="用户尊称 (User Title)"
              description="Agent 对你的称呼，默认尊称「老师 (Sensei)」并建立最高特权羁绊。"
            >
              <input
                type="text"
                value={preferences.userTitle}
                onChange={(e) => update({ userTitle: e.target.value })}
                placeholder="老师"
                className="w-28 rounded-md border border-white/[0.1] bg-black/30 px-2.5 py-1 text-[11px] text-mist-100 outline-none focus:border-accent text-right"
              />
            </SettingRow>

            <div className="py-2.5">
              <div className="text-[12.5px] font-semibold text-mist-100">附加系统提示词 (Custom System Prompt)</div>
              <div className="mt-0.5 text-[11px] text-mist-500">
                将全局追加到 System Prompt 末尾的专属指令（如代码语言偏好、回答格式约束等）。
              </div>
              <textarea
                value={preferences.customSystemPrompt}
                onChange={(e) => update({ customSystemPrompt: e.target.value })}
                rows={3}
                placeholder="例如：优先使用 TypeScript 编写并给出具体实现代码；拒绝废话客套…"
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 p-2.5 text-[11.5px] leading-relaxed text-mist-100 outline-none focus:border-accent placeholder:text-mist-600 resize-none"
              />
            </div>
          </SectionCard>
        </div>

        {/* ── 右侧辅助栏 ── */}
        <div className="space-y-3.5">
          {/* ── 4. 自进化与安全配置 ── */}
          <SectionCard title="自进化与安全门禁" hint="Self-Evolution & Guardrails">
            <SettingRow
              icon={<Sparkles className="h-3.5 w-3.5" />}
              title="自动沉淀踩坑经验"
              description="多步工具调用或异常自愈后，自动由反思器生成候选 SKILL.md。"
            >
              <Switch
                checked={preferences.autoSynthesize}
                onChange={(autoSynthesize) => update({ autoSynthesize })}
                label="自动自进化"
              />
            </SettingRow>

            <SettingRow
              icon={<MonitorSmartphone className="h-3.5 w-3.5" />}
              title="默认发起平台"
              description="新建会话时预选的接入端（QQ / DSH / Web）。"
            >
              <div className="flex items-center gap-1">
                {PLATFORM_ORDER.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => update({ defaultPlatform: platform })}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[9.5px] font-medium transition-colors",
                      preferences.defaultPlatform === platform
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-white/[0.06] bg-black/20 text-mist-500 hover:text-mist-300",
                    )}
                  >
                    {PLATFORM_META[platform].label}
                  </button>
                ))}
              </div>
            </SettingRow>
          </SectionCard>

          {/* ── 5. 连接与网关状态 ── */}
          <SectionCard
            title="网关与网络服务"
            hint="Gateways & Endpoints"
            action={<span className="font-mono text-[8.5px] text-emerald-400">127.0.0.1:3200</span>}
          >
            <SettingRow
              icon={<Server className="h-3.5 w-3.5" />}
              title="前端 Origin"
              description="Next.js 服务访问地址与代理源。"
            >
              <code className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-0.5 font-mono text-[9.5px] text-mist-400">
                {origin}
              </code>
            </SettingRow>

            <SettingRow
              icon={<Terminal className="h-3.5 w-3.5" />}
              title="QQ OneBot 网关"
              description="独立进程适配器 (ws://127.0.0.1:3001)。"
            >
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5 font-mono text-[9px] text-mist-400">
                <span>Bot: 1579989279</span>
              </span>
            </SettingRow>

            <SettingRow
              icon={<Radio className="h-3.5 w-3.5" />}
              title="会话统计"
              description="当前内存活跃会话与执行快照。"
            >
              <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-mist-400">
                <span>{sessionCount} 会话</span>
                <span className="text-mist-700">·</span>
                <span className="text-cyan-300">{stats?.streaming ?? 0} 运行中</span>
              </div>
            </SettingRow>
          </SectionCard>

          {/* ── 6. 本地凭据与管理 ── */}
          <SectionCard title="认证凭据与安全" hint="Local Credential" action={<ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}>
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2.5">
              <div className="flex items-center gap-1.5">
                <KeyRound className="h-3 w-3 text-accent" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-mist-500">Bearer JWT</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[8.5px] text-emerald-400">
                  <span className="h-1 w-1 rounded-full bg-emerald-400" />
                  local
                </span>
              </div>
              <div className="mt-1.5 break-all font-mono text-[9.5px] leading-relaxed text-mist-400">
                {reveal ? token ?? "未登录" : maskToken(token)}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setReveal((value) => !value)}
                  className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-0.5 text-[9.5px] text-mist-400 transition-colors hover:bg-white/[0.05] hover:text-mist-200"
                >
                  {reveal ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                  {reveal ? "隐藏" : "显示完整"}
                </button>
                {token ? (
                  <CopyButton value={token} label="复制" className="rounded-md border border-white/[0.06] px-2" />
                ) : null}
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 text-[10px] text-mist-500">
              <span>恢复默认设置（不影响登录）</span>
              <Button size="xs" variant="ghost" onClick={reset}>
                <RefreshCw className="h-3 w-3" />
                重置
              </Button>
            </div>

            <Button variant="danger" size="sm" className="mt-3 w-full" onClick={onLogout}>
              <LogOut className="h-3.5 w-3.5" />
              退出登录并清除凭据
            </Button>
          </SectionCard>
        </div>
      </div>
    </BoardPage>
  );
}
