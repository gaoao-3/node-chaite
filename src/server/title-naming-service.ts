/**
 * 独立会话标题命名服务 (Title Naming Service)
 *
 * 使用独立的小模型/ OpenAI 兼容端点，在首轮完成后提炼短标题。
 * 命名请求不携带会话历史、不挂载工具，也不会阻塞主回复；失败时返回 undefined。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface TitleNamingConfig {
  enabled: boolean
  model: string
  baseUrl: string
  apiKey?: string
  timeoutMs: number
  maxChars: number
}

export type PublicTitleNamingConfig = Omit<TitleNamingConfig, 'apiKey'> & {
  apiKeyConfigured: boolean
}

const DEFAULT_CONFIG: TitleNamingConfig = {
  enabled: true,
  model: process.env.TITLE_MODEL || 'gemini-3.8-flash-high',
  baseUrl: process.env.TITLE_BASE_URL || process.env.LLM_BASE_URL || 'http://127.0.0.1:3000/v1',
  apiKey: process.env.TITLE_API_KEY || process.env.LLM_API_KEY || '',
  timeoutMs: 12_000,
  maxChars: 24,
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, Math.floor(number)))
}

/** Remove transport/meta prefixes and provider formatting from a title candidate. */
export function sanitizeTitle(value: string, maxChars = 24): string {
  const cleaned = value
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*(?:标题|Title|会话标题|topic)\s*[:：]\s*/i, '')
    .split(/\r?\n/)[0]
    .replace(/^\s*[-#*>\s]+/, '')
    .replace(/^['"`「『【（(]+|['"`」』】）)]+$/g, '')
    .replace(/[。！？!?；;，,、\s]+$/g, '')
    .trim()
  if (!cleaned) return ''
  return Array.from(cleaned).slice(0, Math.max(4, maxChars)).join('')
}

function promptForNaming(prompt: string, reply: string): string {
  const cleanPrompt = prompt
    .replace(/^\[(?:深度思考模式|联网搜索模式):[^\]]+\]\s*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, 1400)
  const cleanReply = reply.replace(/\s+/g, ' ').slice(0, 700)
  return `请根据下面的首轮对话，生成一个简短、具体、便于在会话列表中识别的标题。\n\n用户：${cleanPrompt}\n\n助手：${cleanReply || '(暂无回复)'}` 
}

export class TitleNamingService {
  private config: TitleNamingConfig = { ...DEFAULT_CONFIG }
  private loaded = false
  private readonly filePath: string

  constructor(filePath?: string) {
    this.filePath = path.resolve(filePath || path.join(process.cwd(), 'data/storage/title-naming.json'))
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<TitleNamingConfig>
      this.config = {
        ...this.config,
        ...parsed,
        timeoutMs: clamp(parsed.timeoutMs, this.config.timeoutMs, 1000, 60_000),
        maxChars: clamp(parsed.maxChars, this.config.maxChars, 8, 60),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[title-naming] Failed to load config:', (error as Error).message)
      }
    } finally {
      this.loaded = true
    }
  }

  private async persist(): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    await fs.promises.writeFile(temporary, JSON.stringify(this.config, null, 2), 'utf8')
    await fs.promises.rename(temporary, this.filePath)
  }

  async getPublicConfig(): Promise<PublicTitleNamingConfig> {
    await this.ensureLoaded()
    const { apiKey, ...rest } = this.config
    return { ...rest, apiKeyConfigured: Boolean(apiKey) }
  }

  async updateConfig(patch: Partial<TitleNamingConfig>): Promise<PublicTitleNamingConfig> {
    await this.ensureLoaded()
    const next: TitleNamingConfig = {
      ...this.config,
      ...(patch.enabled === undefined ? {} : { enabled: Boolean(patch.enabled) }),
      ...(patch.model === undefined ? {} : { model: String(patch.model).trim() }),
      ...(patch.baseUrl === undefined ? {} : { baseUrl: String(patch.baseUrl).trim().replace(/\/+$/, '') }),
      ...(patch.apiKey === undefined ? {} : { apiKey: String(patch.apiKey).trim() || undefined }),
      timeoutMs: clamp(patch.timeoutMs, this.config.timeoutMs, 1000, 60_000),
      maxChars: clamp(patch.maxChars, this.config.maxChars, 8, 60),
    }
    if (!next.model) throw new Error('命名模型不能为空')
    if (!next.baseUrl) throw new Error('命名接口 Base URL 不能为空')
    this.config = next
    await this.persist()
    return this.getPublicConfig()
  }

  async generateTitle(prompt: string, reply: string): Promise<string | undefined> {
    await this.ensureLoaded()
    if (!this.config.enabled || !prompt.trim()) return undefined

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: '你是会话标题生成器。只输出一个简短、具体的中文标题，不超过16个字。不要解释，不要引号，不要Markdown，不要标点结尾，不要输出其他内容。',
            },
            { role: 'user', content: promptForNaming(prompt, reply) },
          ],
          temperature: 0.2,
          max_tokens: 48,
          stream: false,
        }),
        signal: controller.signal,
      })
      if (!response.ok) return undefined
      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
      }
      const content = data.choices?.[0]?.message?.content
      const text = Array.isArray(content)
        ? content.map(part => part.text || '').join('')
        : content || ''
      const title = sanitizeTitle(text, this.config.maxChars)
      return title || undefined
    } catch (error) {
      // Naming is best-effort. Never surface an auxiliary model failure to chat.
      console.warn('[title-naming] Auxiliary model unavailable:', (error as Error).message)
      return undefined
    } finally {
      clearTimeout(timer)
    }
  }
}
