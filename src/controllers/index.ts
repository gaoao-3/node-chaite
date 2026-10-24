import express, { type Application } from 'express'
import AuthRouter from './auth'
import ChannelsRouter from './channels'
import ToolsRouter from './tools'
import ChatPresetRouter from './preset'
import StateRouter from './state'
import ConfigRouter from './config'
import ProcessorsRouter from './processors'
import OpenAIRouter from './openai'
import ToolGroupsRouter from './toolsGroup'
import TriggerRouter from './trigger'
import SystemRouter from './basic'
import AgentRouter from './agent'
import { getAgentWebApiRouter } from '../server/default-web-api'
import LogsRouter from './logs'
import cors from 'cors'
import { authenticateToken } from './middlewares'
import { getLogger } from '../utils'
import path from 'path'
import fs from 'node:fs'
import type { Server } from 'node:http'

export interface ApiServerOptions {
  /** Optional new frontend build (index.html + assets). Legacy panel is not used. */
  frontendDir?: string
}

export function createApp (configure?: (app: Application) => void, options: ApiServerOptions = {}): Application {
  const app = express()
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ limit: '50mb', extended: true }))
  app.use(cors())
  app.use('/api/system', SystemRouter)
  app.use('/api/auth', AuthRouter)
  app.use('/api/channels', authenticateToken, ChannelsRouter)
  app.use('/api/tools', authenticateToken, ToolsRouter)
  app.use('/api/preset', authenticateToken, ChatPresetRouter)
  app.use('/api/state', authenticateToken, StateRouter)
  app.use('/api/config', authenticateToken, ConfigRouter)
  app.use('/api/processors', authenticateToken, ProcessorsRouter)
  app.use('/api/triggers', authenticateToken, TriggerRouter)
  app.use('/api/toolGroups', authenticateToken, ToolGroupsRouter)
  // Modern session / SSE / Fusion / Evolution API. Mounted before the legacy
  // agent router so /api/agent/skills serves the richer web payload; requests
  // it does not handle fall through to the CRUD router below.
  app.use('/api/agent', authenticateToken, getAgentWebApiRouter())
  app.use('/api/agent', authenticateToken, AgentRouter)
  app.use('/api/logs', authenticateToken, LogsRouter)
  app.use('/v1', authenticateToken, OpenAIRouter)
  // 暴露标准 Prometheus / OpenMetrics 监控端点 (兼容 dsh-prometheus / Grafana)
  app.get('/metrics', async (_req, res) => {
    try {
      const { getPrometheusService } = await import('../agent/monitoring/prometheus')
      const prom = getPrometheusService()
      res.setHeader('Content-Type', prom.getContentType())
      res.send(await prom.getMetrics())
    } catch (err: any) {
      res.status(500).send(`Prometheus metrics error: ${err.message}`)
    }
  })
  configure?.(app)
  // The legacy NaiveUI management panel is intentionally not served by
  // default. A new frontend can opt in explicitly with options.frontendDir or
  // CHAITE_FRONTEND_DIR; otherwise only the headless API is exposed.
  const frontendDir = options.frontendDir ? path.resolve(options.frontendDir) : undefined
  const frontendEntry = frontendDir ? path.join(frontendDir, 'index.html') : undefined
  if (frontendDir && frontendEntry && fs.existsSync(frontendEntry)) {
    app.use(express.static(frontendDir))
    app.get('*', (_req, res) => {
      res.sendFile(frontendEntry)
    })
  }
  else {
    if (frontendDir) {
      getLogger().warn(`Chaite frontend not found at ${frontendDir}`)
    }
    app.get('*', (_req, res) => {
      res.status(404).json({ code: -1, data: null, message: 'No frontend is mounted. Use /api/agent.' })
    })
  }

  // 全局 JSON 错误处理中间件，严格杜绝向前端客户端泄露 HTML 默认错误页面 (<!DOCTYPE html>)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500
    const message = err.type === 'entity.too.large'
      ? '请求数据体积过大 (超过 50MB 上限)'
      : (err.message || '服务器处理异常')
    res.status(status).json({
      success: false,
      code: -1,
      message,
      error: {
        code: err.code || (err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR'),
        message,
      },
    })
  })
  return app
}

export function runServer (host: string, port: number, configure?: (app: Application) => void, options: ApiServerOptions = {}): { app: Application, server: Server } {
  const app = createApp(configure, options)
  const server = app.listen(port, host, () => {
    getLogger().info(`Chaite server is running at http://${host}:${port}`)
  })
  return { app, server }
}
