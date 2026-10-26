/**
 * QQ OneBot v11 网关插件 (QQ OneBot Gateway Plugin)
 *
 * 实现了 GatewayAdapterPlugin 标准接口，可被 GatewayManager 动态热插拔与监控。
 */

import WebSocket from 'ws'
import type { GatewayAdapterPlugin, GatewayRuntime, GatewayStatusInfo } from '../types'
import type { InboundMessage } from '../../agent/gateway-contracts'

export interface QqOnebotConfig {
  wsUrl?: string
  wsToken?: string
  httpUrl?: string
  httpToken?: string
  botQq?: string
  ownerQq?: string
}

export class QqOnebotPlugin implements GatewayAdapterPlugin {
  readonly id = 'qq-onebot'
  readonly name = 'QQ OneBot v11 网关插件'
  readonly platform = 'qq' as const
  readonly description = '通过 OneBot v11 反向 WebSocket / HTTP 接入 QQ 群与私聊，支持事件过滤与流式回复'

  private config: Required<QqOnebotConfig>
  private runtime?: GatewayRuntime
  private wsClient?: WebSocket
  private reconnectTimer?: NodeJS.Timeout
  private status: 'stopped' | 'starting' | 'running' | 'error' = 'stopped'
  private messageCount = 0
  private lastError?: string
  private connectedAt?: number
  private stopping = false

  constructor(config: QqOnebotConfig = {}) {
    this.config = {
      wsUrl: config.wsUrl || process.env.ONEBOT_WS_URL || 'ws://127.0.0.1:3001',
      wsToken: config.wsToken || process.env.ONEBOT_WS_TOKEN || '',
      httpUrl: config.httpUrl || process.env.ONEBOT_HTTP_URL || 'http://127.0.0.1:3004',
      httpToken: config.httpToken || process.env.ONEBOT_HTTP_TOKEN || '',
      botQq: config.botQq || process.env.BOT_QQ || '1579989279',
      ownerQq: config.ownerQq || process.env.OWNER_QQ || '3094274628',
    }
  }

  getStatus(): GatewayStatusInfo {
    return {
      id: this.id,
      name: this.name,
      platform: this.platform,
      status: this.status,
      error: this.lastError,
      messageCount: this.messageCount,
      connectedAt: this.connectedAt,
      endpoint: this.config.wsUrl,
      metadata: {
        botQq: this.config.botQq,
        ownerQq: this.config.ownerQq,
        httpUrl: this.config.httpUrl,
      },
    }
  }
  async configure(config: Record<string, unknown>): Promise<void> {
    const wasRunning = this.status === 'running' || this.status === 'starting'
    const next = { ...this.config }
    for (const [key, value] of Object.entries(config)) {
      if (key === 'wsToken' || key === 'httpToken') {
        if (typeof value === 'string' && value.trim()) next[key] = value.trim()
      } else if (key === 'wsUrl' || key === 'httpUrl' || key === 'botQq' || key === 'ownerQq') {
        if (typeof value === 'string') next[key] = value.trim()
      }
    }
    this.config = next
    if (wasRunning && this.runtime) {
      await this.stop()
      await this.start(this.runtime)
    }
  }


  async start(runtime: GatewayRuntime): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      return
    }
    this.runtime = runtime
    this.stopping = false
    this.status = 'starting'
    this.connectWs()
  }

  async stop(): Promise<void> {
    this.stopping = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    if (this.wsClient) {
      try {
        this.wsClient.terminate()
      } catch {}
      this.wsClient = undefined
    }
    this.status = 'stopped'
  }

  private connectWs() {
    if (this.stopping) return
    try {
      this.wsClient = new WebSocket(this.config.wsUrl, {
        headers: {
          Authorization: `Bearer ${this.config.wsToken}`,
        },
      })

      this.wsClient.on('open', () => {
        this.status = 'running'
        this.connectedAt = Date.now()
        this.lastError = undefined
        console.log(`[QqOnebotPlugin] Connected to OneBot WebSocket at ${this.config.wsUrl}`)
      })

      this.wsClient.on('message', async (data: WebSocket.RawData) => {
        try {
          const event = JSON.parse(data.toString())
          if (event.post_type !== 'message') return

          this.messageCount++
          await this.handleMessageEvent(event)
        } catch (err: any) {
          console.error(`[QqOnebotPlugin] Message processing error: ${err.message}`)
        }
      })

      this.wsClient.on('close', (code: any, reason: any) => {
        this.status = 'stopped'
        if (!this.stopping) {
          console.warn(`[QqOnebotPlugin] Disconnected (code=${code}), reconnecting in 5s...`)
          this.reconnectTimer = setTimeout(() => this.connectWs(), 5000)
        }
      })

      this.wsClient.on('error', (err: any) => {
        this.status = 'error'
        this.lastError = err.message
        console.error(`[QqOnebotPlugin] WS Error: ${err.message}`)
      })
    } catch (err: any) {
      this.status = 'error'
      this.lastError = err.message
    }
  }

  private async handleMessageEvent(event: any) {
    if (!this.runtime) return

    const isGroup = event.message_type === 'group'
    const userId = String(event.user_id)
    const groupId = isGroup ? String(event.group_id) : undefined
    const messageId = String(event.message_id)
    const rawMsg = event.raw_message || ''

    const isAtBot = rawMsg.includes(`[CQ:at,qq=${this.config.botQq}]`)
    const mentionsName = rawMsg.includes('凯伊') || rawMsg.includes('Key')
    const isOwner = userId === this.config.ownerQq

    // 过滤规则：私聊必回；群聊需要 @ 或 提到名字 或 主人召唤
    if (isGroup && !isAtBot && !mentionsName && !isOwner) {
      return
    }

    const cleanText = rawMsg.replace(/\[CQ:[^\]]+\]/g, '').trim() || '在吗'
    const targetId = isGroup ? `group_${groupId}` : `private_${userId}`
    const sessionId = `qq:${targetId}`

    const inbound: InboundMessage = {
      platform: 'qq',
      botId: this.config.botQq,
      tenantId: 'default',
      messageId: `qq_${messageId}`,
      sessionId,
      kind: isGroup ? 'group' : 'private',
      sender: {
        id: userId,
        nickname: event.sender?.card || event.sender?.nickname,
        role: isOwner ? 'owner' : 'member',
      },
      groupId,
      content: [{ type: 'text', text: cleanText }],
      timestamp: Date.now(),
      receivedAt: Date.now(),
    }

    await this.runtime.dispatchInbound(inbound)

    // 发送表情回馈 (👀)
    if (isGroup && event.message_id) {
      this.callApi('set_msg_emoji_like', { message_id: event.message_id, emoji_id: '8' }).catch(() => {})
    }

    // 监听本轮完成后的 final_reply
    let finalEmitted = false
    const unsubscribe = this.runtime.subscribeSession(sessionId, async (outEvent) => {
      if (outEvent.type === 'final_reply' && !finalEmitted) {
        finalEmitted = true
        unsubscribe()
        const text = outEvent.text || ''
        if (text) {
          await this.sendReply({ isGroup, id: isGroup ? groupId! : userId }, text, messageId)
        }
      }
    })

    // 超时兜底反注册
    setTimeout(() => unsubscribe(), 60000)

    // 驱动 Prompt
    await this.runtime.sendPrompt(sessionId, cleanText)
  }

  private async callApi(action: string, params: Record<string, unknown> = {}): Promise<any> {
    const url = `${this.config.httpUrl.replace(/\/+$/, '')}/${action}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.httpToken}`,
      },
      body: JSON.stringify(params),
    })
    return await res.json()
  }

  private async sendReply(target: { isGroup: boolean; id: string }, text: string, replyMessageId?: string) {
    const payload: Record<string, unknown> = {}
    if (target.isGroup) {
      payload.group_id = Number(target.id)
    } else {
      payload.user_id = Number(target.id)
    }

    if (replyMessageId) {
      payload.message = [
        { type: 'reply', data: { id: replyMessageId } },
        { type: 'text', data: { text } },
      ]
    } else {
      payload.message = text
    }

    const endpoint = target.isGroup ? 'send_group_msg' : 'send_private_msg'
    return await this.callApi(endpoint, payload)
  }
}
