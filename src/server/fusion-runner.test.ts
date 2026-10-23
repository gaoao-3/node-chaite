import type { FusionTaskSpec } from '../agent/gateway-contracts'
import { FusionTaskService } from './fusion-service'
import { FusionRunner } from './fusion-runner'

function sampleSpec(overrides: Partial<FusionTaskSpec> = {}): FusionTaskSpec {
  return {
    task_id: 'task-runner-1',
    session_id: 'web:session_fusion',
    instruction: '实现 Dockerfile 多阶段构建并将体积缩减 30%',
    target_tools: [
      { name: 'read_file', source: 'builtin', required: true },
      { name: 'write_file', source: 'builtin', required: true },
    ],
    diff_schema: {
      format: 'unified_diff',
      path_scope: ['Dockerfile'],
      max_files: 1,
    },
    review_criteria: [
      { id: 'size_reduction', description: '最终镜像体积明显缩减', weight: 0.6, required: true },
      { id: 'syntax_clean', description: '无多余缓存残留', weight: 0.4 },
    ],
    created_at: Date.now(),
    ...overrides,
  }
}

describe('FusionRunner (Dual-Agent Collaboration Engine)', () => {
  it('executes task through Sidekick, submits diff, and performs cross-agent review to approve', async () => {
    const fusionService = new FusionTaskService()
    fusionService.create(sampleSpec())

    const runner = new FusionRunner({
      fusionService,
      sidekickModel: 'DeepSeek-V4.1-Flash (Executor)',
      mainModel: 'Claude-3.7-Sonnet (Architect)',
      mockExecutor: async (instruction) => {
        return {
          summary: `已完成多阶段构建重构: ${instruction}`,
          diff: `--- a/Dockerfile\n+++ b/Dockerfile\n@@ -1,3 +1,5 @@\n+FROM node:20-alpine AS builder\n+RUN pnpm build\n`,
          filesChanged: ['Dockerfile'],
          tests: [{ name: 'docker_build_check', passed: true }],
        }
      },
    })

    const executed = await runner.runTask('task-runner-1')

    // 验证状态机闭环
    expect(executed.status).toBe('approved')
    expect(executed.sidekick).toBe('DeepSeek-V4.1-Flash (Executor)')
    expect(executed.result?.diff).toContain('FROM node:20-alpine AS builder')
    expect(executed.reviews).toHaveLength(1)
    expect(executed.reviews[0].reviewer).toBe('Claude-3.7-Sonnet (Architect)')
    expect(executed.reviews[0].decision).toBe('approved')
    expect(executed.reviews[0].score).toBeGreaterThan(0.9)
  })

  it('rejects if a required criterion is not met', async () => {
    const fusionService = new FusionTaskService()
    fusionService.create(sampleSpec({ task_id: 'task-runner-2' }))

    const runner = new FusionRunner({
      fusionService,
      mockExecutor: async () => ({
        summary: '产物未达到预期',
        diff: '',
        filesChanged: [],
      }),
      mockReviewer: async () => ({
        decision: 'changes_requested',
        summary: '未提交实质代码变更，要求重新执行',
        criteria: [
          { criterionId: 'size_reduction', passed: false, score: 0.2, comment: '无有效 diff' },
          { criterionId: 'syntax_clean', passed: false, score: 0.2, comment: '未完成' },
        ],
      }),
    })

    const executed = await runner.runTask('task-runner-2')
    expect(executed.status).toBe('rejected')
    expect(executed.reviews[0].decision).toBe('rejected')
  })

  it('requests changes if non-required criterion is not met', async () => {
    const fusionService = new FusionTaskService()
    fusionService.create(sampleSpec({
      task_id: 'task-runner-3',
      review_criteria: [
        { id: 'size_reduction', description: '最终镜像体积明显缩减', weight: 0.6, required: false },
        { id: 'syntax_clean', description: '无多余缓存残留', weight: 0.4, required: false },
      ],
    }))

    const runner = new FusionRunner({
      fusionService,
      mockExecutor: async () => ({
        summary: '初步尝试完成',
        diff: '--- a/Dockerfile\n+++ b/Dockerfile\n',
        filesChanged: ['Dockerfile'],
      }),
      mockReviewer: async () => ({
        decision: 'changes_requested',
        summary: '尚有细节需完善',
        criteria: [
          { criterionId: 'size_reduction', passed: true, score: 0.9, comment: '基本合格' },
          { criterionId: 'syntax_clean', passed: false, score: 0.3, comment: '需清理缓存' },
        ],
      }),
    })

    const executed = await runner.runTask('task-runner-3')
    expect(executed.status).toBe('changes_requested')
    expect(executed.reviews[0].decision).toBe('changes_requested')
  })
})
