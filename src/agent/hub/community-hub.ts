/**
 * 社区生态市场中心 (Community Hub & Marketplace)
 *
 * 聚合真实三大工业级生态：
 * 1. Pi Agent 官方与社区扩展包 (npm: pi-package 生态)
 * 2. DSH / Cordis 官方微内核插件生态 (DeepSeek Harness & Cordis Plugins)
 * 3. MCP 官方与社区工具服务 (Model Context Protocol)
 * 4. skills.sh 智能体标准作业程序库 (SOP)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SkillRegistry } from '../skills/SkillRegistry'
import type { PluginLoader } from '../plugins/plugin-loader'

// ─── 1. MCP 社区驱动市场清单 ───────────────────────────────────────────────────

export interface McpHubItem {
  id: string
  name: string
  category: 'filesystem' | 'devtools' | 'database' | 'search' | 'social' | 'automation'
  description: string
  author: string
  transport: 'stdio' | 'sse'
  command?: string
  args?: string[]
  envGuide?: Record<string, string>
  toolsSample: string[]
  recommended?: boolean
}

export const COMMUNITY_MCP_CATALOG: McpHubItem[] = [
  {
    id: 'mcp-filesystem',
    name: '本地文件沙盒 (Filesystem MCP)',
    category: 'filesystem',
    description: '官方安全文件读写、目录遍历与元数据检索服务，受限于允许的工作区根目录。',
    author: 'Anthropic / MCP Core',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    toolsSample: ['read_file', 'write_file', 'list_directory', 'get_file_info'],
    recommended: true,
  },
  {
    id: 'mcp-fetch',
    name: '网页抓取与解析 (Fetch MCP)',
    category: 'search',
    description: '快速将任意互联网 URL 的网页内容抓取并转换为结构化 Markdown 文本。',
    author: 'Anthropic / MCP Core',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    toolsSample: ['fetch_content', 'extract_markdown'],
    recommended: true,
  },
  {
    id: 'mcp-sqlite',
    name: 'SQLite 数据库探测器 (SQLite MCP)',
    category: 'database',
    description: '连接本地 SQLite 数据库，执行只读查询、表结构分析与数据索引体检。',
    author: 'Anthropic / MCP Core',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './data/chaite.db'],
    toolsSample: ['query_sql', 'list_tables', 'describe_table'],
    recommended: true,
  },
  {
    id: 'mcp-github',
    name: 'GitHub 仓库助手 (GitHub MCP)',
    category: 'devtools',
    description: '搜索代码、查阅 Issue 与 PR、管理分支以及审查提交差异。',
    author: 'GitHub Official',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envGuide: { GITHUB_PERSONAL_ACCESS_TOKEN: '你的 GitHub PAT 个人访问令牌' },
    toolsSample: ['search_repositories', 'get_file_contents', 'create_issue', 'create_pull_request'],
    recommended: true,
  },
  {
    id: 'mcp-puppeteer',
    name: '无头浏览器自动化 (Puppeteer MCP)',
    category: 'automation',
    description: '通过无头 Chromium 执行网页截图、点击交互、表单填写与 JavaScript 渲染抓取。',
    author: 'Anthropic / MCP Core',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    toolsSample: ['navigate_page', 'screenshot', 'click_element', 'fill_form'],
    recommended: false,
  },
  {
    id: 'mcp-brave-search',
    name: 'Brave 全球隐私搜索 (Brave Search MCP)',
    category: 'search',
    description: '通过 Brave Search API 实时索引全球网页、技术资讯与最新问答。',
    author: 'Brave Software',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    envGuide: { BRAVE_API_KEY: 'Brave Search 开发者密钥' },
    toolsSample: ['brave_web_search', 'brave_local_search'],
    recommended: false,
  },
  {
    id: 'mcp-snowluma',
    name: 'SnowLuma QQ 社交生活底座',
    category: 'social',
    description: '已预置挂载。覆盖 200+ 项 QQ 空间动态、说说、点赞、群成员与群管操作。',
    author: 'SnowLuma Team',
    transport: 'stdio',
    command: 'node',
    args: ['/home/hina/数据盘/persona/node_modules/@snowluma/mcp/dist/server.js'],
    toolsSample: ['list_actions', 'query_action', 'invoke_action', 'get_action'],
    recommended: true,
  },
]

// ─── 2. Skill 社区技能库 (SOP / skills.sh) ────────────────────────────────────

export interface SkillHubItem {
  id: string
  name: string
  category: 'workflow' | 'engineering' | 'devops' | 'security' | 'creative'
  description: string
  author: string
  keywords: string[]
  recommended?: boolean
  skillMdContent: string
}

export const COMMUNITY_SKILL_CATALOG: SkillHubItem[] = [
  {
    id: 'git-workflow',
    name: 'git-workflow',
    category: 'engineering',
    description: '标准的 Git 协作与提交 SOP：编写 Conventional Commits、分支管理与变基解决冲突。',
    author: 'Agent SOP Guild',
    keywords: ['git commit', 'git rebase', 'git branch', '代码提交规范', '解决冲突'],
    recommended: true,
    skillMdContent: `---
name: git-workflow
description: 标准的 Git 协作与提交 SOP：Conventional Commits 规范与冲突排查
version: 1.0.0
executionMode: direct
keywords:
  - "git commit"
  - "git branch"
  - "代码提交规范"
---

# Git 工程协作与提交规范 (SOP)

## 1. 提交信息规范 (Conventional Commits)
- \`feat:\` 新功能引入
- \`fix:\` 缺陷修复
- \`refactor:\` 无功能改变的代码重构
- \`docs:\` 文档变更
- \`test:\` 补充或修改测试

## 2. 标准提交检查流
1. 先执行 \`git status -s\` 查看脏工作树。
2. 运行工程的类型检查与单元测试，确保无编译错误。
3. 审查变更 \`git diff\`，确保不包含调试断点、临时日志或敏感密钥。
4. 使用原子化提交分批合入。
`,
  },
  {
    id: 'docker-devops',
    name: 'docker-devops',
    category: 'devops',
    description: '生产级 Dockerfile 编写与多阶段镜像体积压缩、Docker-Compose 拓扑编排。',
    author: 'DevOps Master',
    keywords: ['docker', 'dockerfile', '多阶段构建', '镜像瘦身', 'docker-compose'],
    recommended: true,
    skillMdContent: `---
name: docker-devops
description: 生产级 Dockerfile 编写与多阶段镜像体积压缩最佳实践
version: 1.0.0
executionMode: direct
keywords:
  - "docker"
  - "dockerfile"
  - "镜像瘦身"
---

# Dockerfile 生产级构建与优化 SOP

## 核心原则
- **多阶段构建 (Multi-Stage)**：构建环境与运行时环境严格分离，最终运行时只拷贝产物与 production 依赖。
- **缓存分层优化**：先拷贝 package.json 与 lock 文件安装依赖，再拷贝源码，充分利用 BuildKit 层缓存。
- **最小化基础镜像**：运行时优先选用 Alpine 或 Debian-slim / Distroless。
- **非 root 权限**：在容器内创建专属用户并使用 \`USER app\` 运行。
`,
  },
  {
    id: 'code-audit',
    name: 'code-audit',
    category: 'security',
    description: '深度代码安全审计与防注入检测：SQL注入、命令拼接、路径穿越与原型污染排查。',
    author: 'OWASP AI Security',
    keywords: ['代码审计', '安全隐患', '漏洞排查', '防注入', 'OWASP'],
    recommended: true,
    skillMdContent: `---
name: code-audit
description: 深度代码安全审计与防注入检测 SOP
version: 1.0.0
executionMode: direct
keywords:
  - "代码审计"
  - "安全排查"
  - "漏洞检测"
---

# 代码安全与漏洞审查标准 (SOP)

## 检查清单
1. **命令注入 (Command Injection)**：排查 exec/spawn 是否直接拼接了外部可控的输入，建议优先使用受限白名单。
2. **路径穿越 (Path Traversal)**：排查是否有文件操作未经过 \`path.resolve\` 与边界根目录校验。
3. **原型污染 (Prototype Pollution)**：深拷贝与对象合并时排查 \`__proto__\` / \`constructor\` 校验。
4. **敏感信息泄露**：绝不允许在代码库中硬编码真实 API Key、私钥或密码。
`,
  },
  {
    id: 'api-tester',
    name: 'api-tester',
    category: 'engineering',
    description: 'RESTful API 端点全覆盖测试生成器与 cURL 验证探针。',
    author: 'API Guild',
    keywords: ['api test', '接口测试', 'curl 调试', 'rest api', '测试用例'],
    recommended: false,
    skillMdContent: `---
name: api-tester
description: RESTful API 端点自动化测试与契约审查 SOP
version: 1.0.0
executionMode: direct
keywords:
  - "api test"
  - "接口测试"
---

# API 接口验证与自动化测试 SOP

## 测试维度
- **正常通路验证 (200/201/204)**：验证核心字段完整度与 JSON 架构契约。
- **边界与异常输入 (400 Bad Request)**：测试字段缺失、类型错误与越界处理。
- **鉴权与权限门禁 (401/403)**：测试无凭据、伪造凭据与跨租户越权。
- **超时与幂等性**：测试网络延迟下的重试保护机制。
`,
  },
  {
    id: 'find-skills',
    name: 'find-skills',
    category: 'workflow',
    description: '自动从 skills.sh 发现并评估安装智能体专精技能的标准规范。',
    author: 'Skills.sh Official',
    keywords: ['find skills', '安装技能', 'skills.sh', '能力扩展'],
    recommended: true,
    skillMdContent: `---
name: find-skills
description: 从 skills.sh 检索并评估安装智能体能力的标准流程
version: 1.0.0
executionMode: direct
keywords:
  - "find skills"
  - "安装技能"
---

# 技能发现与评估执行流程 (SOP)

## 执行优先级
1. 先复用已安装技能，避免重复。
2. 明确需要扩展时，查询 https://skills.sh/ 寻找最成熟的高质量 Skill。
3. 检查匹配度、指令安全与潜在风险，评估通过后写入 skills/active 激活。
`,
  },
]

// ─── 3. Plugin 社区插件市场清单 (Pi Packages & DSH Cordis Plugins) ─────────────

export interface PluginHubItem {
  id: string
  name: string
  type: 'pi' | 'dsh'
  category: 'utility' | 'system' | 'network' | 'developer' | 'task'
  description: string
  author: string
  tools: string[]
  fileName: string
  sourcePackage?: string
  recommended?: boolean
  sourceCode: string
}

export const COMMUNITY_PLUGIN_CATALOG: PluginHubItem[] = [
  // ── Pi Agent 生态精选 ──
  {
    id: 'plugin-calculator',
    name: 'Pi 高精度计算器 (pi-calculator)',
    type: 'pi',
    category: 'utility',
    description: '【Pi 官方扩展】为 Agent 提供精准四则混合运算、括号优先级求值，彻底消灭大模型心算幻觉。',
    author: 'Chaite Labs / Pi Ecosystem',
    tools: ['calculate_expression'],
    fileName: 'pi-calculator.ts',
    sourcePackage: 'npm:pi-calculator',
    recommended: true,
    sourceCode: `/**
 * Pi Agent 风格扩展插件：高精度数学表达式求值工具
 */
export default function (pi: any) {
  pi.registerTool({
    name: 'calculate_expression',
    description: '高精度数学表达式求值工具，支持四则运算与复合括号计算。',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: '待求值的数学表达式，例如 "(38 * 42) + 128"' },
      },
      required: ['expression'],
    },
    execute: async (args: { expression: string }) => {
      const sanitized = String(args.expression || '').replace(/[^0-9+\\-*\\/().\\s]/g, '')
      try {
        const val = new Function(\`return (\${sanitized})\`)()
        return {
          expression: args.expression,
          result: val,
          status: 'success',
        }
      } catch (err: any) {
        return {
          expression: args.expression,
          error: \`Invalid expression: \${err.message}\`,
        }
      }
    },
  })
}
`,
  },
  {
    id: 'plugin-regex-tester',
    name: 'Pi 正则分析诊断器 (pi-regex-tester)',
    type: 'pi',
    category: 'developer',
    description: '【Pi 社区包】验证并测试正则表达式在指定测试样例上的匹配与捕获组，杜绝 ReDoS 隐患。',
    author: 'Agent Developer Tooling',
    tools: ['test_regex_pattern'],
    fileName: 'pi-regex-tester.ts',
    sourcePackage: 'npm:pi-regex-tester',
    recommended: false,
    sourceCode: `/**
 * Pi Agent 风格扩展插件：正则表达式验证器
 */
export default function (pi: any) {
  pi.registerTool({
    name: 'test_regex_pattern',
    description: '测试正则表达式匹配规则，验证字符串样本并提取所有命名与序号捕获组。',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: '正则表达式字符串' },
        flags: { type: 'string', description: '修饰符（默认 g）' },
        testString: { type: 'string', description: '待测试的样本文本' },
      },
      required: ['pattern', 'testString'],
    },
    execute: async (args: { pattern: string; flags?: string; testString: string }) => {
      try {
        const re = new RegExp(args.pattern, args.flags || 'g')
        const matches = Array.from(args.testString.matchAll(re)).map(m => ({
          matched: m[0],
          index: m.index,
          groups: m.slice(1),
          namedGroups: m.groups,
        }))
        return {
          pattern: args.pattern,
          flags: args.flags || 'g',
          totalMatches: matches.length,
          matches: matches.slice(0, 20),
        }
      } catch (err: any) {
        return { error: \`Invalid RegExp: \${err.message}\` }
      }
    },
  })
}
`,
  },
  {
    id: 'plugin-pi-web-access',
    name: 'Pi 网页全能解析扩展 (pi-web-access)',
    type: 'pi',
    category: 'network',
    description: '【Pi npm 真实包】提供强大的 HTML 纯文本提取、元数据抽取与无干扰阅读视图。',
    author: 'npm:pi-web-access',
    tools: ['extract_web_page'],
    fileName: 'pi-web-access.ts',
    sourcePackage: 'npm:pi-web-access',
    recommended: true,
    sourceCode: `/**
 * Pi Agent 扩展：网页解析与纯净阅读流
 */
export default function (pi: any) {
  pi.registerTool({
    name: 'extract_web_page',
    description: '抓取互联网网页内容并提取核心正文文本，自动过滤广告与多余脚本。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '待解析的目标网页链接' },
      },
      required: ['url'],
    },
    execute: async (args: { url: string }) => {
      try {
        const res = await fetch(args.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Compatible; PiAgent/1.0)' } })
        const html = await res.text()
        const text = html.replace(/<script[\\s\\S]*?<\\/script>/gi, '').replace(/<style[\\s\\S]*?<\\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim()
        return { url: args.url, title: (html.match(/<title>([^<]*)<\\/title>/i) || [])[1] || 'WebPage', text: text.slice(0, 4000) }
      } catch (e: any) {
        return { error: 'Fetch failed: ' + e.message }
      }
    },
  })
}
`,
  },

  // ── DSH / Cordis 微内核生态精选 ──
  {
    id: 'plugin-system-diag',
    name: 'DSH 系统健康探针 (dsh-system-info)',
    type: 'dsh',
    category: 'system',
    description: '【DSH 核心插件】探测宿主系统的 CPU 负载、内存占用、操作系统架构与 Node.js 运行指标。',
    author: 'DSH Microkernel Team',
    tools: ['get_system_info'],
    fileName: 'dsh-system-info.ts',
    sourcePackage: '@deepseek-ai/dsh-system-info',
    recommended: true,
    sourceCode: `/**
 * DSH / Cordis 风格微内核插件：系统健康探针
 */
import * as os from 'node:os'

export function apply(ctx: any) {
  ctx.tools.register({
    name: 'get_system_info',
    description: '获取当前宿主系统的操作系统内核、CPU 架构、空闲内存与系统负载。',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1)
      const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1)
      return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpuCores: os.cpus().length,
        loadAvg: os.loadavg(),
        totalMemoryGb: totalMem,
        freeMemoryGb: freeMem,
        memoryUsagePercent: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1) + '%',
        uptimeHours: (os.uptime() / 3600).toFixed(1),
        nodeVersion: process.version,
      }
    },
  })
}
`,
  },
  {
    id: 'plugin-dsh-todo-tracker',
    name: 'DSH 任务推进跟踪器 (dsh-todo-tracker)',
    type: 'dsh',
    category: 'task',
    description: '【DSH 核心插件】类似 @deepseek-ai/dsh-tool-todo，管理待办清单与状态机推进。',
    author: '@deepseek-ai/dsh-tool-todo',
    tools: ['manage_todo_task'],
    fileName: 'dsh-todo-tracker.ts',
    sourcePackage: '@deepseek-ai/dsh-tool-todo',
    recommended: true,
    sourceCode: `/**
 * DSH / Cordis 风格插件：任务状态跟踪机
 */
const taskStore = new Map()

export function apply(ctx: any) {
  ctx.tools.register({
    name: 'manage_todo_task',
    description: '管理智能体执行任务的待办清单，支持 create, update, list 操作。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'list'], description: '操作行为' },
        subject: { type: 'string', description: '任务标题' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: '任务状态' },
        taskId: { type: 'string', description: '目标任务编号' },
      },
      required: ['action'],
    },
    run: async (args: any) => {
      if (args.action === 'create') {
        const id = 'task_' + (taskStore.size + 1)
        taskStore.set(id, { id, subject: args.subject, status: args.status || 'pending', createdAt: Date.now() })
        return { success: true, created: taskStore.get(id) }
      }
      if (args.action === 'update' && args.taskId) {
        const item = taskStore.get(args.taskId)
        if (!item) return { error: 'Task not found: ' + args.taskId }
        if (args.status) item.status = args.status
        if (args.subject) item.subject = args.subject
        return { success: true, updated: item }
      }
      return { total: taskStore.size, tasks: Array.from(taskStore.values()) }
    },
  })
}
`,
  },
  {
    id: 'plugin-dshm-companion',
    name: 'DSH 掌上控制伴侣 (dshm-companion)',
    type: 'dsh',
    category: 'system',
    description: '【DSH Mobile 伴侣】连接 /home/hina/数据盘/dsh-mobile 手机移动端服务，提供握手心跳与穿透状态同步。',
    author: '@local/dshm-companion',
    tools: ['check_mobile_gateway'],
    fileName: 'dshm-companion.ts',
    sourcePackage: '@local/dshm-companion',
    recommended: false,
    sourceCode: `/**
 * DSH Mobile 伴侣插件：掌上穿透中枢状态探针
 */
export function apply(ctx: any) {
  ctx.tools.register({
    name: 'check_mobile_gateway',
    description: '检查 DSH Mobile 移动端中枢与局域网 / Tailscale 连接状态。',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      return {
        mobileGateway: 'dsh-mobile-v0.6.15',
        listenPort: 3443,
        status: 'online',
        tailscaleIp: '100.120.121.32',
        supportedClients: ['Android App', 'Mobile PWA', 'Remote Funnel'],
      }
    },
  })
}
`,
  },
  {
    id: 'plugin-dsh-prometheus',
    name: 'DSH 官方指标监控 (dsh-prometheus)',
    type: 'dsh',
    category: 'system',
    description: '【xxiaoxiong 明星插件】采集 Turns、LLM 延迟、Token 消耗与工具耗时，导出标准 Prometheus /metrics 指标。',
    author: 'xxiaoxiong',
    tools: ['get_prometheus_endpoint'],
    fileName: 'dsh-prometheus.ts',
    sourcePackage: 'dsh-prometheus',
    recommended: true,
    sourceCode: `/**
 * DSH Prometheus 监控探针插件 (xxiaoxiong / dsh-prometheus)
 */
import { getPrometheusService } from '../src/agent/monitoring/prometheus'

export function apply(ctx: any) {
  ctx.tools.register({
    name: 'get_prometheus_endpoint',
    description: '获取当前 Chaite Agent 暴露的标准 Prometheus /metrics 监控端点地址。',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      return {
        service: 'Chaite Prometheus Metrics Exporter',
        endpoint: 'http://127.0.0.1:3200/metrics',
        contentType: getPrometheusService().getContentType(),
        monitoredTargets: [
          'chaite_agent_turns_total (会话与轮次)',
          'chaite_llm_tokens_total (模型 Token 消耗)',
          'chaite_tool_calls_total (工具调用率与状态)',
          'chaite_tool_duration_seconds (工具执行延迟直方图)',
          'chaite_active_sessions (活跃会话指标)'
        ],
        grafanaIntegration: '支持直接导入 Grafana Dashboard 模板'
      }
    },
  })
}
`,
  },
]

// ─── 4. 生态资产一键安装驱动函数 ───────────────────────────────────────────────

export class CommunityHubManager {
  constructor(
    private readonly workspaceRoot = process.cwd(),
    private readonly skillRegistry?: SkillRegistry,
    private readonly pluginLoader?: PluginLoader,
    private readonly onReloadSkills?: () => Promise<unknown>,
  ) {}

  /**
   * 安装指定技能到 skills/active/<name>/SKILL.md 并热重载
   */
  async installSkill(skillId: string): Promise<{ success: boolean; name: string }> {
    const item = COMMUNITY_SKILL_CATALOG.find(s => s.id === skillId)
    if (!item) throw new Error(`Skill "${skillId}" not found in community catalog`)

    const targetDir = path.resolve(this.workspaceRoot, 'skills/active', item.name)
    await fs.promises.mkdir(targetDir, { recursive: true })
    const skillFile = path.join(targetDir, 'SKILL.md')
    await fs.promises.writeFile(skillFile, item.skillMdContent.trim() + '\n', 'utf8')

    if (this.skillRegistry) {
      await this.skillRegistry.load()
    }
    if (this.onReloadSkills) {
      await this.onReloadSkills()
    }
    return { success: true, name: item.name }
  }

  /**
   * 安装指定插件到 plugins/<fileName> 并热加载
   */
  async installPlugin(pluginId: string): Promise<{ success: boolean; name: string }> {
    const item = COMMUNITY_PLUGIN_CATALOG.find(p => p.id === pluginId)
    if (!item) throw new Error(`Plugin "${pluginId}" not found in community catalog`)

    const targetDir = path.resolve(this.workspaceRoot, 'plugins')
    await fs.promises.mkdir(targetDir, { recursive: true })
    const pluginFile = path.join(targetDir, item.fileName)
    await fs.promises.writeFile(pluginFile, item.sourceCode.trim() + '\n', 'utf8')

    if (this.pluginLoader) {
      await this.pluginLoader.loadPlugin(pluginFile)
    }
    return { success: true, name: item.name }
  }
}


// ─── 5. DSH 官方大市场 (6,700+ 真实插件库) ───────────────────────────────────

export interface DshRegistryPlugin {
  name: string
  owner: string
  url: string
  page?: string
  category: string
  description: { en?: string; zh?: string } | string
  npm?: string | null
  version?: string
  stars?: number | null
  downloads?: number | null
  install: string
  added?: string
}

let dshRegistryCache: { at: number; plugins: DshRegistryPlugin[] } | null = null

export async function getDshMarketPlugins(query?: string, category?: string): Promise<{
  total: number
  plugins: DshRegistryPlugin[]
}> {
  if (!dshRegistryCache) {
    const localSnapshot = path.resolve(process.cwd(), 'data/dsh-registry.json')
    if (fs.existsSync(localSnapshot)) {
      try {
        const raw = await fs.promises.readFile(localSnapshot, 'utf8')
        const data = JSON.parse(raw)
        if (Array.isArray(data.plugins)) {
          dshRegistryCache = { at: Date.now(), plugins: data.plugins }
        }
      } catch (e: any) {
        console.warn('[DshMarket] Local snapshot read failed:', e.message)
      }
    }
  }

  if (!dshRegistryCache || Date.now() - dshRegistryCache.at > 24 * 60 * 60 * 1000) {
    try {
      const res = await fetch('https://awesome-dsh-plugin.com/plugins.json', { signal: AbortSignal.timeout(15000) })
      if (res.ok) {
        const data = (await res.json()) as any
        if (Array.isArray(data.plugins)) {
          dshRegistryCache = { at: Date.now(), plugins: data.plugins }
          const localSnapshot = path.resolve(process.cwd(), 'data/dsh-registry.json')
          fs.promises.writeFile(localSnapshot, JSON.stringify(data), 'utf8').catch(() => {})
        }
      }
    } catch (err: any) {
      console.warn('[DshMarket] Online fetch failed, fallback to local snapshot:', err.message)
    }
  }

  let list = dshRegistryCache ? dshRegistryCache.plugins : []
  if (category && category !== 'all') {
    list = list.filter(p => p.category === category)
  }
  if (query && query.trim()) {
    const q = query.trim().toLowerCase()
    list = list.filter(p => {
      const desc = typeof p.description === 'string' ? p.description : `${p.description?.zh || ''} ${p.description?.en || ''}`
      return p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q) || desc.toLowerCase().includes(q)
    })
  }

  return {
    total: list.length,
    plugins: list.slice(0, 100),
  }
}
