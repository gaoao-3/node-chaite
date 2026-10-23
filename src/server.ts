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
  const storage = new SimpleMemoryStorage<any>()
  const logger = getLogger()
  const dataDir = path.resolve(process.cwd(), 'data')

  // 1. 初始化各类 Manager 单例
  const channelsManager = await ChannelsManager.init(storage, new DefaultChannelLoadBalancer())
  const toolsManager = await ToolManager.init(path.join(dataDir, 'tools'), storage)
  const processorsManager = await ProcessorsManager.init(path.join(dataDir, 'processors'), storage)
  const chatPresetManager = await ChatPresetManager.init(storage)
  const toolsGroupManager = await ToolsGroupManager.init(storage)
  const triggerManager = new TriggerManager(path.join(dataDir, 'triggers'), storage)
  const userModeSelector = {
    getChatPreset: async () => undefined,
  } as any

  // 2. 初始化 Chaite 核心上下文
  const chaite = Chaite.init(
    channelsManager,
    toolsManager,
    processorsManager,
    chatPresetManager,
    toolsGroupManager,
    triggerManager,
    userModeSelector,
    storage,
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

  // 配置持久 Token 认证
  const authHandler = new PersistentAuthHandler(ADMIN_PASSWORD)
  chaite.setFrontendAuthHandler(authHandler)

  // 3. 启动 Express Web 服务并挂载已编译的 Vue3 前端面板
  const frontendDir = path.resolve(process.cwd(), 'frontend/build')

  const { server } = runServer(HOST, PORT, undefined, {
    frontendDir,
  })

  console.log('\n======================================================')
  console.log('🖥️  Chaite Agent Web 控制台与管理服务已启动！')
  console.log(`🌐 访问地址: http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`)
  console.log(`🔑 管理员登录口令: ${ADMIN_PASSWORD}`)
  console.log('======================================================\n')

  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0)
    })
  })
}

start().catch((err) => {
  console.error('启动 Chaite Web 服务异常:', err)
  process.exit(1)
})
