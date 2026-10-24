/**
 * 跨平台网关插件规范 (Gateway Adapter Plugin Contracts)
 *
 * 将所有外部接入端（QQ OneBot、DSH 移动端、Telegram、Discord、Web）规范化为可插拔插件模块。
 * 具备独立生命周期、故障隔离与标准化事件流。
 */

import type { InboundMessage, OutboundEvent } from '../agent/gateway-contracts'

export type GatewayAdapterStatus = 'running' | 'stopped' | 'error' | 'starting'

export interface GatewayStatusInfo {
  id: string
  name: string
  platform: 'qq' | 'dsh' | 'web' | 'discord' | 'telegram'
  status: GatewayAdapterStatus
  error?: string
  messageCount: number
  connectedAt?: number
  endpoint?: string
  metadata?: Record<string, unknown>
}

export interface GatewayRuntime {
  /**
   * 将入站消息派发进主 Agent 会话系统
   */
  dispatchInbound(message: InboundMessage): Promise<{
    sessionId: string
    accepted: boolean
  }>

  /**
   * 订阅指定会话的流式出站事件 (SSE 风格总线)
   */
  subscribeSession(
    sessionId: string,
    listener: (event: OutboundEvent) => void,
  ): () => void

  /**
   * 发送指令驱动会话生成
   */
  sendPrompt(
    sessionId: string,
    prompt: string,
    options?: { model?: string; images?: Array<{ url?: string; base64?: string; mimeType?: string }> },
  ): Promise<void>
}

export interface GatewayAdapterPlugin {
  readonly id: string
  readonly name: string
  readonly platform: 'qq' | 'dsh' | 'web' | 'discord' | 'telegram'
  readonly description?: string

  getStatus(): GatewayStatusInfo
  init?(config?: Record<string, unknown>): Promise<void>
  start(runtime: GatewayRuntime): Promise<void>
  stop(): Promise<void>
}
