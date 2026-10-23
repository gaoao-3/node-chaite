import { request } from '../http'
import { fetchAllLocalItems } from './pagination'

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface AgentPage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AgentPageQuery {
  page?: number
  pageSize?: number
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export type SkillExecutionMode = 'direct' | 'plan' | 'workflow'

export interface SkillFrontmatter {
  name: string
  description: string
  keywords?: string[]
  version?: string
  executionMode?: SkillExecutionMode
  workflowRef?: string
  preset?: string
  planningModel?: string
  allowedTools?: string[]
  processors?: string[]
  triggers?: string[]
  readonly?: boolean
  mcpServer?: string
  mcpTools?: string[]
}

export interface SkillMeta {
  id: string
  rootDir: string
  frontmatter: SkillFrontmatter
}

export interface SkillDetail extends SkillFrontmatter {
  id: string
  rootDir: string
  instructions: string
}

export interface SkillListQuery extends AgentPageQuery {
  name?: string
  executionMode?: SkillExecutionMode
}

export interface CreateSkillDTO {
  name: string
  description: string
  systemPrompt: string
  executionMode?: SkillExecutionMode
  allowedTools?: string[]
  preset?: string
  planningModel?: string
  keywords?: string[]
  mcpServer?: string
  mcpTools?: string[]
  overwrite?: boolean
}

export interface UpdateSkillDTO {
  description?: string
  systemPrompt?: string
  executionMode?: SkillExecutionMode
  allowedTools?: string[]
  preset?: string
  planningModel?: string
  keywords?: string[]
  mcpServer?: string
  mcpTools?: string[]
}

export interface RunSkillDTO {
  goal?: string
  userId?: string
  groupId?: string
  background?: boolean
}

export function fetchSkillList(query: SkillListQuery = {}) {
  return request.Get<Service.ResponseResult<AgentPage<SkillMeta>>>('/api/agent/skills', { params: query })
}

export function fetchSkillDetail(name: string) {
  return request.Get<Service.ResponseResult<SkillDetail>>(`/api/agent/skills/${encodeURIComponent(name)}`)
}

export function reloadSkills() {
  return request.Post<Service.ResponseResult<{ count: number }>>('/api/agent/skills/reload', {})
}

export function createSkill(data: CreateSkillDTO) {
  return request.Post<Service.ResponseResult<{ name: string; created: boolean }>>('/api/agent/skills', data)
}

export function updateSkill(name: string, data: UpdateSkillDTO) {
  return request.Patch<Service.ResponseResult<{ name: string; updated: boolean }>>(`/api/agent/skills/${encodeURIComponent(name)}`, data)
}

export function deleteSkill(name: string) {
  return request.Delete<Service.ResponseResult<{ name: string; deleted: boolean }>>(`/api/agent/skills/${encodeURIComponent(name)}`)
}

export function runSkill(name: string, data: RunSkillDTO = {}) {
  return request.Post<Service.ResponseResult<any>>(`/api/agent/skills/${encodeURIComponent(name)}/run`, data)
}

// ─── Background Jobs ──────────────────────────────────────────────────────────

export interface BackgroundJob {
  id: string
  description: string
  userId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  payload?: unknown
  result?: unknown
  error?: string
  createdAt: number
  updatedAt?: number
}

export interface JobListQuery extends AgentPageQuery {
  userId?: string
  status?: BackgroundJob['status']
}

export function fetchJobList(query: JobListQuery = {}) {
  return request.Get<Service.ResponseResult<AgentPage<BackgroundJob>>>('/api/agent/jobs', { params: query })
}

export function fetchJobDetail(id: string) {
  return request.Get<Service.ResponseResult<BackgroundJob>>(`/api/agent/jobs/${id}`)
}

// ─── Scheduled Tasks ──────────────────────────────────────────────────────────

export interface ScheduledTask {
  id: string
  userId?: string
  description?: string
  cronExpression?: string
  nextRunAt?: number
  lastRunAt?: number
  status: 'active' | 'paused' | 'completed' | 'failed'
  createdAt?: number
}

export interface ScheduledTaskListQuery extends AgentPageQuery {
  userId?: string
}

export function fetchScheduledTaskList(query: ScheduledTaskListQuery = {}) {
  return request.Get<Service.ResponseResult<AgentPage<ScheduledTask>>>('/api/agent/scheduled-tasks', { params: query })
}

export function fetchScheduledTaskDetail(id: string) {
  return request.Get<Service.ResponseResult<ScheduledTask>>(`/api/agent/scheduled-tasks/${id}`)
}

export function cancelScheduledTask(id: string) {
  return request.Delete<Service.ResponseResult<{ cancelled: boolean }>>(`/api/agent/scheduled-tasks/${id}`)
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface PlanStep {
  id: string
  description: string
  status: 'pending' | 'running' | 'done' | 'failed'
  output?: string
}

export interface AgentPlan {
  id: string
  goal: string
  status: 'pending' | 'running' | 'done' | 'failed'
  steps: PlanStep[]
  createdAt?: number
}

export function fetchPlan(id: string) {
  return request.Get<Service.ResponseResult<AgentPlan>>(`/api/agent/plans/${id}`)
}

// ─── MCP Servers ──────────────────────────────────────────────────────────────

export interface McpServerConfig {
  id: string
  name: string
  description?: string
  transport?: 'streamable-http' | 'sse' | 'stdio'
  url?: string
  baseUrl?: string
  headers?: Record<string, string>
  authHeader?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  toolGroupIds?: string[]
  tools?: Array<{ name: string; description?: string; schema?: unknown }>
  toolsDiscoveredAt?: number
  timeoutMs?: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export type CreateMcpServerDTO = Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt'>

export interface McpTestResult {
  ok: boolean
  toolCount: number
  cachedToolCount?: number
  tools: Array<{ name: string; description?: string }>
}

export function fetchMcpServerList(query: AgentPageQuery = {}) {
  return request.Get<Service.ResponseResult<AgentPage<McpServerConfig>>>('/api/agent/mcp-servers', { params: query })
}

export function fetchAllMcpServerList(query: AgentPageQuery = {}) {
  return fetchAllLocalItems<McpServerConfig, AgentPageQuery>(fetchMcpServerList, query)
}

export function fetchMcpServerDetail(id: string) {
  return request.Get<Service.ResponseResult<McpServerConfig>>(`/api/agent/mcp-servers/${id}`)
}

export function createMcpServer(data: CreateMcpServerDTO) {
  return request.Post<Service.ResponseResult<McpServerConfig>>('/api/agent/mcp-servers', data)
}

export function updateMcpServer(id: string, data: Partial<CreateMcpServerDTO>) {
  return request.Patch<Service.ResponseResult<McpServerConfig>>(`/api/agent/mcp-servers/${id}`, data)
}

export function deleteMcpServer(id: string) {
  return request.Delete<Service.ResponseResult<{ deleted: boolean }>>(`/api/agent/mcp-servers/${id}`)
}

export function testMcpServer(id: string) {
  return request.Post<Service.ResponseResult<McpTestResult>>(`/api/agent/mcp-servers/${id}/test`, {})
}

// ─── Fusion Dual-Agent ────────────────────────────────────────────────────────

export interface FusionToolTarget {
  name: string
  source?: 'local' | 'mcp' | 'builtin' | 'skill' | 'remote'
  server?: string
  required?: boolean
  notes?: string
}

export interface FusionDiffSchema {
  format: 'unified_diff' | 'json_patch' | 'structured_patch' | 'none'
  path_scope?: string[]
  max_files?: number
  max_changed_lines?: number
}

export interface FusionReviewCriterion {
  id: string
  description: string
  weight: number
  required?: boolean
  evaluator?: 'main_agent' | 'sidekick_self' | 'tests' | 'human' | 'automated'
  pass_condition?: string
}

export interface FusionTaskBudget {
  max_tool_calls?: number
  max_wall_clock_ms?: number
  max_tokens?: number
  max_attempts?: number
}

export interface FusionTaskRecord {
  taskId: string
  sessionId: string
  instruction: string
  targetTools: FusionToolTarget[]
  diffSchema: FusionDiffSchema
  reviewCriteria: FusionReviewCriterion[]
  budget?: FusionTaskBudget
  sidekickModel: string
  mainModel: string
  status: 'pending' | 'executing' | 'reviewing' | 'completed' | 'failed'
  producedDiff?: string
  reviewScore?: number
  reviewFeedback?: string
  createdAt: number
  completedAt?: number
}

export function fetchFusionTaskList(query: AgentPageQuery = {}) {
  return request.Get<Service.ResponseResult<AgentPage<FusionTaskRecord>>>('/api/agent/fusion/tasks', { params: query })
}

export function fetchFusionTaskDetail(taskId: string) {
  return request.Get<Service.ResponseResult<FusionTaskRecord>>(`/api/agent/fusion/tasks/${encodeURIComponent(taskId)}`)
}

export function createFusionTask(data: Partial<FusionTaskRecord>) {
  return request.Post<Service.ResponseResult<FusionTaskRecord>>('/api/agent/fusion/tasks', data)
}

export function reviewFusionTask(taskId: string, decision: { status: 'approved' | 'rejected'; feedback?: string }) {
  return request.Post<Service.ResponseResult<{ updated: boolean }>>(`/api/agent/fusion/tasks/${encodeURIComponent(taskId)}/review`, decision)
}

// ─── Self-Evolution & Skill-Forge ─────────────────────────────────────────────

export interface EvolutionScores {
  correctness: number
  efficiency: number
  safety: number
  reusability: number
}

export interface EvolutionToolCall {
  callId: string
  name: string
  arguments: Record<string, unknown>
  status: 'ok' | 'error' | 'retried' | 'skipped' | 'denied'
  attempt: number
  resultPreview?: string
  error?: {
    kind: 'RETRYABLE' | 'POLICY_DENIED' | 'FATAL'
    message: string
  }
}

export interface EvolutionRetryRecord {
  attempt: number
  reason: string
  recovered: boolean
  occurredAt: number
}

export interface EvolutionTraceRecord {
  traceId: string
  sessionId: string
  platform: 'qq' | 'dsh' | 'web'
  botId: string
  userIntent: {
    raw: string
    category?: string
  }
  outcome: 'success' | 'partial' | 'failure'
  toolCalls: EvolutionToolCall[]
  errorRetries: EvolutionRetryRecord[]
  scores: EvolutionScores
  compositeScore: number
  draftSkillName: string
  draftSkillMd: string
  lessons: string[]
  startedAt: number
  completedAt: number
  mergedToSkill?: boolean
}

export function fetchEvolutionTraceList(query: AgentPageQuery = {}) {
  return request.Get<Service.ResponseResult<AgentPage<EvolutionTraceRecord>>>('/api/agent/evolution/traces', { params: query })
}

export function fetchEvolutionTraceDetail(traceId: string) {
  return request.Get<Service.ResponseResult<EvolutionTraceRecord>>(`/api/agent/evolution/traces/${encodeURIComponent(traceId)}`)
}

export function evaluateSkillCandidate(draftSkillMd: string) {
  return request.Post<Service.ResponseResult<{ scores: EvolutionScores; passed: boolean; breakdown: Record<string, string> }>>('/api/agent/evolution/evaluate', { draftSkillMd })
}

export function mergeEvolutionSkill(traceId: string, options?: { skillName?: string; overwrite?: boolean }) {
  return request.Post<Service.ResponseResult<{ success: boolean; skillName: string }>>(`/api/agent/evolution/traces/${encodeURIComponent(traceId)}/merge`, options || {})
}

// ─── Human-in-the-Loop Approval Gate ─────────────────────────────────────────

export interface HumanApprovalAction {
  type: 'tool_call' | 'file_write' | 'shell' | 'network' | 'external_side_effect' | 'custom'
  title: string
  summary: string
  toolName?: string
  command?: string
  path?: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  parameters?: Record<string, unknown>
}

export interface HumanApprovalRequestRecord {
  requestId: string
  platform: 'qq' | 'dsh' | 'web'
  botId: string
  sessionId: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  action: HumanApprovalAction
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  reason?: string
  integrityDigest: string
  requestedBy: {
    initiatorRole: string
    agentId?: string
  }
  createdAt: number
  expiresAt: number
}

export function fetchApprovalList(query: AgentPageQuery = {}) {
  return request.Get<Service.ResponseResult<AgentPage<HumanApprovalRequestRecord>>>('/api/agent/approvals', { params: query })
}

export function submitApprovalDecision(requestId: string, decision: { decision: 'approved' | 'rejected' | 'modified'; reason?: string; editedAction?: any }) {
  return request.Post<Service.ResponseResult<{ success: boolean }>>(`/api/agent/approvals/${encodeURIComponent(requestId)}/decide`, decision)
}

// ─── Gateway Adapters Status ──────────────────────────────────────────────────

export interface GatewayPlatformStatus {
  platform: 'qq' | 'dsh' | 'web'
  name: string
  status: 'online' | 'offline' | 'degraded'
  botId: string
  adapterType: string
  connectedAt: number
  messageCount: number
  errorCount: number
  throttledCount: number
  bufferQueueLength: number
  lastHeartbeat: number
}

export function fetchGatewayStatusList() {
  return request.Get<Service.ResponseResult<GatewayPlatformStatus[]>>('/api/agent/gateways')
}

export function restartGatewayAdapter(platform: string) {
  return request.Post<Service.ResponseResult<{ success: boolean }>>(`/api/agent/gateways/${encodeURIComponent(platform)}/restart`, {})
}
