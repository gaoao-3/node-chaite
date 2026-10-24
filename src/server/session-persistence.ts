/**
 * 会话持久化记录与本地文件存储 (Session Persistence)
 *
 * 让 Web 控制台的会话列表、每轮的思考链、工具轨迹与最终回复在接受服务重启后依然完好：
 * 1. 会话元信息 (标题、平台、模型、轮数、最后活跃时间)
 * 2. 完整事件流 (thought_chunk / tool_status / text_chunk / final_reply / error)
 * 3. 冻结进行中的 Turn 状态，避免重启后残留 "streaming" 僵尸会话
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AgentWebEvent } from './types'

export interface SessionRecord {
  version: 1
  id: string
  platform: string
  botId: string
  title: string
  status: string
  createdAt: number
  lastActiveAt: number
  turnCount: number
  skills: string[]
  model?: string
  metadata: Record<string, unknown>
  lastSeq: number
  events: AgentWebEvent[]
}

export interface SessionPersistence {
  load(): Promise<SessionRecord[]>
  save(records: readonly SessionRecord[]): Promise<void>
}

/** 原子写入的会话 JSON 存储，默认落盘到 data/storage/sessions.json */
export class FileSessionPersistence implements SessionPersistence {
  private readonly filePath: string

  constructor(filePath?: string) {
    this.filePath = path.resolve(filePath ?? path.join(process.cwd(), 'data/storage/sessions.json'))
  }

  async load(): Promise<SessionRecord[]> {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed as SessionRecord[]
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      console.warn('[session-persistence] Failed to load sessions:', (error as Error).message)
      return []
    }
  }

  async save(records: readonly SessionRecord[]): Promise<void> {
    const directory = path.dirname(this.filePath)
    await fs.promises.mkdir(directory, { recursive: true })
    const temporary = path.join(directory, `.${path.basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`)
    await fs.promises.writeFile(temporary, `${JSON.stringify(records)}\n`, 'utf8')
    try {
      await fs.promises.rename(temporary, this.filePath)
    } catch (error) {
      await fs.promises.rm(temporary, { force: true }).catch(() => {})
      throw error
    }
  }
}
