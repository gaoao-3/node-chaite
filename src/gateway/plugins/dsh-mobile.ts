/**
 * DSH Mobile 掌上中枢插件 (DSH Mobile Gateway Plugin)
 *
 * 实现了 GatewayAdapterPlugin 标准接口，通过 Cordis IPC / WebSocket 对接 DSH 移动端。
 */

import type { GatewayAdapterPlugin, GatewayRuntime, GatewayStatusInfo } from '../types'

export class DshMobilePlugin implements GatewayAdapterPlugin {
  readonly id = 'dsh-mobile'
  readonly name = 'DSH Mobile 掌上中枢插件'
  readonly platform = 'dsh' as const
  readonly description = '基于 Cordis 微内核 IPC 桥接的移动端会话适配器，支持实时移动端审批与通知'

  private status: 'stopped' | 'running' = 'running'
  private connectedAt = Date.now()
  private messageCount = 0

  getStatus(): GatewayStatusInfo {
    return {
      id: this.id,
      name: this.name,
      platform: this.platform,
      status: this.status,
      messageCount: this.messageCount,
      connectedAt: this.connectedAt,
      endpoint: 'cordis://dsh-mobile/ipc',
    }
  }

  async start(runtime: GatewayRuntime): Promise<void> {
    this.status = 'running'
    this.connectedAt = Date.now()
  }

  async stop(): Promise<void> {
    this.status = 'stopped'
  }
}
