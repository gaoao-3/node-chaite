/**
 * 本地 JSON 文件持久化存储驱动 (FileJsonStorage)
 *
 * 继承 ChaiteStorage，实现基于本地 JSON 文件的原子读写与断电恢复：
 * 1. 内存高速缓存 (Fast in-memory Map) 用于零延迟读查询
 * 2. 异步原子写入 (Atomic file replace) 持久化至 data/storage/<name>.json
 * 3. 彻底杜绝服务重启后 MCP 服务、模型渠道与技能配置丢失（掉配置）的严重缺陷！
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ChaiteStorage } from '../types/storage'

export class FileJsonStorage<T extends { id?: string | number }> extends ChaiteStorage<T> {
  private cache = new Map<string, T>()
  private loaded = false
  private readonly filePath: string

  constructor(
    private readonly storageName: string,
    baseDir?: string,
    /** Rebuilds rich class instances (Channel, ChatPreset, ...) from plain JSON. */
    private readonly reviver?: (raw: any) => T,
  ) {
    super()
    const dir = baseDir || path.resolve(process.cwd(), 'data/storage')
    this.filePath = path.join(dir, `${storageName}.json`)
  }

  override getName(): string {
    return `file_json_${this.storageName}`
  }

  /**
   * 确保初始化并从磁盘载入全部数据
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf8')
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          for (const item of items) {
            const key = item.id !== undefined ? String(item.id) : randomUUID()
            let value: T = item
            if (this.reviver) {
              try {
                value = this.reviver(item)
                if (!(value as any).id) (value as any).id = item.id ?? key
              } catch (reviveError: any) {
                console.warn(
                  `[FileJsonStorage:${this.storageName}] Failed to revive ${key}, keeping raw record:`,
                  reviveError?.message,
                )
                value = item
              }
            }
            this.cache.set(key, value)
          }
        }
      }
    } catch (err: any) {
      console.warn(`[FileJsonStorage:${this.storageName}] Load error, starting empty:`, err.message)
    } finally {
      this.loaded = true
    }
  }

  /**
   * 同步持久化写入磁盘 (原子写入临时文件后 rename)
   */
  private async persist(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath)
      await fs.promises.mkdir(dir, { recursive: true })
      const tempPath = path.join(dir, `.${path.basename(this.filePath)}.${Date.now()}.${randomUUID().slice(0, 6)}.tmp`)
      const array = Array.from(this.cache.values())
      await fs.promises.writeFile(tempPath, JSON.stringify(array, null, 2), 'utf8')
      await fs.promises.rename(tempPath, this.filePath)
    } catch (err: any) {
      console.error(`[FileJsonStorage:${this.storageName}] Persist error:`, err.message)
    }
  }

  override async getItem(key: string): Promise<T | null> {
    await this.ensureLoaded()
    return this.cache.get(key) || null
  }

  override async setItem(key: string, value: T): Promise<string> {
    await this.ensureLoaded()
    const targetKey = key || (value.id !== undefined ? String(value.id) : randomUUID())
    if (!value.id) {
      ;(value as any).id = targetKey
    }
    this.cache.set(targetKey, value)
    await this.persist()
    return targetKey
  }

  override async removeItem(key: string): Promise<void> {
    await this.ensureLoaded()
    if (this.cache.delete(key)) {
      await this.persist()
    }
  }

  override async listItems(): Promise<T[]> {
    await this.ensureLoaded()
    return Array.from(this.cache.values())
  }

  override async listItemsByEqFilter(filter: Record<string, unknown>): Promise<T[]> {
    await this.ensureLoaded()
    return Array.from(this.cache.values()).filter((item: any) => {
      for (const [k, v] of Object.entries(filter)) {
        if (item[k] !== v) return false
      }
      return true
    })
  }

  override async listItemsByInQuery(query: Array<{ field: string; values: unknown[] }>): Promise<T[]> {
    await this.ensureLoaded()
    return Array.from(this.cache.values()).filter((item: any) => {
      return query.every(({ field, values }) => values.includes(item[field]))
    })
  }

  override async clear(): Promise<void> {
    await this.ensureLoaded()
    this.cache.clear()
    await this.persist()
  }
}
