import type { SkillFrontmatter, SkillMeta } from '../agent/skills/skill.types'
import type { SkillRegistry } from '../agent/skills/SkillRegistry'
import { NotFoundError, ServiceUnavailableError } from './errors'

export interface SkillListItem {
  id: string
  name: string
  description: string
  version?: string
  license?: string
  compatibility?: string
  executionMode: NonNullable<SkillFrontmatter['executionMode']>
  allowedTools: string[]
  keywords: string[]
  preset?: string
  planningModel?: string
  workflowRef?: string
  mcpServer?: string
  mcpTools: string[]
  processors: string[]
  triggers: string[]
  readonly: boolean
  rootDir: string
  metadata: Record<string, unknown>
  /** Raw frontmatter, kept for the legacy management UI. */
  frontmatter: SkillFrontmatter
}

export interface SkillListFilter {
  name?: string
  executionMode?: SkillFrontmatter['executionMode']
  limit?: number
  offset?: number
}

export interface SkillListResult {
  items: SkillListItem[]
  total: number
  limit: number
  offset: number
  available: boolean
}

function toListItem(meta: SkillMeta): SkillListItem {
  const fm = meta.frontmatter
  return {
    id: meta.id,
    name: fm.name || meta.id,
    description: fm.description ?? '',
    version: fm.version,
    license: fm.license,
    compatibility: fm.compatibility,
    executionMode: fm.executionMode ?? 'direct',
    allowedTools: [...(fm.allowedTools ?? [])],
    keywords: [...(fm.keywords ?? [])],
    preset: fm.preset,
    planningModel: fm.planningModel,
    workflowRef: fm.workflowRef,
    mcpServer: fm.mcpServer,
    mcpTools: [...(fm.mcpTools ?? [])],
    processors: [...(fm.processors ?? [])],
    triggers: [...(fm.triggers ?? [])],
    readonly: fm.readonly === true,
    rootDir: meta.rootDir,
    metadata: { ...(fm.metadata ?? {}) },
    frontmatter: { ...fm },
  }
}

/** Read-only view over Chaite's `SkillRegistry` for the web console. */
export class SkillsService {
  constructor(private readonly getRegistry: () => SkillRegistry | undefined) {}

  get available(): boolean {
    return this.getRegistry() !== undefined
  }

  list(filter: SkillListFilter = {}): SkillListResult {
    const registry = this.getRegistry()
    const limit = Math.min(200, Math.max(1, filter.limit ?? 50))
    const offset = Math.max(0, filter.offset ?? 0)
    if (!registry) {
      return { items: [], total: 0, limit, offset, available: false }
    }
    const name = filter.name?.trim().toLowerCase()
    let items = registry.listSkillMetas().map(toListItem)
    if (name) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(name)
        || item.description.toLowerCase().includes(name)
        || item.keywords.some(keyword => keyword.toLowerCase().includes(name)),
      )
    }
    if (filter.executionMode) {
      items = items.filter(item => item.executionMode === filter.executionMode)
    }
    items.sort((a, b) => a.name.localeCompare(b.name))
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
      available: true,
    }
  }

  get(name: string): SkillListItem {
    const registry = this.getRegistry()
    if (!registry) {
      throw new ServiceUnavailableError('Skill registry is not configured', {
        code: 'SKILL_REGISTRY_UNAVAILABLE',
      })
    }
    const skill = registry.getSkillByName(name)
    if (!skill) {
      throw new NotFoundError(`Skill "${name}" not found`, { code: 'SKILL_NOT_FOUND' })
    }
    return toListItem({ id: skill.id, rootDir: skill.rootDir, frontmatter: skill.frontmatter })
  }

  async instructions(name: string): Promise<{ skill: SkillListItem; instructions: string }> {
    const registry = this.getRegistry()
    if (!registry) {
      throw new ServiceUnavailableError('Skill registry is not configured', {
        code: 'SKILL_REGISTRY_UNAVAILABLE',
      })
    }
    const skill = registry.getSkillByName(name)
    if (!skill) {
      throw new NotFoundError(`Skill "${name}" not found`, { code: 'SKILL_NOT_FOUND' })
    }
    return {
      skill: toListItem({ id: skill.id, rootDir: skill.rootDir, frontmatter: skill.frontmatter }),
      instructions: await skill.loadInstructions(),
    }
  }

  async reload(): Promise<number> {
    const registry = this.getRegistry()
    if (!registry) {
      throw new ServiceUnavailableError('Skill registry is not configured', {
        code: 'SKILL_REGISTRY_UNAVAILABLE',
      })
    }
    await registry.load()
    return registry.listSkillMetas().length
  }
}
