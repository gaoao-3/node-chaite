/**
 * 一等公民编程与系统工具集 (First-Class Coding & Engineering Tools)
 *
 * 为 Agent 提供真实、强大的代码工程与执行能力：
 * 1. read_file: 读取指定文件内容（带行号与分片）
 * 2. write_file: 写入/创建文件（自动创建父目录）
 * 3. edit_file: 精确字符串或区块替换编辑
 * 4. exec_bash: 安全执行终端命令（带超时熔断与高危行为检测）
 * 5. web_search: 全网实时搜索引擎检索
 * 6. delegate_fusion_task: 委派副手 (Sidekick) 执行子任务并产出 Diff 交叉审查
 * 7. load_skill_sop: 渐进式加载领域 SOP 规范
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { exec, spawn } from 'node:child_process'
import type { Tool } from '../../types/tools'
import type { FusionTaskService } from '../../server/fusion-service'
import { FusionRunner } from '../../server/fusion-runner'

export interface CodingToolsOptions {
  workspaceRoot?: string
  fusionService?: FusionTaskService
  proxyUrl?: string
  requireApprovalForBash?: (command: string) => boolean
}

// 高危命令特征检测
const HIGH_RISK_PATTERNS = [
  /\brm\s+-[rf]{1,2}\s+[\/*]/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b(shutdown|reboot|poweroff|init\s+0)\b/i,
  /\bchmod\s+-[R\s]*777\s+[\/]/i,
  /\b(drop\s+database|truncate\s+table)\b/i,
  />\s*\/dev\/sd[a-z]/i,
]

export function isHighRiskCommand(cmd: string): boolean {
  return HIGH_RISK_PATTERNS.some(p => p.test(cmd))
}

export function createCodingTools(options: CodingToolsOptions = {}): Tool[] {
  const root = path.resolve(options.workspaceRoot || process.cwd())
  const proxy = options.proxyUrl || process.env.https_proxy || process.env.http_proxy || 'http://127.0.0.1:7890'

  function safePath(relPath: string): string {
    const resolved = path.resolve(root, relPath)
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`Access denied: path "${relPath}" escapes workspace directory`)
    }
    return resolved
  }

  // 1. read_file
  const readFileTool: Tool = {
    name: 'read_file',
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取工作区内的代码或文本文件内容，支持行号、起始行与读取条数限制。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对工作区根目录的文件路径，例如 "src/index.ts"' },
          offset: { type: 'number', description: '起始行号（从 1 开始，默认 1）' },
          limit: { type: 'number', description: '最多读取行数（默认 200 行）' },
        },
        required: ['path'],
      },
    },
    async run(args: Record<string, unknown>) {
      const filePath = safePath(String(args['path']))
      const offset = Math.max(1, Number(args['offset']) || 1)
      const limit = Math.max(1, Number(args['limit']) || 200)

      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `File not found: ${args['path']}` })
      }

      const stat = await fs.promises.stat(filePath)
      if (stat.isDirectory()) {
        return JSON.stringify({ error: `Path "${args['path']}" is a directory, use list_files instead` })
      }

      const content = await fs.promises.readFile(filePath, 'utf8')
      const allLines = content.split('\n')
      const slice = allLines.slice(offset - 1, offset - 1 + limit)

      const numbered = slice.map((line, idx) => `${offset + idx} | ${line}`).join('\n')

      return JSON.stringify({
        path: args['path'],
        totalLines: allLines.length,
        startLine: offset,
        endLine: Math.min(allLines.length, offset + slice.length - 1),
        content: numbered,
        truncated: offset - 1 + limit < allLines.length,
      })
    },
  }

  // 2. write_file
  const writeFileTool: Tool = {
    name: 'write_file',
    type: 'function',
    function: {
      name: 'write_file',
      description: '向工作区写入文件。若目标文件或父目录不存在，将自动递归创建。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对工作区根目录的文件路径' },
          content: { type: 'string', description: '欲写入的完整文本内容' },
        },
        required: ['path', 'content'],
      },
    },
    async run(args: Record<string, unknown>) {
      const filePath = safePath(String(args['path']))
      const content = String(args['content'] ?? '')

      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
      await fs.promises.writeFile(filePath, content, 'utf8')

      return JSON.stringify({
        path: args['path'],
        bytesWritten: Buffer.byteLength(content, 'utf8'),
        linesWritten: content.split('\n').length,
        status: 'success',
      })
    },
  }

  // 3. edit_file
  const editFileTool: Tool = {
    name: 'edit_file',
    type: 'function',
    function: {
      name: 'edit_file',
      description: '对工作区指定文件进行精确替换编辑（以原文件中的唯一子串进行替换）。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对工作区根目录的文件路径' },
          find: { type: 'string', description: '原文件中必须存在且唯一的文本段落' },
          replace: { type: 'string', description: '欲替换的新文本段落' },
        },
        required: ['path', 'find', 'replace'],
      },
    },
    async run(args: Record<string, unknown>) {
      const filePath = safePath(String(args['path']))
      const findText = String(args['find'] ?? '')
      const replaceText = String(args['replace'] ?? '')

      if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `File not found: ${args['path']}` })
      }

      const content = await fs.promises.readFile(filePath, 'utf8')
      const count = content.split(findText).length - 1

      if (count === 0) {
        return JSON.stringify({
          error: `The string to find was not found in ${args['path']}. Please verify the exact text with read_file first.`,
        })
      }

      if (count > 1) {
        return JSON.stringify({
          error: `The string to find appears ${count} times in ${args['path']}. Please provide more surrounding context to make it unique.`,
        })
      }

      const updated = content.replace(findText, replaceText)
      await fs.promises.writeFile(filePath, updated, 'utf8')

      return JSON.stringify({
        path: args['path'],
        status: 'success',
        replacedOccurrences: 1,
      })
    },
  }

  // 4. exec_bash
  const execBashTool: Tool = {
    name: 'exec_bash',
    type: 'function',
    function: {
      name: 'exec_bash',
      description: '在工作区环境下执行 Shell / Bash 脚本命令。具有超时控制与安全检测机制。',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: '欲执行的 shell 命令' },
          timeout: { type: 'number', description: '超时秒数（默认 30 秒）' },
          cwd: { type: 'string', description: '可选子目录（相对工作区根目录）' },
        },
        required: ['command'],
      },
    },
    async run(args: Record<string, unknown>) {
      const command = String(args['command'] || '').trim()
      const timeoutSec = Math.min(120, Math.max(1, Number(args['timeout']) || 30))
      const workingDir = args['cwd'] ? safePath(String(args['cwd'])) : root

      // 高危拦截检测
      if (isHighRiskCommand(command)) {
        return JSON.stringify({
          status: 'approval_required',
          riskLevel: 'critical',
          warning: `Command "${command}" triggered safety guardrails: contains destructive operation pattern.`,
          command,
        })
      }

      return new Promise<string>((resolve) => {
        exec(command, { cwd: workingDir, timeout: timeoutSec * 1000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) {
            resolve(JSON.stringify({
              command,
              exitCode: err.code ?? 1,
              error: err.message,
              stdout: stdout?.slice(0, 3000),
              stderr: stderr?.slice(0, 3000),
            }))
            return
          }
          resolve(JSON.stringify({
            command,
            exitCode: 0,
            stdout: stdout?.slice(0, 4000) || '(no stdout output)',
            stderr: stderr?.slice(0, 1000) || undefined,
          }))
        })
      })
    },
  }

  // 5. web_search
  const webSearchTool: Tool = {
    name: 'web_search',
    type: 'function',
    function: {
      name: 'web_search',
      description: '通过互联网搜索引擎进行实时检索，获取最新的技术文档、开源资讯、实时新闻与解决方案。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词或问题' },
          numResults: { type: 'number', description: '返回结果数量（1~5，默认 3）' },
        },
        required: ['query'],
      },
    },
    async run(args: Record<string, unknown>) {
      const query = String(args['query'] || '').trim()
      const limit = Math.min(5, Math.max(1, Number(args['numResults']) || 3))

      const encoded = encodeURIComponent(query)
      const proxyArgs = proxy ? `-x ${proxy}` : ''
      const curlCmd = `curl -s -L ${proxyArgs} --connect-timeout 8 -m 12 "https://html.duckduckgo.com/html/?q=${encoded}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)"`

      return new Promise<string>((resolve) => {
        exec(curlCmd, (err, stdout) => {
          if (err || !stdout) {
            resolve(JSON.stringify({
              query,
              results: [],
              notice: `Web search temporarily unavailable: ${err?.message || 'no response'}`,
            }))
            return
          }

          const results: Array<{ title: string; snippet: string; url: string }> = []
          const snippetRegex = /<a class="result__snippet[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g
          const titleRegex = /<a class="result__url"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g

          // 匹配主要片段
          const parts = stdout.split(/class="result__body"/)
          for (let i = 1; i < parts.length && results.length < limit; i++) {
            const block = parts[i]
            const titleMatch = block.match(/<a class="result__a"[^>]*>([\s\S]*?)<\/a>/)
            const snippetMatch = block.match(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/)
            const urlMatch = block.match(/href="([^"]*)"/)

            const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : `Result #${i}`
            const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : ''
            const url = urlMatch ? urlMatch[1] : ''

            if (snippet || title) {
              results.push({ title, snippet, url })
            }
          }

          resolve(JSON.stringify({
            query,
            totalFound: results.length,
            results,
          }))
        })
      })
    },
  }

  // 6. delegate_fusion_task (Devin Fusion 副手协同)
  const delegateFusionTool: Tool = {
    name: 'delegate_fusion_task',
    type: 'function',
    function: {
      name: 'delegate_fusion_task',
      description: '将复杂的编码、排错或多步骤实现子任务委派给极速 Sidekick (副手模型) 执行，生成代码补丁并进行主脑交叉评审。',
      parameters: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: '委派给副手的具体执行指令' },
          pathScope: {
            type: 'array',
            items: { type: 'string', description: '文件相对路径' },
            description: '限制副手修改的文件路径列表，例如 ["src/server/web-api.ts"]',
          },
          criteria: {
            type: 'array',
            items: { type: 'string', description: '验收条件文本' },
            description: '主脑验收标准列表，例如 ["包含完整的单元测试", "编译通过无报错"]',
          },
        },
        required: ['instruction'],
      },
    },
    async run(args: Record<string, unknown>) {
      const instruction = String(args['instruction'] || '')
      const pathScope = Array.isArray(args['pathScope']) ? (args['pathScope'] as string[]) : ['src/index.ts']
      const criteriaList = Array.isArray(args['criteria']) ? (args['criteria'] as string[]) : ['代码规范且功能完整']

      if (!options.fusionService) {
        return JSON.stringify({
          status: 'error',
          message: 'Fusion service is not mounted in current environment',
        })
      }

      const taskId = `fusion_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const runner = new FusionRunner({ fusionService: options.fusionService })

      const criteria = criteriaList.map((c, i) => ({
        id: `criterion_${i + 1}`,
        description: c,
        weight: 1.0 / criteriaList.length,
        required: true,
      }))

      options.fusionService.create({
        taskId,
        sessionId: 'web:active_session',
        instruction,
        targetTools: [{ name: 'write_file', source: 'builtin', required: true }],
        diffSchema: { format: 'unified_diff', pathScope },
        reviewCriteria: criteria,
      })

      const finalRecord = await runner.runTask(taskId)
      return JSON.stringify({
        taskId: finalRecord.id,
        status: finalRecord.status,
        sidekickSummary: finalRecord.result?.summary,
        diff: finalRecord.result?.diff,
        reviewerDecision: finalRecord.reviews?.[0]?.decision,
        reviewerSummary: finalRecord.reviews?.[0]?.summary,
      })
    },
  }

  // 7. list_skills & load_skill_sop
  const listSkillsTool: Tool = {
    name: 'list_skills',
    type: 'function',
    function: {
      name: 'list_skills',
      description: '列出系统当前所有可用的领域专业技能 (Skills) 与 SOP 清单。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    async run() {
      const activeDir = path.resolve(root, 'skills/active')
      if (!fs.existsSync(activeDir)) {
        return JSON.stringify({ skills: [] })
      }
      const entries = await fs.promises.readdir(activeDir, { withFileTypes: true })
      const skills = entries.filter(e => e.isDirectory()).map(e => e.name)
      return JSON.stringify({
        total: skills.length,
        activeSkills: skills,
        note: '可调用 load_skill_sop(name) 加载特定技能的完整 SOP 指引。',
      })
    },
  }

  const loadSkillSopTool: Tool = {
    name: 'load_skill_sop',
    type: 'function',
    function: {
      name: 'load_skill_sop',
      description: '加载指定技能的完整标准作业程序 (SKILL.md SOP)。',
      parameters: {
        type: 'object',
        properties: {
          skillName: { type: 'string', description: '技能目录名，例如 "troubleshoot-napcat-disconnect"' },
        },
        required: ['skillName'],
      },
    },
    async run(args: Record<string, unknown>) {
      const skillName = String(args['skillName'] || '')
      const skillFile = path.resolve(root, 'skills/active', skillName, 'SKILL.md')

      if (!fs.existsSync(skillFile)) {
        return JSON.stringify({ error: `Skill "${skillName}" not found in skills/active/` })
      }

      const md = await fs.promises.readFile(skillFile, 'utf8')
      return JSON.stringify({
        skillName,
        sop: md,
      })
    },
  }

  return [
    readFileTool,
    writeFileTool,
    editFileTool,
    execBashTool,
    webSearchTool,
    delegateFusionTool,
    listSkillsTool,
    loadSkillSopTool,
  ]
}
