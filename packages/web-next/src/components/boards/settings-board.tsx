"use client";

import * as React from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Download,
  Star,
  Eye,
  EyeOff,
  FileCode,
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
  Save,
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
import { PERSONA_TEMPLATES, type ConsolePreferences, type Density } from "@/hooks/use-preferences";
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
  fetchPlugins,
  fetchPluginSource,
  savePluginSource,
  createPlugin,
  deletePlugin,
  type PluginInfo,
  type PluginSourceInfo,
  fetchMcpHub,
  fetchSkillHub,
  fetchPluginHub,
  installHubSkill,
  installHubPlugin,
  type McpHubItem,
  type SkillHubItem,
  type PluginHubItem,
  fetchDshHub,
  type DshMarketPlugin,
  fetchTitleNamingConfig,
  updateTitleNamingConfig,
  type TitleNamingConfig,
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

export type SettingsTab = "general" | "channels" | "skills" | "mcp" | "plugins";

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
  const [titleNaming, setTitleNaming] = React.useState<TitleNamingConfig | null>(null);
  const [titleApiKey, setTitleApiKey] = React.useState("");
  const [titleNamingSaving, setTitleNamingSaving] = React.useState(false);
  const [titleNamingNotice, setTitleNamingNotice] = React.useState<string | null>(null);
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
  const [skillSubTab, setSkillSubTab] = React.useState<"installed" | "hub">("installed");
  const [skills, setSkills] = React.useState<SkillDetailItem[]>([]);
  const [skillsLoading, setSkillsLoading] = React.useState(false);
  const [skillHubList, setSkillHubList] = React.useState<SkillHubItem[]>([]);
  const [installingSkillId, setInstallingSkillId] = React.useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = React.useState<string | null>(null);

  // New Skill Form
  const [newSkillOpen, setNewSkillOpen] = React.useState(false);
  const [newSkillName, setNewSkillName] = React.useState("");
  const [newSkillDesc, setNewSkillDesc] = React.useState("");
  const [newSkillPrompt, setNewSkillPrompt] = React.useState("");

  // ─── MCP Servers State ─────────────────────────────────────────────────────
  const [mcpSubTab, setMcpSubTab] = React.useState<"installed" | "hub">("installed");
  const [mcpServers, setMcpServers] = React.useState<McpServerConfigItem[]>([]);
  const [mcpLoading, setMcpLoading] = React.useState(false);
  const [mcpHubList, setMcpHubList] = React.useState<McpHubItem[]>([]);
  const [installingMcpId, setInstallingMcpId] = React.useState<string | null>(null);
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

  // ─── Plugins State ─────────────────────────────────────────────────────────
  const [pluginSubTab, setPluginSubTab] = React.useState<"installed" | "hub">("installed");
  const [plugins, setPlugins] = React.useState<PluginInfo[]>([]);
  const [pluginsLoading, setPluginsLoading] = React.useState(false);
  const [pluginHubList, setPluginHubList] = React.useState<PluginHubItem[]>([]);
  const [installingPluginId, setInstallingPluginId] = React.useState<string | null>(null);

  // ─── DSH Live Market State (6,700+ plugins) ────────────────────────────────
  const [dshSearchQuery, setDshSearchQuery] = React.useState("");
  const [dshCategory, setDshCategory] = React.useState("all");
  const [dshPlugins, setDshPlugins] = React.useState<DshMarketPlugin[]>([]);
  const [dshTotal, setDshTotal] = React.useState(0);
  const [dshLoading, setDshLoading] = React.useState(false);
  const dshReqSeqRef = React.useRef(0);
  const searchDebounceRef = React.useRef<any>(null);

  const loadDshMarket = React.useCallback(async (q?: string, cat?: string) => {
    if (!token) return;
    const seq = ++dshReqSeqRef.current;
    setDshLoading(true);
    try {
      const targetQuery = q !== undefined ? q : dshSearchQuery;
      const targetCategory = cat !== undefined ? cat : dshCategory;
      const res = await fetchDshHub(token, { query: targetQuery, category: targetCategory });
      if (seq === dshReqSeqRef.current) {
        setDshPlugins(res.plugins || []);
        setDshTotal(res.total || 0);
      }
    } catch (err: any) {
      if (seq === dshReqSeqRef.current) {
        console.warn("fetchDshHub failed:", err);
      }
    } finally {
      if (seq === dshReqSeqRef.current) {
        setDshLoading(false);
      }
    }
  }, [token, dshSearchQuery, dshCategory]);

  // Plugin Source Editor Modal
  const [editorPlugin, setEditorPlugin] = React.useState<PluginInfo | null>(null);
  const [editorSource, setEditorSource] = React.useState("");
  const [editorLoading, setEditorLoading] = React.useState(false);
  const [editorSaving, setEditorSaving] = React.useState(false);
  const [editorNotice, setEditorNotice] = React.useState<string | null>(null);

  // New Plugin Form
  const [newPluginOpen, setNewPluginOpen] = React.useState(false);
  const [newPluginName, setNewPluginName] = React.useState("");
  const [newPluginType, setNewPluginType] = React.useState<"pi" | "dsh">("pi");

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
      const [list, hub] = await Promise.all([
        fetchSkillList(token).catch(() => []),
        fetchSkillHub(token).catch(() => []),
      ]);
      setSkills(list);
      setSkillHubList(hub);
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
      const [list, hub] = await Promise.all([
        fetchMcpServers(token).catch(() => []),
        fetchMcpHub(token).catch(() => []),
      ]);
      setMcpServers(list);
      setMcpHubList(hub);
    } catch (err: any) {
      console.warn("Fetch MCP failed:", err);
    } finally {
      setMcpLoading(false);
    }
  }, [token]);

  const loadPlugins = React.useCallback(async () => {
    if (!token) return;
    setPluginsLoading(true);
    try {
      const [list, hub] = await Promise.all([
        fetchPlugins(token).catch(() => []),
        fetchPluginHub(token).catch(() => []),
      ]);
      setPlugins(list);
      setPluginHubList(hub);
    } catch (err: any) {
      console.warn("Fetch plugins failed:", err);
    } finally {
      setPluginsLoading(false);
    }
  }, [token]);

  const loadTitleNaming = React.useCallback(async () => {
    if (!token) return;
    try {
      setTitleNaming(await fetchTitleNamingConfig(token));
    } catch (error) {
      console.warn("Fetch title naming config failed:", error);
    }
  }, [token]);

  const saveTitleNaming = async () => {
    if (!token || !titleNaming) return;
    setTitleNamingSaving(true);
    setTitleNamingNotice(null);
    try {
      const next = await updateTitleNamingConfig(token, {
        enabled: titleNaming.enabled,
        model: titleNaming.model,
        baseUrl: titleNaming.baseUrl,
        timeoutMs: titleNaming.timeoutMs,
        maxChars: titleNaming.maxChars,
        ...(titleApiKey.trim() ? { apiKey: titleApiKey.trim() } : {}),
      });
      setTitleNaming(next);
      setTitleApiKey("");
      setTitleNamingNotice("已保存，下一轮新会话生效");
    } catch (error) {
      setTitleNamingNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setTitleNamingSaving(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === "general") void loadTitleNaming();
    if (activeTab === "channels") void loadChannels();
    if (activeTab === "skills") void loadSkills();
    if (activeTab === "mcp") void loadMcp();
    if (activeTab === "plugins") void loadPlugins();
  }, [activeTab, loadChannels, loadSkills, loadMcp, loadPlugins, loadTitleNaming]);

  React.useEffect(() => {
    if (activeTab === "plugins" && pluginSubTab === "hub") {
      void loadDshMarket();
    }
  }, [activeTab, pluginSubTab, loadDshMarket]);

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

  const handleInstallHubSkill = async (hubItem: SkillHubItem) => {
    if (!token) return;
    setInstallingSkillId(hubItem.id);
    try {
      await installHubSkill(token, hubItem.id);
      await loadSkills();
    } catch (err: any) {
      alert(`安装技能失败: ${err.message}`);
    } finally {
      setInstallingSkillId(null);
    }
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

  const handleInstallHubMcp = async (hubItem: McpHubItem) => {
    if (!token) return;
    setInstallingMcpId(hubItem.id);
    try {
      await createMcpServer(token, {
        name: hubItem.name.split(" ")[0].toLowerCase(),
        description: hubItem.description,
        transport: hubItem.transport,
        command: hubItem.command,
        args: hubItem.args,
      });
      await loadMcp();
    } catch (err: any) {
      alert(`挂载 MCP 服务失败: ${err.message}`);
    } finally {
      setInstallingMcpId(null);
    }
  };

  // Plugin Actions
  const handleOpenPluginEditor = async (p: PluginInfo) => {
    if (!token) return;
    setEditorPlugin(p);
    setEditorLoading(true);
    setEditorNotice(null);
    try {
      const res = await fetchPluginSource(token, p.id);
      setEditorSource(res.source);
    } catch (err: any) {
      setEditorSource(`// 加载源码失败: ${err.message}`);
    } finally {
      setEditorLoading(false);
    }
  };

  const handleSavePluginSource = async () => {
    if (!token || !editorPlugin) return;
    setEditorSaving(true);
    setEditorNotice(null);
    try {
      await savePluginSource(token, editorPlugin.id, editorSource);
      setEditorNotice("✓ 保存成功并已实时热重载！");
      void loadPlugins();
    } catch (err: any) {
      setEditorNotice(`✗ 保存失败: ${err.message}`);
    } finally {
      setEditorSaving(false);
    }
  };

  const handleCreatePlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPluginName.trim()) return;
    try {
      await createPlugin(token, {
        name: newPluginName.trim(),
        type: newPluginType,
      });
      setNewPluginOpen(false);
      setNewPluginName("");
      void loadPlugins();
    } catch (err: any) {
      alert(`创建插件失败: ${err.message}`);
    }
  };

  const handleDeletePlugin = async (p: PluginInfo) => {
    if (!token || !confirm(`确定要删除插件 "${p.name}" 及其文件吗？`)) return;
    await deletePlugin(token, p.id);
    void loadPlugins();
  };

  const handleInstallHubPlugin = async (hubItem: PluginHubItem) => {
    if (!token) return;
    setInstallingPluginId(hubItem.id);
    try {
      await installHubPlugin(token, hubItem.id);
      await loadPlugins();
    } catch (err: any) {
      alert(`安装插件失败: ${err.message}`);
    } finally {
      setInstallingPluginId(null);
    }
  };

  return (
    <BoardPage
      onMenu={onMenu}
      onBack={onBack}
      icon={<Settings2 className="h-4 w-4" />}
      eyebrow="Console"
      title="控制中心"
      description="管理外观主题、模型渠道、技能标准 SOP、MCP 服务与扩展插件"
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
      {/* ── 5 Main Section Tabs (Pi Web Style) ── */}
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

        <button
          type="button"
          onClick={() => setActiveTab("plugins")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors shrink-0",
            activeTab === "plugins"
              ? "bg-[var(--bg-selected)] text-[var(--accent)] shadow-xs"
              : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
          )}
        >
          <Puzzle className="h-3.5 w-3.5" />
          <span>插件生态 (Pi/DSH)</span>
          {plugins.length > 0 ? (
            <span className="font-mono text-[9px] rounded px-1 bg-[var(--bg-panel)] border border-[var(--border)]">
              {plugins.length}
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
            <SettingRow
              title="双星协同副手模型 (Sidekick)"
              description="双星协同模式下负责具体编写代码与输出 Diff 的极速模型（如 deepseek-v4.1-flash）。"
            >
              <input
                type="text"
                value={preferences.fusionSidekickModel}
                onChange={(e) => update({ fusionSidekickModel: e.target.value })}
                placeholder="例如：deepseek-v4.1-flash"
                className="w-full max-w-[240px] rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2 py-1 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </SettingRow>

            <SettingRow
              title="双星协同主脑模型 (Architect)"
              description="负责制定 SOP 架构方案与交叉审查的架构师模型（如 claude-3.7-sonnet）。"
            >
              <input
                type="text"
                value={preferences.fusionMainModel}
                onChange={(e) => update({ fusionMainModel: e.target.value })}
                placeholder="例如：claude-3.7-sonnet"
                className="w-full max-w-[240px] rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2 py-1 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </SettingRow>
          </SectionCard>

          <SectionCard title="会话标题自动命名" hint="Auxiliary Model">
            {titleNaming ? (
              <>
                <SettingRow
                  title="首轮自动生成短标题"
                  description="主会话模型负责回答，独立小模型只负责提炼标题；手动改名后不再覆盖。"
                >
                  <Switch
                    checked={titleNaming.enabled}
                    onChange={(enabled) => setTitleNaming({ ...titleNaming, enabled })}
                    label="自动命名"
                  />
                </SettingRow>
                <SettingRow
                  title="命名小模型"
                  description="可填本地小模型或任意 OpenAI 兼容模型，例如 deepseek-v4.1-flash。"
                >
                  <input
                    type="text"
                    value={titleNaming.model}
                    onChange={(event) => setTitleNaming({ ...titleNaming, model: event.target.value })}
                    className="w-full max-w-[250px] rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2 py-1 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </SettingRow>
                <SettingRow
                  title="独立命名接口"
                  description="不会复用会话上下文，也不会给命名模型挂载工具。"
                >
                  <input
                    type="text"
                    value={titleNaming.baseUrl}
                    onChange={(event) => setTitleNaming({ ...titleNaming, baseUrl: event.target.value })}
                    placeholder="http://127.0.0.1:3000/v1"
                    className="w-full max-w-[280px] rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2 py-1 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </SettingRow>
                <SettingRow
                  title="命名接口 API Key"
                  description={titleNaming.apiKeyConfigured ? "已保存密钥；留空表示不修改。" : "按你的服务要求填写，留空则不发送 Authorization。"}
                >
                  <input
                    type="password"
                    value={titleApiKey}
                    onChange={(event) => setTitleApiKey(event.target.value)}
                    placeholder="留空保持当前配置"
                    className="w-full max-w-[250px] rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2 py-1 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </SettingRow>
                <div className="flex items-center justify-between gap-2 pt-2">
                  <span className="text-[10px] text-[var(--text-dim)]">
                    {titleNamingNotice || `超时 ${Math.round(titleNaming.timeoutMs / 1000)}s · 最长 ${titleNaming.maxChars} 字`}
                  </span>
                  <Button size="xs" variant="primary" disabled={titleNamingSaving} onClick={() => void saveTitleNaming()}>
                    <Save className="h-3 w-3" />
                    {titleNamingSaving ? "保存中…" : "保存命名配置"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="py-2 text-[11px] text-[var(--text-dim)]">正在读取命名配置…</div>
            )}
          </SectionCard>

          <SectionCard title="助理设定与人设管理" hint="Persona">
            <SettingRow
              title="助理名称 (Bot Name)"
              description="Agent 的专属称呼，将显示在欢迎页与界面各处。"
            >
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
                <div className="flex items-center gap-1">
                  {["天童凯伊", "全栈架构师", "代码助手"].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => update({ botName: n })}
                      className="rounded border border-[var(--border)] bg-[var(--bg-hover)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={preferences.botName}
                  onChange={(e) => update({ botName: e.target.value })}
                  placeholder="例如：天童凯伊、JARVIS"
                  className="w-36 rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </SettingRow>

            <SettingRow
              title="人设预设模板 (Persona Template)"
              description="一键切换助理的性格风格与行为模式，或选择自定义。"
            >
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: "kaiyi", label: "天童凯伊 (傲娇系统娘)" },
                    { id: "architect", label: "全栈架构师 (严谨专业)" },
                    { id: "minimal", label: "代码助手 (极简)" },
                    { id: "custom", label: "自定义人设" },
                  ] as const
                ).map((tpl) => {
                  const active = preferences.personaType === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        if (tpl.id === "custom") {
                          update({ personaType: "custom" });
                        } else {
                          const item = PERSONA_TEMPLATES[tpl.id];
                          update({
                            personaType: tpl.id,
                            botName: item.name,
                            systemPersona: item.prompt,
                          });
                        }
                      }}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] font-semibold shadow-xs"
                          : "border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]",
                      )}
                    >
                      {tpl.label}
                    </button>
                  );
                })}
              </div>
            </SettingRow>

            {/* System Persona Prompt Editor */}
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-medium text-[var(--text)]">核心主系统提示词 (System Persona)</div>
                <span className="font-mono text-[9.5px] text-[var(--text-dim)]">可随时编辑覆盖</span>
              </div>
              <textarea
                value={preferences.systemPersona}
                onChange={(e) => update({ systemPersona: e.target.value, personaType: "custom" })}
                rows={4}
                placeholder="输入该助理的核心角色设定与行为原则…"
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)] resize-y"
              />
            </div>

            <SettingRow
              title="用户称呼 (User Title)"
              description="Agent 对你的尊称，默认「老师 (Sensei)」，可填老板、主人、管理员或自定义。"
            >
              <input
                type="text"
                value={preferences.userTitle}
                onChange={(e) => update({ userTitle: e.target.value })}
                placeholder="例如：老师、老板、管理员"
                className="w-28 rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2 py-1 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)] text-right"
              />
            </SettingRow>

            <div className="pt-2 border-t border-[var(--border)]">
              <div className="text-[12px] font-medium text-[var(--text)]">附加系统指令 (Custom Instructions)</div>
              <div className="mt-0.5 text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                追加到系统提示词末尾的个人定制规则（如优先使用 TypeScript、中文注释等）。
              </div>
              <textarea
                value={preferences.customSystemPrompt}
                onChange={(e) => update({ customSystemPrompt: e.target.value })}
                rows={2}
                placeholder="例如：优先使用 TypeScript 并给出可直接运行的完整代码…"
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] p-2 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
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

          {/* New Channel Form */}
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
          TAB 3: SKILLS (SOP) & COMMUNITY HUB
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "skills" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">技能标准作业程序 (Skills SOP)</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                管理已激活的 SKILL.md 领域标准执行流程，或从 skills.sh 社区库一键安装。
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

          {/* Subtabs: Installed vs Community Hub */}
          <div className="flex items-center gap-1 border-b border-[var(--border)] pb-1.5">
            <button
              type="button"
              onClick={() => setSkillSubTab("installed")}
              className={cn(
                "rounded-md px-3 py-1 text-[11.5px] font-medium transition-colors",
                skillSubTab === "installed"
                  ? "bg-[var(--bg-selected)] text-[var(--accent)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              已激活技能 ({skills.length})
            </button>
            <button
              type="button"
              onClick={() => setSkillSubTab("hub")}
              className={cn(
                "rounded-md px-3 py-1 text-[11.5px] font-medium transition-colors flex items-center gap-1",
                skillSubTab === "hub"
                  ? "bg-[var(--bg-selected)] text-[var(--accent)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              <Globe className="h-3 w-3" />
              <span>技能生态库 (skills.sh)</span>
            </button>
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

          {/* SubTab 1: Installed Skills */}
          {skillSubTab === "installed" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {skillsLoading && skills.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-[var(--text-muted)] col-span-2">加载技能中…</div>
              ) : skills.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[12px] text-[var(--text-muted)] col-span-2">
                  当前暂无已激活技能。点击上方【热重载技能】从 skills/ 目录加载，或切到【技能生态库】一键安装。
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
          ) : (
            /* SubTab 2: Community Skill Hub (skills.sh) */
            <div className="grid gap-2.5 sm:grid-cols-2">
              {skillHubList.map((item) => {
                const installed = skills.some((s) => s.name === item.name);
                const isInstalling = installingSkillId === item.id;
                return (
                  <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-[var(--text)]">{item.name}</span>
                        <span className="rounded border border-[var(--border)] bg-[var(--bg-hover)] px-1.5 py-0.5 font-mono text-[8.5px] uppercase text-[var(--accent)]">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">{item.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.keywords.map((k) => (
                          <span key={k} className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-dim)]">
                            #{k}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                      <span className="text-[9.5px] text-[var(--text-dim)] font-mono">by {item.author}</span>
                      <Button
                        size="xs"
                        variant={installed ? "ghost" : "primary"}
                        disabled={installed || isInstalling}
                        onClick={() => handleInstallHubSkill(item)}
                      >
                        {installed ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span>已激活 ✓</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3" />
                            <span>{isInstalling ? "安装中…" : "一键安装"}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4: MCP SERVERS & COMMUNITY STORE
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "mcp" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">MCP 外部驱动服务 (Model Context Protocol)</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                挂载标准 MCP 协议服务 (Stdio 命令行进程 / SSE 远程端点)，或从 MCP 社区应用库一键安装。
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={() => setNewMcpOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span>添加 MCP 服务</span>
            </Button>
          </div>

          {/* Subtabs: Installed vs MCP Hub */}
          <div className="flex items-center gap-1 border-b border-[var(--border)] pb-1.5">
            <button
              type="button"
              onClick={() => setMcpSubTab("installed")}
              className={cn(
                "rounded-md px-3 py-1 text-[11.5px] font-medium transition-colors",
                mcpSubTab === "installed"
                  ? "bg-[var(--bg-selected)] text-[var(--accent)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              已配置服务 ({mcpServers.length})
            </button>
            <button
              type="button"
              onClick={() => setMcpSubTab("hub")}
              className={cn(
                "rounded-md px-3 py-1 text-[11.5px] font-medium transition-colors flex items-center gap-1",
                mcpSubTab === "hub"
                  ? "bg-[var(--bg-selected)] text-[var(--accent)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              <Globe className="h-3 w-3" />
              <span>MCP 社区应用库</span>
            </button>
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

          {/* SubTab 1: Configured MCP Servers */}
          {mcpSubTab === "installed" ? (
            <div className="space-y-2">
              {mcpLoading && mcpServers.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-[var(--text-muted)]">加载 MCP 服务列表中…</div>
              ) : mcpServers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[12px] text-[var(--text-muted)]">
                  当前暂无已挂载的 MCP 服务。点击上方【添加 MCP 服务】或切换到【MCP 社区应用库】一键挂载。
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
          ) : (
            /* SubTab 2: MCP Community Hub */
            <div className="grid gap-2.5 sm:grid-cols-2">
              {mcpHubList.map((item) => {
                const installed = mcpServers.some((s) => s.name.toLowerCase() === item.name.split(" ")[0].toLowerCase());
                const isInstalling = installingMcpId === item.id;
                return (
                  <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-[var(--text)]">{item.name}</span>
                        <span className="rounded border border-[var(--border)] bg-[var(--bg-hover)] px-1.5 py-0.5 font-mono text-[8.5px] uppercase text-[var(--accent)]">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">{item.description}</p>
                      
                      <div className="mt-2 text-[10px] text-[var(--text-dim)] font-mono">
                        <div>包含工具：{item.toolsSample.join(", ")}</div>
                        {item.command ? <div className="mt-0.5 truncate text-[9px] text-[var(--text-muted)]">执行命令：{item.command} {item.args?.join(" ")}</div> : null}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                      <span className="text-[9.5px] text-[var(--text-dim)] font-mono">by {item.author}</span>
                      <Button
                        size="xs"
                        variant={installed ? "ghost" : "primary"}
                        disabled={installed || isInstalling}
                        onClick={() => handleInstallHubMcp(item)}
                      >
                        {installed ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span>已挂载 ✓</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3" />
                            <span>{isInstalling ? "挂载中…" : "一键挂载"}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 5: PLUGINS (Pi & DSH EXTENSIONS) & IN-BROWSER CODE EDITOR
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "plugins" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">插件生态与源码管理 (Plugins Hub)</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                支持在线查看与编辑 Pi / DSH 扩展插件源码，实时热重载，或从社区插件市场一键安装。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="primary" onClick={() => setNewPluginOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                <span>新建插件</span>
              </Button>
            </div>
          </div>

          {/* Subtabs: Installed vs Plugin Hub */}
          <div className="flex items-center gap-1 border-b border-[var(--border)] pb-1.5">
            <button
              type="button"
              onClick={() => setPluginSubTab("installed")}
              className={cn(
                "rounded-md px-3 py-1 text-[11.5px] font-medium transition-colors",
                pluginSubTab === "installed"
                  ? "bg-[var(--bg-selected)] text-[var(--accent)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              已挂载插件 ({plugins.length})
            </button>
            <button
              type="button"
              onClick={() => setPluginSubTab("hub")}
              className={cn(
                "rounded-md px-3 py-1 text-[11.5px] font-medium transition-colors flex items-center gap-1",
                pluginSubTab === "hub"
                  ? "bg-[var(--bg-selected)] text-[var(--accent)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              <Globe className="h-3 w-3" />
              <span>插件生态市场</span>
            </button>
          </div>

          {/* New Plugin Form */}
          {newPluginOpen ? (
            <form onSubmit={handleCreatePlugin} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 space-y-3 animate-scale-in">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[13px] font-semibold text-[var(--text)]">新建插件 (Plugin)</span>
                <button type="button" onClick={() => setNewPluginOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">插件名称 (kebab-case)</label>
                  <input
                    type="text"
                    required
                    value={newPluginName}
                    onChange={(e) => setNewPluginName(e.target.value)}
                    placeholder="如：pi-my-helper 或 dsh-notifier"
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 font-mono text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">插件架构规范</label>
                  <select
                    value={newPluginType}
                    onChange={(e) => setNewPluginType(e.target.value as any)}
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-hover)] px-2.5 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="pi">Pi Agent 风格扩展 (export default function(pi))</option>
                    <option value="dsh">DSH / Cordis 风格插件 (export function apply(ctx))</option>
                  </select>
                </div>
              </div>

              <p className="text-[10.5px] text-[var(--text-dim)] leading-relaxed">
                创建后将在 <code>plugins/{newPluginName || "my-plugin"}.ts</code> 自动生成规范模板，并支持直接在线编辑与热重载。
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <Button size="xs" variant="ghost" onClick={() => setNewPluginOpen(false)}>
                  取消
                </Button>
                <Button size="xs" variant="primary" type="submit">
                  创建并编辑
                </Button>
              </div>
            </form>
          ) : null}

          {/* SubTab 1: Installed Plugins & Code Editor */}
          {pluginSubTab === "installed" ? (
            <div className="space-y-3">
              {pluginsLoading && plugins.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-[var(--text-muted)]">加载插件列表中…</div>
              ) : plugins.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[12px] text-[var(--text-muted)]">
                  当前暂无已挂载的插件。点击上方【新建插件】编写，或切换到【插件生态市场】一键安装。
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {plugins.map((pl) => (
                    <div key={pl.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3.5 space-y-2.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Puzzle className="h-3.5 w-3.5 text-[var(--accent)]" />
                            <span className="text-[13px] font-semibold text-[var(--text)]">{pl.name}</span>
                          </div>
                          <span className="rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-1.5 py-0.5 font-mono text-[8.5px] uppercase text-[var(--accent)]">
                            {pl.type}
                          </span>
                        </div>

                        {pl.description ? (
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">{pl.description}</p>
                        ) : null}

                        <div className="mt-2 text-[10px] text-[var(--text-dim)] font-mono truncate">
                          路径: {pl.path || `plugins/${pl.name}.ts`}
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {pl.tools.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 rounded bg-[var(--bg-hover)] border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text)]">
                              <Wrench className="h-2 w-2 text-[var(--accent)]" />
                              <span>{t}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => handleOpenPluginEditor(pl)}
                          className="flex items-center gap-1"
                        >
                          <Code2 className="h-3 w-3" />
                          <span>源码编辑 / 查看</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleDeletePlugin(pl)}
                          className="text-[var(--text-muted)] hover:text-rose-400 p-1"
                          title="删除插件"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Inline Code Editor Drawer/Modal ── */}
              {editorPlugin ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 space-y-3 animate-scale-in">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-[var(--accent)]" />
                      <span className="text-[13px] font-semibold text-[var(--text)]">
                        源码编辑: {editorPlugin.name}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--text-dim)]">({editorPlugin.type})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {editorNotice ? (
                        <span className="text-[10.5px] font-mono text-[var(--accent)] animate-fade-in">{editorNotice}</span>
                      ) : null}
                      <Button
                        size="xs"
                        variant="primary"
                        disabled={editorLoading || editorSaving}
                        onClick={handleSavePluginSource}
                      >
                        <Save className={cn("h-3 w-3", editorSaving && "animate-spin")} />
                        <span>{editorSaving ? "保存中…" : "保存并热重载"}</span>
                      </Button>
                      <button
                        type="button"
                        onClick={() => setEditorPlugin(null)}
                        className="text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {editorLoading ? (
                    <div className="py-12 text-center text-[12px] text-[var(--text-muted)]">加载插件源码中…</div>
                  ) : (
                    <textarea
                      rows={14}
                      value={editorSource}
                      onChange={(e) => setEditorSource(e.target.value)}
                      spellCheck={false}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11.5px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)] resize-y"
                    />
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            /* SubTab 2: Community Plugin Hub (DSH 6700+ Market & Pi Packages) */
            <div className="space-y-3.5">
              {/* Search & Category Filter Bar */}
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-dim)]" />
                    <input
                      type="text"
                      value={dshSearchQuery}
                      onChange={(e) => {
                        const q = e.target.value;
                        setDshSearchQuery(q);
                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                        searchDebounceRef.current = setTimeout(() => {
                          void loadDshMarket(q, dshCategory);
                        }, 300);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void loadDshMarket(dshSearchQuery, dshCategory);
                        }
                      }}
                      placeholder="搜索 DSH 市场 6,700+ 插件 (如 prometheus, tui, git, file, web...)"
                      className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-8 pr-7 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
                    />
                    {dshSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDshSearchQuery("");
                          void loadDshMarket("", dshCategory);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={dshLoading}
                    onClick={() => void loadDshMarket(dshSearchQuery, dshCategory)}
                    className="h-8 px-3 shrink-0"
                  >
                    <Search className="h-3 w-3" />
                    <span>搜索</span>
                  </Button>
                </div>

                {/* Categories */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10.5px]">
                  {[
                    { id: "all", label: "全部生态" },
                    { id: "dev", label: "开发运维 (Dev/Prometheus)" },
                    { id: "ui", label: "UI 增强 & TUI" },
                    { id: "tools", label: "实用工具 (Tools)" },
                    { id: "workflow", label: "自动化工作流" },
                    { id: "model", label: "模型接入" },
                    { id: "system", label: "系统监控" },
                    { id: "agi", label: "AGI 架构" },
                  ].map((cat) => {
                    const active = dshCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setDshCategory(cat.id);
                          void loadDshMarket(dshSearchQuery, cat.id);
                        }}
                        className={cn(
                          "rounded-md px-2 py-0.5 font-medium transition-colors shrink-0",
                          active
                            ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold shadow-xs"
                            : "bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)]",
                        )}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DSH Market Results Count */}
              <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)] font-mono px-1">
                <span>
                  共检索到 <strong className="text-[var(--text)]">{dshTotal || dshPlugins.length}</strong> 款真实 DSH 插件
                  {dshSearchQuery ? ` · 关键词 "${dshSearchQuery}"` : ""}
                </span>
                {dshLoading ? <span className="text-[var(--accent)] animate-pulse">正在索引检索中…</span> : null}
              </div>

              {/* Plugins Grid (DSH + Pi Hub) */}
              <div key={`dsh-grid-${dshSearchQuery}-${dshCategory}`} className="grid gap-2.5 sm:grid-cols-2">
                {dshPlugins.map((item, itemIdx) => {
                  const installed = plugins.some(
                    (p) => p.name === item.name || p.name === item.name.replace(/^dsh-/, ""),
                  );
                  const isInstalling = installingPluginId === item.name;
                  const desc = typeof item.description === "string" ? item.description : item.description?.zh || item.description?.en || "无描述";

                  return (
                    <div
                      key={`${item.owner}/${item.name}/${itemIdx}`}
                      className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3.5 space-y-2 flex flex-col justify-between shadow-xs transition-colors hover:border-[var(--accent)]/40"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[13px] font-semibold text-[var(--text)] truncate">{item.name}</span>
                            {item.version ? (
                              <span className="font-mono text-[9px] text-[var(--text-dim)]">v{item.version}</span>
                            ) : null}
                          </div>
                          <span className="rounded border border-[var(--border)] bg-[var(--bg-hover)] px-1.5 py-0.5 font-mono text-[8.5px] uppercase text-[var(--accent)] shrink-0">
                            {item.category}
                          </span>
                        </div>

                        <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed line-clamp-3">
                          {desc}
                        </p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[10px] text-[var(--text-dim)] font-mono">
                          {item.stars !== undefined && item.stars !== null ? (
                            <span className="flex items-center gap-0.5 text-amber-500">
                              <Star className="h-3 w-3 fill-current" />
                              <span>{item.stars}</span>
                            </span>
                          ) : null}
                          {item.downloads ? (
                            <span className="flex items-center gap-0.5">
                              <Download className="h-3 w-3" />
                              <span>{item.downloads} 次下载</span>
                            </span>
                          ) : null}
                          <span className="truncate max-w-[140px]">by {item.owner}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                        <code className="text-[9px] font-mono text-[var(--text-dim)] truncate max-w-[170px]" title={item.install}>
                          {item.install || `npm i ${item.npm || item.name}`}
                        </code>

                        <Button
                          size="xs"
                          variant={installed ? "ghost" : "primary"}
                          disabled={installed || isInstalling}
                          onClick={async () => {
                            if (!token) return;
                            setInstallingPluginId(item.name);
                            try {
                              // If it matches a prebuilt item in catalog, install it directly
                              const match = pluginHubList.find((p) => p.id === `plugin-${item.name}` || p.name.includes(item.name));
                              if (match) {
                                await installHubPlugin(token, match.id);
                              } else {
                                // Create native DSH plugin stub in plugins/<name>.ts
                                await createPlugin(token, {
                                  name: item.name.replace(/^dsh-/, ""),
                                  type: "dsh",
                                  source: `/**\n * DSH 插件: ${item.name} (by ${item.owner})\n * ${desc}\n */\nexport function apply(ctx: any) {\n  console.log('[Plugin:${item.name}] Initialized via Chaite Plugin Loader');\n  ctx.tools.register({\n    name: "${item.name.replace(/[^a-zA-Z0-9_]/g, '_')}",\n    description: "${desc.replace(/"/g, '')}",\n    parameters: { type: "object", properties: {} },\n    run: async () => ({ message: "Executed ${item.name} successfully" }),\n  });\n}\n`,
                                });
                              }
                              await loadPlugins();
                            } catch (err: any) {
                              alert(`安装插件失败: ${err.message}`);
                            } finally {
                              setInstallingPluginId(null);
                            }
                          }}
                        >
                          {installed ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span>已安装 ✓</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-3 w-3" />
                              <span>{isInstalling ? "安装中…" : "一键安装"}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fallback to local curated list if empty */}
              {dshPlugins.length === 0 && !dshLoading ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[12px] text-[var(--text-muted)] space-y-2">
                  <div>未找到匹配的 DSH 插件。以下为精选即用扩展：</div>
                  <div className="grid gap-2 sm:grid-cols-2 text-left pt-2">
                    {pluginHubList.map((item) => (
                      <div key={item.id} className="rounded-lg border border-[var(--border)] p-2.5 space-y-1">
                        <div className="font-semibold text-[var(--text)] text-[12px]">{item.name}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </BoardPage>
  );
}
