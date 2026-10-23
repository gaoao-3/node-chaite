/**
 * 核心工作区安全工具集 (Workspace & Utility Tools)
 *
 * 提供基础的安全读写、目录探索与实用功能，作为 Agent 在 Web 控制台与会话中的底层能力。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Tool } from '../../types/tools'
import type { ChaiteContext } from '../../types/common'

export function createWorkspaceTools(allowedRoot = process.cwd()): Tool[] {
  const root = path.resolve(allowedRoot)

  function safePath(relPath: string): string {
    const resolved = path.resolve(root, relPath)
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`Access denied: path "${relPath}" escapes workspace directory`)
    }
    return resolved
  }

  const readFileTool: Tool = {
    name: 'read_workspace_file',
    type: 'function',
    function: {
      name: 'read_workspace_file',
      description: '读取工作区内的指定文件内容（限制最大 64KB）。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对工作区根目录的文件路径，例如 "package.json"' },
          maxLines: { type: 'number', description: '最大读取行数，默认 100 行' },
        },
        required: ['path'],
      },
    },
    async run(args: Record<string, unknown>) {
      const filePath = safePath(String(args['path']))
      const maxLines = Number(args['maxLines']) || 100

      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `File not found: ${args['path']}` })
      }

      const content = await fs.promises.readFile(filePath, 'utf8')
      const lines = content.split('\n')
      const truncated = lines.slice(0, maxLines).join('\n')

      return JSON.stringify({
        path: args['path'],
        totalLines: lines.length,
        linesReturned: Math.min(lines.length, maxLines),
        content: truncated,
        isTruncated: lines.length > maxLines,
      })
    },
  }

  const listFilesTool: Tool = {
    name: 'list_workspace_files',
    type: 'function',
    function: {
      name: 'list_workspace_files',
      description: '列出工作区内指定目录下的文件和子目录列表。',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: '相对工作区根目录的目录路径，默认 "."' },
        },
          required: [],
      },
    },
    async run(args: Record<string, unknown>) {
      const targetDir = safePath(String(args['dir'] || '.'))
      if (!fs.existsSync(targetDir)) {
        return JSON.stringify({ error: `Directory not found: ${args['dir']}` })
      }

      const entries = await fs.promises.readdir(targetDir, { withFileTypes: true })
      const list = entries.slice(0, 50).map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }))

      return JSON.stringify({
        dir: args['dir'] || '.',
        totalEntries: entries.length,
        items: list,
      })
    },
  }

  return [readFileTool, listFilesTool]
}
