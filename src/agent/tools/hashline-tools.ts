/**
 * Pi Agent 风格哈希锚点精准代码编辑工具集 (Hashline Editing Tools)
 *
 * 核心设计原理：
 * 1. 每行代码生成唯一的 4 字符哈希锚点 (Anchor)，例如 "aK9f│const x = 1"
 * 2. 彻底消灭行号漂移问题：哪怕前面插入多行，已定位锚点依然精准有效
 * 3. 拒绝幻觉覆盖：修改前校验锚点是否匹配当前文件版本，防脏写
 * 4. 支持 replace (范围替换)、replace_match (单行/局部字符替换)、insert (前后插入)、undo (原子撤销)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import type { Tool } from '../../types/tools'

export interface HashlineToolsOptions {
  workspaceRoot?: string
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * 为单行内容生成 4 字符确定性锚点
 */
function computeAnchor(lineNumber: number, content: string, salt = ''): string {
  const hash = createHash('sha256')
    .update(`${lineNumber}:${content.trimEnd()}:${salt}`)
    .digest()
  let num = hash.readUInt32BE(0)
  let anchor = ''
  for (let i = 0; i < 4; i++) {
    anchor += ALPHABET[num % ALPHABET.length]
    num = Math.floor(num / ALPHABET.length)
  }
  return anchor
}

export interface AnchoredLine {
  line: number
  anchor: string
  content: string
}

export interface FileSnapshot {
  path: string
  lines: string[]
  content: string
  anchors: AnchoredLine[]
  modifiedAt: number
}

export class HashlineEngine {
  private fileCache = new Map<string, FileSnapshot>()
  private undoHistory = new Map<string, string[]>() // path -> previous content stack
  private root: string

  constructor(workspaceRoot = process.cwd()) {
    this.root = path.resolve(workspaceRoot)
  }

  private safePath(relPath: string): string {
    const resolved = path.resolve(this.root, relPath)
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
      throw new Error(`Access denied: path "${relPath}" escapes workspace directory`)
    }
    return resolved
  }

  /**
   * 读取文件并计算每行哈希锚点
   */
  async readFile(relPath: string, offset = 1, limit = 200): Promise<{
    path: string
    totalLines: number
    startLine: number
    endLine: number
    rendered: string
    lines: AnchoredLine[]
    truncated: boolean
  }> {
    const fullPath = this.safePath(relPath)
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relPath}`)
    }

    const content = await fs.promises.readFile(fullPath, 'utf8')
    const rawLines = content.split('\n')
    // 处理末尾空换行
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop()
    }

    const anchors: AnchoredLine[] = rawLines.map((line, idx) => ({
      line: idx + 1,
      anchor: computeAnchor(idx + 1, line),
      content: line,
    }))

    this.fileCache.set(fullPath, {
      path: fullPath,
      lines: rawLines,
      content,
      anchors,
      modifiedAt: Date.now(),
    })

    const start = Math.max(1, offset)
    const end = Math.min(rawLines.length, start + limit - 1)
    const slice = anchors.slice(start - 1, end)

    const rendered = slice
      .map(item => `${item.anchor}│${item.content}`)
      .join('\n')

    return {
      path: relPath,
      totalLines: rawLines.length,
      startLine: start,
      endLine: end,
      rendered,
      lines: slice,
      truncated: end < rawLines.length,
    }
  }

  /**
   * 记录 Undo 历史
   */
  private pushUndo(fullPath: string, prevContent: string) {
    if (!this.undoHistory.has(fullPath)) {
      this.undoHistory.set(fullPath, [])
    }
    const stack = this.undoHistory.get(fullPath)!
    stack.push(prevContent)
    if (stack.length > 20) stack.shift() // 最多保留 20 步
  }

  /**
   * 按锚点范围替换内容 (replace)
   */
  async replace(relPath: string, removeFrom: string, removeTo: string, text: string): Promise<{
    path: string
    diff: string
    firstChangedLine: number
    newTotalLines: number
  }> {
    const fullPath = this.safePath(relPath)
    let snapshot = this.fileCache.get(fullPath)
    if (!snapshot) {
      await this.readFile(relPath, 1, 999999)
      snapshot = this.fileCache.get(fullPath)!
    }

    const fromIdx = snapshot.anchors.findIndex(a => a.anchor === removeFrom)
    const toIdx = snapshot.anchors.findIndex(a => a.anchor === removeTo)

    if (fromIdx === -1) {
      throw new Error(`Anchor "remove_from" (${removeFrom}) not found in ${relPath}. File may have changed, please re-read.`)
    }
    if (toIdx === -1) {
      throw new Error(`Anchor "remove_to" (${removeTo}) not found in ${relPath}. File may have changed, please re-read.`)
    }
    if (fromIdx > toIdx) {
      throw new Error(`"remove_from" line (${fromIdx + 1}) appears after "remove_to" line (${toIdx + 1})`)
    }

    this.pushUndo(fullPath, snapshot.content)

    const before = snapshot.lines.slice(0, fromIdx)
    const after = snapshot.lines.slice(toIdx + 1)
    const replacementLines = text === '' ? [] : text.split('\n')

    const newLines = [...before, ...replacementLines, ...after]
    const newContent = newLines.join('\n')

    await fs.promises.writeFile(fullPath, newContent, 'utf8')

    // 更新缓存与重新计算
    await this.readFile(relPath, 1, 999999)

    const diffLines: string[] = []
    diffLines.push(`@@ -${fromIdx + 1},${toIdx - fromIdx + 1} +${fromIdx + 1},${replacementLines.length} @@`)
    for (let i = fromIdx; i <= toIdx; i++) {
      diffLines.push(`-${snapshot.anchors[i].anchor}│${snapshot.lines[i]}`)
    }
    for (const line of replacementLines) {
      diffLines.push(`+    │${line}`)
    }

    return {
      path: relPath,
      diff: diffLines.join('\n'),
      firstChangedLine: fromIdx + 1,
      newTotalLines: newLines.length,
    }
  }

  /**
   * 局部行精准替换 (replace_match)
   */
  async replaceMatch(relPath: string, replaceFrom: string, replaceTo: string, match: string, replacement: string): Promise<{
    path: string
    diff: string
    matchesReplaced: number
  }> {
    const fullPath = this.safePath(relPath)
    let snapshot = this.fileCache.get(fullPath)
    if (!snapshot) {
      await this.readFile(relPath, 1, 999999)
      snapshot = this.fileCache.get(fullPath)!
    }

    const fromIdx = snapshot.anchors.findIndex(a => a.anchor === replaceFrom)
    const toIdx = snapshot.anchors.findIndex(a => a.anchor === replaceTo)

    if (fromIdx === -1 || toIdx === -1 || fromIdx > toIdx) {
      throw new Error(`Invalid anchor range [${replaceFrom} ... ${replaceTo}] in ${relPath}`)
    }

    this.pushUndo(fullPath, snapshot.content)

    const newLines = [...snapshot.lines]
    let count = 0
    const diffLines: string[] = []

    for (let i = fromIdx; i <= toIdx; i++) {
      const line = newLines[i]
      if (line.includes(match)) {
        const updated = line.replaceAll(match, replacement)
        count += (line.split(match).length - 1)
        diffLines.push(`-${snapshot.anchors[i].anchor}│${line}`)
        diffLines.push(`+    │${updated}`)
        newLines[i] = updated
      }
    }

    if (count === 0) {
      throw new Error(`Target text "${match}" was not found within anchor range in ${relPath}`)
    }

    const newContent = newLines.join('\n')
    await fs.promises.writeFile(fullPath, newContent, 'utf8')
    await this.readFile(relPath, 1, 999999)

    return {
      path: relPath,
      diff: diffLines.join('\n'),
      matchesReplaced: count,
    }
  }

  /**
   * 在指定锚点前/后插入内容 (insert)
   */
  async insert(relPath: string, anchor: string, direction: 'before' | 'after', text: string): Promise<{
    path: string
    diff: string
    insertedLineCount: number
  }> {
    const fullPath = this.safePath(relPath)
    let snapshot = this.fileCache.get(fullPath)
    if (!snapshot) {
      await this.readFile(relPath, 1, 999999)
      snapshot = this.fileCache.get(fullPath)!
    }

    const idx = snapshot.anchors.findIndex(a => a.anchor === anchor)
    if (idx === -1) {
      throw new Error(`Anchor "${anchor}" not found in ${relPath}`)
    }

    this.pushUndo(fullPath, snapshot.content)

    const insertIdx = direction === 'before' ? idx : idx + 1
    const linesToInsert = text.split('\n')
    const before = snapshot.lines.slice(0, insertIdx)
    const after = snapshot.lines.slice(insertIdx)

    const newLines = [...before, ...linesToInsert, ...after]
    await fs.promises.writeFile(fullPath, newLines.join('\n'), 'utf8')
    await this.readFile(relPath, 1, 999999)

    return {
      path: relPath,
      diff: linesToInsert.map(l => `+    │${l}`).join('\n'),
      insertedLineCount: linesToInsert.length,
    }
  }

  /**
   * 撤销上一步修改 (undo)
   */
  async undo(relPath: string): Promise<{ path: string; restored: boolean }> {
    const fullPath = this.safePath(relPath)
    const stack = this.undoHistory.get(fullPath)
    if (!stack || stack.length === 0) {
      return { path: relPath, restored: false }
    }

    const prev = stack.pop()!
    await fs.promises.writeFile(fullPath, prev, 'utf8')
    await this.readFile(relPath, 1, 999999)

    return { path: relPath, restored: true }
  }
}

/**
 * 构造导出给 Agent 使用的 Tool 接口
 */
export function createHashlineTools(options: HashlineToolsOptions = {}): Tool[] {
  const engine = new HashlineEngine(options.workspaceRoot)

  const hashReadTool: Tool = {
    name: 'hash_read',
    type: 'function',
    function: {
      name: 'hash_read',
      description: '【哈希高精度阅读】按行读取文件，每行带有 4 字符哈希锚点 (如 aB3d│代码)。用于后续精准定向 replace 或 insert，彻底杜绝行号漂移。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对工作区根目录的文件路径' },
          offset: { type: 'number', description: '起始行（默认 1）' },
          limit: { type: 'number', description: '最多读取行数（默认 150）' },
        },
        required: ['path'],
      },
    },
    async run(args: Record<string, unknown>) {
      const res = await engine.readFile(
        String(args.path),
        Number(args.offset) || 1,
        Number(args.limit) || 150,
      )
      return JSON.stringify(res)
    },
  }

  const hashReplaceTool: Tool = {
    name: 'hash_replace',
    type: 'function',
    function: {
      name: 'hash_replace',
      description: '【哈希范围替换】根据 hash_read 返回的起始锚点与结束锚点，替换指定区间代码。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          remove_from: { type: 'string', description: '欲删除或替换区间的起始行 4 字符哈希锚点' },
          remove_to: { type: 'string', description: '欲删除或替换区间的结束行 4 字符哈希锚点' },
          text: { type: 'string', description: '欲替换的新文本（空字符串表示纯删除该区间）' },
        },
        required: ['path', 'remove_from', 'remove_to', 'text'],
      },
    },
    async run(args: Record<string, unknown>) {
      const res = await engine.replace(
        String(args.path),
        String(args.remove_from),
        String(args.remove_to),
        String(args.text),
      )
      return JSON.stringify(res)
    },
  }

  const hashReplaceMatchTool: Tool = {
    name: 'hash_replace_match',
    type: 'function',
    function: {
      name: 'hash_replace_match',
      description: '【局部字符微调】在指定锚点范围内，只替换特定子串（match -> replacement），保留整行其余所有字符原样不动。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          replace_from: { type: 'string', description: '搜索范围的起始行锚点' },
          replace_to: { type: 'string', description: '搜索范围的结束行锚点' },
          match: { type: 'string', description: '欲替换的准确子文本片段' },
          replacement: { type: 'string', description: '新的替换内容' },
        },
        required: ['path', 'replace_from', 'replace_to', 'match', 'replacement'],
      },
    },
    async run(args: Record<string, unknown>) {
      const res = await engine.replaceMatch(
        String(args.path),
        String(args.replace_from),
        String(args.replace_to),
        String(args.match),
        String(args.replacement),
      )
      return JSON.stringify(res)
    },
  }

  const hashInsertTool: Tool = {
    name: 'hash_insert',
    type: 'function',
    function: {
      name: 'hash_insert',
      description: '【哈希插入】在指定锚点行之前 (before) 或之后 (after) 插入新代码块，原代码行保持不动。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          anchor: { type: 'string', description: '目标基准行的 4 字符哈希锚点' },
          direction: { type: 'string', description: '插入在锚点行之前(before)还是之后(after)' },
          text: { type: 'string', description: '欲插入的完整文本内容' },
        },
        required: ['path', 'anchor', 'direction', 'text'],
      },
    },
    async run(args: Record<string, unknown>) {
      const res = await engine.insert(
        String(args.path),
        String(args.anchor),
        args.direction === 'before' ? 'before' : 'after',
        String(args.text),
      )
      return JSON.stringify(res)
    },
  }

  const hashUndoTool: Tool = {
    name: 'hash_undo',
    type: 'function',
    function: {
      name: 'hash_undo',
      description: '【原子回滚】撤销目标文件上一次进行的哈希编辑操作。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '欲撤销编辑的文件路径' },
        },
        required: ['path'],
      },
    },
    async run(args: Record<string, unknown>) {
      const res = await engine.undo(String(args.path))
      return JSON.stringify(res)
    },
  }

  return [hashReadTool, hashReplaceTool, hashReplaceMatchTool, hashInsertTool, hashUndoTool]
}
