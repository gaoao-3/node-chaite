/**
 * 多源 MCP 管理器 (Multi-MCP Manager)
 * 支持同时挂载多个外部 MCP 服务的工具，并抹平为标准 OpenAI Function Calling 格式
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export interface McpServerDef {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  cwd?: string
}

export interface UnifiedMcpTool {
  serverId: string
  name: string
  description?: string
  inputSchema: any
}

export class MultiMcpManager {
  private clients = new Map<string, { client: Client; transport: StdioClientTransport }>()
  private tools = new Map<string, UnifiedMcpTool>()

  async registerServer(def: McpServerDef): Promise<number> {
    try {
      const transport = new StdioClientTransport({
        command: def.command,
        args: def.args,
        env: Object.fromEntries(
          Object.entries({ ...process.env, ...(def.env || {}) }).filter(([_, v]) => typeof v === 'string')
        ) as Record<string, string>,
        cwd: def.cwd,
      })

      const client = new Client({ name: `chaite-${def.id}`, version: '1.0.0' }, { capabilities: {} })
      await client.connect(transport)
      this.clients.set(def.id, { client, transport })

      const toolsRes = await client.listTools()
      for (const t of toolsRes.tools) {
        this.tools.set(t.name, {
          serverId: def.id,
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })
      }
      return toolsRes.tools.length
    } catch (err: any) {
      console.error(`[MultiMcpManager] 挂载 MCP 服务 ${def.id} 失败:`, err.message)
      return 0
    }
  }

  getOpenAiTools(): any[] {
    return Array.from(this.tools.values()).map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema || { type: 'object', properties: {} },
      },
    }))
  }

  hasTool(name: string): boolean {
    return this.tools.has(name)
  }

  async callTool(name: string, args: Record<string, unknown>, timeoutMs = 25000): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`未找到 MCP 工具: ${name}`)

    const entry = this.clients.get(tool.serverId)
    if (!entry) throw new Error(`MCP 服务端 ${tool.serverId} 未就绪`)

    const callPromise = entry.client.callTool({ name, arguments: args })
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`MCP 工具 ${name} 执行超时 (${timeoutMs}ms)`)), timeoutMs)
    )

    const res: any = await Promise.race([callPromise, timeoutPromise])
    const contents = res.content || []
    return contents
      .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
      .join('\n')
      .trim() || JSON.stringify(res)
  }

  async closeAll() {
    for (const [id, entry] of this.clients.entries()) {
      try {
        await entry.transport.close()
      } catch {}
    }
    this.clients.clear()
    this.tools.clear()
  }
}
