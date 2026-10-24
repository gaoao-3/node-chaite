/**
 * 集中式网关插件生命周期管理器 (Gateway Plugin Manager)
 *
 * 统一调度各个外部接入端插件（QQ、DSH、Web 等），提供热启停、状态监控与统一消息路由。
 */

import type { SessionRegistry } from '../server/session-registry'
import type { InboundMessage, OutboundEvent } from '../agent/gateway-contracts'
import type { GatewayAdapterPlugin, GatewayRuntime, GatewayStatusInfo } from './types'

export class GatewayManager {
  private adapters = new Map<string, GatewayAdapterPlugin>()
  private runtime: GatewayRuntime

  constructor(sessionRegistry?: SessionRegistry) {
    this.runtime = this.createRuntime(sessionRegistry)
  }

  /**
   * 将 SessionRegistry 绑定为 GatewayRuntime 驱动总线
   */
  setSessionRegistry(sessionRegistry: SessionRegistry) {
    this.runtime = this.createRuntime(sessionRegistry)
  }

  private createRuntime(registry?: SessionRegistry): GatewayRuntime {
    return {
      async dispatchInbound(message: InboundMessage): Promise<{ sessionId: string; accepted: boolean }> {
        if (!registry) {
          throw new Error('SessionRegistry is not attached to GatewayManager')
        }
        // 根据隔离作用域生成全局规范 session ID
        const targetId = message.groupId
          ? `group_${message.groupId}`
          : `private_${message.sender.id}`
        const sessionId = message.sessionId || `${message.platform}:${targetId}`

        // 确保会话存在
        registry.ensure({
          id: sessionId,
          platform: message.platform,
          botId: message.botId,
          title: message.groupId ? `群聊 ${message.groupId}` : `私聊 ${message.sender.nickname || message.sender.id}`,
          metadata: {
            userId: message.sender.id,
            nickname: message.sender.nickname,
            groupId: message.groupId,
          },
        })

        return { sessionId, accepted: true }
      },

      subscribeSession(sessionId: string, listener: (event: OutboundEvent) => void): () => void {
        if (!registry) return () => {}
        const session = registry.get(sessionId)
        if (!session) return () => {}
        return session.onEvent((event: any) => {
          listener(event as unknown as OutboundEvent)
        })
      },

      async sendPrompt(sessionId: string, prompt: string, options?: { model?: string; images?: any[] }): Promise<void> {
        if (!registry) {
          throw new Error('SessionRegistry is not attached to GatewayManager')
        }
        registry.dispatchPrompt(sessionId, {
          prompt,
          model: options?.model,
          images: options?.images,
        })
      },
    }
  }

  registerAdapter(adapter: GatewayAdapterPlugin) {
    if (this.adapters.has(adapter.id)) {
      console.warn(`[GatewayManager] Adapter ${adapter.id} is already registered, replacing...`)
    }
    this.adapters.set(adapter.id, adapter)
  }

  getAdapter(id: string): GatewayAdapterPlugin | undefined {
    return this.adapters.get(id)
  }

  listAdapters(): GatewayStatusInfo[] {
    return Array.from(this.adapters.values()).map(a => a.getStatus())
  }

  async startAdapter(id: string): Promise<GatewayStatusInfo> {
    const adapter = this.adapters.get(id)
    if (!adapter) throw new Error(`Gateway adapter "${id}" not found`)
    await adapter.start(this.runtime)
    return adapter.getStatus()
  }

  async stopAdapter(id: string): Promise<GatewayStatusInfo> {
    const adapter = this.adapters.get(id)
    if (!adapter) throw new Error(`Gateway adapter "${id}" not found`)
    await adapter.stop()
    return adapter.getStatus()
  }

  async startAll(): Promise<void> {
    for (const [id, adapter] of this.adapters.entries()) {
      try {
        await adapter.start(this.runtime)
      } catch (err: any) {
        console.error(`[GatewayManager] Failed to start adapter "${id}": ${err.message}`)
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const [id, adapter] of this.adapters.entries()) {
      try {
        await adapter.stop()
      } catch (err: any) {
        console.error(`[GatewayManager] Failed to stop adapter "${id}": ${err.message}`)
      }
    }
  }
}
