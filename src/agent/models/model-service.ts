/**
 * 动态模型探测与能力元数据服务 (Model Discovery & Capability Service)
 *
 * 核心职责：
 * 1. 动态探测全渠道上游可用模型列表（支持 OpenAI /v1/models、CPA 代理与静态配置模型聚合）
 * 2. 智能推断模型元数据：实际上下文窗口上限 (Context Window)、思考推理机制 (Thinking Support)、
 *    多模态视觉 (Vision) 与工具调用能力 (Tools)
 * 3. 内存缓存 (TTL 5分钟) 与并发超时熔断保护，防止打崩上游代理
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface ModelMetadata {
  id: string
  label: string
  provider: 'google' | 'anthropic' | 'openai' | 'deepseek' | 'moonshot' | 'meta' | 'alibaba' | 'other'
  channelName: string
  channelId?: string
  adapterType?: string
  contextWindow: number // 实际最大上下文长度（例如 1048576, 200000, 128000, 64000）
  contextWindowFormatted: string // 格式化文本（例如 "1M", "200K", "128K", "64K"）
  supportsThinking: boolean // 是否支持推理思考链
  thinkingType?: 'budget_tokens' | 'reasoning_effort' | 'gemini_level'
  maxThinkingTokens?: number
  supportsVision: boolean // 是否支持多模态图片输入
  supportsTools: boolean // 是否支持函数工具调用
  isRecommended?: boolean
}

interface ChannelStorageItem {
  id: string
  name: string
  adapterType: string
  status: string
  options?: {
    baseUrl?: string
    apiKey?: string
  }
  models?: Array<{
    name: string
    features?: string[]
  }>
}

/**
 * 格式化上下文 Token 数为易读字符串（如 1M, 200K）
 */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = +(tokens / 1_000_000).toFixed(1)
    return `${m}M`
  }
  if (tokens >= 1_000) {
    const k = Math.round(tokens / 1_000)
    return `${k}K`
  }
  return `${tokens}`
}

/**
 * 智能推断任意模型的供应商
 */
export function inferProvider(modelId: string): ModelMetadata['provider'] {
  const lower = modelId.toLowerCase()
  if (lower.includes('gemini') || lower.includes('gemma')) return 'google'
  if (lower.includes('claude')) return 'anthropic'
  if (lower.includes('deepseek')) return 'deepseek'
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('text-embedding')) return 'openai'
  if (lower.includes('kimi') || lower.includes('moonshot')) return 'moonshot'
  if (lower.includes('llama')) return 'meta'
  if (lower.includes('qwen')) return 'alibaba'
  return 'other'
}

/**
 * 智能推断模型真实最大上下文大小 (Context Window)
 */
export function inferContextWindow(modelId: string): number {
  const lower = modelId.toLowerCase()

  // 1. 明确按 ID 内置指定
  if (lower.includes('gemini-1.5') || lower.includes('gemini-2.0') || lower.includes('gemini-3')) {
    return 1_048_576 // 1M tokens (Gemini 默认 1M)
  }
  if (lower.includes('claude-3') || lower.includes('claude-sonnet') || lower.includes('claude-opus')) {
    return 200_000 // 200k tokens
  }
  if (lower.includes('o3-mini') || lower.includes('kimi') || lower.includes('moonshot-v1-128k')) {
    return 200_000 // 200k tokens
  }
  if (lower.includes('gpt-4o') || lower.includes('gpt-4-turbo') || lower.includes('o1')) {
    return 128_000 // 128k tokens
  }
  if (lower.includes('deepseek-chat') || lower.includes('deepseek-v3') || lower.includes('deepseek-v4') || lower.includes('deepseek-r1') || lower.includes('deepseek-reasoner')) {
    return 64_000 // 64k tokens (部分服务商 128k，以 64k 为标准基准)
  }

  // 2. 正则按名字里的数字规格提取 (如 qwen-2.5-72b-128k, llama-3.1-8b-32k)
  const matchM = lower.match(/([0-9]+)m(?!\w)/)
  if (matchM) {
    return parseInt(matchM[1], 10) * 1_000_000
  }
  const matchK = lower.match(/([0-9]+)k(?!\w)/)
  if (matchK) {
    return parseInt(matchK[1], 10) * 1_000
  }

  // 3. 供应商兜底
  const provider = inferProvider(modelId)
  switch (provider) {
    case 'google': return 1_048_576
    case 'anthropic': return 200_000
    case 'openai': return 128_000
    case 'deepseek': return 64_000
    case 'moonshot': return 128_000
    case 'alibaba': return 131_072
    default: return 128_000
  }
}

/**
 * 智能推断模型是否支持推理思考链及思考机制
 */
export function inferThinkingCapability(modelId: string): {
  supportsThinking: boolean
  thinkingType?: ModelMetadata['thinkingType']
  maxThinkingTokens?: number
} {
  const lower = modelId.toLowerCase()

  // 1. Anthropic 扩展思考
  if (lower.includes('claude-3-7-sonnet') || lower.includes('claude-3.7-sonnet') || lower.includes('claude-opus-4') || lower.includes('claude-sonnet-4') || (lower.includes('claude') && lower.includes('thinking'))) {
    return {
      supportsThinking: true,
      thinkingType: 'budget_tokens',
      maxThinkingTokens: 64_000,
    }
  }

  // 2. Google Gemini 思考模型
  if ((lower.includes('gemini') && lower.includes('thinking')) || lower.includes('flash-high') || lower.includes('gemini-3')) {
    return {
      supportsThinking: true,
      thinkingType: 'gemini_level',
      maxThinkingTokens: 32_000,
    }
  }

  // 3. OpenAI o1/o3 及 DeepSeek R1 推理模型
  if (lower.includes('deepseek-r1') || lower.includes('deepseek-reasoner') || lower.includes('-r1') || lower.startsWith('o1') || lower.startsWith('o3')) {
    return {
      supportsThinking: true,
      thinkingType: 'reasoning_effort',
      maxThinkingTokens: 32_000,
    }
  }

  // 4. 其他包含显式推理关键字
  if (lower.includes('reasoner') || lower.includes('reasoning') || lower.includes('thinking')) {
    return {
      supportsThinking: true,
      thinkingType: 'reasoning_effort',
      maxThinkingTokens: 16_000,
    }
  }

  return { supportsThinking: false }
}

/**
 * 智能推断是否支持多模态视觉
 */
export function inferVisionCapability(modelId: string): boolean {
  const lower = modelId.toLowerCase()
  if (lower.includes('vision') || lower.includes('vl') || lower.includes('4v') || lower.includes('image')) return true
  if (lower.includes('gemini') || lower.includes('claude') || lower.includes('gpt-4o')) return true
  if (lower.includes('omni') || lower.includes('qwen-vl')) return true
  return false
}

/**
 * 构造生成统一的 ModelMetadata 实体
 */
export function buildModelMetadata(
  id: string,
  channelName: string,
  extra: { channelId?: string; adapterType?: string; isRecommended?: boolean } = {},
): ModelMetadata {
  const cleanId = id.trim()
  const provider = inferProvider(cleanId)
  const contextWindow = inferContextWindow(cleanId)
  const contextWindowFormatted = formatContextWindow(contextWindow)
  const thinking = inferThinkingCapability(cleanId)
  const supportsVision = inferVisionCapability(cleanId)

  // 易读 Label 生成
  let label = cleanId
  if (cleanId === 'gemini-3.8-flash-high') label = 'Gemini 3.8 Flash'
  else if (cleanId === 'claude-3.7-sonnet' || cleanId === 'claude-3-7-sonnet-20250219') label = 'Claude 3.7 Sonnet'
  else if (cleanId === 'claude-opus-4-6-thinking') label = 'Claude Opus 4.6 (Thinking)'
  else if (cleanId === 'claude-sonnet-4-6') label = 'Claude Sonnet 4.6'
  else if (cleanId === 'deepseek-v4.1-flash') label = 'DeepSeek V4.1'
  else if (cleanId === 'deepseek-chat') label = 'DeepSeek V3'
  else if (cleanId === 'deepseek-reasoner') label = 'DeepSeek R1'
  else if (cleanId === 'gpt-4o') label = 'GPT-4o'
  else if (cleanId === 'gpt-4o-mini') label = 'GPT-4o Mini'
  else if (cleanId === 'gpt-oss-120b-medium') label = 'GPT-OSS 120B'
  else if (cleanId === 'kimi-k3-1') label = 'Kimi K3.1'

  const isRecommended = extra.isRecommended ?? [
    'gemini-3.8-flash-high',
    'claude-3.7-sonnet',
    'claude-sonnet-4-6',
    'deepseek-v4.1-flash',
    'deepseek-chat',
    'gpt-4o',
  ].includes(cleanId)

  return {
    id: cleanId,
    label,
    provider,
    channelName,
    channelId: extra.channelId,
    adapterType: extra.adapterType,
    contextWindow,
    contextWindowFormatted,
    supportsThinking: thinking.supportsThinking,
    thinkingType: thinking.thinkingType,
    maxThinkingTokens: thinking.maxThinkingTokens,
    supportsVision,
    supportsTools: true,
    isRecommended,
  }
}

/**
 * 动态模型探测与管理服务
 */
export class ModelDiscoveryService {
  private cache: { at: number; items: ModelMetadata[] } | null = null
  private readonly ttlMs = 5 * 60 * 1000 // 5 分钟缓存
  private readonly storageFile: string

  constructor(storageDir?: string) {
    const base = storageDir || path.resolve(process.cwd(), 'data/storage')
    this.storageFile = path.join(base, 'channels.json')
  }

  /**
   * 读取本地配置的 Channels 渠道列表
   */
  private async readChannels(): Promise<ChannelStorageItem[]> {
    try {
      if (!fs.existsSync(this.storageFile)) return []
      const raw = await fs.promises.readFile(this.storageFile, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter(c => c && c.status !== 'disabled')
      }
      return []
    } catch (err: any) {
      console.warn('[ModelDiscoveryService] Failed to read channels.json:', err.message)
      return []
    }
  }

  /**
   * 探测指定渠道上游的 /models 端点（带超时与容错）
   */
  private async probeUpstreamModels(channel: ChannelStorageItem): Promise<string[]> {
    const baseUrl = channel.options?.baseUrl?.trim()?.replace(/\/+$/, '')
    if (!baseUrl) return []

    // 针对 OpenAI 兼容端点探测
    const targetUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`
    const apiKey = channel.options?.apiKey

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500) // 2.5 秒快速超时

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      }
      if (apiKey) {
        headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`
      }

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      if (!res.ok) return []
      const json = await res.json() as any

      // 标准 OpenAI 格式: { data: [{ id: "model-id" }] }
      if (Array.isArray(json?.data)) {
        return json.data
          .map((m: any) => (typeof m === 'string' ? m : m?.id))
          .filter((id: any): id is string => typeof id === 'string' && Boolean(id.trim()))
      }

      // Gemini 格式: { models: [{ name: "models/gemini-pro" }] }
      if (Array.isArray(json?.models)) {
        return json.models
          .map((m: any) => (typeof m === 'string' ? m : m?.name?.replace(/^models\//, '')))
          .filter((id: any): id is string => typeof id === 'string' && Boolean(id.trim()))
      }

      return []
    } catch {
      // 网络超时或非标准端点，平滑忽略
      return []
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * 获取当前全部可用模型列表（动态汇聚 + 元数据计算）
   */
  async getAvailableModels(forceRefresh = false): Promise<ModelMetadata[]> {
    if (!forceRefresh && this.cache && Date.now() - this.cache.at < this.ttlMs) {
      return this.cache.items
    }

    const channels = await this.readChannels()
    const modelsMap = new Map<string, ModelMetadata>()

    // 1. 并发探测所有渠道
    const probePromises = channels.map(async (channel) => {
      const upstreamModelIds = await this.probeUpstreamModels(channel)
      const declaredModelIds = (channel.models || []).map(m => m.name).filter(Boolean)
      const allIds = Array.from(new Set([...upstreamModelIds, ...declaredModelIds]))

      for (const id of allIds) {
        // 如果未收录，则加入
        if (!modelsMap.has(id)) {
          modelsMap.set(id, buildModelMetadata(id, channel.name, {
            channelId: channel.id,
            adapterType: channel.adapterType,
          }))
        }
      }
    })

    await Promise.allSettled(probePromises)

    // 2. 默认置顶预设兜底（确保就算离线也能至少有推荐模型可选）
    const defaults = [
      { id: 'gemini-3.8-flash-high', channel: 'default-gemini', rec: true },
      { id: 'claude-3.7-sonnet', channel: 'default-gemini', rec: true },
      { id: 'deepseek-v4.1-flash', channel: 'default-gemini', rec: true },
      { id: 'gpt-4o', channel: 'default-gemini', rec: true },
    ]
    for (const d of defaults) {
      if (!modelsMap.has(d.id)) {
        modelsMap.set(d.id, buildModelMetadata(d.id, d.channel, { isRecommended: d.rec }))
      }
    }

    // 3. 排序策略：推荐模型置顶，其余按供应商及模型名称排序
    const list = Array.from(modelsMap.values()).sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1
      if (!a.isRecommended && b.isRecommended) return 1
      return a.label.localeCompare(b.label)
    })

    this.cache = { at: Date.now(), items: list }
    return list
  }
}

let globalModelDiscoveryService: ModelDiscoveryService | null = null

export function getModelDiscoveryService(): ModelDiscoveryService {
  if (!globalModelDiscoveryService) {
    globalModelDiscoveryService = new ModelDiscoveryService()
  }
  return globalModelDiscoveryService
}
