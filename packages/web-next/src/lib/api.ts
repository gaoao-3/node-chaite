import type {
  AgentSessionInfo,
  AgentSessionSnapshot,
  ApprovalDecision,
  ApprovalOptionId,
  ApprovalScope,
  EvolutionListResponse,
  EvolutionStats,
  EvolutionTraceRecord,
  FusionStats,
  FusionTaskListResponse,
  FusionTaskRecord,
  SessionListResponse,
  SkillListResponse,
} from "./types";

export const TOKEN_KEY = "chaite.console.token";
const LEGACY_TOKEN_KEYS = ["chaite.auth.token", "chaite_token"];

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status = 0, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "登录状态已失效，请重新输入口令") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const primary = window.localStorage.getItem(TOKEN_KEY);
  if (primary) return primary;
  for (const key of LEGACY_TOKEN_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export function storeToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  for (const key of LEGACY_TOKEN_KEYS) window.localStorage.removeItem(key);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  for (const key of [TOKEN_KEY, ...LEGACY_TOKEN_KEYS]) window.localStorage.removeItem(key);
}

interface RequestOptions {
  token?: string | null;
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  cache?: RequestCache;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3200");
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}

interface Envelope<T> {
  success?: boolean;
  code?: number;
  data?: T;
  message?: string;
  error?: { code?: string; message?: string; details?: unknown };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: options.cache ?? "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("无法连接到 Chaite 后端，请确认服务运行在 127.0.0.1:3200", 0, "NETWORK_ERROR");
  }

  let payload: Envelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as Envelope<T>;
    } catch {
      if (!response.ok) {
        let msg = response.statusText || `请求失败 (${response.status})`;
        if (response.status === 413) {
          msg = "发送内容或图片体积过大 (超过服务器限制)";
        } else if (response.status === 502 || response.status === 504) {
          msg = "后端服务响应超时，请检查服务状态";
        } else if (text.includes("<pre>")) {
          const match = text.match(/<pre>([\s\S]*?)<\/pre>/i);
          if (match) {
            msg = match[1].replace(/<[^>]+>/g, "").split("\n")[0].trim() || msg;
          }
        }
        throw new ApiError(msg, response.status, `HTTP_${response.status}`);
      }
    }
  }

  if (response.status === 401) {
    throw new UnauthorizedError(payload?.message ?? payload?.error?.message);
  }

  if (!response.ok || payload?.success === false || (payload?.code !== undefined && payload.code !== 0)) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      (payload?.error as { message?: string } | undefined)?.message ||
      response.statusText ||
      `请求失败 (${response.status})`;
    throw new ApiError(message, response.status, payload?.error?.code, payload?.error?.details);
  }

  if (payload && "data" in payload) return payload.data as T;
  return payload as unknown as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

interface LoginPayload {
  token?: string;
  expiresIn?: number;
}

export async function loginWithPassword(password: string): Promise<string> {
  const payload = await request<LoginPayload>("/api/auth/login", {
    method: "POST",
    body: { token: password },
  });
  if (!payload?.token) throw new ApiError("后端未返回登录令牌", 500, "INVALID_LOGIN_RESPONSE");
  storeToken(payload.token);
  return payload.token;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function fetchSessions(
  token: string,
  options: { limit?: number; query?: string; signal?: AbortSignal } = {},
): Promise<SessionListResponse> {
  return request<SessionListResponse>("/api/agent/sessions", {
    token,
    query: { limit: options.limit ?? 100, query: options.query },
    signal: options.signal,
  });
}

export function createSession(
  token: string,
  input: { platform?: "qq" | "dsh" | "web"; title?: string; model?: string; skills?: string[]; metadata?: Record<string, unknown> },
): Promise<AgentSessionInfo> {
  return request<AgentSessionInfo>("/api/agent/sessions", {
    token,
    method: "POST",
    body: input,
  });
}

export function updateSession(
  token: string,
  sessionId: string,
  input: { title?: string; model?: string; skills?: string[] },
): Promise<AgentSessionInfo> {
  return request<AgentSessionInfo>(`/api/agent/sessions/${encodeURIComponent(sessionId)}`, {
    token,
    method: "PATCH",
    body: input,
  });
}

export function deleteSession(token: string, sessionId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/agent/sessions/${encodeURIComponent(sessionId)}`, {
    token,
    method: "DELETE",
  });
}

export function fetchSessionSnapshot(token: string, sessionId: string, limit = 500): Promise<AgentSessionSnapshot> {
  return request<AgentSessionSnapshot>(
    `/api/agent/sessions/${encodeURIComponent(sessionId)}/events/snapshot`,
    { token, query: { limit } },
  );
}

export function sendPrompt(
  token: string,
  sessionId: string,
  input: {
    prompt: string;
    displayText?: string;
    model?: string;
    skillName?: string;
    images?: Array<{ url?: string; base64?: string; mimeType?: string }>;
    thinkingLevel?: "none" | "low" | "medium" | "high" | "max";
  },
): Promise<{ accepted: boolean; sessionId: string; turnId: string; startedAt: number }> {
  return request(`/api/agent/sessions/${encodeURIComponent(sessionId)}/prompt`, {
    token,
    method: "POST",
    body: input,
  });
}

export function cancelPrompt(token: string, sessionId: string, reason?: string): Promise<{ cancelled: boolean }> {
  return request<{ cancelled: boolean }>(`/api/agent/sessions/${encodeURIComponent(sessionId)}/cancel`, {
    token,
    method: "POST",
    body: { reason },
  });
}

export interface ApprovalResponseInput {
  decision: ApprovalDecision;
  scope?: ApprovalScope;
  optionId?: ApprovalOptionId;
  reason?: string;
}

export function respondApproval(
  token: string,
  sessionId: string,
  requestId: string,
  input: ApprovalResponseInput,
): Promise<{ requestId: string; decision: ApprovalDecision; scope?: ApprovalScope; optionId?: ApprovalOptionId; respondedAt: number }> {
  return request(
    `/api/agent/sessions/${encodeURIComponent(sessionId)}/approvals/${encodeURIComponent(requestId)}`,
    { token, method: "POST", body: input },
  );
}

// ─── Fusion ──────────────────────────────────────────────────────────────────

export function fetchFusionTasks(
  token: string,
  options: { status?: string; limit?: number; sessionId?: string; signal?: AbortSignal } = {},
): Promise<FusionTaskListResponse> {
  return request<FusionTaskListResponse>("/api/agent/fusion/tasks", {
    token,
    query: { status: options.status, limit: options.limit ?? 50, sessionId: options.sessionId },
    signal: options.signal,
  });
}

export function fetchFusionStats(token: string, signal?: AbortSignal): Promise<FusionStats> {
  return request<FusionStats>("/api/agent/fusion/stats", { token, signal });
}

export function updateFusionStatus(
  token: string,
  taskId: string,
  status: string,
  sidekick?: string,
): Promise<FusionTaskRecord> {
  return request<FusionTaskRecord>(`/api/agent/fusion/tasks/${encodeURIComponent(taskId)}/status`, {
    token,
    method: "PATCH",
    body: { status, sidekick },
  });
}

export function executeFusionTask(token: string, taskId: string): Promise<FusionTaskRecord> {
  return request<FusionTaskRecord>(`/api/agent/fusion/tasks/${encodeURIComponent(taskId)}/execute`, {
    token,
    method: "POST",
  });
}

// ─── Evolution ───────────────────────────────────────────────────────────────

export function fetchEvolutionTraces(
  token: string,
  options: { status?: string; limit?: number; minScore?: number; signal?: AbortSignal } = {},
): Promise<EvolutionListResponse> {
  return request<EvolutionListResponse>("/api/agent/evolution/traces", {
    token,
    query: { status: options.status, limit: options.limit ?? 50, minScore: options.minScore },
    signal: options.signal,
  });
}

export function fetchEvolutionStats(token: string, signal?: AbortSignal): Promise<EvolutionStats> {
  return request<EvolutionStats>("/api/agent/evolution/stats", { token, signal });
}

export function reviewEvolutionTrace(
  token: string,
  traceId: string,
  action: "approve" | "reject",
  reviewedBy = "web-console",
): Promise<EvolutionTraceRecord> {
  return request<EvolutionTraceRecord>(
    `/api/agent/evolution/traces/${encodeURIComponent(traceId)}/${action}`,
    { token, method: "POST", body: { reviewedBy } },
  );
}

export function mergeEvolutionTrace(
  token: string,
  traceId: string,
  input: { skillName?: string; force?: boolean; mergedBy?: string } = {},
): Promise<{ record: EvolutionTraceRecord; skill: { name: string; path: string } }> {
  return request(`/api/agent/evolution/traces/${encodeURIComponent(traceId)}/merge`, {
    token,
    method: "POST",
    body: { mergedBy: "web-console", ...input },
  });
}

export function deleteFusionTask(token: string, id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/agent/fusion/tasks/${encodeURIComponent(id)}`, { token, method: "DELETE" });
}

export function clearFusionTasks(token: string): Promise<{ cleared: boolean }> {
  return request<{ cleared: boolean }>("/api/agent/fusion/tasks", { token, method: "DELETE" });
}

export function deleteEvolutionTrace(token: string, id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/agent/evolution/traces/${encodeURIComponent(id)}`, { token, method: "DELETE" });
}

export function clearEvolutionTraces(token: string): Promise<{ cleared: boolean }> {
  return request<{ cleared: boolean }>("/api/agent/evolution/traces", { token, method: "DELETE" });
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export function fetchSkills(token: string, signal?: AbortSignal): Promise<SkillListResponse> {
  return request<SkillListResponse>("/api/agent/skills", {
    token,
    query: { page: 1, pageSize: 50 },
    signal,
  });
}

export function reloadSkills(token: string): Promise<{ count: number }> {
  return request<{ count: number }>("/api/agent/skills/reload", { token, method: "POST", body: {} });
}

export interface GatewayInfo {
  id: string
  name: string
  platform: "qq" | "dsh" | "web" | "discord" | "telegram"
  status: "running" | "stopped" | "error" | "starting"
  messageCount: number
  endpoint?: string
  error?: string
  connectedAt?: number
}

export interface PluginInfo {
  id: string
  name: string
  type: "pi" | "dsh" | "native"
  description?: string
  status: "active" | "error" | "disabled"
  tools: string[]
  path?: string;
  error?: string
}

export function fetchGateways(token: string, signal?: AbortSignal): Promise<GatewayInfo[]> {
  return request<GatewayInfo[]>("/api/agent/gateways", { token, signal });
}

export function startGateway(token: string, id: string): Promise<GatewayInfo> {
  return request<GatewayInfo>(`/api/agent/gateways/${encodeURIComponent(id)}/start`, { token, method: "POST", body: {} });
}

export function stopGateway(token: string, id: string): Promise<GatewayInfo> {
  return request<GatewayInfo>(`/api/agent/gateways/${encodeURIComponent(id)}/stop`, { token, method: "POST", body: {} });
}

export interface GatewayConfig {
  id: string
  name: string
  platform: string
  enabled: boolean
  settings: Record<string, string | undefined>
  credentials?: { wsTokenConfigured: boolean; httpTokenConfigured: boolean }
  updatedAt?: number
}

export function fetchGatewayConfigs(token: string): Promise<GatewayConfig[]> {
  return request<GatewayConfig[]>("/api/agent/gateways/configs", { token })
}

export function saveGatewayConfig(token: string, id: string, config: Partial<GatewayConfig>): Promise<GatewayConfig> {
  return request<GatewayConfig>(`/api/agent/gateways/${encodeURIComponent(id)}/config`, { token, method: "PUT", body: config })
}

export function reloadGateway(token: string, id: string): Promise<GatewayInfo> {
  return request<GatewayInfo>(`/api/agent/gateways/${encodeURIComponent(id)}/reload`, { token, method: "POST", body: {} })
}

export function testGateway(token: string, id: string): Promise<{ success: boolean; wsReachable?: boolean; httpReachable?: boolean; botNickname?: string; error?: string }> {
  return request(`/api/agent/gateways/${encodeURIComponent(id)}/test`, { token, method: "POST", body: {} })
}
export function fetchPlugins(token: string, signal?: AbortSignal): Promise<PluginInfo[]> {
  return request<PluginInfo[]>("/api/agent/plugins", { token, signal });
}


// ─── Channels & Models Management ──────────────────────────────────────────

export interface ChannelModelConfig {
  name: string
  features?: string[]
}

export interface ChannelItem {
  id: string
  name: string
  adapterType: string
  models: ChannelModelConfig[]
  options?: {
    baseUrl?: string
    apiKey?: string
  }
  weight?: number
  priority?: number
  status?: "enabled" | "disabled"
}

export function fetchChannels(token: string, signal?: AbortSignal): Promise<ChannelItem[]> {
  return request<{ items: ChannelItem[] }>("/api/channels/list", {
    token,
    query: { page: 1, pageSize: 50 },
    signal,
  }).then((res) => res.items || []);
}

export function createChannel(token: string, payload: Partial<ChannelItem>): Promise<any> {
  return request("/api/channels", { token, method: "POST", body: payload });
}

export function updateChannel(token: string, id: string, payload: Partial<ChannelItem>): Promise<any> {
  return request(`/api/channels/${encodeURIComponent(id)}`, { token, method: "PUT", body: payload });
}

export function deleteChannel(token: string, id: string): Promise<any> {
  return request(`/api/channels/${encodeURIComponent(id)}`, { token, method: "DELETE" });
}

export function testChannel(
  token: string,
  payload: { adapterType: string; options: { baseUrl?: string; apiKey?: string }; model: string },
): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  return request("/api/channels/test", { token, method: "POST", body: payload });
}

// ─── MCP Servers Management ────────────────────────────────────────────────

export interface McpToolInfo {
  name: string
  description?: string
  schema?: any
}

export interface McpServerConfigItem {
  id: string
  name: string
  description?: string
  transport?: "streamable-http" | "sse" | "stdio"
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  tools?: McpToolInfo[]
}

export function fetchMcpServers(token: string, signal?: AbortSignal): Promise<McpServerConfigItem[]> {
  return request<{ items: McpServerConfigItem[] }>("/api/agent/mcp-servers", {
    token,
    query: { page: 1, pageSize: 50 },
    signal,
  }).then((res) => res.items || []);
}

export function createMcpServer(token: string, payload: Partial<McpServerConfigItem>): Promise<any> {
  return request("/api/agent/mcp-servers", { token, method: "POST", body: payload });
}

export function deleteMcpServer(token: string, id: string): Promise<any> {
  return request(`/api/agent/mcp-servers/${encodeURIComponent(id)}`, { token, method: "DELETE" });
}

export function testMcpServer(
  token: string,
  id: string,
): Promise<{ success: boolean; tools?: McpToolInfo[]; error?: string }> {
  return request(`/api/agent/mcp-servers/${encodeURIComponent(id)}/test`, { token, method: "POST", body: {} });
}

// ─── Skill Detailed Management ─────────────────────────────────────────────

export interface SkillDetailItem {
  name: string
  description?: string
  executionMode?: "direct" | "plan" | "workflow"
  allowedTools?: string[]
  systemPrompt?: string
  keywords?: string[]
  readonly?: boolean
}

export function fetchSkillList(token: string, signal?: AbortSignal): Promise<SkillDetailItem[]> {
  return request<{ items: SkillDetailItem[] }>("/api/agent/skills", {
    token,
    query: { page: 1, pageSize: 100 },
    signal,
  }).then((res) => res.items || []);
}

export function createSkillItem(
  token: string,
  payload: { name: string; description: string; systemPrompt: string; executionMode?: string },
): Promise<any> {
  return request("/api/agent/skills", { token, method: "POST", body: payload });
}

export function deleteSkillItem(token: string, name: string): Promise<any> {
  return request(`/api/agent/skills/${encodeURIComponent(name)}`, { token, method: "DELETE" });
}


// ─── Plugin Source Code & Management ──────────────────────────────────────────

export interface PluginSourceInfo {
  id: string;
  name: string;
  path: string;
  source: string;
}

export function fetchPluginSource(token: string, id: string): Promise<PluginSourceInfo> {
  return request<PluginSourceInfo>(`/api/agent/plugins/${encodeURIComponent(id)}/source`, { token });
}

export function savePluginSource(token: string, id: string, source: string): Promise<PluginInfo> {
  return request<PluginInfo>(`/api/agent/plugins/${encodeURIComponent(id)}/source`, {
    token,
    method: "PUT",
    body: { source },
  });
}

export function createPlugin(token: string, payload: { name: string; type: "pi" | "dsh"; source?: string }): Promise<PluginInfo> {
  return request<PluginInfo>("/api/agent/plugins", {
    token,
    method: "POST",
    body: payload,
  });
}

export function deletePlugin(token: string, id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/agent/plugins/${encodeURIComponent(id)}`, {
    token,
    method: "DELETE",
  });
}

// ─── Community Hub Marketplace ───────────────────────────────────────────────

export interface McpHubItem {
  id: string;
  name: string;
  category: string;
  description: string;
  author: string;
  transport: "stdio" | "sse";
  command?: string;
  args?: string[];
  envGuide?: Record<string, string>;
  toolsSample: string[];
  recommended?: boolean;
}

export interface SkillHubItem {
  id: string;
  name: string;
  category: string;
  description: string;
  author: string;
  keywords: string[];
  recommended?: boolean;
  skillMdContent: string;
}

export interface PluginHubItem {
  id: string;
  name: string;
  type: "pi" | "dsh";
  category: string;
  description: string;
  author: string;
  tools: string[];
  fileName: string;
  recommended?: boolean;
  sourceCode: string;
}

export function fetchMcpHub(token: string): Promise<McpHubItem[]> {
  return request<McpHubItem[]>("/api/agent/hub/mcp", { token });
}

export function fetchSkillHub(token: string): Promise<SkillHubItem[]> {
  return request<SkillHubItem[]>("/api/agent/hub/skills", { token });
}

export function fetchPluginHub(token: string): Promise<PluginHubItem[]> {
  return request<PluginHubItem[]>("/api/agent/hub/plugins", { token });
}

export function installHubSkill(token: string, id: string): Promise<{ success: boolean; name: string }> {
  return request<{ success: boolean; name: string }>(`/api/agent/hub/skills/${encodeURIComponent(id)}/install`, {
    token,
    method: "POST",
    body: {},
  });
}

export function installHubPlugin(token: string, id: string): Promise<{ success: boolean; name: string }> {
  return request<{ success: boolean; name: string }>(`/api/agent/hub/plugins/${encodeURIComponent(id)}/install`, {
    token,
    method: "POST",
    body: {},
  });
}


export interface DshMarketPlugin {
  name: string;
  owner: string;
  url: string;
  page?: string;
  category: string;
  description: { en?: string; zh?: string } | string;
  npm?: string | null;
  version?: string;
  stars?: number | null;
  downloads?: number | null;
  install: string;
  added?: string;
}

export function fetchDshHub(
  token: string,
  options?: { query?: string; category?: string },
): Promise<{ total: number; plugins: DshMarketPlugin[] }> {
  const params = new URLSearchParams();
  if (options?.query) params.set("query", options.query);
  if (options?.category) params.set("category", options.category);
  const q = params.toString() ? `?${params.toString()}` : "";
  return request<{ total: number; plugins: DshMarketPlugin[] }>(`/api/agent/hub/dsh${q}`, { token });
}


// ─── Workspace: file tree, editor and controlled terminal ─────────────────────

export interface WorkspaceEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: number;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
  size: number;
  truncated: boolean;
  readOnly: boolean;
  dataUrl?: string;
  mimeType?: string;
}

export interface WorkspaceTerminalResult {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  approvalRequired?: boolean;
}

export function fetchWorkspaceTree(token: string, path = ".", hidden = false): Promise<{ path: string; entries: WorkspaceEntry[] }> {
  return request(`/api/agent/workspace/tree?path=${encodeURIComponent(path)}&hidden=${hidden ? "1" : "0"}`, { token });
}

export function fetchWorkspaceFile(token: string, path: string): Promise<WorkspaceFile> {
  return request(`/api/agent/workspace/file?path=${encodeURIComponent(path)}`, { token });
}

export function saveWorkspaceFile(token: string, path: string, content: string): Promise<{ path: string; bytes: number }> {
  return request("/api/agent/workspace/file", { token, method: "PUT", body: { path, content } });
}

export function runWorkspaceCommand(
  token: string,
  command: string,
  cwd = ".",
  timeout = 30,
): Promise<WorkspaceTerminalResult> {
  return request("/api/agent/workspace/terminal", { token, method: "POST", body: { command, cwd, timeout } });
}


// ─── Auxiliary model for automatic session titles ─────────────────────────────

export interface TitleNamingConfig {
  enabled: boolean;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxChars: number;
  apiKeyConfigured: boolean;
}

export function fetchTitleNamingConfig(token: string): Promise<TitleNamingConfig> {
  return request<TitleNamingConfig>("/api/agent/title-naming", { token });
}

export function updateTitleNamingConfig(
  token: string,
  payload: Partial<Omit<TitleNamingConfig, "apiKeyConfigured">> & { apiKey?: string },
): Promise<TitleNamingConfig> {
  return request<TitleNamingConfig>("/api/agent/title-naming", { token, method: "PUT", body: payload });
}


// ─── Available Models & Capabilities ──────────────────────────────────────────

export interface ModelMetadata {
  id: string;
  label: string;
  provider: "google" | "anthropic" | "openai" | "deepseek" | "moonshot" | "meta" | "alibaba" | "other";
  channelName: string;
  channelId?: string;
  adapterType?: string;
  contextWindow: number;
  contextWindowFormatted: string;
  supportsThinking: boolean;
  thinkingType?: "budget_tokens" | "reasoning_effort" | "gemini_level";
  maxThinkingTokens?: number;
  supportsVision: boolean;
  supportsTools: boolean;
  isRecommended?: boolean;
}

export function fetchAvailableModels(
  token: string,
  options?: { query?: string; provider?: string; refresh?: boolean },
): Promise<{ items: ModelMetadata[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.query) params.set("query", options.query);
  if (options?.provider) params.set("provider", options.provider);
  if (options?.refresh) params.set("refresh", "1");
  const qs = params.toString();
  return request<{ items: ModelMetadata[]; total: number }>(`/api/agent/models${qs ? `?${qs}` : ""}`, { token });
}
