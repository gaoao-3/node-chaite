import {
  calculate4DScores,
  deriveKebabName,
  generateSkillMarkdown,
  shouldSynthesizeSkill,
  synthesizeAndRecordEvolution,
  type TurnExecutionRecord,
} from './evolution-synthesizer'
import { EvolutionService } from './evolution-service'

describe('EvolutionSynthesizer (Hermes & nekocode)', () => {
  const sampleRecord: TurnExecutionRecord = {
    sessionId: 'web:session_test',
    platform: 'web',
    botId: 'web-console',
    prompt: '排查 Docker 容器 3001 端口拒绝连接并自动重启验证',
    replyText: '已成功诊断 3001 端口拒绝连接问题，通过重启容器并执行 ws ping 探针验证，服务现已恢复健康。',
    toolCalls: [
      {
        id: 'c1',
        name: 'read_log',
        arguments: { path: '/var/log/app.log', lines: 50 },
        status: 'succeeded',
        resultPreview: 'connection refused on port 3001',
        durationMs: 120,
      },
      {
        id: 'c2',
        name: 'restart_service',
        arguments: { service: 'app-container' },
        status: 'succeeded',
        resultPreview: 'service restarted successfully',
        durationMs: 850,
      },
      {
        id: 'c3',
        name: 'ping_port',
        arguments: { port: 3001 },
        status: 'succeeded',
        resultPreview: 'pong: 1ms',
        durationMs: 45,
      },
    ],
    errorRetries: [
      {
        attempt: 1,
        error: { message: 'Connection refused on port 3001' },
        recovered: true,
      },
    ],
    startedAt: 1700000000000,
    completedAt: 1700000003000,
  }

  it('correctly evaluates shouldSynthesizeSkill heuristics', () => {
    expect(shouldSynthesizeSkill(sampleRecord)).toBe(true)

    const simpleGreeting: TurnExecutionRecord = {
      sessionId: 'web:chitchat',
      prompt: '你好',
      replyText: '你好呀！',
      toolCalls: [],
      errorRetries: [],
      startedAt: 1700000000000,
      completedAt: 1700000000500,
    }
    expect(shouldSynthesizeSkill(simpleGreeting)).toBe(false)
  })

  it('calculates 4-dimension scores according to nekocode standard', () => {
    const scores = calculate4DScores(sampleRecord)
    expect(scores.correctness).toBeGreaterThanOrEqual(0.8)
    expect(scores.efficiency).toBe(1.0)
    expect(scores.safety).toBe(0.95)
    expect(scores.reusability).toBe(0.88)

    const composite = (scores.correctness + scores.efficiency + scores.safety + scores.reusability) * 2
    expect(composite).toBeGreaterThanOrEqual(6.0) // 达到 6/8 分合入门禁
  })

  it('generates a valid draft SKILL.md with frontmatter and SOP steps', () => {
    const scores = calculate4DScores(sampleRecord)
    const name = deriveKebabName(sampleRecord.prompt, ['read_log', 'restart_service'])
    const { markdown, lessons } = generateSkillMarkdown(name, sampleRecord, scores)

    expect(markdown).toContain('---')
    expect(markdown).toContain(`name: ${name}`)
    expect(markdown).toContain('read_log')
    expect(markdown).toContain('restart_service')
    expect(markdown).toContain('避坑指南')
    expect(lessons.length).toBeGreaterThan(0)
  })

  it('synthesizes and automatically inserts trace into EvolutionService', async () => {
    const evolutionService = new EvolutionService()
    const trace = await synthesizeAndRecordEvolution(sampleRecord, evolutionService)

    expect(trace).not.toBeNull()
    expect(trace?.scores.correctness).toBeGreaterThanOrEqual(0.8)
    expect(evolutionService.list().total).toBe(1)
    const record = evolutionService.get(trace!.traceId)
    expect(record?.gatePassed).toBe(true)
  })
})
