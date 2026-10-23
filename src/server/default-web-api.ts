import path from 'node:path'
import type { Router } from 'express'
import { Chaite } from '../core/chaite'
import { createChaitePromptDriver } from './chaite-driver'
import { EvolutionService } from './evolution-service'
import { FusionTaskService } from './fusion-service'
import { JsonFilePersistence } from './persistence'
import { SessionRegistry } from './session-registry'
import { SkillsService } from './skills-service'
import type { AgentWebApiDependencies } from './web-api'
import { createAgentWebApiRouter } from './web-api'

let override: AgentWebApiDependencies | null = null
let dependencies: AgentWebApiDependencies | null = null
let router: Router | null = null
let hydration: Promise<void> | null = null

function resolveChaiteSync(): Chaite | undefined {
  try {
    return Chaite.getInstance() as Chaite | undefined
  } catch {
    return undefined
  }
}

function stateDirectory(): string {
  return process.env.CHAITE_WEB_STATE_DIR
    ?? path.resolve(process.cwd(), 'data')
}

/**
 * Build the production dependency graph. Services stay in memory; fusion and
 * evolution snapshots are flushed to JSON files so a restart keeps tasks and
 * evolution candidates.
 */
export function createDefaultAgentWebApiDependencies(): AgentWebApiDependencies {
  const evolution = new EvolutionService({
    persistence: new JsonFilePersistence(path.join(stateDirectory(), 'web-evolution-traces.json')),
    getRegistry: () => resolveChaiteSync()?.getSkillRegistry(),
    skillsDir: path.resolve(process.cwd(), 'skills/active'),
    onPersistError: error => console.warn('[chaite-web] Failed to persist evolution traces:', error),
  })
  const sessions = new SessionRegistry({
    driver: createChaitePromptDriver({
      resolveChaite: async () => resolveChaiteSync(),
      defaultUserId: 'web-console',
      evolutionService: evolution,
    }),
  })
  const fusion = new FusionTaskService({
    persistence: new JsonFilePersistence(path.join(stateDirectory(), 'web-fusion-tasks.json')),
    onPersistError: error => console.warn('[chaite-web] Failed to persist Fusion tasks:', error),
  })
  const skills = new SkillsService(() => resolveChaiteSync()?.getSkillRegistry())
  return { sessions, fusion, evolution, skills }
}

function ensureHydrated(deps: AgentWebApiDependencies): void {
  if (hydration) return
  hydration = Promise.all([
    deps.fusion?.hydrate(),
    deps.evolution?.hydrate(),
  ])
    .then(() => undefined)
    .catch((error: unknown) => {
      console.warn('[chaite-web] Failed to hydrate persisted web state:', error)
    })
}

/**
 * Replace the default graph (tests, embedding in another host, custom storage).
 * The next call to {@link getAgentWebApiRouter} rebuilds the router.
 */
export function configureAgentWebApi(deps: AgentWebApiDependencies): void {
  override = deps
  dependencies = null
  router = null
  hydration = null
}

export function getAgentWebApiDependencies(): AgentWebApiDependencies {
  if (!dependencies) {
    dependencies = override ?? createDefaultAgentWebApiDependencies()
  }
  ensureHydrated(dependencies)
  return dependencies
}

/** Router used by `controllers/index.ts` (mount before the legacy router). */
export function getAgentWebApiRouter(): Router {
  if (!router) {
    router = createAgentWebApiRouter(getAgentWebApiDependencies())
  }
  return router
}

/** Test/shutdown helper. */
export function resetAgentWebApi(): void {
  dependencies?.sessions.closeAll('web API reset')
  override = null
  dependencies = null
  router = null
  hydration = null
}
