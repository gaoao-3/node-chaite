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
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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
      if (!response.ok) throw new ApiError(text.slice(0, 240) || response.statusText, response.status);
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
  input: { platform?: "qq" | "dsh" | "web"; title?: string; model?: string; skills?: string[] },
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

export function fetchPlugins(token: string, signal?: AbortSignal): Promise<PluginInfo[]> {
  return request<PluginInfo[]>("/api/agent/plugins", { token, signal });
}
