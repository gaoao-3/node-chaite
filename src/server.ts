/**
 * Chaite Web & API 独立服务端启动入口
 */
import { Chaite } from './core/chaite'
import { runServer } from './controllers'
import {
  ChannelsManager,
  ChatPresetManager,
  ProcessorsManager,
  ToolManager,
  ToolsGroupManager,
  TriggerManager,
} from './share'
import { DefaultChannelLoadBalancer } from './channels/channels'
import {
  FrontEndAuthHandler,
  GlobalConfig,
  InMemoryHistoryManager,
  getLogger,
} from './utils'
import { ChaiteStorage } from './types/storage'
import { SkillRegistry } from './agent/skills/SkillRegistry'
import {
  closeAllAgentEventStreams,
  getAgentWebApiDependencies,
} from './server/index'
import path from 'node:path'

// 简易内存存储驱动实现
class SimpleMemoryStorage<T> extends ChaiteStorage<T> {
  private map = new Map<string, T>()

  async getItem(key: string): Promise<T | null> {
    return this.map.get(key) || null
  }
  async setItem(key: string, value: T): Promise<string> {
    this.map.set(key, value)
    return key
  }
  async removeItem(key: string): Promise<void> {
    this.map.delete(key)
  }
  async listItems(): Promise<T[]> {
    return Array.from(this.map.values())
  }
  async listItemsByEqFilter(filter: Record<string, unknown>): Promise<T[]> {
    return this.listItems()
  }
  async listItemsByInQuery(query: Array<{ field: string; values: unknown[] }>): Promise<T[]> {
    return this.listItems()
  }
  async clear(): Promise<void> {
    this.map.clear()
  }
  override getName(): string {
    return 'simple_memory'
  }
}

// 增强的前端认证管理器：支持持久固定的 Admin 秘钥，避免每次登录被一次性擦除
class PersistentAuthHandler extends FrontEndAuthHandler {
  private staticSecret: string

  constructor(secret: string) {
    super()
    this.staticSecret = secret
  }

  override validateToken(token: string): boolean {
    if (token === this.staticSecret) {
      return true
    }
    return super.validateToken(token)
  }
}

const HOST = process.env.CHAITE_HOST || '0.0.0.0'
const PORT = Number(process.env.CHAITE_PORT || 3200)
const ADMIN_PASSWORD = process.env.CHAITE_ADMIN_TOKEN || 'admin123456'

async function start() {
  const channelsStorage = new SimpleMemoryStorage<any>()
  const presetsStorage = new SimpleMemoryStorage<any>()
  const toolsStorage = new SimpleMemoryStorage<any>()
  const processorsStorage = new SimpleMemoryStorage<any>()
  const toolsGroupStorage = new SimpleMemoryStorage<any>()
  const triggerStorage = new SimpleMemoryStorage<any>()
  const coreStorage = new SimpleMemoryStorage<any>()

  const logger = getLogger()
  const dataDir = path.resolve(process.cwd(), 'data')

  // 1. 初始化各类 Manager 单例 (相互隔离的存储域)
  const channelsManager = await ChannelsManager.init(channelsStorage, new DefaultChannelLoadBalancer())
  const toolsManager = await ToolManager.init(path.join(dataDir, 'tools'), toolsStorage)
  const processorsManager = await ProcessorsManager.init(path.join(dataDir, 'processors'), processorsStorage)
  const chatPresetManager = await ChatPresetManager.init(presetsStorage)
  const toolsGroupManager = await ToolsGroupManager.init(toolsGroupStorage)
  const triggerManager = new TriggerManager(path.join(dataDir, 'triggers'), triggerStorage)
  const userModeSelector = {
    getChatPreset: async () => undefined,
  } as any
  // 自动填充默认 Channel 与 Preset，保证 Web 前端即使未配置也能直接开聊
  const { ensureDefaultPresetAndChannel } = await import('./server/setup-default-preset')
  const { getAgentWebApiDependencies } = await import('./server/default-web-api')
  const webDeps = getAgentWebApiDependencies()
  await ensureDefaultPresetAndChannel(chatPresetManager, channelsManager, { fusionService: webDeps.fusion })

  // 2. 初始化 Chaite 核心上下文
  const chaite = Chaite.init(
    channelsManager,
    toolsManager,
    processorsManager,
    chatPresetManager,
    toolsGroupManager,
    triggerManager,
    userModeSelector,
    coreStorage,
    new InMemoryHistoryManager(),
    logger
  )

  // 设置全局配置并固定 AuthKey
  const globalConfig = new GlobalConfig()
  globalConfig.setAuthKey(ADMIN_PASSWORD)
  chaite.setGlobalConfig(globalConfig)

  // 初始化技能注册表
  const skillsDir = path.resolve(process.cwd(), 'skills/active')
  const skillRegistry = new SkillRegistry(skillsDir)
  chaite.setSkillRegistry(skillRegistry)

  // 初始化 MCP 服务管理器
  const { McpServerManager } = await import('./agent/mcp/McpServerConfig')
  const mcpStorage = new SimpleMemoryStorage<any>()
  const mcpServerManager = new McpServerManager(mcpStorage)
  chaite.setMcpServerManager(mcpServerManager)

  // 配置持久 Token 认证
  const authHandler = new PersistentAuthHandler(ADMIN_PASSWORD)
  chaite.setFrontendAuthHandler(authHandler)

  // 3. 启动 Headless Web API 服务。
  // 旧版 NaiveUI 管理面板不再默认挂载；全新前台可通过 CHAITE_FRONTEND_DIR 显式接入。
  const frontendDir = process.env.CHAITE_FRONTEND_DIR
    ? path.resolve(process.env.CHAITE_FRONTEND_DIR)
    : undefined

  const { server } = runServer(HOST, PORT, undefined, { frontendDir })

  console.log('\n======================================================')
  console.log('🖥️  Chaite Agent Headless Web API 已启动！')
  console.log(`🌐 API 地址: http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/api/agent`)
  console.log(`🔑 管理员登录口令: ${ADMIN_PASSWORD}`)
  console.log('======================================================\n')

  const shutdown = () => {
    closeAllAgentEventStreams()
    getAgentWebApiDependencies().sessions.closeAll('server shutting down')
    server.close(() => {
      process.exit(0)
    })
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

start().catch((err) => {
  console.error('启动 Chaite Web 服务异常:', err)
  process.exit(1)
})
