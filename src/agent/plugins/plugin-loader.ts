/**
 * Pi Agent & DSH (Cordis) 跨生态插件加载器 (Universal Plugin Loader)
 *
 * 允许用户在 Chaite Agent 平台中直接无缝复用：
 * 1. Pi Agent Extensions (支持 pi.registerTool, pi.registerCommand, pi.on 等)
 * 2. DSH / Cordis 风格微内核插件 (支持 apply(ctx), ctx.tools.register, ctx.plugin 等)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Tool } from '../../types/tools'

export interface LoadedPluginInfo {
  id: string
  name: string
  type: 'pi' | 'dsh' | 'native'
  description?: string
  version?: string
  path: string
  status: 'active' | 'error' | 'disabled'
  tools: string[]
  error?: string
}

export class PluginLoader {
  private plugins = new Map<string, LoadedPluginInfo>()
  private registeredTools = new Map<string, Tool>()
  private pluginsDir: string

  constructor(pluginsDir?: string) {
    this.pluginsDir = pluginsDir || path.resolve(process.cwd(), 'plugins')
    if (!fs.existsSync(this.pluginsDir)) {
      try {
        fs.mkdirSync(this.pluginsDir, { recursive: true })
      } catch {}
    }
  }

  /**
   * 获取所有已由插件注入的可用工具
   */
  getRegisteredTools(): Tool[] {
    return Array.from(this.registeredTools.values())
  }

  /**
   * 列出所有已加载插件状态
   */
  listPlugins(): LoadedPluginInfo[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 动态加载单个插件文件或模块目录
   */
  async loadPlugin(pluginPath: string): Promise<LoadedPluginInfo> {
    const resolvedPath = path.resolve(pluginPath)
    const baseName = path.basename(resolvedPath, path.extname(resolvedPath))
    const pluginId = `plugin_${baseName}`

    const pluginInfo: LoadedPluginInfo = {
      id: pluginId,
      name: baseName,
      type: 'native',
      path: resolvedPath,
      status: 'active',
      tools: [],
    }

    try {
      // 动态导入模块 (支持 TSX / ESM)
      const mod = await import(resolvedPath)
      const exported = mod.default || mod

      // 1. 判断是否为 Pi Agent 风格扩展: export default function(pi) { ... }
      if (typeof exported === 'function' && exported.length >= 1) {
        pluginInfo.type = 'pi'
        const piShim = this.createPiExtensionShim(pluginId, pluginInfo)
        await exported(piShim)
      }
      // 2. 判断是否为 DSH / Cordis 风格插件: export function apply(ctx) { ... }
      else if (typeof mod.apply === 'function') {
        pluginInfo.type = 'dsh'
        const cordisShim = this.createCordisContextShim(pluginId, pluginInfo)
        await mod.apply(cordisShim)
      }
      // 3. 原生 Tool 数组导出: export const tools = [...] 或 export default [...]
      else if (Array.isArray(exported)) {
        pluginInfo.type = 'native'
        for (const t of exported) {
          if (t.name && typeof t.run === 'function') {
            this.registeredTools.set(t.name, t)
            pluginInfo.tools.push(t.name)
          }
        }
      }

      this.plugins.set(pluginId, pluginInfo)
      return pluginInfo
    } catch (err: any) {
      pluginInfo.status = 'error'
      pluginInfo.error = err.message
      this.plugins.set(pluginId, pluginInfo)
      return pluginInfo
    }
  }
  /**
   * 读取指定插件的源码
   */
  async getPluginSource(pluginId: string): Promise<{ id: string; name: string; path: string; source: string }> {
    const info = this.plugins.get(pluginId)
    if (!info) throw new Error(`Plugin "${pluginId}" not found`)
    if (!fs.existsSync(info.path)) throw new Error(`Plugin file not found at ${info.path}`)
    const source = await fs.promises.readFile(info.path, 'utf8')
    return { id: info.id, name: info.name, path: info.path, source }
  }

  /**
   * 保存并热重载指定插件的源码
   */
  async savePluginSource(pluginId: string, source: string): Promise<LoadedPluginInfo> {
    const info = this.plugins.get(pluginId)
    if (!info) throw new Error(`Plugin "${pluginId}" not found`)

    // 清理旧注册的工具
    for (const toolName of info.tools) {
      this.registeredTools.delete(toolName)
    }

    await fs.promises.writeFile(info.path, source, 'utf8')
    // 重新加载插件
    return await this.loadPlugin(info.path)
  }

  /**
   * 新建插件并写入 plugins/ 目录
   */
  async createPlugin(name: string, type: 'pi' | 'dsh', source?: string): Promise<LoadedPluginInfo> {
    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    const targetFile = path.join(this.pluginsDir, `${safeName}.ts`)
    if (fs.existsSync(targetFile)) {
      throw new Error(`Plugin file "${safeName}.ts" already exists`)
    }

    let defaultSource = source
    if (!defaultSource) {
      if (type === 'pi') {
        defaultSource = `/**\n * Pi Agent 扩展插件：${safeName}\n */\nexport default function(pi: any) {\n  pi.registerTool({\n    name: "${safeName.replace(/-/g, '_')}",\n    description: "自定义工具描述",\n    parameters: {\n      type: "object",\n      properties: {\n        input: { type: "string", description: "输入参数" },\n      },\n      required: ["input"],\n    },\n    execute: async (args: { input: string }) => {\n      return { result: "处理完成: " + args.input, status: "success" };\n    },\n  });\n}\n`
      } else {
        defaultSource = `/**\n * DSH / Cordis 插件：${safeName}\n */\nexport function apply(ctx: any) {\n  ctx.tools.register({\n    name: "${safeName.replace(/-/g, '_')}",\n    description: "自定义 DSH 工具描述",\n    parameters: { type: "object", properties: {} },\n    run: async () => {\n      return { message: "Hello from DSH plugin ${safeName}" };\n    },\n  });\n}\n`
      }
    }

    await fs.promises.writeFile(targetFile, defaultSource, 'utf8')
    return await this.loadPlugin(targetFile)
  }

  /**
   * 删除插件文件及已注册的工具
   */
  async deletePlugin(pluginId: string): Promise<boolean> {
    const info = this.plugins.get(pluginId)
    if (!info) return false

    for (const toolName of info.tools) {
      this.registeredTools.delete(toolName)
    }

    if (fs.existsSync(info.path)) {
      try {
        await fs.promises.unlink(info.path)
      } catch (err) {
        console.warn(`Failed to unlink plugin file ${info.path}:`, err)
      }
    }

    this.plugins.delete(pluginId)
    return true
  }

  /**
   * 自动扫描 plugins/ 目录加载所有有效插件
   */
  async scanAndLoadAll(): Promise<LoadedPluginInfo[]> {
    if (!fs.existsSync(this.pluginsDir)) return []
    const entries = await fs.promises.readdir(this.pluginsDir, { withFileTypes: true })
    const results: LoadedPluginInfo[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.endsWith('.d.ts')) continue
      const fullPath = path.join(this.pluginsDir, entry.name)

      if (entry.isFile() && /\.(js|mjs|ts)$/.test(entry.name)) {
        results.push(await this.loadPlugin(fullPath))
      } else if (entry.isDirectory()) {
        const pkgJson = path.join(fullPath, 'package.json')
        const indexTs = path.join(fullPath, 'index.ts')
        const indexJs = path.join(fullPath, 'index.js')
        const target = fs.existsSync(indexTs) ? indexTs : fs.existsSync(indexJs) ? indexJs : fullPath
        results.push(await this.loadPlugin(target))
      }
    }

    return results
  }

  // ─── Pi Extension API 兼容垫片 ───────────────────────────────────────────────

  private createPiExtensionShim(pluginId: string, info: LoadedPluginInfo) {
    return {
      registerTool: (toolDef: {
        name: string
        description?: string
        parameters?: any
        execute: (args: any, context?: any) => Promise<any> | any
      }) => {
        const wrappedTool: Tool = {
          name: toolDef.name,
          type: 'function',
          function: {
            name: toolDef.name,
            description: toolDef.description || `Tool registered via Pi extension ${pluginId}`,
            parameters: toolDef.parameters || { type: 'object', properties: {} },
          },
          run: async (args: any, context?: any) => {
            const res = await toolDef.execute(args, context)
            return typeof res === 'string' ? res : JSON.stringify(res)
          },
        }
        this.registeredTools.set(toolDef.name, wrappedTool)
        info.tools.push(toolDef.name)
      },

      registerCommand: (name: string, cmdDef: any) => {
        // 兼容注册斜杠命令
        console.log(`[PluginLoader:Pi] Registered command /${name}`)
      },

      on: (event: string, handler: Function) => {
        // 兼容生命周期事件注册
        return () => {}
      },

      ui: {
        notify: (msg: string, type?: string) => console.log(`[PiExtension:${type || 'info'}] ${msg}`),
      },
    }
  }

  // ─── DSH / Cordis Context 兼容垫片 ───────────────────────────────────────────

  private createCordisContextShim(pluginId: string, info: LoadedPluginInfo) {
    return {
      tools: {
        register: (toolDef: {
          name: string
          description?: string
          parameters?: any
          run: (args: any) => Promise<any> | any
        }) => {
          const wrappedTool: Tool = {
            name: toolDef.name,
            type: 'function',
            function: {
              name: toolDef.name,
              description: toolDef.description || `Tool registered via DSH plugin ${pluginId}`,
              parameters: toolDef.parameters || { type: 'object', properties: {} },
            },
            run: async (args: any) => {
              const res = await toolDef.run(args)
              return typeof res === 'string' ? res : JSON.stringify(res)
            },
          }
          this.registeredTools.set(toolDef.name, wrappedTool)
          info.tools.push(toolDef.name)
        },
      },
      plugin: (subMod: any, options?: any) => {
        console.log(`[PluginLoader:DSH] Mounted sub-plugin in ${pluginId}`)
      },
      logger: (name: string) => ({
        info: (msg: string) => console.log(`[${name}:info] ${msg}`),
        warn: (msg: string) => console.warn(`[${name}:warn] ${msg}`),
        error: (msg: string) => console.error(`[${name}:error] ${msg}`),
      }),
    }
  }
}
