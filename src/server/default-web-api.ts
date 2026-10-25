import path from 'node:path'
import type { Router } from 'express'
import { Chaite } from '../core/chaite'
import { createChaitePromptDriver } from './chaite-driver'
import { EvolutionService } from './evolution-service'
import { FusionTaskService } from './fusion-service'
import { JsonFilePersistence } from './persistence'
import { SessionRegistry } from './session-registry'
import { TitleNamingService } from './title-naming-service'
import { FileSessionPersistence } from './session-persistence'
import { SkillsService } from './skills-service'
import type { AgentWebApiDependencies } from './web-api'
import { createAgentWebApiRouter } from './web-api'
import { GatewayManager } from '../gateway/gateway-manager'
import { QqOnebotPlugin } from '../gateway/plugins/qq-onebot'
import { DshMobilePlugin } from '../gateway/plugins/dsh-mobile'
import { PluginLoader } from '../agent/plugins/plugin-loader'

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
  const titleNaming = new TitleNamingService()
  const sessions = new SessionRegistry({
    driver: createChaitePromptDriver({
      resolveChaite: async () => resolveChaiteSync(),
      defaultUserId: 'web-console',
      evolutionService: evolution,
    }),
    persistence: new FileSessionPersistence(path.join(stateDirectory(), 'storage/sessions.json')),
    titleNamer: ({ prompt, reply }) => titleNaming.generateTitle(prompt, reply),
  })
  const fusion = new FusionTaskService({
    persistence: new JsonFilePersistence(path.join(stateDirectory(), 'web-fusion-tasks.json')),
    onPersistError: error => console.warn('[chaite-web] Failed to persist Fusion tasks:', error),
  })
  const skills = new SkillsService(() => resolveChaiteSync()?.getSkillRegistry())
  const gateways = new GatewayManager(sessions)
  gateways.registerAdapter(new QqOnebotPlugin())
  gateways.registerAdapter(new DshMobilePlugin())

  const plugins = new PluginLoader()

  return { sessions, fusion, evolution, skills, gateways, plugins, titleNaming }
}

function ensureHydrated(deps: AgentWebApiDependencies): void {
  if (hydration || process.env.NODE_ENV === 'test') return
  hydration = Promise.all([
    deps.sessions?.hydrate(),
    deps.fusion?.hydrate(),
    deps.evolution?.hydrate(),
    deps.plugins?.scanAndLoadAll(),
  ])
    .then(() => undefined)
    .catch((error: unknown) => {
      console.warn('[chaite-web] Failed to hydrate persisted web state:', error)
    })
}

/** Await pending hydration (used by tests and graceful shutdown). */
export function whenHydrated(): Promise<void> {
  return hydration ?? Promise.resolve()
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
