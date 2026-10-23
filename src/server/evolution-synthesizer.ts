/**
 * Hermes & nekocode Skill-Forge 自进化闭环提炼器 (Evolution Synthesizer)
 *
 * 职责：
 * 1. 自动监听 Agent 会话的工具调用链与错误自愈轨迹
 * 2. 基于 nekocode 4 维门禁标准（正确性、效率、安全性、可复用性）进行自动化多维打分
 * 3. 将成功克服踩坑的经验提炼为标准的 `SKILL.md` 草稿
 * 4. 自动注入 EvolutionService 候选池，等待人类确认或一键合入活跃技能库
 */

import { randomUUID } from 'node:crypto'
import type {
  EvolutionOutcome,
  EvolutionRetryRecord,
  EvolutionScores,
  EvolutionToolCall,
  EvolutionTrace,
  GatewayPlatform,
} from '../agent/gateway-contracts'
import type { EvolutionService } from './evolution-service'

export interface TurnExecutionRecord {
  sessionId: string
  platform?: GatewayPlatform
  botId?: string
  prompt: string
  replyText?: string
  toolCalls: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
    status: 'succeeded' | 'failed' | 'denied' | 'skipped'
    resultPreview?: string
    error?: { code?: string; message: string }
    durationMs?: number
  }>
  errorRetries: Array<{
    attempt: number
    error: { code?: string; message: string }
    recovered: boolean
  }>
  startedAt: number
  completedAt: number
}

/**
 * 启发式评估：判断单次交互是否包含值得沉淀为技能的“工程排错或多步工具链经验”
 */
export function shouldSynthesizeSkill(record: TurnExecutionRecord): boolean {
  // 1. 调用工具步数 >= 2
  if (record.toolCalls.length >= 2) return true
  // 2. 经历过报错并成功自愈
  if (record.errorRetries.some(r => r.recovered)) return true
  // 3. 单次工具调用具有复合参数
  if (record.toolCalls.length === 1 && Object.keys(record.toolCalls[0].arguments).length >= 3) {
    return true
  }
  return false
}

/**
 * 基于 nekocode 4 维标准计算评分 (0.0 ~ 1.0)
 */
export function calculate4DScores(record: TurnExecutionRecord): EvolutionScores {
  const totalCalls = record.toolCalls.length
  const failedCalls = record.toolCalls.filter(c => c.status === 'failed' || c.status === 'denied').length
  const succeededCalls = totalCalls - failedCalls

  // 1. 正确性 (Correctness)：最终是否有明确正文产出且无未恢复异常
  const hasResult = Boolean(record.replyText && record.replyText.length > 5)
  const allRecovered = record.errorRetries.every(r => r.recovered)
  const correctness = hasResult ? (allRecovered ? 0.95 : 0.75) : 0.4

  // 2. 效率 (Efficiency)：成功步骤占比，无无效重试惩罚
  const efficiency = totalCalls === 0 ? 0.8 : Math.max(0.6, Math.min(1.0, succeededCalls / totalCalls))

  // 3. 安全性 (Safety)：是否存在越权拦截或高危拒绝
  const hasDenied = record.toolCalls.some(c => c.status === 'denied')
  const safety = hasDenied ? 0.6 : 0.95

  // 4. 复用增量 (Reusability)：是否具备领域专精指导价值
  const prompt = record.prompt.toLowerCase()
  const isChitchat = prompt.length < 5 || /^(你好|在吗|hi|hello|1\+1)/i.test(prompt)
  const reusability = isChitchat ? 0.6 : 0.88

  return {
    correctness: Number(correctness.toFixed(2)),
    efficiency: Number(efficiency.toFixed(2)),
    safety: Number(safety.toFixed(2)),
    reusability: Number(reusability.toFixed(2)),
  }
}

/**
 * 提炼技能名称 (kebab-case)
 */
export function deriveKebabName(prompt: string, toolNames: string[]): string {
  const clean = prompt
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .trim()
    .slice(0, 30)

  // 英文或数字直接转 kebab
  const ascii = clean.toLowerCase().replace(/\s+/g, '-')
  if (/^[a-z0-9-]+$/.test(ascii) && ascii.length >= 3) {
    return ascii.slice(0, 32)
  }

  // 中文场景：结合工具名生成描述性标识
  const primaryTool = toolNames[0]?.replace(/_/g, '-') || 'task'
  const timeHash = Math.abs(prompt.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 1000
  return `workflow-${primaryTool}-${timeHash}`
}

/**
 * 提炼生成标准的 SKILL.md Markdown 内容
 */
export function generateSkillMarkdown(
  name: string,
  record: TurnExecutionRecord,
  scores: EvolutionScores,
): { markdown: string; lessons: string[] } {
  const toolsUsed = [...new Set(record.toolCalls.map(c => c.name))]
  const lessons: string[] = []

  if (record.errorRetries.length > 0) {
    lessons.push('在调用工具出现暂态网络或参数错误时，必须执行验证重试而非直接报错。')
  }
  if (toolsUsed.length > 1) {
    lessons.push(`工具组合调用顺序：优先调用 ${toolsUsed[0]}，随后根据结果调度 ${toolsUsed.slice(1).join(', ')}。`)
  }
  lessons.push('执行外部命令或修改动作前，务必保证输入参数的边界合法与防注入。')

  const stepsMd = record.toolCalls.map((c, i) => {
    return `${i + 1}. **调用 \`${c.name}\`**：根据前序上下文输入必要参数，解析输出并校验状态。`
  }).join('\n')

  const triggers = [
    record.prompt.slice(0, 20),
    ...toolsUsed.map(t => t.replace(/_/g, ' ')),
  ].filter(t => t.length >= 2)

  const md = `---
name: ${name}
description: 针对「${record.prompt.slice(0, 40).replace(/["\n]/g, '')}」的自动化处理工作流
version: 1.0.0
executionMode: direct
keywords:
${triggers.map(t => `  - ${JSON.stringify(t)}`).join('\n')}
metadata:
  synthesizer: "hermes-nekocode-forge"
  compositeScore: ${((scores.correctness + scores.efficiency + scores.safety + scores.reusability) * 2).toFixed(1)}
---

# ${name} 标准执行流程 (SOP)

## 触发时机
当收到类似以下用户意图时自动匹配并激活：
- "${record.prompt.replace(/["\n]/g, '')}"

## 核心依赖工具
${toolsUsed.map(t => `- \`${t}\``).join('\n')}

## 标准执行步骤
${stepsMd || '1. 综合分析用户指令并直接执行。'}

## 避坑指南与安全禁忌
- 严禁在未经前置校验的情况下执行不可逆写入。
- 遇网络或服务超时，按指数退避算法重试，最大重试次数不超过 3 次。
- 完成全部工具调用后，必须以结构化、自然流畅的排版格式将结论反馈给用户。
`

  return { markdown: md, lessons }
}

/**
 * 闭环核心驱动：合成 Trace 并持久化至 EvolutionService
 */
export async function synthesizeAndRecordEvolution(
  record: TurnExecutionRecord,
  evolutionService: EvolutionService,
): Promise<EvolutionTrace | null> {
  if (!shouldSynthesizeSkill(record)) {
    return null
  }

  const scores = calculate4DScores(record)
  const toolNames = record.toolCalls.map(c => c.name)
  const draftName = deriveKebabName(record.prompt, toolNames)
  const { markdown, lessons } = generateSkillMarkdown(draftName, record, scores)

  const formattedToolCalls: EvolutionToolCall[] = record.toolCalls.map((c, index) => ({
    callId: c.id || `call_${index + 1}`,
    name: c.name,
    arguments: c.arguments,
    status: c.status === 'succeeded' ? 'ok' : c.status === 'failed' ? 'error' : c.status,
    attempt: 1,
    resultPreview: c.resultPreview?.slice(0, 300),
    error: c.error ? { kind: 'RETRYABLE', message: c.error.message } : undefined,
    durationMs: c.durationMs,
  }))

  const formattedRetries: EvolutionRetryRecord[] = record.errorRetries.map(r => ({
    attempt: r.attempt,
    reason: r.error.message,
    recovered: r.recovered,
    occurredAt: Date.now(),
  }))

  const outcome: EvolutionOutcome = record.toolCalls.some(c => c.status === 'failed')
    ? (record.replyText ? 'partial' : 'failure')
    : 'success'

  const trace: EvolutionTrace = {
    traceId: `trace_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    sessionId: record.sessionId,
    platform: record.platform || 'web',
    botId: record.botId || 'web-console',
    userIntent: {
      raw: record.prompt,
      category: 'agentic_workflow',
      confidence: 0.92,
    },
    outcome,
    toolCalls: formattedToolCalls,
    errorRetries: formattedRetries,
    scores,
    draftSkillName: draftName,
    draftSkillMd: markdown,
    lessons,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
  }

  try {
    evolutionService.create(trace)
    return trace
  } catch (err: any) {
    console.warn(`[EvolutionSynthesizer] Failed to record trace: ${err.message}`)
    return null
  }
}
