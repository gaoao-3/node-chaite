import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'

/** Optional durable store for fusion tasks / evolution traces. */
export interface CollectionPersistence<T> {
  load(): Promise<T[]>
  save(items: readonly T[]): Promise<void>
}

/**
 * Tiny JSON-file collection store with atomic replace. The backend keeps
 * everything in memory for fast reads; this exists so a restart does not lose
 * delegated tasks or evolution candidates.
 */
export class JsonFilePersistence<T> implements CollectionPersistence<T> {
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath)
  }

  async load(): Promise<T[]> {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        throw new Error(`Expected an array in ${this.filePath}`)
      }
      return parsed as T[]
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  async save(items: readonly T[]): Promise<void> {
    const directory = path.dirname(this.filePath)
    await fs.promises.mkdir(directory, { recursive: true })
    const temporary = path.join(directory, `.${path.basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`)
    const payload = `${JSON.stringify(items, null, 2)}\n`
    await fs.promises.writeFile(temporary, payload, 'utf8')
    try {
      await fs.promises.rename(temporary, this.filePath)
    } catch (error) {
      await fs.promises.rm(temporary, { force: true }).catch(() => {})
      throw error
    }
  }
}

/**
 * Serialises persistence writes so two mutations cannot interleave and write an
 * older snapshot after a newer one. `flush()` is used by tests and shutdown.
 */
export class PersistenceQueue<T> {
  private chain: Promise<void> = Promise.resolve()

  constructor(
    private readonly snapshot: () => T[],
    private readonly persistence?: CollectionPersistence<T>,
    private readonly onError?: (error: unknown) => void,
  ) {}

  schedule(): void {
    if (!this.persistence) return
    const persistence = this.persistence
    this.chain = this.chain
      .then(() => persistence.save(this.snapshot()))
      .catch((error: unknown) => {
        this.onError?.(error)
      })
  }

  async flush(): Promise<void> {
    await this.chain
  }
}
