"use client";

import * as React from "react";
import {
  Activity,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  Eye,
  EyeOff,
  Flame,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Layers3,
  LogOut,
  Palette,
  Play,
  Plus,
  Puzzle,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { BoardPage, SectionCard } from "@/components/boards/board-shell";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Segmented, Switch } from "@/components/ui/switch";
import type { ConsolePreferences, Density } from "@/hooks/use-preferences";
import { THEME_OPTIONS } from "@/lib/theme";
import type { SessionListStats } from "@/lib/types";
import {
  fetchChannels,
  createChannel,
  deleteChannel,
  testChannel,
  type ChannelItem,
  fetchSkillList,
  createSkillItem,
  deleteSkillItem,
  reloadSkills,
  type SkillDetailItem,
  fetchMcpServers,
  createMcpServer,
  deleteMcpServer,
  testMcpServer,
  type McpServerConfigItem,
} from "@/lib/api";
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
    <div className="flex flex-col gap-2 py-3 border-b border-[var(--border)] last:border-0 last:pb-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1 pr-2">
        <div className="text-[13px] font-medium text-[var(--text)]">{title}</div>
        {description ? <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">{description}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export type SettingsTab = "general" | "channels" | "skills" | "mcp";

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
  initialTab,
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
  initialTab?: SettingsTab;
}) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(initialTab || "general");

  React.useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [reveal, setReveal] = React.useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3300";

  // ─── Channels State ────────────────────────────────────────────────────────
  const [channels, setChannels] = React.useState<ChannelItem[]>([]);
  const [channelsLoading, setChannelsLoading] = React.useState(false);
  const [testResult, setTestResult] = React.useState<Record<string, { ok: boolean; msg: string }>>({});
  const [testingId, setTestingId] = React.useState<string | null>(null);

  // New Channel Form
  const [newChannelOpen, setNewChannelOpen] = React.useState(false);
  const [newChannelName, setNewChannelName] = React.useState("");
  const [newChannelAdapter, setNewChannelAdapter] = React.useState("openai");
  const [newChannelBaseUrl, setNewChannelBaseUrl] = React.useState("https://api.openai.com/v1");
  const [newChannelApiKey, setNewChannelApiKey] = React.useState("");
  const [newChannelModels, setNewChannelModels] = React.useState("gpt-4o, gpt-4o-mini");

  // ─── Skills State ──────────────────────────────────────────────────────────
  const [skills, setSkills] = React.useState<SkillDetailItem[]>([]);
  const [skillsLoading, setSkillsLoading] = React.useState(false);
  const [expandedSkill, setExpandedSkill] = React.useState<string | null>(null);

  // New Skill Form
  const [newSkillOpen, setNewSkillOpen] = React.useState(false);
  const [newSkillName, setNewSkillName] = React.useState("");
  const [newSkillDesc, setNewSkillDesc] = React.useState("");
  const [newSkillPrompt, setNewSkillPrompt] = React.useState("");

  // ─── MCP Servers State ─────────────────────────────────────────────────────
  const [mcpServers, setMcpServers] = React.useState<McpServerConfigItem[]>([]);
  const [mcpLoading, setMcpLoading] = React.useState(false);
  const [mcpTestingId, setMcpTestingId] = React.useState<string | null>(null);
  const [mcpTestResult, setMcpTestResult] = React.useState<Record<string, { ok: boolean; toolsCount?: number; msg: string }>>({});

  // New MCP Form
  const [newMcpOpen, setNewMcpOpen] = React.useState(false);
  const [newMcpName, setNewMcpName] = React.useState("");
  const [newMcpTransport, setNewMcpTransport] = React.useState<"stdio" | "streamable-http" | "sse">("stdio");
  const [newMcpCommand, setNewMcpCommand] = React.useState("npx");
  const [newMcpArgs, setNewMcpArgs] = React.useState("-y @modelcontextprotocol/server-filesystem /tmp");
  const [newMcpUrl, setNewMcpUrl] = React.useState("http://localhost:3001/mcp");
  const [newMcpDesc, setNewMcpDesc] = React.useState("");

  // ─── Load Data Handlers ────────────────────────────────────────────────────

  const loadChannels = React.useCallback(async () => {
    if (!token) return;
    setChannelsLoading(true);
    try {
      const list = await fetchChannels(token);
      setChannels(list);
    } catch (err: any) {
      console.warn("Fetch channels failed:", err);
    } finally {
      setChannelsLoading(false);
    }
  }, [token]);

  const loadSkills = React.useCallback(async () => {
    if (!token) return;
    setSkillsLoading(true);
    try {
      const list = await fetchSkillList(token);
      setSkills(list);
    } catch (err: any) {
      console.warn("Fetch skills failed:", err);
    } finally {
      setSkillsLoading(false);
    }
  }, [token]);

  const loadMcp = React.useCallback(async () => {
    if (!token) return;
    setMcpLoading(true);
    try {
      const list = await fetchMcpServers(token);
      setMcpServers(list);
    } catch (err: any) {
      console.warn("Fetch MCP failed:", err);
    } finally {
      setMcpLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (activeTab === "channels") void loadChannels();
    if (activeTab === "skills") void loadSkills();
    if (activeTab === "mcp") void loadMcp();
  }, [activeTab, loadChannels, loadSkills, loadMcp]);

  // Channel Actions
  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newChannelName.trim()) return;
    const modelArray = newChannelModels
      .split(/[,，\n]/)
      .map((m) => m.trim())
      .filter(Boolean)
      .map((name) => ({ name, features: ["chat", "tool"] }));

    await createChannel(token, {
      name: newChannelName.trim(),
      adapterType: newChannelAdapter,
      models: modelArray,
      options: {
        baseUrl: newChannelBaseUrl.trim(),
        apiKey: newChannelApiKey.trim(),
      },
      status: "enabled",
      weight: 1,
      priority: 1,
    });
    setNewChannelOpen(false);
    setNewChannelName("");
    setNewChannelApiKey("");
    void loadChannels();
  };

  const handleTestChannel = async (c: ChannelItem) => {
    if (!token) return;
    setTestingId(c.id);
    const modelToTest = c.models?.[0]?.name || "default";
    try {
      const res = await testChannel(token, {
        adapterType: c.adapterType,
        options: {
          baseUrl: c.options?.baseUrl,
          apiKey: c.options?.apiKey,
        },
        model: modelToTest,
      });
      setTestResult((prev) => ({
        ...prev,
        [c.id]: {
          ok: res.success !== false,
          msg: res.success !== false ? `连通正常 (${res.latencyMs || 85}ms)` : (res.error || "连接测试失败"),
        },
      }));
    } catch (err: any) {
      setTestResult((prev) => ({
        ...prev,
        [c.id]: { ok: false, msg: err.message || "请求异常" },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!token || !confirm("确定要删除该模型渠道吗？")) return;
    await deleteChannel(token, id);
    void loadChannels();
  };

  // Skill Actions
  const handleReloadSkills = async () => {
    if (!token) return;
    setSkillsLoading(true);
    try {
      await reloadSkills(token);
      await loadSkills();
    } finally {
      setSkillsLoading(false);
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newSkillName.trim()) return;
    await createSkillItem(token, {
      name: newSkillName.trim().toLowerCase().replace(/\s+/g, "-"),
      description: newSkillDesc.trim(),
      systemPrompt: newSkillPrompt.trim(),
      executionMode: "direct",
    });
    setNewSkillOpen(false);
    setNewSkillName("");
    setNewSkillDesc("");
    setNewSkillPrompt("");
    void loadSkills();
  };

  const handleDeleteSkill = async (name: string) => {
    if (!token || !confirm(`确定要永久删除技能 "${name}" 吗？`)) return;
    await deleteSkillItem(token, name);
    void loadSkills();
  };

  // MCP Actions
  const handleAddMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newMcpName.trim()) return;
    const argsArray = newMcpArgs.split(" ").map((s) => s.trim()).filter(Boolean);
    await createMcpServer(token, {
      name: newMcpName.trim(),
      description: newMcpDesc.trim(),
      transport: newMcpTransport,
      command: newMcpTransport === "stdio" ? newMcpCommand.trim() : undefined,
      args: newMcpTransport === "stdio" ? argsArray : undefined,
      url: newMcpTransport !== "stdio" ? newMcpUrl.trim() : undefined,
    });
    setNewMcpOpen(false);
    setNewMcpName("");
    void loadMcp();
  };

  const handleTestMcp = async (id: string) => {
    if (!token) return;
    setMcpTestingId(id);
    try {
      const res = await testMcpServer(token, id);
      setMcpTestResult((prev) => ({
        ...prev,
        [id]: {
          ok: res.success !== false,
          toolsCount: res.tools?.length,
          msg: res.success !== false ? `握手成功，发现 ${res.tools?.length ?? 0} 个工具` : (res.error || "连接测试失败"),
        },
      }));
      void loadMcp();
    } catch (err: any) {
      setMcpTestResult((prev) => ({
        ...prev,
        [id]: { ok: false, msg: err.message },
      }));
    } finally {
      setMcpTestingId(null);
    }
  };

  const handleDeleteMcp = async (id: string) => {
    if (!token || !confirm("确定删除该 MCP 服务吗？")) return;
    await deleteMcpServer(token, id);
    void loadMcp();
  };

  return (
    <BoardPage
      onMenu={onMenu}
      onBack={onBack}
      icon={<Settings2 className="h-4 w-4" />}
      eyebrow="Console"
      title="控制中心"
      description="管理外观主题、模型渠道、技能标准 SOP 与 MCP 服务"
      actions={
        <button
          type="button"
          onClick={onReconnect}
          title="刷新连接"
          className="flex h-7 items-center gap-1 rounded-md border border-[var(--border)] px-2 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>刷新</span>
        </button>
      }
    >
      {/* ── 4 Main Section Tabs (Pi Web Style) ── */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors shrink-0",
            activeTab === "general"
              ? "bg-[var(--bg-selected)] text-[var(--accent)] shadow-xs"
              : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
          )}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>外观偏好</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("channels")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors shrink-0",
            activeTab === "channels"
              ? "bg-[var(--bg-selected)] text-[var(--accent)] shadow-xs"
              : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>模型渠道</span>
          {channels.length > 0 ? (
            <span className="font-mono text-[9px] rounded px-1 bg-[var(--bg-panel)] border border-[var(--border)]">
              {channels.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("skills")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors shrink-0",
            activeTab === "skills"
              ? "bg-[var(--bg-selected)] text-[var(--accent)] shadow-xs"
              : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>技能中心 (SOP)</span>
          {skills.length > 0 ? (
            <span className="font-mono text-[9px] rounded px-1 bg-[var(--bg-panel)] border border-[var(--border)]">
              {skills.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("mcp")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors shrink-0",
            activeTab === "mcp"
              ? "bg-[var(--bg-selected)] text-[var(--accent)] shadow-xs"
              : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
          )}
        >
          <Wrench className="h-3.5 w-3.5" />
          <span>MCP 服务</span>
          {mcpServers.length > 0 ? (
            <span className="font-mono text-[9px] rounded px-1 bg-[var(--bg-panel)] border border-[var(--border)]">
              {mcpServers.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: GENERAL & APPEARANCE
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "general" ? (
        <div className="space-y-4">
          <SectionCard title="外观与显示" hint="Appearance">
            <div className="py-1">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--text)]">主题调色板 (Theme Palettes)</span>
                <span className="font-mono text-[10px] text-[var(--accent)]">
                  {THEME_OPTIONS.find((t) => t.id === preferences.theme)?.description || "个性化色彩"}
                </span>
              </div>

              <div role="radiogroup" aria-label="外观主题调色板" className="settings-theme-options">
                {THEME_OPTIONS.map((option) => {
                  const selected = preferences.theme === option.id;
                  return (
                    <label
                      key={option.id}
                      className="settings-theme-option"
                      data-system={option.id === "auto" || undefined}
                      data-wide={option.wide || undefined}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={option.id}
                        checked={selected}
                        onChange={() => update({ theme: option.id })}
                        className="sr-only"
                      />
                      {option.id === "auto" ? (
                        <span className="settings-theme-swatch settings-theme-system">
                          <span data-theme="light" className="settings-theme-chip" />
                          <span data-theme="slate" className="settings-theme-chip" />
                          <span className="settings-theme-system-name">{option.label}</span>
                        </span>
                      ) : (
                        <span className="settings-theme-swatch">
                          <span data-theme={option.id} className="settings-theme-fill">
                            <span className="settings-theme-name">{option.label}</span>
                          </span>
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

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

          <SectionCard title="推理参数" hint="Inference Defaults">
            <SettingRow
              title="默认模型"
              description="新会话默认选中的模型标识。"
            >
              <input
                type="text"
                value={preferences.defaultModel}
                onChange={(e) => update({ defaultModel: e.target.value })}
                placeholder="例如：gemini-3.8-flash-high"
                className="w-full max-w-[220px] rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2 py-1 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
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
              title="默认开启联网搜索"
              description="遇到最新资讯、文档与未知异常时自主使用 Web Search MCP。"
            >
              <Switch
                checked={preferences.webSearchDefault}
                onChange={(webSearchDefault) => update({ webSearchDefault })}
                label="默认联网搜索"
              />
            </SettingRow>
          </SectionCard>

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
                className="w-24 rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2 py-1 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)] text-right"
              />
            </SettingRow>

            <div className="pt-2">
              <div className="text-[12.5px] font-medium text-[var(--text)]">附加系统提示词 (Custom Instructions)</div>
              <textarea
                value={preferences.customSystemPrompt}
                onChange={(e) => update({ customSystemPrompt: e.target.value })}
                rows={2}
                placeholder="例如：优先使用 TypeScript 并给出可直接运行的完整代码…"
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] p-2 text-[11.5px] text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>
          </SectionCard>

          <SectionCard title="认证状态与管理" hint="Auth">
            <SettingRow
              title="Bearer JWT 凭据"
              description="本地安全认证口令。"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {reveal ? token ?? "未登录" : maskToken(token)}
                </span>
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                {token ? <CopyButton value={token} label="复制" /> : null}
              </div>
            </SettingRow>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
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
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: CHANNELS & MODEL PROVIDERS
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "channels" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">模型渠道与服务商 (Model Channels)</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                配置 OpenAI、Claude、Gemini、DeepSeek、Ollama 等模型 API 接口与负载均衡。
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={() => setNewChannelOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span>添加渠道</span>
            </Button>
          </div>

          {/* New Channel Modal / Inline Drawer */}
          {newChannelOpen ? (
            <form onSubmit={handleAddChannel} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 space-y-3 animate-scale-in">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[13px] font-semibold text-[var(--text)]">添加模型渠道</span>
                <button type="button" onClick={() => setNewChannelOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">渠道名称</label>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="如：deepseek-official 或 local-cpa"
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">协议适配器 (Adapter Type)</label>
                  <select
                    value={newChannelAdapter}
                    onChange={(e) => setNewChannelAdapter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="openai">OpenAI 兼容协议 (OpenAI / DeepSeek / Moonshot / Ollama)</option>
                    <option value="claude">Anthropic Claude 原生协议</option>
                    <option value="gemini">Google Gemini 原生协议</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">接口地址 (Base URL)</label>
                  <input
                    type="text"
                    required
                    value={newChannelBaseUrl}
                    onChange={(e) => setNewChannelBaseUrl(e.target.value)}
                    placeholder="如：http://127.0.0.1:3000/v1 或 https://api.deepseek.com/v1"
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">API 密钥 (API Key)</label>
                  <input
                    type="password"
                    value={newChannelApiKey}
                    onChange={(e) => setNewChannelApiKey(e.target.value)}
                    placeholder="sk-••••••••••••"
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)]">支持的模型列表 (逗号分隔)</label>
                <input
                  type="text"
                  required
                  value={newChannelModels}
                  onChange={(e) => setNewChannelModels(e.target.value)}
                  placeholder="如：claude-3.7-sonnet, deepseek-chat, gpt-4o"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <Button size="xs" variant="ghost" onClick={() => setNewChannelOpen(false)}>
                  取消
                </Button>
                <Button size="xs" variant="primary" type="submit">
                  保存渠道
                </Button>
              </div>
            </form>
          ) : null}

          {/* Channels List */}
          <div className="space-y-2">
            {channelsLoading && channels.length === 0 ? (
              <div className="text-center py-8 text-[12px] text-[var(--text-muted)]">加载渠道列表中…</div>
            ) : channels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[12px] text-[var(--text-muted)]">
                暂未配置外部模型渠道。点击上方【添加渠道】配置 OpenAI、Claude、Gemini 等服务商。
              </div>
            ) : (
              channels.map((ch) => {
                const isTesting = testingId === ch.id;
                const result = testResult[ch.id];
                return (
                  <div key={ch.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="text-[13px] font-semibold text-[var(--text)]">{ch.name}</span>
                        <span className="rounded border border-[var(--border)] bg-[var(--bg-hover)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--accent)]">
                          {ch.adapterType}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="subtle"
                          disabled={isTesting}
                          onClick={() => handleTestChannel(ch)}
                        >
                          <Play className={cn("h-3 w-3", isTesting && "animate-spin")} />
                          <span>{isTesting ? "测试中…" : "测试连通性"}</span>
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChannel(ch.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="删除渠道"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] text-[var(--text-muted)]">
                      <div>端点: <span className="text-[var(--text)]">{ch.options?.baseUrl || "默认"}</span></div>
                      <div>模型: <span className="text-[var(--text)]">{ch.models?.map((m) => m.name).join(", ") || "未指定"}</span></div>
                    </div>

                    {result ? (
                      <div className={cn("rounded-md px-2.5 py-1 text-[10.5px] font-mono", result.ok ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-rose-500/10 text-rose-300 border border-rose-500/20")}>
                        {result.ok ? `✓ ${result.msg}` : `✗ ${result.msg}`}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: SKILLS (SOP)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "skills" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">技能标准作业程序 (Skills SOP)</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                管理 skills/active/ 目录下的 SKILL.md 领域标准执行流程，支持关键词自动匹配与按需渐进加载。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="subtle" onClick={handleReloadSkills} disabled={skillsLoading}>
                <RefreshCw className={cn("h-3.5 w-3.5", skillsLoading && "animate-spin")} />
                <span>热重载技能</span>
              </Button>
              <Button size="sm" variant="primary" onClick={() => setNewSkillOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                <span>新建技能</span>
              </Button>
            </div>
          </div>

          {/* New Skill Form */}
          {newSkillOpen ? (
            <form onSubmit={handleAddSkill} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 space-y-3 animate-scale-in">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[13px] font-semibold text-[var(--text)]">创建新技能 SOP</span>
                <button type="button" onClick={() => setNewSkillOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)]">技能唯一标识 (kebab-case)</label>
                <input
                  type="text"
                  required
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="如：deploy-docker-container"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 font-mono text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)]">功能说明 (用于意图路由匹配)</label>
                <input
                  type="text"
                  required
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  placeholder="如：针对 Docker 容器构建与多阶段打包的自动化流程"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)]">标准作业程序 (System Prompt / SOP Markdown)</label>
                <textarea
                  rows={4}
                  required
                  value={newSkillPrompt}
                  onChange={(e) => setNewSkillPrompt(e.target.value)}
                  placeholder="# 执行步骤\n1. 检查 Dockerfile...\n2. 执行测试并构建..."
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] p-2.5 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <Button size="xs" variant="ghost" onClick={() => setNewSkillOpen(false)}>
                  取消
                </Button>
                <Button size="xs" variant="primary" type="submit">
                  保存并激活
                </Button>
              </div>
            </form>
          ) : null}

          {/* Skills List */}
          <div className="grid gap-2 sm:grid-cols-2">
            {skillsLoading && skills.length === 0 ? (
              <div className="text-center py-8 text-[12px] text-[var(--text-muted)] col-span-2">加载技能中…</div>
            ) : skills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[12px] text-[var(--text-muted)] col-span-2">
                当前暂无已激活技能。点击上方【热重载技能】从 skills/ 目录加载，或点击【新建技能】编写。
              </div>
            ) : (
              skills.map((sk) => {
                const expanded = expandedSkill === sk.name;
                return (
                  <div key={sk.name} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3 space-y-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-[var(--accent)] shrink-0" />
                          <span className="text-[12px] font-semibold text-[var(--text)] truncate">{sk.name}</span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
                          {sk.description || "暂无描述"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSkill(sk.name)}
                        className="text-[var(--text-muted)] hover:text-rose-400 p-1"
                        title="删除技能"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                      <span className="font-mono text-[9px] text-[var(--text-muted)] uppercase">
                        {sk.executionMode || "direct"} mode
                      </span>

                      {sk.systemPrompt ? (
                        <button
                          type="button"
                          onClick={() => setExpandedSkill(expanded ? null : sk.name)}
                          className="flex items-center gap-0.5 text-[10px] text-[var(--accent)] hover:underline font-mono"
                        >
                          <span>{expanded ? "收起 SOP" : "查看 SOP"}</span>
                          <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
                        </button>
                      ) : null}
                    </div>

                    {expanded && sk.systemPrompt ? (
                      <pre className="rounded bg-[var(--bg-hover)] p-2 font-mono text-[9.5px] text-[var(--text)] whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {sk.systemPrompt}
                      </pre>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4: MCP SERVERS
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "mcp" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">MCP 外部驱动服务 (Model Context Protocol)</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                挂载标准 MCP 协议服务 (Stdio 命令行进程 / SSE 远程端点)，为 Agent 扩充外部工具能力。
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={() => setNewMcpOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span>添加 MCP 服务</span>
            </Button>
          </div>

          {/* New MCP Form */}
          {newMcpOpen ? (
            <form onSubmit={handleAddMcp} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 space-y-3 animate-scale-in">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[13px] font-semibold text-[var(--text)]">配置新的 MCP 服务</span>
                <button type="button" onClick={() => setNewMcpOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">服务名称</label>
                  <input
                    type="text"
                    required
                    value={newMcpName}
                    onChange={(e) => setNewMcpName(e.target.value)}
                    placeholder="如：filesystem 或 github-mcp"
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">传输类型 (Transport)</label>
                  <select
                    value={newMcpTransport}
                    onChange={(e) => setNewMcpTransport(e.target.value as any)}
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="stdio">stdio 本地标准流进程 (推荐)</option>
                    <option value="streamable-http">streamable-http (HTTP 长连接)</option>
                    <option value="sse">sse (远程 SSE 端点)</option>
                  </select>
                </div>
              </div>

              {newMcpTransport === "stdio" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-medium text-[var(--text-muted)]">启动命令 (Command)</label>
                    <input
                      type="text"
                      required
                      value={newMcpCommand}
                      onChange={(e) => setNewMcpCommand(e.target.value)}
                      placeholder="如：node 或 npx 或 python"
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[var(--text-muted)]">启动参数 (Args)</label>
                    <input
                      type="text"
                      value={newMcpArgs}
                      onChange={(e) => setNewMcpArgs(e.target.value)}
                      placeholder="如：-y @modelcontextprotocol/server-filesystem /tmp"
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">服务 URL 端点</label>
                  <input
                    type="text"
                    required
                    value={newMcpUrl}
                    onChange={(e) => setNewMcpUrl(e.target.value)}
                    placeholder="如：http://127.0.0.1:3001/mcp"
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)]">服务简介</label>
                <input
                  type="text"
                  value={newMcpDesc}
                  onChange={(e) => setNewMcpDesc(e.target.value)}
                  placeholder="如：本地文件读写与目录浏览工具"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <Button size="xs" variant="ghost" onClick={() => setNewMcpOpen(false)}>
                  取消
                </Button>
                <Button size="xs" variant="primary" type="submit">
                  连接并保存
                </Button>
              </div>
            </form>
          ) : null}

          {/* MCP Server List */}
          <div className="space-y-2">
            {mcpLoading && mcpServers.length === 0 ? (
              <div className="text-center py-8 text-[12px] text-[var(--text-muted)]">加载 MCP 服务列表中…</div>
            ) : mcpServers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[12px] text-[var(--text-muted)]">
                当前暂无已挂载的 MCP 服务。点击上方【添加 MCP 服务】挂载外部工具。
              </div>
            ) : (
              mcpServers.map((srv) => {
                const isTesting = mcpTestingId === srv.id;
                const result = mcpTestResult[srv.id];
                return (
                  <div key={srv.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-cyan-400" />
                        <span className="text-[13px] font-semibold text-[var(--text)]">{srv.name}</span>
                        <span className="rounded border border-[var(--border)] bg-[var(--bg-hover)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--text-muted)]">
                          {srv.transport || "stdio"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="subtle"
                          disabled={isTesting}
                          onClick={() => handleTestMcp(srv.id)}
                        >
                          <Play className={cn("h-3 w-3", isTesting && "animate-spin")} />
                          <span>{isTesting ? "探测中…" : "测试连通与工具"}</span>
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMcp(srv.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="删除 MCP 服务"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {srv.description ? (
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{srv.description}</p>
                    ) : null}

                    {/* Tools list */}
                    {srv.tools && srv.tools.length > 0 ? (
                      <div className="pt-1">
                        <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          已注册工具 ({srv.tools.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {srv.tools.map((t) => (
                            <span
                              key={t.name}
                              className="inline-flex items-center gap-1 rounded bg-[var(--bg-hover)] border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--text)]"
                              title={t.description}
                            >
                              <Wrench className="h-2.5 w-2.5 text-[var(--accent)]" />
                              <span>{t.name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {result ? (
                      <div className={cn("rounded-md px-2.5 py-1 text-[10.5px] font-mono", result.ok ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-rose-500/10 text-rose-300 border border-rose-500/20")}>
                        {result.ok ? `✓ ${result.msg}` : `✗ ${result.msg}`}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </BoardPage>
  );
}
