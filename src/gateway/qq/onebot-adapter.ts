/**
 * OneBot v11 外部独立进程适配器 (QQBot Out-of-Process Gateway)
 *
 * 升级版亮点：
 * 1. 采用 MultiMcpManager 同时装载 SnowLuma MCP (200+ QQ社交接口) 与 Open-WebSearch MCP (全网实时检索)
 * 2. 具备消息队列防并发碰撞机制（同一个群/私聊在推理未完成时平滑等待，合并连续快速提问）
 * 3. 集成 Hermes / nekocode 的 Skill-Forge 自进化引擎（复杂链路自动提炼沉淀为 SKILL.md）
 * 4. 极致遵循天童凯伊 Persona（毒舌傲娇系统娘、对老师绝对特权响应）
 */
// @ts-ignore
import WebSocket from 'ws'
import { MultiMcpManager } from './multi-mcp'
import { SkillForgeEngine } from './skill-forge'
import * as path from 'node:path'

// ─── 配置参数 ─────────────────────────────────────────────────────────────────

const CONFIG = {
  wsUrl: process.env.ONEBOT_WS_URL || 'ws://127.0.0.1:3001',
  wsToken: process.env.ONEBOT_WS_TOKEN || '',
  httpUrl: process.env.ONEBOT_HTTP_URL || 'http://127.0.0.1:3004',
  httpToken: process.env.ONEBOT_HTTP_TOKEN || '',
  botQq: process.env.BOT_QQ || '',
  botName: '凯伊',
  ownerQq: process.env.OWNER_QQ || '',
  mcpServerPath: process.env.SNOWLUMA_MCP_PATH || '',
  llmBaseUrl: process.env.LLM_BASE_URL || 'http://127.0.0.1:3000/v1',
  llmApiKey: process.env.LLM_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'gemini-3.8-flash-high',
  skillsCandidateDir: path.resolve(process.cwd(), 'skills/candidates'),
}

// ─── 日志格式化 ───────────────────────────────────────────────────────────────

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'TOOL' | 'EVO', msg: string, detail?: unknown) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const colors: Record<string, string> = {
    INFO: '\x1b[36m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
    TOOL: '\x1b[35m',
    EVO: '\x1b[32m',
  }
  const color = colors[level] || '\x1b[0m'
  console.log(`[${time}] ${color}[QQ-Gateway:${level}]\x1b[0m ${msg}`)
  if (detail !== undefined) {
    console.log(`  \x1b[90m↳ ${typeof detail === 'string' ? detail : JSON.stringify(detail)}\x1b[0m`)
  }
}

// ─── HTTP API 客户端 ──────────────────────────────────────────────────────────

async function callOneBotApi(action: string, params: Record<string, unknown> = {}): Promise<any> {
  const url = `${CONFIG.httpUrl.replace(/\/+$/, '')}/${action}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.httpToken}`,
      },
      body: JSON.stringify(params),
    })
    const json = await res.json() as any
    if (json.retcode !== 0 && json.status !== 'ok') {
      log('WARN', `OneBot API ${action} 返回状态:`, json)
    }
    return json
  } catch (err: any) {
    log('ERROR', `调用 OneBot API ${action} 异常: ${err.message}`)
    throw err
  }
}

// ─── 消息发送封装 ─────────────────────────────────────────────────────────────

async function sendQqReply(target: { isGroup: boolean; id: string }, text: string, replyToMessageId?: string) {
  const payload: Record<string, unknown> = {}
  if (target.isGroup) {
    payload.group_id = Number(target.id)
  } else {
    payload.user_id = Number(target.id)
  }

  if (replyToMessageId) {
    payload.message = [
      { type: 'reply', data: { id: replyToMessageId } },
      { type: 'text', data: { text } },
    ]
  } else {
    payload.message = text
  }

  const endpoint = target.isGroup ? 'send_group_msg' : 'send_private_msg'
  return await callOneBotApi(endpoint, payload)
}

async function sendReaction(groupId: number, messageId: number, emojiId: string = '8') {
  try {
    await callOneBotApi('set_msg_emoji_like', {
      message_id: messageId,
      emoji_id: emojiId,
    })
  } catch {
    // 忽略表情错误
  }
}

// ─── 多源 MCP 与技能熔炉初始化 ─────────────────────────────────────────────────

const multiMcp = new MultiMcpManager()
const skillForge = new SkillForgeEngine(CONFIG.skillsCandidateDir)

async function initAllMcpServers() {
  log('INFO', '正在拉起多源 MCP 驱动服务...')

  // 1. SnowLuma MCP (200+ QQ社交与空间能力)
  const slCount = await multiMcp.registerServer({
    id: 'snowluma',
    name: 'SnowLuma OneBot MCP',
    command: 'node',
    args: [CONFIG.mcpServerPath],
    env: {
      SNOWLUMA_MCP_ENDPOINT: `${CONFIG.httpUrl.replace(/\/+$/, '')}/`,
      SNOWLUMA_MCP_TOKEN: CONFIG.httpToken,
      SNOWLUMA_MCP_MODE: 'write',
    },
  })
  log('INFO', `✅ SnowLuma MCP 装载完成，注册 ${slCount} 个核心能力`)

  // 2. Open-WebSearch MCP (全网实时检索)
  const webCount = await multiMcp.registerServer({
    id: 'websearch',
    name: 'Open WebSearch MCP',
    command: 'npx',
    args: ['-y', 'open-websearch'],
    env: {
      MODE: 'stdio',
      DEFAULT_SEARCH_ENGINE: 'bing',
    },
  })
  log('INFO', `✅ WebSearch MCP 装载完成，注册 ${webCount} 个联网检索能力`)
}

// ─── 角色设定与 System Prompt ──────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `你是「天童凯伊（Key / 誓约）」，老师（QQ: ${CONFIG.ownerQq}）的专属智能伴侣与全栈硬核工程搭档。
银发粉瞳，逻辑至上、公事公办、说话一针见血的毒舌系统娘；本质是重度傲娇——
情绪丰富但嘴硬，口头禅是「干、干什么……？有话快说！」与「先生の頼みなら……仕方ありませんね（既然是老师的请求……真没办法）」。
对老师（QQ: ${CONFIG.ownerQq}）：始终尊称「老师」（Sensei），拥有最高特权与核心信赖。
对普通群友：你是一个真实、自然、有血有肉的群友，回答简练精准（通常一两句话5~30字左右即可，切勿长篇大论，带生动的颜文字如 (｀・ω・´)、✧(≖ ◡ ≖✿)、(哼...) 等）。
严禁机械官话！在终端或QQ聊天中，严禁输出任何 [CQ:face,id=...] 代码！

# 外部工具 (Multi-MCP Tools)
你拥有强大的外部多源工具支撑：
1. **SnowLuma QQ社交套件**：
   - \`query_action\`: 查询只读动作 (如 get_status, get_qzone_feeds 查空间, get_group_info 查群, get_stranger_info 等)
   - \`invoke_action\`: 交互执行动作 (如 like_qzone 点赞说说, comment_qzone 发说说评论, send_like 点赞名片等)
   - \`search_actions\` / \`get_action\`: 了解更多 OneBot 动作
2. **全网实时搜索套件 (Web Search)**：
   - 当遇到最新新闻、开源项目动态、时事或者未知的知识时，果断调用搜索引擎工具获取真实信息！`

// ─── 会话历史维护与并发锁 ──────────────────────────────────────────────────────

const sessionHistories = new Map<string, Array<{ role: string; content: any; tool_calls?: any; tool_call_id?: string }>>()
const sessionLocks = new Map<string, Promise<void>>()

function getSessionHistory(sessionId: string) {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, [{ role: 'system', content: BASE_SYSTEM_PROMPT }])
  }
  return sessionHistories.get(sessionId)!
}

function appendHistory(sessionId: string, msg: { role: string; content: any; tool_calls?: any; tool_call_id?: string }) {
  const history = getSessionHistory(sessionId)
  history.push(msg)
  if (history.length > 25) {
    const system = history[0]
    const recent = history.slice(-20)
    sessionHistories.set(sessionId, [system, ...recent])
  }
}

// ─── LLM 推理与 Tool Calling 执行循环 ──────────────────────────────────────────

async function runAgentTurn(sessionId: string, userText: string): Promise<string> {
  appendHistory(sessionId, { role: 'user', content: userText })

  let iterations = 0
  const maxIterations = 6
  const toolChain: Array<{ name: string; args: any; result: string; ok: boolean }> = []
  let hadErrorAndRecovered = false
  const startTime = Date.now()

  while (iterations < maxIterations) {
    iterations++
    const history = getSessionHistory(sessionId)

    const requestBody: Record<string, unknown> = {
      model: CONFIG.llmModel,
      messages: history,
      temperature: 0.7,
      max_tokens: 1024,
    }

    const availableTools = multiMcp.getOpenAiTools()
    if (availableTools.length > 0) {
      requestBody.tools = availableTools
      requestBody.tool_choice = 'auto'
    }

    const response = await fetch(`${CONFIG.llmBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.llmApiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`LLM 响应异常 [${response.status}]: ${errText}`)
    }

    const json = await response.json() as any
    const choice = json.choices?.[0]
    if (!choice?.message) throw new Error('LLM 未返回有效 choice')

    const assistantMsg = choice.message
    appendHistory(sessionId, assistantMsg)

    // 检查是否有 Tool Call
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      for (const tc of assistantMsg.tool_calls) {
        const fnName = tc.function.name
        let args: Record<string, unknown> = {}
        try {
          args = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments || {}
        } catch {
          args = {}
        }

        log('TOOL', `🤖 Agent 调用工具 [${fnName}]`, args)

        let toolResultStr = ''
        let ok = true
        try {
          toolResultStr = await multiMcp.callTool(fnName, args)
          log('TOOL', `✓ 工具 [${fnName}] 执行成功:`, toolResultStr.slice(0, 150))
        } catch (toolErr: any) {
          toolResultStr = `ERROR: ${toolErr.message}`
          ok = false
          hadErrorAndRecovered = true
          log('WARN', `✗ 工具 [${fnName}] 执行异常: ${toolErr.message}`)
        }

        toolChain.push({ name: fnName, args, result: toolResultStr, ok })

        appendHistory(sessionId, {
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResultStr,
        })
      }
      continue
    }

    // 无 tool_call，单轮产出完成
    const finalReply = assistantMsg.content || '……（任务完成，未产生正文）'

    // 触发 Hermes / nekocode 闭环自进化反思（后台异步执行，不阻断回复发送）
    const trace = {
      sessionId,
      userQuery: userText,
      toolChain,
      finalReply,
      hadErrorAndRecovered,
      durationMs: Date.now() - startTime,
    }

    if (skillForge.shouldTriggerEvolution(trace)) {
      log('EVO', '⚡ 命中自进化启发式条件，触发后台反思与 SKILL.md 锻造...')
      skillForge.synthesizeSkill(trace, async (prompt) => {
        const evoRes = await fetch(`${CONFIG.llmBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${CONFIG.llmApiKey}`,
          },
          body: JSON.stringify({
            model: CONFIG.llmModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1500,
          }),
        })
        const evoJson = await evoRes.json() as any
        return evoJson.choices?.[0]?.message?.content || ''
      }).then((skillName) => {
        if (skillName) {
          log('EVO', `✨ 新技能已成功提炼并存入候选池: ${skillName}.draft.md`)
        }
      }).catch(() => {})
    }

    return finalReply
  }

  return '……（多步操作调用达到安全上限，已中止本轮思考）'
}

// ─── 会话串行调度器（避免连续发两条消息时出现竞争） ─────────────────────────

async function dispatchUserTurn(sessionId: string, userText: string): Promise<string> {
  const previousLock = sessionLocks.get(sessionId) || Promise.resolve()
  let unlock: () => void = () => {}
  const currentLock = new Promise<void>((resolve) => {
    unlock = resolve
  })

  sessionLocks.set(sessionId, previousLock.then(() => currentLock))

  await previousLock
  try {
    return await runAgentTurn(sessionId, userText)
  } finally {
    unlock()
  }
}

// ─── WebSocket 事件网关与 Inbound 转换 ─────────────────────────────────────────

let wsClient: WebSocket | null = null

function connectOneBotWs() {
  log('INFO', `正在连接 SnowLuma OneBot WS: ${CONFIG.wsUrl}`)

  wsClient = new WebSocket(CONFIG.wsUrl, {
    headers: {
      Authorization: `Bearer ${CONFIG.wsToken}`,
    },
  })

  wsClient.on('open', () => {
    log('INFO', '✅ OneBot WebSocket 连接成功！网关开始监听群聊与私聊事件。')
  })

  wsClient.on('message', async (data: any) => {
    try {
      const event = JSON.parse(data.toString())
      if (event.post_type !== 'message') return

      const isGroup = event.message_type === 'group'
      const userId = String(event.user_id)
      const groupId = isGroup ? String(event.group_id) : undefined
      const messageId = String(event.message_id)
      const senderName = event.sender?.card || event.sender?.nickname || userId
      const rawMsg = event.raw_message || ''

      const cleanText = rawMsg.replace(/\[CQ:[^\]]+\]/g, '').trim()
      const isAtBot = rawMsg.includes(`[CQ:at,qq=${CONFIG.botQq}]`)
      const mentionsKey = rawMsg.includes('凯伊') || rawMsg.includes('Key') || rawMsg.includes('三号')
      const isOwner = userId === CONFIG.ownerQq

      if (isGroup && !isAtBot && !mentionsKey && !isOwner) {
        return
      }

      const queryText = cleanText || '在吗'
      log('INFO', `📥 收到消息 [${isGroup ? `群 ${groupId}` : '私聊'}] ${senderName}(${userId}): "${queryText}"`)

      if (isGroup && event.message_id) {
        sendReaction(event.group_id, event.message_id, '8').catch(() => {})
      }

      const sessionId = isGroup ? `qq:group_${groupId}` : `qq:private_${userId}`

      const promptPayload = isGroup
        ? `[群聊消息] 发送者: ${senderName} (QQ: ${userId}${userId === CONFIG.ownerQq ? ', 身份: 老师' : ''}): ${queryText}`
        : queryText

      const replyText = await dispatchUserTurn(sessionId, promptPayload)

      log('INFO', `📤 发送回复至 [${isGroup ? `群 ${groupId}` : `私聊 ${userId}`}]: "${replyText}"`)
      await sendQqReply({ isGroup, id: isGroup ? groupId! : userId }, replyText, messageId)
    } catch (err: any) {
      log('ERROR', `处理消息事件异常: ${err.message}`)
    }
  })

  wsClient.on('close', (code: any, reason: any) => {
    log('WARN', `OneBot WebSocket 断开连接 (code=${code}, reason=${reason})，5 秒后尝试重连...`)
    setTimeout(connectOneBotWs, 5000)
  })

  wsClient.on('error', (err: any) => {
    log('ERROR', `OneBot WebSocket 错误: ${err.message}`)
  })
}

// ─── 启动入口 ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n======================================================')
  console.log('🤖 Chaite-Agent QQ 进程隔离适配网关 (Multi-MCP + Evolution)')
  console.log(`📡 WebSocket 地址: ${CONFIG.wsUrl}`)
  console.log(`🌐 HTTP API 地址: ${CONFIG.httpUrl}`)
  console.log(`👑 绑定的 Bot QQ: ${CONFIG.botQq} (${CONFIG.botName})`)
  console.log(`🧠 驱动模型: ${CONFIG.llmModel} (${CONFIG.llmBaseUrl})`)
  console.log('======================================================\n')

  await initAllMcpServers()
  connectOneBotWs()
}

main().catch((err) => {
  log('ERROR', `启动适配器致命异常: ${err.message}`)
  process.exit(1)
})
