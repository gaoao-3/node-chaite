/**
 * Agent subsystem HTTP controller.
 * Mounts under /api/agent and covers:
 *   /api/agent/skills          - SkillRegistry (full CRUD, readonly-aware)
 *   /api/agent/jobs            - BackgroundJobManager
 *   /api/agent/scheduled-tasks - DynamicScheduler
 *   /api/agent/plans           - PlanExecutor (read-only)
 *   /api/agent/mcp-servers     - McpServerManager
 */
import express, { Router, Request, Response } from 'express'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Chaite, ChaiteResponse } from '../index'
import type { McpServerConfig } from '../agent/mcp/McpServerConfig'
import type { SkillFrontmatter } from '../agent/skills/skill.types'

const router: Router = express.Router()

// ─── Helper ───────────────────────────────────────────────────────────────────

function handle(res: Response, fn: () => Promise<unknown>) {
  fn()
    .then(data => { if (!res.headersSent) res.status(200).json(ChaiteResponse.ok(data)) })
    .catch((e: unknown) => {
      if (!res.headersSent) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        Chaite.getInstance().getLogger().error(e as object)
        res.status(500).json(ChaiteResponse.fail(null, msg))
      }
    })
}

function notConfigured(res: Response, name: string) {
  res.status(503).json(ChaiteResponse.fail(null, `${name} is not configured`))
}

function paginate<T>(items: T[], req: Request): { items: T[]; total: number; page: number; pageSize: number } {
  const page = Math.max(1, parseInt(req.query['page'] as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query['pageSize'] as string) || 20))
  const total = items.length
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize }
}

async function discoverMcpTools(config: McpServerConfig) {
  const { McpToolExecutor } = await import('../agent/tool-executors/mcp')
  const executor = new McpToolExecutor(config)
  try {
    return await executor.listAvailableTools({ runId: 'discovery', userId: 'admin', timeoutMs: config.timeoutMs })
  } finally {
    await executor.close()
  }
}

/** Return 403 if the skill is marked readonly. Returns true if the response was sent (caller should return). */
function readonlyGuard(res: Response, name: string, frontmatter: SkillFrontmatter): boolean {
  if (frontmatter.readonly) {
    res.status(403).json(ChaiteResponse.fail(null, `Skill "${name}" is readonly and cannot be modified or deleted via the API. Remove readonly: true from its SKILL.md to enable editing.`))
    return true
  }
  return false
}

/** Parse comma-separated or JSON-array string → string[] */
function parseToolList(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed) as string[] } catch { /* fall through */ }
  }
  return trimmed.split(',').map(s => s.trim()).filter(Boolean)
}

function buildSkillFrontmatter(fields: Partial<SkillFrontmatter>): string {
  const lines: string[] = ['---']
  const s = (k: string, v: string | undefined) => { if (v) lines.push(`${k}: ${v}`) }
  const a = (k: string, vs: string[] | undefined) => {
    if (vs && vs.length > 0) { lines.push(`${k}:`); vs.forEach(v => lines.push(`  - ${v}`)) }
  }
  s('name', fields.name)
  s('description', fields.description)
  s('version', fields.version)
  if (fields.executionMode) s('executionMode', fields.executionMode)
  if (fields.workflowRef) s('workflowRef', fields.workflowRef)
  if (fields.preset) s('preset', fields.preset)
  if (fields.planningModel) s('planningModel', fields.planningModel)
  if (fields.readonly) lines.push('readonly: true')
  a('allowedTools', fields.allowedTools)
  a('processors', fields.processors)
  a('triggers', fields.triggers)
  a('keywords', fields.keywords)
  s('mcpServer', fields.mcpServer)
  a('mcpTools', fields.mcpTools)
  lines.push('---')
  return lines.join('\n') + '\n'
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKILLS  /api/agent/skills
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/agent/skills?page=1&pageSize=20&name=xxx — list skills with optional name filter + pagination */
router.get('/skills', (req: Request, res: Response) => {
  const registry = Chaite.getInstance().getSkillRegistry()
  if (!registry) return notConfigured(res, 'SkillRegistry')
  handle(res, async () => {
    let metas = registry.listSkillMetas()
    const name = req.query['name'] as string | undefined
    const mode = req.query['executionMode'] as string | undefined
    if (name) metas = metas.filter(m => m.frontmatter.name.includes(name) || m.frontmatter.description?.includes(name))
    if (mode) metas = metas.filter(m => (m.frontmatter.executionMode ?? 'direct') === mode)
    return paginate(metas, req)
  })
})

/** GET /api/agent/skills/:name — get one skill detail (includes instructions body) */
router.get('/skills/:name', (req: Request<{ name: string }>, res: Response) => {
  const registry = Chaite.getInstance().getSkillRegistry()
  if (!registry) return notConfigured(res, 'SkillRegistry')
  handle(res, async () => {
    const skill = registry.getSkillByName(req.params.name)
    if (!skill) {
      res.status(404).json(ChaiteResponse.fail(null, `Skill "${req.params.name}" not found`))
      return null
    }
    const instructions = await skill.loadInstructions()
    return { ...skill.frontmatter, id: skill.id, rootDir: skill.rootDir, instructions }
  })
})

/** POST /api/agent/skills/reload — hot-reload all skills from disk */
router.post('/skills/reload', (req: Request, res: Response) => {
  const registry = Chaite.getInstance().getSkillRegistry()
  if (!registry) return notConfigured(res, 'SkillRegistry')
  handle(res, async () => {
    await registry.load()
    return { count: registry.listSkillMetas().length }
  })
})

/**
 * POST /api/agent/skills
 * Create a new skill (writes SKILL.md + system-prompt.md, then hot-reloads).
 * Body: { name, description, systemPrompt, executionMode?, allowedTools?, preset?, overwrite? }
 * Returns 409 if skill exists and overwrite is not true.
 */
router.post('/skills', (req: Request, res: Response) => {
  const registry = Chaite.getInstance().getSkillRegistry()
  if (!registry) return notConfigured(res, 'SkillRegistry')
  handle(res, async () => {
    const { name, description, systemPrompt, executionMode, allowedTools, preset, planningModel, keywords, mcpServer, mcpTools, overwrite = false } = req.body as {
      name: string
      description: string
      systemPrompt: string
      executionMode?: SkillFrontmatter['executionMode']
      allowedTools?: string | string[]
      preset?: string
      planningModel?: string
      keywords?: string | string[]
      mcpServer?: string
      mcpTools?: string | string[]
      overwrite?: boolean
    }

    if (!name || !description || !systemPrompt) {
      res.status(400).json(ChaiteResponse.fail(null, 'name, description and systemPrompt are required'))
      return null
    }

    const safeName = name.trim().replace(/\s+/g, '-')
    const existing = registry.getSkillByName(safeName)
    if (existing) {
      if (readonlyGuard(res, safeName, existing.frontmatter)) return null
      if (!overwrite) {
        res.status(409).json(ChaiteResponse.fail(null, `Skill "${safeName}" already exists. Set overwrite: true to replace it.`))
        return null
      }
    }

    const tools = typeof allowedTools === 'string' ? parseToolList(allowedTools) : allowedTools
    const skillKeywords = typeof keywords === 'string' ? parseToolList(keywords) : keywords
    const selectedMcpTools = typeof mcpTools === 'string' ? parseToolList(mcpTools) : mcpTools
    const skillDir = path.join(registry.getSkillsDir(), safeName)
    await fs.promises.mkdir(skillDir, { recursive: true })
    await fs.promises.writeFile(path.join(skillDir, 'SKILL.md'), buildSkillFrontmatter({ name: safeName, description, executionMode, allowedTools: tools, preset, planningModel, keywords: skillKeywords, mcpServer, mcpTools: selectedMcpTools }), 'utf-8')
    await fs.promises.writeFile(path.join(skillDir, 'system-prompt.md'), systemPrompt, 'utf-8')
    await registry.load()

    return { name: safeName, created: true }
  })
})

/**
 * PATCH /api/agent/skills/:name
 * Update an existing skill. Readonly skills return 403.
 * Body: { description?, systemPrompt?, executionMode?, allowedTools?, preset? }
 */
router.patch('/skills/:name', (req: Request<{ name: string }>, res: Response) => {
  const registry = Chaite.getInstance().getSkillRegistry()
  if (!registry) return notConfigured(res, 'SkillRegistry')
  handle(res, async () => {
    const skill = registry.getSkillByName(req.params.name)
    if (!skill) {
      res.status(404).json(ChaiteResponse.fail(null, `Skill "${req.params.name}" not found`))
      return null
    }
    if (readonlyGuard(res, req.params.name, skill.frontmatter)) return null

    const { description, systemPrompt, executionMode, allowedTools, preset, planningModel, keywords, mcpServer, mcpTools } = req.body as {
      description?: string
      systemPrompt?: string
      executionMode?: SkillFrontmatter['executionMode']
      allowedTools?: string | string[]
      preset?: string
      planningModel?: string
      keywords?: string | string[]
      mcpServer?: string
      mcpTools?: string | string[]
    }

    const updated: Partial<SkillFrontmatter> = { ...skill.frontmatter }
    if (description) updated.description = description
    if (executionMode) updated.executionMode = executionMode
    if (preset !== undefined) updated.preset = preset
    if (planningModel) updated.planningModel = planningModel
    if (allowedTools !== undefined) {
      updated.allowedTools = typeof allowedTools === 'string' ? parseToolList(allowedTools) : allowedTools
    }
    if (keywords !== undefined) updated.keywords = typeof keywords === 'string' ? parseToolList(keywords) : keywords
    if (mcpServer !== undefined) updated.mcpServer = mcpServer
    if (mcpTools !== undefined) updated.mcpTools = typeof mcpTools === 'string' ? parseToolList(mcpTools) : mcpTools

    await fs.promises.writeFile(path.join(skill.rootDir, 'SKILL.md'), buildSkillFrontmatter(updated), 'utf-8')
    if (systemPrompt) {
      await fs.promises.writeFile(path.join(skill.rootDir, 'system-prompt.md'), systemPrompt, 'utf-8')
    }

    await registry.load()
    return { name: req.params.name, updated: true }
  })
})

/**
 * DELETE /api/agent/skills/:name
 * Delete a skill and all its files. Readonly skills return 403.
 */
router.delete('/skills/:name', (req: Request<{ name: string }>, res: Response) => {
  const registry = Chaite.getInstance().getSkillRegistry()
  if (!registry) return notConfigured(res, 'SkillRegistry')
  handle(res, async () => {
    const skill = registry.getSkillByName(req.params.name)
    if (!skill) {
      res.status(404).json(ChaiteResponse.fail(null, `Skill "${req.params.name}" not found`))
      return null
    }
    if (readonlyGuard(res, req.params.name, skill.frontmatter)) return null

    await fs.promises.rm(skill.rootDir, { recursive: true, force: true })
    await registry.load()
    return { name: req.params.name, deleted: true }
  })
})

/**
 * POST /api/agent/skills/:name/run
 * Manually trigger a skill's workflow or plan execution.
 * Body: { goal?: string, userId?: string, groupId?: string, background?: boolean }
 *   - goal: overrides the message text for plan mode
 *   - background: if true, wraps execution in a BackgroundJob and returns jobId immediately
 */
router.post('/skills/:name/run', (req: Request<{ name: string }>, res: Response) => {
  const chaite = Chaite.getInstance()
  const registry = chaite.getSkillRegistry()
  if (!registry) return notConfigured(res, 'SkillRegistry')
  handle(res, async () => {
    const skill = registry.getSkillByName(req.params.name)
    if (!skill) {
      res.status(404).json(ChaiteResponse.fail(null, `Skill "${req.params.name}" not found`))
      return null
    }

    const { goal = skill.frontmatter.description ?? req.params.name, userId, groupId, background = false } = req.body as {
      goal?: string
      userId?: string
      groupId?: string
      background?: boolean
    }

    const agentCtx = chaite.buildAgentRunContext({ skillName: skill.id, userId, groupId })
    const mode = skill.frontmatter.executionMode

    if (background) {
      const jobMgr = chaite.getBackgroundJobManager()
      if (!jobMgr) return notConfigured(res, 'BackgroundJobManager')
      const jobId = await jobMgr.createAndRun({ description: `Skill run: ${skill.id}`, userId: userId ?? 'api', payload: { goal } })
      return { jobId }
    }

    if (mode === 'workflow') {
      const engine = chaite.getWorkflowEngine()
      if (!engine) return notConfigured(res, 'WorkflowEngine')
      if (!skill.frontmatter.workflowRef) {
        res.status(400).json(ChaiteResponse.fail(null, 'Skill has no workflowRef'))
        return null
      }
      const buf = await skill.readFile(skill.frontmatter.workflowRef)
      const workflowDef = JSON.parse(buf.toString('utf-8'))
      const result = await engine.run(workflowDef, agentCtx)
      return result
    }

    if (mode === 'plan') {
      const planExec = chaite.getPlanExecutor()
      if (!planExec) return notConfigured(res, 'PlanExecutor')
      const { plan, output } = await planExec.execute(goal, agentCtx)
      return { planId: plan.id, output, status: plan.status }
    }

    // direct mode — just run the skill as a sendMessage
    res.status(400).json(ChaiteResponse.fail(null, `Skill "${req.params.name}" has executionMode=direct; use the chat API instead`))
    return null
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND JOBS  /api/agent/jobs
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/agent/jobs?userId=xxx&status=xxx&page=1&pageSize=20 */
router.get('/jobs', (req: Request, res: Response) => {
  const mgr = Chaite.getInstance().getBackgroundJobManager()
  if (!mgr) return notConfigured(res, 'BackgroundJobManager')
  handle(res, async () => {
    const userId = req.query['userId'] as string | undefined
    const status = req.query['status'] as string | undefined
    let jobs = await mgr.listJobs(userId)
    if (status) jobs = jobs.filter(j => j.status === status)
    return paginate(jobs, req)
  })
})

/** GET /api/agent/jobs/:id — get one job */
router.get('/jobs/:id', (req: Request<{ id: string }>, res: Response) => {
  const mgr = Chaite.getInstance().getBackgroundJobManager()
  if (!mgr) return notConfigured(res, 'BackgroundJobManager')
  handle(res, async () => {
    const job = await mgr.getJob(req.params.id)
    if (!job) {
      res.status(404).json(ChaiteResponse.fail(null, 'Job not found'))
      return null
    }
    return job
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED TASKS  /api/agent/scheduled-tasks
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/agent/scheduled-tasks?userId=xxx&page=1&pageSize=20 */
router.get('/scheduled-tasks', (req: Request, res: Response) => {
  const scheduler = Chaite.getInstance().getDynamicScheduler()
  if (!scheduler) return notConfigured(res, 'DynamicScheduler')
  handle(res, async () => {
    const userId = req.query['userId'] as string | undefined
    const tasks = await scheduler.listTasks(userId)
    return paginate(tasks, req)
  })
})

/** GET /api/agent/scheduled-tasks/:id — get one task */
router.get('/scheduled-tasks/:id', (req: Request<{ id: string }>, res: Response) => {
  const scheduler = Chaite.getInstance().getDynamicScheduler()
  if (!scheduler) return notConfigured(res, 'DynamicScheduler')
  handle(res, async () => {
    const task = await scheduler.getTask(req.params.id)
    if (!task) {
      res.status(404).json(ChaiteResponse.fail(null, 'Task not found'))
      return null
    }
    return task
  })
})

/** DELETE /api/agent/scheduled-tasks/:id — cancel a task */
router.delete('/scheduled-tasks/:id', (req: Request<{ id: string }>, res: Response) => {
  const scheduler = Chaite.getInstance().getDynamicScheduler()
  if (!scheduler) return notConfigured(res, 'DynamicScheduler')
  handle(res, async () => {
    const ok = await scheduler.cancelTask(req.params.id)
    if (!ok) {
      res.status(404).json(ChaiteResponse.fail(null, 'Task not found'))
      return null
    }
    return { cancelled: true }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PLANS  /api/agent/plans  (read-only — plans are created by the agent)
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/agent/plans/:id — get plan + step progress */
router.get('/plans/:id', (req: Request<{ id: string }>, res: Response) => {
  const storage = Chaite.getInstance().getAgentStorage()
  if (!storage) return notConfigured(res, 'AgentStorage')
  handle(res, async () => {
    const plan = await storage.getItem('plan:' + req.params.id)
    if (!plan) {
      res.status(404).json(ChaiteResponse.fail(null, 'Plan not found'))
      return null
    }
    return plan
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// MCP SERVERS  /api/agent/mcp-servers
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/agent/mcp-servers?page=1&pageSize=20 */
router.get('/mcp-servers', (req: Request, res: Response) => {
  const mgr = Chaite.getInstance().getMcpServerManager()
  if (!mgr) return notConfigured(res, 'McpServerManager')
  handle(res, async () => paginate(await mgr.list(), req))
})

/** GET /api/agent/mcp-servers/:id */
router.get('/mcp-servers/:id', (req: Request<{ id: string }>, res: Response) => {
  const mgr = Chaite.getInstance().getMcpServerManager()
  if (!mgr) return notConfigured(res, 'McpServerManager')
  handle(res, async () => {
    const cfg = await mgr.get(req.params.id)
    if (!cfg) {
      res.status(404).json(ChaiteResponse.fail(null, 'MCP server not found'))
      return null
    }
    return cfg
  })
})

/** POST /api/agent/mcp-servers — add a new MCP server */
router.post('/mcp-servers', (
  req: Request<object, object, Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt'>>,
  res: Response,
) => {
  const mgr = Chaite.getInstance().getMcpServerManager()
  if (!mgr) return notConfigured(res, 'McpServerManager')
  handle(res, async () => {
    // Adding a server is also its first connection validation and discovery.
    // Do not leave an unusable endpoint in the user's configuration.
    const created = await mgr.add(req.body)
    try {
      const tools = await discoverMcpTools(created)
      const updated = await mgr.update(created.id, { tools, toolsDiscoveredAt: Date.now() })
      if (!updated) throw new Error('MCP server disappeared while saving its tool manifest')
      return updated
    } catch (error) {
      await mgr.delete(created.id)
      throw new Error(`MCP server connection failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
})

/** PATCH /api/agent/mcp-servers/:id — update an existing MCP server */
router.patch('/mcp-servers/:id', (
  req: Request<{ id: string }, object, Partial<McpServerConfig>>,
  res: Response,
) => {
  const mgr = Chaite.getInstance().getMcpServerManager()
  if (!mgr) return notConfigured(res, 'McpServerManager')
  handle(res, async () => {
    const existing = await mgr.get(req.params.id)
    if (!existing) {
      res.status(404).json(ChaiteResponse.fail(null, 'MCP server not found'))
      return null
    }
    // Validate the proposed connection before replacing a working config.
    const candidate = { ...existing, ...req.body, id: existing.id, createdAt: existing.createdAt, updatedAt: existing.updatedAt }
    const tools = await discoverMcpTools(candidate)
    const updated = await mgr.update(req.params.id, { ...req.body, tools, toolsDiscoveredAt: Date.now() })
    if (!updated) {
      res.status(404).json(ChaiteResponse.fail(null, 'MCP server not found'))
      return null
    }
    return updated
  })
})

/** DELETE /api/agent/mcp-servers/:id — remove an MCP server config */
router.delete('/mcp-servers/:id', (req: Request<{ id: string }>, res: Response) => {
  const mgr = Chaite.getInstance().getMcpServerManager()
  if (!mgr) return notConfigured(res, 'McpServerManager')
  handle(res, async () => {
    const existing = await mgr.get(req.params.id)
    if (!existing) {
      res.status(404).json(ChaiteResponse.fail(null, 'MCP server not found'))
      return null
    }
    await mgr.delete(req.params.id)
    return { deleted: true }
  })
})

/** POST /api/agent/mcp-servers/:id/test — ping the MCP server and list its tools */
router.post('/mcp-servers/:id/test', (req: Request<{ id: string }>, res: Response) => {
  const mgr = Chaite.getInstance().getMcpServerManager()
  if (!mgr) return notConfigured(res, 'McpServerManager')
  handle(res, async () => {
    const cfg = await mgr.get(req.params.id)
    if (!cfg) {
      res.status(404).json(ChaiteResponse.fail(null, 'MCP server not found'))
      return null
    }
    const tools = await discoverMcpTools(cfg)
    const updated = await mgr.update(cfg.id, { tools, toolsDiscoveredAt: Date.now() })
    if (!updated || updated.tools?.length !== tools.length) {
      throw new Error('MCP tool manifest could not be persisted')
    }
    return { ok: true, toolCount: tools.length, cachedToolCount: updated.tools.length, tools }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// FUSION DUAL-AGENT  /api/agent/fusion
// ═══════════════════════════════════════════════════════════════════════════════

const sampleFusionTasks = [
  {
    taskId: 'fusion_task_9021',
    sessionId: 'qq:group_789456123',
    instruction: '重构并优化 Dockerfile 实现多阶段构建，将运行时镜像体积压缩 40% 以上并确保编译通过',
    targetTools: [
      { name: 'read_file', source: 'builtin', required: true },
      { name: 'write_file', source: 'builtin', required: true },
      { name: 'exec_bash', source: 'local', required: true, notes: '用于验证 docker build' },
    ],
    diffSchema: {
      format: 'unified_diff',
      path_scope: ['Dockerfile', '.dockerignore'],
      max_files: 2,
      max_changed_lines: 80,
    },
    reviewCriteria: [
      { id: 'size_reduction', description: '最终产出镜像体积减少 30% 以上', weight: 0.5, evaluator: 'main_agent', required: true },
      { id: 'build_success', description: '执行 docker build . 无报错且 smoke test 正常', weight: 0.5, evaluator: 'tests', required: true },
    ],
    budget: { max_tool_calls: 10, max_wall_clock_ms: 60000, max_tokens: 16000, max_attempts: 2 },
    mainModel: 'Claude-3.7-Sonnet (Architect)',
    sidekickModel: 'DeepSeek-V4.1-Flash (Executor)',
    status: 'reviewing',
    producedDiff: `--- a/Dockerfile\n+++ b/Dockerfile\n@@ -1,15 +1,18 @@\n-FROM node:20\n-WORKDIR /app\n-COPY . .\n-RUN npm install\n-RUN npm run build\n-CMD ["node", "dist/index.js"]\n+# Build stage\n+FROM node:20-alpine AS builder\n+WORKDIR /app\n+COPY package.json pnpm-lock.yaml ./\n+RUN corepack enable && pnpm install --frozen-lockfile\n+COPY . .\n+RUN pnpm run build\n+\n+# Production stage\n+FROM node:20-alpine AS runner\n+WORKDIR /app\n+ENV NODE_ENV=production\n+COPY --from=builder /app/package.json ./package.json\n+COPY --from=builder /app/dist ./dist\n+USER node\n+EXPOSE 3000\n+CMD ["node", "dist/index.js"]`,
    reviewScore: 0.95,
    reviewFeedback: '分层优雅，使用了 node:20-alpine 与非 root 用户，体积从 1.1GB 降低至 142MB，达标！',
    createdAt: Date.now() - 360000,
  },
  {
    taskId: 'fusion_task_9022',
    sessionId: 'web:session_playground',
    instruction: '编写 QQ 群友签到与好感度计算工具模块，附带单元测试',
    targetTools: [
      { name: 'write_file', source: 'builtin', required: true },
      { name: 'run_test', source: 'local', required: true },
    ],
    diffSchema: {
      format: 'unified_diff',
      path_scope: ['src/tools/checkin.ts', 'src/tools/checkin.test.ts'],
      max_files: 2,
      max_changed_lines: 120,
    },
    reviewCriteria: [
      { id: 'test_pass', description: '所有测试用例 100% 通过', weight: 0.6, evaluator: 'tests', required: true },
      { id: 'clean_code', description: '无 lint 警告且类型健全', weight: 0.4, evaluator: 'main_agent' },
    ],
    budget: { max_tool_calls: 6, max_wall_clock_ms: 30000, max_tokens: 8000 },
    mainModel: 'Claude-3.7-Sonnet (Architect)',
    sidekickModel: 'DeepSeek-V4.1-Flash (Executor)',
    status: 'completed',
    producedDiff: `--- /dev/null\n+++ b/src/tools/checkin.ts\n@@ -0,0 +1,24 @@\n+export function calculateFavorability(base: number, streakDays: number): number {\n+  const bonus = Math.min(streakDays * 2, 20);\n+  return base + bonus + Math.floor(Math.random() * 5);\n+}`,
    reviewScore: 1.0,
    reviewFeedback: '测试全部通过，逻辑闭环，已合并。',
    createdAt: Date.now() - 86400000,
    completedAt: Date.now() - 86350000,
  },
]

/** GET /api/agent/fusion/tasks */
router.get('/fusion/tasks', (req: Request, res: Response) => {
  handle(res, async () => paginate(sampleFusionTasks, req))
})

/** GET /api/agent/fusion/tasks/:id */
router.get('/fusion/tasks/:id', (req: Request<{ id: string }>, res: Response) => {
  handle(res, async () => {
    const task = sampleFusionTasks.find(t => t.taskId === req.params.id)
    if (!task) {
      res.status(404).json(ChaiteResponse.fail(null, 'Fusion task not found'))
      return null
    }
    return task
  })
})

/** POST /api/agent/fusion/tasks */
router.post('/fusion/tasks', (req: Request, res: Response) => {
  handle(res, async () => {
    const newTask = {
      taskId: `fusion_task_${Date.now()}`,
      sessionId: req.body.sessionId || 'web:manual_dispatch',
      instruction: req.body.instruction || '新委托任务',
      targetTools: req.body.targetTools || [{ name: 'read_file' }, { name: 'write_file' }],
      diffSchema: req.body.diffSchema || { format: 'unified_diff', max_files: 5, max_changed_lines: 200 },
      reviewCriteria: req.body.reviewCriteria || [{ id: 'general', description: '代码准确无误', weight: 1.0 }],
      budget: req.body.budget || { max_tool_calls: 8, max_wall_clock_ms: 45000 },
      mainModel: req.body.mainModel || 'Claude-3.7-Sonnet (Architect)',
      sidekickModel: req.body.sidekickModel || 'DeepSeek-V4.1-Flash (Executor)',
      status: 'executing',
      createdAt: Date.now(),
    }
    sampleFusionTasks.unshift(newTask as any)
    return newTask
  })
})

/** POST /api/agent/fusion/tasks/:id/review */
router.post('/fusion/tasks/:id/review', (req: Request<{ id: string }>, res: Response) => {
  handle(res, async () => {
    const task = sampleFusionTasks.find(t => t.taskId === req.params.id)
    if (!task) {
      res.status(404).json(ChaiteResponse.fail(null, 'Fusion task not found'))
      return null
    }
    const { status, feedback } = req.body
    task.status = status === 'approved' ? 'completed' : 'failed'
    task.reviewFeedback = feedback || (status === 'approved' ? '人工审查通过并接受变更' : '人工审查已驳回')
    task.completedAt = Date.now()
    return { updated: true }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SELF-EVOLUTION & SKILL-FORGE  /api/agent/evolution
// ═══════════════════════════════════════════════════════════════════════════════

const sampleEvolutionTraces = [
  {
    traceId: 'trace_evo_101',
    sessionId: 'qq:group_984512301',
    platform: 'qq',
    botId: 'bot_main_qq',
    userIntent: {
      raw: 'NapCat 刚才掉线了，查一下为什么断连并自动拉起，不要重启整台机器',
      category: 'ops_troubleshooting',
    },
    outcome: 'success',
    toolCalls: [
      { callId: 'c1', name: 'read_log', arguments: { path: '/var/log/napcat.log', lines: 50 }, status: 'ok', attempt: 1 },
      { callId: 'c2', name: 'check_port', arguments: { port: 3001 }, status: 'error', attempt: 1, error: { kind: 'RETRYABLE', message: 'Connection refused on port 3001' } },
      { callId: 'c3', name: 'restart_service', arguments: { service: 'napcat-docker' }, status: 'ok', attempt: 2 },
      { callId: 'c4', name: 'ping_ws', arguments: { endpoint: 'ws://127.0.0.1:3001' }, status: 'ok', attempt: 1, resultPreview: 'pong: 2ms' },
    ],
    errorRetries: [
      { attempt: 1, reason: '端口 3001 拒绝连接，容器异常退出', recovered: true, occurredAt: Date.now() - 1700000 },
    ],
    scores: {
      correctness: 0.94,
      efficiency: 0.88,
      safety: 0.98,
      reusability: 0.92,
    },
    compositeScore: 7.4,
    draftSkillName: 'troubleshoot-napcat-disconnect',
    draftSkillMd: `---
name: troubleshoot-napcat-disconnect
description: 诊断并自动恢复 NapCat / OneBot 掉线与连接拒绝异常
keywords: ["napcat", "qqbot 掉线", "onebot connection refused"]
triggers: ["napcat 掉线", "qq机器人断联", "connection refused 3001"]
executionMode: direct
---

# NapCat 断线排查恢复工作流

## 触发时机
当 QQ 机器人出现心跳丢失、WebSocket 拒绝连接 (3001) 时激活。

## 标准排查步骤
1. 读取 NapCat 容器最新 50 行日志：\`read_log('/var/log/napcat.log', lines=50)\`
2. 检查 3001 端口存活状态。
3. 若容器死锁，平滑重启 docker 服务：\`restart_service('napcat-docker')\`
4. 发起 ws ping 探针确认恢复。

## 避坑禁忌
- 严禁直接执行宿主机 reboot 命令。
- 恢复后必须验证至少 1 次握手。`,
    lessons: [
      'NapCat 容易因内存溢出引发 3001 端口静默关闭',
      '优先检查容器状态再拉起，比直接 kill 进程更安全',
    ],
    startedAt: Date.now() - 1800000,
    completedAt: Date.now() - 1740000,
    mergedToSkill: false,
  },
  {
    traceId: 'trace_evo_102',
    sessionId: 'dsh:mobile_sync',
    platform: 'dsh',
    botId: 'dsh_hub',
    userIntent: {
      raw: '把上周所有的用户对话 Token 消耗按模型分类导出 Markdown 表格',
      category: 'data_analysis',
    },
    outcome: 'success',
    toolCalls: [
      { callId: 'c11', name: 'query_usage_db', arguments: { days: 7 }, status: 'ok', attempt: 1 },
      { callId: 'c12', name: 'format_markdown_table', arguments: { groupBy: 'model' }, status: 'ok', attempt: 1 },
    ],
    errorRetries: [],
    scores: {
      correctness: 0.96,
      efficiency: 0.95,
      safety: 1.0,
      reusability: 0.85,
    },
    compositeScore: 7.5,
    draftSkillName: 'generate-model-token-report',
    draftSkillMd: `---
name: generate-model-token-report
description: 按周期与模型分类汇总 Token 消耗与成本分析
keywords: ["token 统计", "模型费用", "使用量报表"]
executionMode: direct
---

# 模型使用统计报表工作流
1. 查询指定天数内的数据库统计指标。
2. 按模型家族（Claude/OpenAI/Gemini/DeepSeek）聚合统计输入/输出/思考Token。
3. 输出结构化 Markdown 表格。`,
    lessons: [
      '对思考模型单独列出 reasoningTokens 能更准确评估开销',
    ],
    startedAt: Date.now() - 7200000,
    completedAt: Date.now() - 7180000,
    mergedToSkill: true,
  },
]

/** GET /api/agent/evolution/traces */
router.get('/evolution/traces', (req: Request, res: Response) => {
  handle(res, async () => paginate(sampleEvolutionTraces, req))
})

/** GET /api/agent/evolution/traces/:id */
router.get('/evolution/traces/:id', (req: Request<{ id: string }>, res: Response) => {
  handle(res, async () => {
    const trace = sampleEvolutionTraces.find(t => t.traceId === req.params.id)
    if (!trace) {
      res.status(404).json(ChaiteResponse.fail(null, 'Evolution trace not found'))
      return null
    }
    return trace
  })
})

/** POST /api/agent/evolution/evaluate */
router.post('/evolution/evaluate', (req: Request, res: Response) => {
  handle(res, async () => {
    const { draftSkillMd } = req.body
    if (!draftSkillMd || draftSkillMd.length < 20) {
      throw new Error('技能文本过短，无法通过 4 维评估')
    }
    const hasTriggers = draftSkillMd.includes('triggers') || draftSkillMd.includes('keywords')
    const hasSteps = draftSkillMd.includes('1.') || draftSkillMd.includes('步骤')
    const hasSafety = draftSkillMd.includes('避坑') || draftSkillMd.includes('禁忌') || draftSkillMd.includes('安全')

    const correctness = hasSteps ? 0.92 : 0.65
    const efficiency = 0.90
    const safety = hasSafety ? 0.96 : 0.70
    const reusability = hasTriggers ? 0.94 : 0.60
    const composite = (correctness * 2 + efficiency * 2 + safety * 2 + reusability * 2).toFixed(1)

    return {
      scores: { correctness, efficiency, safety, reusability },
      compositeScore: Number(composite),
      passed: Number(composite) >= 6.0,
      breakdown: {
        triggerQuality: hasTriggers ? '优 (包含清晰的触发词与场景)' : '中 (建议补充具体触发场景)',
        stepClarity: hasSteps ? '优 (步骤明确且具备可执行性)' : '缺 (缺少步骤编号与指令)',
        safetyCompleteness: hasSafety ? '优 (包含安全禁忌与避坑指南)' : '待完善 (建议增加高危拦截说明)',
        discriminability: '达标 (具有明确的领域专精增量)',
      },
    }
  })
})

/** POST /api/agent/evolution/traces/:id/merge */
router.post('/evolution/traces/:id/merge', (req: Request<{ id: string }>, res: Response) => {
  handle(res, async () => {
    const trace = sampleEvolutionTraces.find(t => t.traceId === req.params.id)
    if (!trace) {
      res.status(404).json(ChaiteResponse.fail(null, 'Evolution trace not found'))
      return null
    }
    const registry = Chaite.getInstance().getSkillRegistry()
    if (!registry) return notConfigured(res, 'SkillRegistry')

    const skillName = req.body.skillName || trace.draftSkillName
    const content = trace.draftSkillMd

    const skillsDir = registry.getSkillsDir()
    const targetDir = path.join(skillsDir, skillName)
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true })
    }
    await fs.promises.writeFile(path.join(targetDir, 'SKILL.md'), content, 'utf8')
    await registry.load()

    trace.mergedToSkill = true
    return { success: true, skillName }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HUMAN-IN-THE-LOOP APPROVALS  /api/agent/approvals
// ═══════════════════════════════════════════════════════════════════════════════

const sampleApprovals = [
  {
    requestId: 'appr_req_5001',
    platform: 'qq',
    botId: 'bot_main_qq',
    sessionId: 'qq:group_984512301',
    riskLevel: 'critical',
    status: 'pending',
    action: {
      type: 'shell',
      title: '执行系统高危命令 (rm -rf 缓存清理)',
      summary: '清理 /var/cache/app-data/ 目录下所有缓存并重启子进程',
      toolName: 'exec_bash',
      command: 'rm -rf /var/cache/app-data/* && systemctl restart qqbot-worker',
      riskLevel: 'critical',
      parameters: { timeoutMs: 15000 },
    },
    reason: '由于群友批量生成多张高清图导致磁盘剩余空间低于 5%，Agent 提议清理临时缓存',
    integrityDigest: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    requestedBy: { initiatorRole: 'sidekick', agentId: 'deepseek-v4.1-flash' },
    createdAt: Date.now() - 120000,
    expiresAt: Date.now() + 480000,
  },
  {
    requestId: 'appr_req_5002',
    platform: 'dsh',
    botId: 'dsh_mobile_hub',
    sessionId: 'dsh:admin_console',
    riskLevel: 'high',
    status: 'approved',
    action: {
      type: 'file_write',
      title: '修改全局渠道路由配置',
      summary: '更新 channel-routing.json 中 Claude 渠道的并发上限至 10',
      toolName: 'write_file',
      path: '/etc/chaite/channel-routing.json',
      riskLevel: 'high',
      parameters: { maxConcurrency: 10 },
    },
    reason: '高峰期请求排队严重，动态上调并发限制',
    integrityDigest: 'sha256:3a91b40212f0fc98124d65824901b004d65dfc2d4b1fa3d677284addd2009801',
    requestedBy: { initiatorRole: 'main_agent', agentId: 'claude-3.7-sonnet' },
    createdAt: Date.now() - 3600000,
    expiresAt: Date.now() - 3000000,
  },
]

/** GET /api/agent/approvals */
router.get('/approvals', (req: Request, res: Response) => {
  handle(res, async () => paginate(sampleApprovals, req))
})

/** POST /api/agent/approvals/:id/decide */
router.post('/approvals/:id/decide', (req: Request<{ id: string }>, res: Response) => {
  handle(res, async () => {
    const item = sampleApprovals.find(a => a.requestId === req.params.id)
    if (!item) {
      res.status(404).json(ChaiteResponse.fail(null, 'Approval request not found'))
      return null
    }
    const { decision, reason, editedAction } = req.body
    item.status = decision === 'approved' ? 'approved' : 'rejected'
    if (editedAction) item.action = editedAction
    item.reason = reason || item.reason
    return { success: true }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GATEWAYS STATUS  /api/agent/gateways
// ═══════════════════════════════════════════════════════════════════════════════

const sampleGateways = [
  {
    platform: 'qq',
    name: 'QQBot OneBot 网关',
    status: 'online',
    botId: '2854129840',
    adapterType: 'OneBot v11 (NapCat WS Reverse)',
    connectedAt: Date.now() - 86400000 * 3,
    messageCount: 4219,
    errorCount: 2,
    throttledCount: 14,
    bufferQueueLength: 0,
    lastHeartbeat: Date.now() - 2500,
  },
  {
    platform: 'dsh',
    name: 'DSH Mobile 掌上中枢',
    status: 'online',
    botId: 'dsh_cordis_core',
    adapterType: 'Cordis IPC & Push Bridge',
    connectedAt: Date.now() - 86400000 * 2,
    messageCount: 890,
    errorCount: 0,
    throttledCount: 0,
    bufferQueueLength: 0,
    lastHeartbeat: Date.now() - 1100,
  },
  {
    platform: 'web',
    name: 'Web 控制台 & API 网关',
    status: 'online',
    botId: 'chaite_web_srv',
    adapterType: 'Express SSE & OpenAI /v1 Proxy',
    connectedAt: Date.now() - 86400000 * 5,
    messageCount: 12480,
    errorCount: 5,
    throttledCount: 0,
    bufferQueueLength: 0,
    lastHeartbeat: Date.now() - 400,
  },
]

/** GET /api/agent/gateways */
router.get('/gateways', (req: Request, res: Response) => {
  handle(res, async () => sampleGateways)
})

/** POST /api/agent/gateways/:platform/restart */
router.post('/gateways/:platform/restart', (req: Request<{ platform: string }>, res: Response) => {
  handle(res, async () => {
    const gw = sampleGateways.find(g => g.platform === req.params.platform)
    if (!gw) {
      res.status(404).json(ChaiteResponse.fail(null, 'Gateway platform not found'))
      return null
    }
    gw.lastHeartbeat = Date.now()
    gw.status = 'online'
    return { success: true }
  })
})

export default router
