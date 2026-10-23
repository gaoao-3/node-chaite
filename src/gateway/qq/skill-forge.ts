/**
 * 4 维评估自进化技能熔炉 (Skill Forge Engine)
 * 借鉴 nekocode skill-forge 与 Hermes 闭环反思
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface EvolutionTraceEvent {
  sessionId: string
  userQuery: string
  toolChain: Array<{ name: string; args: any; result: string; ok: boolean }>
  finalReply: string
  hadErrorAndRecovered: boolean
  durationMs: number
}

export class SkillForgeEngine {
  constructor(private readonly storageDir: string) {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true })
    }
  }

  /**
   * 判定是否达到触发自进化的启发式条件：
   * 1. 工具调用链条 ≥ 3 步
   * 2. 或者在多步中发生过错误并自我重试/纠正恢复成功
   */
  shouldTriggerEvolution(trace: EvolutionTraceEvent): boolean {
    if (trace.toolChain.length >= 3) return true
    if (trace.hadErrorAndRecovered && trace.toolChain.length >= 2) return true
    return false
  }

  /**
   * 异步提炼并生成候选 SKILL.md
   */
  async synthesizeSkill(trace: EvolutionTraceEvent, llmCaller: (prompt: string) => Promise<string>): Promise<string | null> {
    const prompt = `你是一个资深的 Agent 自进化反思器 (Skill Synthesizer)。
刚才系统经历了一次复杂的工具调用与问题解决过程：
用户提问: ${trace.userQuery}
调用链路:
${trace.toolChain.map((t, idx) => `[第${idx + 1}步] 工具: ${t.name}, 入参: ${JSON.stringify(t.args)}, 结果状态: ${t.ok ? '成功' : '失败'}`).join('\n')}
最终输出总结: ${trace.finalReply.slice(0, 300)}

请对本次调用进行反思，提炼出一份符合标准化 SKILL.md 规范的技能草稿。
要求：
1. 包含 YAML frontmatter (name, description, triggers: [...], keywords: [...])
2. 给出详细的工作流步骤 (SOP)
3. 包含明确的【避坑禁忌】与【安全校验】
4. 输出纯 Markdown 内容，不要有其他寒暄。`

    try {
      const generated = await llmCaller(prompt)
      const cleaned = generated.replace(/^```markdown\s*/, '').replace(/```\s*$/, '').trim()

      const skillNameMatch = cleaned.match(/name:\s*([a-zA-Z0-9_-]+)/)
      const skillName = skillNameMatch ? skillNameMatch[1] : `evo-${Date.now()}`

      const candidatePath = path.join(this.storageDir, `${skillName}.draft.md`)
      await fs.promises.writeFile(candidatePath, cleaned, 'utf8')
      return skillName
    } catch (err: any) {
      console.error('[SkillForgeEngine] 技能提炼失败:', err.message)
      return null
    }
  }
}
