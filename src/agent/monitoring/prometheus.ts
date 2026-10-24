/**
 * Chaite Prometheus & OpenMetrics 监控引擎 (Prometheus Metrics Exporter)
 *
 * 参照 dsh-prometheus / xxiaoxiong 架构设计，面向生产运维与 Grafana 仪表盘：
 * 1. 监控指标覆盖：Agent Turns、单轮耗时、LLM Token (含缓存与思考)、工具调用、安全审批与活跃会话
 * 2. 严格的隐私边界：绝不向指标标签导出任何 Prompt、消息文本、工具参数或文件路径
 * 3. 标签基数保护：动态模型与工具名受限截断，防止高基数 (High Cardinality) 内存溢出
 * 4. 暴露标准的 /metrics 端点供 Prometheus Server 周期性抓取
 */

import client from 'prom-client'

export class ChaitePrometheusService {
  public readonly registry: client.Registry
  public readonly turnsTotal: client.Counter<'platform' | 'status'>
  public readonly turnDuration: client.Histogram<'platform'>
  public readonly tokensTotal: client.Counter<'kind' | 'model'>
  public readonly toolCallsTotal: client.Counter<'tool' | 'status'>
  public readonly toolDuration: client.Histogram<'tool'>
  public readonly activeSessions: client.Gauge
  public readonly approvalsTotal: client.Counter<'outcome'>

  constructor() {
    this.registry = new client.Registry()

    // 默认采集 Node.js 运行时指标 (GC, EventLoop, 堆内存, CPU)
    client.collectDefaultMetrics({ register: this.registry, prefix: 'chaite_nodejs_' })

    // 1. Agent 轮次计数器
    this.turnsTotal = new client.Counter({
      name: 'chaite_agent_turns_total',
      help: 'Agent 会话总交互轮次计数',
      labelNames: ['platform', 'status'],
      registers: [this.registry],
    })

    // 2. 单轮任务执行耗时分布
    this.turnDuration = new client.Histogram({
      name: 'chaite_agent_turn_duration_seconds',
      help: 'Agent 单轮任务从 Prompt 到最终回复的耗时分布 (秒)',
      labelNames: ['platform'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60],
      registers: [this.registry],
    })

    // 3. LLM Tokens 消耗分布
    this.tokensTotal = new client.Counter({
      name: 'chaite_llm_tokens_total',
      help: '大模型 Tokens 消耗统计（按 prompt, completion, cached, reasoning 划分）',
      labelNames: ['kind', 'model'],
      registers: [this.registry],
    })

    // 4. 工具调用计数
    this.toolCallsTotal = new client.Counter({
      name: 'chaite_tool_calls_total',
      help: '工具调用频次与状态统计',
      labelNames: ['tool', 'status'],
      registers: [this.registry],
    })

    // 5. 工具调用耗时分布
    this.toolDuration = new client.Histogram({
      name: 'chaite_tool_duration_seconds',
      help: '各个工具的实际执行延迟分布 (秒)',
      labelNames: ['tool'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    })

    // 6. 活跃会话数
    this.activeSessions = new client.Gauge({
      name: 'chaite_active_sessions',
      help: '当前内存中处于存活状态的会话总数',
      registers: [this.registry],
    })

    // 7. 高危审批操作计数
    this.approvalsTotal = new client.Counter({
      name: 'chaite_approvals_total',
      help: '人工介入安全门禁的审批决策统计',
      labelNames: ['outcome'],
      registers: [this.registry],
    })
  }

  private cleanLabel(val?: string, maxLen = 40): string {
    if (!val) return 'unknown'
    const safe = val.replace(/[^a-zA-Z0-9_.:/-]/g, '_').slice(0, maxLen)
    return safe || 'unknown'
  }

  /**
   * 记录一轮交互完成
   */
  recordTurn(platform: string, status: 'success' | 'failed' | 'error', durationMs: number) {
    const p = this.cleanLabel(platform)
    this.turnsTotal.inc({ platform: p, status })
    this.turnDuration.observe({ platform: p }, Math.max(0, durationMs / 1000))
  }

  /**
   * 记录 Token 消耗
   */
  recordTokens(model: string, usage: { promptTokens?: number; completionTokens?: number; cachedTokens?: number; reasoningTokens?: number }) {
    const m = this.cleanLabel(model)
    if (usage.promptTokens) {
      this.tokensTotal.inc({ kind: 'prompt', model: m }, usage.promptTokens)
    }
    if (usage.completionTokens) {
      this.tokensTotal.inc({ kind: 'completion', model: m }, usage.completionTokens)
    }
    if (usage.cachedTokens) {
      this.tokensTotal.inc({ kind: 'cached', model: m }, usage.cachedTokens)
    }
    if (usage.reasoningTokens) {
      this.tokensTotal.inc({ kind: 'reasoning', model: m }, usage.reasoningTokens)
    }
  }

  /**
   * 记录工具调用
   */
  recordToolCall(toolName: string, status: 'succeeded' | 'failed' | 'denied', durationMs: number) {
    const t = this.cleanLabel(toolName)
    this.toolCallsTotal.inc({ tool: t, status })
    this.toolDuration.observe({ tool: t }, Math.max(0, durationMs / 1000))
  }

  /**
   * 记录人工审批结果
   */
  recordApproval(outcome: 'approve' | 'deny' | 'timeout') {
    this.approvalsTotal.inc({ outcome })
  }

  /**
   * 更新活跃会话数
   */
  setActiveSessions(count: number) {
    this.activeSessions.set(count)
  }

  /**
   * 输出标准的 Prometheus 格式文本
   */
  async getMetrics(): Promise<string> {
    return await this.registry.metrics()
  }

  getContentType(): string {
    return this.registry.contentType
  }
}

let globalPrometheus: ChaitePrometheusService | null = null

export function getPrometheusService(): ChaitePrometheusService {
  if (!globalPrometheus) {
    globalPrometheus = new ChaitePrometheusService()
  }
  return globalPrometheus
}
