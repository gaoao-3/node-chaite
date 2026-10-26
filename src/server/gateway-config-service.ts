/**
 * 网关适配器配置与安全凭证管理服务 (Gateway Config Service)
 *
 * 特性：
 * 1. 本地 JSON 持久化配置到 data/storage/gateways.json
 * 2. 对外 API 严格脱敏：Token 等密钥只回传 apiKeyConfigured 布尔标志，绝不向前端明文回显
 * 3. 支持连通性探测 (WebSocket 与 HTTP Health 探针)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import WebSocket from 'ws'
import type { QqOnebotConfig } from '../gateway/plugins/qq-onebot'

export interface GatewayConfigRecord {
  id: string
  name: string
  platform: 'qq' | 'dsh' | 'web'
  enabled: boolean
  settings: Record<string, unknown>
  updatedAt: number
}

export type PublicGatewayConfigRecord = Omit<GatewayConfigRecord, 'settings'> & {
  settings: Record<string, unknown>
  credentials: {
    wsTokenConfigured: boolean
    httpTokenConfigured: boolean
  }
}

function sanitizeSettings(id: string, settings: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...settings }
  delete copy.wsToken
  delete copy.httpToken
  return copy
}

export class GatewayConfigService {
  private configs = new Map<string, GatewayConfigRecord>()
  private loaded = false
  private readonly filePath: string

  constructor(filePath?: string) {
    this.filePath = path.resolve(filePath || path.join(process.cwd(), 'data/storage/gateways.json'))
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf8')
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item && item.id) {
              this.configs.set(item.id, item)
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[GatewayConfigService] Failed to load configs:', err.message)
    } finally {
      this.loaded = true
    }
  }

  private async persist(): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    const data = Array.from(this.configs.values())
    await fs.promises.writeFile(temp, JSON.stringify(data, null, 2), 'utf8')
    await fs.promises.rename(temp, this.filePath)
  }

  /**
   * 获取安全脱敏后的网关配置
   */
  async getPublicConfig(id: string): Promise<PublicGatewayConfigRecord | null> {
    await this.ensureLoaded()
    const record = this.configs.get(id)
    if (!record) return null
    return {
      ...record,
      settings: sanitizeSettings(id, record.settings),
      credentials: {
        wsTokenConfigured: Boolean(record.settings.wsToken),
        httpTokenConfigured: Boolean(record.settings.httpToken),
      },
    }
  }

  async getAllPublicConfigs(): Promise<PublicGatewayConfigRecord[]> {
    await this.ensureLoaded()
    return Promise.all(Array.from(this.configs.keys()).map(id => this.getPublicConfig(id))) as Promise<PublicGatewayConfigRecord[]>
  }

  /**
   * 读取原始配置（供内部网关初始化使用，包含完整密钥）
   */
  async getRawConfig(id: string): Promise<QqOnebotConfig | null> {
    await this.ensureLoaded()
    const record = this.configs.get(id)
    if (!record) return null
    return record.settings as unknown as QqOnebotConfig
  }

  /**
   * 更新网关配置 (留空 token 表示保持原有密钥不变)
   */
  async updateConfig(id: string, input: Partial<GatewayConfigRecord>): Promise<PublicGatewayConfigRecord> {
    await this.ensureLoaded()
    const current = this.configs.get(id)
    const oldSettings = current?.settings || {}

    const newSettings = { ...oldSettings }
    if (input.settings) {
      for (const [k, v] of Object.entries(input.settings)) {
        if (k === 'wsToken' || k === 'httpToken') {
          // 如果新传入值非空字符串，则更新；为空/undefined 则保持旧值
          if (typeof v === 'string' && v.trim()) {
            newSettings[k] = v.trim()
          }
        } else {
          newSettings[k] = v
        }
      }
    }

    const record: GatewayConfigRecord = {
      id,
      name: input.name?.trim() || current?.name || (id === 'qq-onebot' ? 'QQ OneBot v11' : id),
      platform: input.platform || current?.platform || (id === 'qq-onebot' ? 'qq' : 'dsh'),
      enabled: input.enabled !== undefined ? input.enabled : (current?.enabled ?? true),
      settings: newSettings,
      updatedAt: Date.now(),
    }

    this.configs.set(id, record)
    await this.persist()
    return (await this.getPublicConfig(id)) as PublicGatewayConfigRecord
  }

  /**
   * 探测网关连通性（支持 QQ OneBot WS + HTTP API 双通道健康检查）
   */
  async testConnectivity(id: string): Promise<{
    success: boolean
    wsReachable?: boolean
    httpReachable?: boolean
    botNickname?: string
    error?: string
  }> {
    const config = await this.getRawConfig(id)
    if (!config && id === 'qq-onebot') {
      // Fallback to default config if no persisted config exists
      return this.testQqDefaultConnectivity()
    }
    if (id === 'qq-onebot') {
      const wsUrl = config?.wsUrl || 'ws://127.0.0.1:3001'
      const httpUrl = config?.httpUrl || 'http://127.0.0.1:3004'
      const wsToken = config?.wsToken || ''
      const httpToken = config?.httpToken || ''

      let wsReachable = false
      let httpReachable = false
      let botNickname = ''
      let errorMsg = ''

      // 1. WS Reachability Probe (2.5s timeout)
      const wsProbe = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('WebSocket connection timeout (2.5s)'))
        }, 2500)

        try {
          const ws = new WebSocket(wsUrl, {
            headers: wsToken ? { Authorization: `Bearer ${wsToken}` } : {},
          })

          ws.on('open', () => {
            clearTimeout(timer)
            ws.close()
            resolve()
          })
          ws.on('error', (err) => {
            clearTimeout(timer)
            reject(err)
          })
        } catch (err) {
          clearTimeout(timer)
          reject(err)
        }
      })

      try {
        await wsProbe
        wsReachable = true
      } catch (err: any) {
        errorMsg = `WS: ${err.message}`
      }

      // 2. HTTP API Health Probe
      try {
        const res = await fetch(`${httpUrl.replace(/\/+$/, '')}/get_login_info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(httpToken ? { Authorization: `Bearer ${httpToken}` } : {}),
          },
          signal: AbortSignal.timeout(2000),
        })
        if (res.ok) {
          httpReachable = true
          const data = await res.json() as any
          if (data?.data?.nickname) {
            botNickname = data.data.nickname
          }
        } else {
          errorMsg += ` | HTTP: status ${res.status}`
        }
      } catch (err: any) {
        errorMsg += ` | HTTP: ${err.message}`
      }

      return {
        success: wsReachable || httpReachable,
        wsReachable,
        httpReachable,
        botNickname,
        error: !wsReachable || !httpReachable ? errorMsg.trim().replace(/^\|/, '') : undefined,
      }
    }

    // Other gateway types
    return { success: true }
  }

  private async testQqDefaultConnectivity(): Promise<{ success: boolean; wsReachable: boolean; httpReachable: boolean; botNickname?: string; error?: string }> {
    // Default fallback using hardcoded local ports if none configured yet
    return {
      success: false,
      wsReachable: false,
      httpReachable: false,
      error: '未配置网关参数，请先保存 WebSocket 与 HTTP 地址及 Token',
    }
  }
}
