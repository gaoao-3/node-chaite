/**
 * 受控工作区服务 (Workspace Service)
 *
 * 为 Pi Web 风格的文件树、源码查看/编辑和终端面板提供后端能力。
 * - 所有文件和终端路径均限制在工作区根目录内，拒绝符号链接逃逸。
 * - 终端是受控单次命令执行，不是持久 PTY；高危命令只返回审批需求，不执行。
 * - 默认排除依赖、构建产物、日志和会话数据，避免把敏感文件暴露到浏览器。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { exec } from 'node:child_process'
import { BadRequestError } from './errors'
import { isHighRiskCommand } from '../agent/tools/coding-tools'

const TEXT_LIMIT = 512 * 1024
const IMAGE_LIMIT = 3 * 1024 * 1024
const OUTPUT_LIMIT = 12_000
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', '.turbo', 'data', 'logs'])
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
}
const LANGUAGES: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.mjs': 'javascript', '.cjs': 'javascript', '.json': 'json', '.md': 'markdown',
  '.css': 'css', '.html': 'html', '.vue': 'vue', '.py': 'python', '.sh': 'bash',
  '.yml': 'yaml', '.yaml': 'yaml', '.sql': 'sql', '.rs': 'rust', '.go': 'go',
}

export interface WorkspaceEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modifiedAt: number
}

export interface WorkspaceFileResult {
  path: string
  content: string
  language: string
  size: number
  truncated: boolean
  readOnly: boolean
  dataUrl?: string
  mimeType?: string
}

export interface WorkspaceTerminalResult {
  command: string
  cwd: string
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  approvalRequired?: boolean
}

function clipped(value: string): string {
  return value.length > OUTPUT_LIMIT ? `${value.slice(0, OUTPUT_LIMIT)}\n… output truncated …` : value
}

export class WorkspaceService {
  readonly root: string

  constructor(root = process.cwd()) {
    this.root = fs.realpathSync(root)
  }

  private safePath(relativePath = '.'): string {
    if (typeof relativePath !== 'string' || relativePath.includes('\0')) {
      throw new BadRequestError('Invalid workspace path')
    }
    const normalized = relativePath.replace(/\\/g, '/') || '.'
    const target = path.resolve(this.root, normalized)
    if (target !== this.root && !target.startsWith(`${this.root}${path.sep}`)) {
      throw new BadRequestError('Workspace path escapes the allowed root')
    }

    // Resolve the closest existing ancestor to reject symlink escapes, including
    // paths whose final file has not been created yet.
    let ancestor = target
    while (!fs.existsSync(ancestor) && ancestor !== this.root) {
      ancestor = path.dirname(ancestor)
    }
    const realAncestor = fs.realpathSync(ancestor)
    if (realAncestor !== this.root && !realAncestor.startsWith(`${this.root}${path.sep}`)) {
      throw new BadRequestError('Workspace symbolic links are not allowed')
    }
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
      throw new BadRequestError('Workspace symbolic links are not allowed')
    }
    return target
  }

  private relative(target: string): string {
    return path.relative(this.root, target).replace(/\\/g, '/') || '.'
  }

  private isProtected(target: string): boolean {
    const relative = this.relative(target)
    const parts = relative.split('/')
    return parts.some(part => IGNORED_DIRECTORIES.has(part))
      || /^\.env(?:\.|$)/i.test(path.basename(target))
      || /\.(?:pem|key|p12|pfx|log)$/i.test(target)
  }

  async list(relativePath = '.', includeHidden = false): Promise<{ path: string; entries: WorkspaceEntry[] }> {
    const directory = this.safePath(relativePath)
    if (this.isProtected(directory) && directory !== this.root) {
      throw new BadRequestError('This workspace directory is private')
    }
    const stat = await fs.promises.stat(directory)
    if (!stat.isDirectory()) throw new BadRequestError('Workspace path is not a directory')

    const entries = await fs.promises.readdir(directory, { withFileTypes: true })
    const result: WorkspaceEntry[] = []
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      if (!includeHidden && entry.name.startsWith('.')) continue
      if (IGNORED_DIRECTORIES.has(entry.name) || /^\.env(?:\.|$)/i.test(entry.name) || /\.log$/i.test(entry.name)) continue
      const fullPath = path.join(directory, entry.name)
      if (this.isProtected(fullPath)) continue
      try {
        const stat = await fs.promises.stat(fullPath)
        result.push({
          name: entry.name,
          path: this.relative(fullPath),
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stat.size,
          modifiedAt: stat.mtimeMs,
        })
      } catch {
        // A file can disappear between readdir and stat; omit that entry.
      }
    }
    result.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1)
    return { path: this.relative(directory), entries: result.slice(0, 250) }
  }

  async readFile(relativePath: string): Promise<WorkspaceFileResult> {
    const filePath = this.safePath(relativePath)
    if (this.isProtected(filePath)) throw new BadRequestError('This file is private')
    const stat = await fs.promises.stat(filePath)
    if (!stat.isFile()) throw new BadRequestError('Workspace path is not a file')
    const extension = path.extname(filePath).toLowerCase()
    const mimeType = IMAGE_MIME[extension]

    if (mimeType) {
      if (stat.size > IMAGE_LIMIT) throw new BadRequestError('Image is too large for inline preview')
      const buffer = await fs.promises.readFile(filePath)
      return {
        path: this.relative(filePath), content: '', language: 'image', size: stat.size,
        truncated: false, readOnly: true, mimeType,
        dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
      }
    }

    const raw = await fs.promises.readFile(filePath, 'utf8')
    const truncated = raw.length > TEXT_LIMIT
    return {
      path: this.relative(filePath),
      content: truncated ? raw.slice(0, TEXT_LIMIT) : raw,
      language: LANGUAGES[extension] || 'text',
      size: stat.size,
      truncated,
      readOnly: false,
    }
  }

  async writeFile(relativePath: string, content: string): Promise<{ path: string; bytes: number }> {
    if (typeof content !== 'string') throw new BadRequestError('File content must be a string')
    if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) throw new BadRequestError('File content exceeds 1 MiB')
    const filePath = this.safePath(relativePath)
    if (this.isProtected(filePath)) throw new BadRequestError('This file is private')
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) throw new BadRequestError('Cannot overwrite a directory')
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, content, 'utf8')
    return { path: this.relative(filePath), bytes: Buffer.byteLength(content, 'utf8') }
  }

  async runTerminal(command: string, relativeCwd = '.', timeoutSeconds = 30): Promise<WorkspaceTerminalResult> {
    if (typeof command !== 'string' || !command.trim()) throw new BadRequestError('Command is required')
    if (command.length > 4000) throw new BadRequestError('Command is too long')
    const cwd = this.safePath(relativeCwd)
    if (this.isProtected(cwd)) throw new BadRequestError('This working directory is private')
    if (!fs.statSync(cwd).isDirectory()) throw new BadRequestError('Working directory is not a directory')
    const trimmed = command.trim()

    if (isHighRiskCommand(trimmed)) {
      return { command, cwd: this.relative(cwd), stdout: '', stderr: '高危命令已拦截，需要人工审批后才能执行。', exitCode: 126, durationMs: 0, approvalRequired: true }
    }

    // `cd` is handled by the service so the next command retains the selected cwd.
    const cdMatch = trimmed.match(/^cd(?:\s+(.+))?$/s)
    if (cdMatch) {
      const argument = (cdMatch[1] || '.').trim().replace(/^['"]|['"]$/g, '')
      const next = this.safePath(argument.startsWith('/') ? path.relative(this.root, argument) : path.join(this.relative(cwd), argument))
      if (!fs.statSync(next).isDirectory()) throw new BadRequestError('Target directory does not exist')
      if (this.isProtected(next)) throw new BadRequestError('This working directory is private')
      return { command, cwd: this.relative(next), stdout: '', stderr: '', exitCode: 0, durationMs: 0 }
    }

    const timeout = Math.min(120, Math.max(1, timeoutSeconds)) * 1000
    const startedAt = Date.now()
    return new Promise(resolve => {
      exec(trimmed, { cwd, timeout, maxBuffer: 512 * 1024, windowsHide: true }, (error, stdout, stderr) => {
        const exitCode = error && typeof error.code === 'number' ? error.code : error ? 1 : 0
        resolve({
          command,
          cwd: this.relative(cwd),
          stdout: clipped(stdout || ''),
          stderr: clipped(stderr || (error && exitCode !== 0 ? error.message : '')),
          exitCode,
          durationMs: Date.now() - startedAt,
        })
      })
    })
  }
}
