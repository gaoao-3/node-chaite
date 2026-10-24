/**
 * 基于本地 JSON 文件的 KV 存储 (FileKVStore)
 *
 * 用于驱动 KVHistoryManager，让多轮对话的上下文历史落盘到
 * data/storage/conversation-history.json，重启后 Agent 依然记得之前聊过什么。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { KVStore } from './kv_history'

export class FileKVStore implements KVStore {
  private cache: Map<string, string> | null = null
  private flushTimer: NodeJS.Timeout | null = null
  private readonly filePath: string
  private writing = false

  constructor(filePath?: string) {
    this.filePath = path.resolve(filePath ?? path.join(process.cwd(), 'data/storage/conversation-history.json'))
  }

  private load(): Map<string, string> {
    if (this.cache) return this.cache
    this.cache = new Map()
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8')
        const parsed = JSON.parse(raw) as Record<string, unknown>
        for (const [key, value] of Object.entries(parsed ?? {})) {
          if (typeof value === 'string') this.cache.set(key, value)
        }
      }
    } catch (error) {
      console.warn('[FileKVStore] Failed to load history store:', (error as Error).message)
    }
    return this.cache
  }

  private scheduleFlush(): void {
    if (this.flushTimer || this.writing) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, 500)
    this.flushTimer.unref?.()
  }

  async flush(): Promise<void> {
    const cache = this.load()
    this.writing = true
    try {
      const directory = path.dirname(this.filePath)
      await fs.promises.mkdir(directory, { recursive: true })
      const payload: Record<string, string> = {}
      for (const [key, value] of cache.entries()) payload[key] = value
      const temporary = path.join(directory, `.${path.basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`)
      await fs.promises.writeFile(temporary, JSON.stringify(payload), 'utf8')
      await fs.promises.rename(temporary, this.filePath)
    } catch (error) {
      console.warn('[FileKVStore] Failed to persist history:', (error as Error).message)
    } finally {
      this.writing = false
    }
  }

  async get(key: string): Promise<string> {
    return this.load().get(key) ?? ''
  }

  async set(key: string, value: string): Promise<void> {
    this.load().set(key, value)
    this.scheduleFlush()
  }

  async delete(key: string): Promise<void> {
    if (this.load().delete(key)) this.scheduleFlush()
  }
}
