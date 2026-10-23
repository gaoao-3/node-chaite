<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  NAlert,
  NBadge,
  NButton,
  NCard,
  NCode,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NFlex,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NModal,
  NProgress,
  NSpace,
  NStatistic,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  evaluateSkillCandidate,
  fetchEvolutionTraceList,
  mergeEvolutionSkill,
} from '@/service/api/agent'
import type {
  EvolutionScores,
  EvolutionTraceRecord,
} from '@/service/api/agent'

const message = useMessage()

// ─── State ───────────────────────────────────────────────────────────────────

const loading = ref(false)
const tracesData = ref<EvolutionTraceRecord[]>([])
const selectedTrace = ref<EvolutionTraceRecord | null>(null)
const showDetailModal = ref(false)
const merging = ref(false)

// Quick Evaluator state
const testSkillContent = ref(`---
name: sample-quick-skill
description: 当遇到网络超时异常时自动重试与故障隔离
keywords: ["network timeout", "retry", "backoff"]
triggers: ["网络超时", "ETIMEDOUT", "socket hang up"]
executionMode: direct
---

# 故障快速自愈工作流
1. 检查本地网关与 DNS 解析状态。
2. 采用指数退避重试请求（最大 3 次）。
3. 避坑禁忌：禁止无间隔死循环重试，防止上游熔断。
`)
const evalResult = ref<{ scores: EvolutionScores; passed: boolean; compositeScore: number; breakdown: Record<string, string> } | null>(null)
const evaluating = ref(false)

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function loadTraces() {
  loading.value = true
  try {
    const res = await fetchEvolutionTraceList({ page: 1, pageSize: 20 })
    if (res.data?.items) {
      tracesData.value = res.data.items
    }
  } catch (err: any) {
    message.error(err?.message || '加载自进化轨迹列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTraces()
})

// ─── Actions ─────────────────────────────────────────────────────────────────

function handleOpenDetail(row: EvolutionTraceRecord) {
  selectedTrace.value = row
  showDetailModal.value = true
}

async function handleRunEvaluation() {
  if (!testSkillContent.value.trim()) return
  evaluating.value = true
  try {
    const res = await evaluateSkillCandidate(testSkillContent.value)
    if (res.data) {
      evalResult.value = res.data as any
      if (res.data.passed) {
        message.success('4 维门禁评估通过！得分 ≥ 6.0，达到合入标准')
      } else {
        message.warning('门禁未通过，请根据下方指标补充步骤或安全禁忌')
      }
    }
  } catch (err: any) {
    message.error(err?.message || '评估执行失败')
  } finally {
    evaluating.value = false
  }
}

async function handleMergeSkill() {
  if (!selectedTrace.value) return
  merging.value = true
  try {
    const res = await mergeEvolutionSkill(selectedTrace.value.traceId)
    if (res.data?.success) {
      message.success(`新技能【${res.data.skillName}】已成功锻造并装载至系统技能库！`)
      showDetailModal.value = false
      await loadTraces()
    }
  } catch (err: any) {
    message.error(err?.message || '技能合入失败')
  } finally {
    merging.value = false
  }
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const columns: DataTableColumns<EvolutionTraceRecord> = [
  {
    title: '轨迹 ID',
    key: 'traceId',
    width: 150,
    render(row) {
      return h('span', { class: 'font-mono text-xs font-semibold text-primary' }, row.traceId)
    },
  },
  {
    title: '来源平台',
    key: 'platform',
    width: 100,
    render(row) {
      const typeMap: Record<string, 'info' | 'success' | 'warning'> = {
        qq: 'info',
        dsh: 'success',
        web: 'warning',
      }
      return h(
        NTag,
        { size: 'small', type: typeMap[row.platform] || 'default', bordered: false },
        { default: () => row.platform.toUpperCase() },
      )
    },
  },
  {
    title: '用户意图',
    key: 'userIntent',
    ellipsis: { tooltip: true },
    render(row) {
      return h('span', { class: 'text-xs' }, row.userIntent.raw)
    },
  },
  {
    title: '工具调用链',
    key: 'toolCalls',
    width: 220,
    render(row) {
      return h(
        'div',
        { class: 'flex items-center gap-1 text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap' },
        row.toolCalls.map((c, idx) => {
          const isErr = c.status === 'error'
          return h(
            NTag,
            { size: 'tiny', type: isErr ? 'error' : 'default', secondary: true },
            { default: () => c.name },
          )
        }),
      )
    },
  },
  {
    title: '4 维综合评分',
    key: 'scores',
    width: 140,
    render(row) {
      const pass = row.compositeScore >= 6.0
      return h('div', { class: 'flex items-center gap-2' }, [
        h(
          NTag,
          { size: 'small', type: pass ? 'success' : 'warning', round: true },
          { default: () => `${row.compositeScore} / 8.0` },
        ),
        h('span', { class: 'text-xs text-neutral-400' }, pass ? '通过门禁' : '待优化'),
      ])
    },
  },
  {
    title: '自进化产物',
    key: 'draftSkillName',
    width: 180,
    render(row) {
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h('span', { class: 'font-mono text-xs font-medium' }, row.draftSkillName),
        row.mergedToSkill
          ? h(NTag, { size: 'tiny', type: 'success' }, { default: () => '已装载' })
          : h(NTag, { size: 'tiny', type: 'warning' }, { default: () => '待合入' }),
      ])
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render(row) {
      return h(
        NButton,
        {
          size: 'tiny',
          type: row.mergedToSkill ? 'default' : 'primary',
          secondary: row.mergedToSkill,
          onClick: () => handleOpenDetail(row),
        },
        { default: () => (row.mergedToSkill ? '查看轨迹' : '审查锻造') },
      )
    },
  },
]
</script>

<template>
  <div class="self-evolution-view space-y-4">
    <!-- Hero Concept Card -->
    <n-card :bordered="false" class="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-rose-500/10 border border-amber-500/20 rounded-xl">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-xl">🧬</span>
            <h3 class="text-lg font-bold tracking-tight">
              Hermes & nekocode 闭环自进化熔炉 (Skill-Forge)
            </h3>
            <n-tag type="warning" size="small" round>
              经验提炼为 SKILL.md
            </n-tag>
            <n-tag type="success" size="small" round>
              4 维门禁打分 (≥6.0)
            </n-tag>
          </div>
          <p class="text-xs text-neutral-500 max-w-2xl leading-relaxed">
            从真实对话和故障排查中自动反思。通过双文件沙箱隔离（低信任 insights 过滤为高信任 draft），经由触发质量、步骤清晰度、安全完整性、区分度 4 维评估门禁，将踩坑经验固化为长效技能，越用越聪明！
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <n-button secondary @click="loadTraces">
            刷新轨迹
          </n-button>
        </div>
      </div>
    </n-card>

    <!-- 4-Dimension Metric Showcase & Quick Evaluator -->
    <n-grid :cols="4" :x-gap="12" :y-gap="12">
      <n-grid-item>
        <n-card size="small" :bordered="false" class="rounded-lg border border-neutral-200/60 dark:border-neutral-800">
          <div class="space-y-1">
            <div class="text-xs font-semibold text-neutral-500">
              1. 触发质量 (Trigger Quality)
            </div>
            <div class="text-lg font-bold text-blue-500">
              3.0 <span class="text-xs text-neutral-400 font-normal">满分权重</span>
            </div>
            <p class="text-[11px] text-neutral-400">
              覆盖复杂场景而非简单动词，杜绝触发重叠。
            </p>
          </div>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card size="small" :bordered="false" class="rounded-lg border border-neutral-200/60 dark:border-neutral-800">
          <div class="space-y-1">
            <div class="text-xs font-semibold text-neutral-500">
              2. 步骤清晰度 (Step Clarity)
            </div>
            <div class="text-lg font-bold text-emerald-500">
              3.0 <span class="text-xs text-neutral-400 font-normal">满分权重</span>
            </div>
            <p class="text-[11px] text-neutral-400">
              每一步包含明确执行动作，解释“为什么”而非只说“做什么”。
            </p>
          </div>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card size="small" :bordered="false" class="rounded-lg border border-neutral-200/60 dark:border-neutral-800">
          <div class="space-y-1">
            <div class="text-xs font-semibold text-neutral-500">
              3. 安全完整性 (Completeness)
            </div>
            <div class="text-lg font-bold text-purple-500">
              2.0 <span class="text-xs text-neutral-400 font-normal">满分权重</span>
            </div>
            <p class="text-[11px] text-neutral-400">
              包含前置校验、验证探针与明确的高危避坑禁忌。
            </p>
          </div>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card size="small" :bordered="false" class="rounded-lg border border-neutral-200/60 dark:border-neutral-800">
          <div class="space-y-1">
            <div class="text-xs font-semibold text-neutral-500">
              4. 区分度 (Discriminability)
            </div>
            <div class="text-lg font-bold text-amber-500">
              Bonus <span class="text-xs text-neutral-400 font-normal">增量判定</span>
            </div>
            <p class="text-[11px] text-neutral-400">
              验证无此技能时基模无法正确完成，确保不收录冗余技能。
            </p>
          </div>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- Traces Data Table -->
    <n-card size="small" :bordered="false" class="rounded-lg shadow-sm border border-neutral-200/60 dark:border-neutral-800">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">实战执行轨迹与技能提炼记录</span>
          <span class="text-xs text-neutral-400">满足连续调用 ≥ 2 次或踩坑恢复的交互自动捕获</span>
        </div>
      </template>
      <n-data-table
        :columns="columns"
        :data="tracesData"
        :loading="loading"
        :pagination="{ pageSize: 10 }"
        size="small"
        striped
      />
    </n-card>

    <!-- Interactive 4D Evaluator Playground -->
    <n-card size="small" :bordered="false" class="rounded-lg shadow-sm border border-neutral-200/60 dark:border-neutral-800">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span>🔬</span>
            <span class="text-sm font-semibold">Skill-Forge 4 维门禁快速评估试炼场</span>
          </div>
          <n-button size="tiny" type="primary" :loading="evaluating" @click="handleRunEvaluation">
            执行门禁打分
          </n-button>
        </div>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div class="text-xs font-semibold mb-1 text-neutral-500">
            候选 SKILL.md 草稿文本
          </div>
          <n-input
            v-model:value="testSkillContent"
            type="textarea"
            rows="10"
            class="font-mono text-xs"
            placeholder="粘贴待评估的 SKILL.md 文本..."
          />
        </div>
        <div class="space-y-3">
          <div class="text-xs font-semibold text-neutral-500">
            门禁诊断结果
          </div>
          <div v-if="evalResult" class="space-y-3 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200/60 dark:border-neutral-800">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold">综合评定得分</span>
              <n-tag :type="evalResult.passed ? 'success' : 'error'" size="small">
                {{ evalResult.compositeScore }} / 8.0 ({{ evalResult.passed ? '达标' : '未达标' }})
              </n-tag>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-neutral-400">正确性:</span>
                <n-progress type="line" :percentage="Math.round(evalResult.scores.correctness * 100)" status="success" />
              </div>
              <div>
                <span class="text-neutral-400">执行效率:</span>
                <n-progress type="line" :percentage="Math.round(evalResult.scores.efficiency * 100)" status="info" />
              </div>
              <div>
                <span class="text-neutral-400">安全完整:</span>
                <n-progress type="line" :percentage="Math.round(evalResult.scores.safety * 100)" status="warning" />
              </div>
              <div>
                <span class="text-neutral-400">复用增量:</span>
                <n-progress type="line" :percentage="Math.round(evalResult.scores.reusability * 100)" status="success" />
              </div>
            </div>
            <div class="space-y-1 text-xs pt-1 border-t border-neutral-200 dark:border-neutral-700">
              <div v-for="(val, key) in evalResult.breakdown" :key="key" class="text-neutral-600 dark:text-neutral-300">
                • <strong>{{ key }}:</strong> {{ val }}
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-neutral-400 h-40 flex items-center justify-center border border-dashed border-neutral-300 dark:border-neutral-700 rounded">
            点击上方【执行门禁打分】测试当前技能是否达到合入标准
          </div>
        </div>
      </div>
    </n-card>

    <!-- Detail / Forge Modal -->
    <n-modal
      v-model:show="showDetailModal"
      preset="card"
      title="执行轨迹回放与技能锻造 (Skill Forge)"
      class="max-w-4xl"
      :segmented="{ content: 'soft', footer: 'soft' }"
    >
      <div v-if="selectedTrace" class="space-y-4">
        <n-descriptions bordered size="small" :column="2">
          <n-descriptions-item label="轨迹编号">
            <span class="font-mono text-xs font-semibold">{{ selectedTrace.traceId }}</span>
          </n-descriptions-item>
          <n-descriptions-item label="触发会话">
            <n-tag size="small" type="info">{{ selectedTrace.sessionId }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="用户初始意图" :span="2">
            <div class="text-xs bg-neutral-100 dark:bg-neutral-800 p-2.5 rounded font-mono">
              {{ selectedTrace.userIntent.raw }}
            </div>
          </n-descriptions-item>
        </n-descriptions>

        <!-- Tool Calls Execution Timeline -->
        <n-card size="small" title="工具调用与异常恢复链条 (Execution Chain)">
          <div class="space-y-2">
            <div
              v-for="(call, idx) in selectedTrace.toolCalls"
              :key="call.callId"
              class="flex items-start gap-2 text-xs p-2 rounded bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700"
            >
              <n-tag size="tiny" :type="call.status === 'ok' ? 'success' : 'error'">
                第 {{ idx + 1 }} 步
              </n-tag>
              <div class="flex-1 space-y-1">
                <div class="font-mono font-semibold text-primary">
                  {{ call.name }}()
                </div>
                <div class="text-neutral-500 font-mono text-[11px]">
                  入参: {{ JSON.stringify(call.arguments) }}
                </div>
                <div v-if="call.error" class="text-red-500 text-[11px] font-mono">
                  ⚠ 异常: {{ call.error.message }}
                </div>
                <div v-if="call.resultPreview" class="text-emerald-600 dark:text-emerald-400 text-[11px] font-mono">
                  ✓ 产出: {{ call.resultPreview }}
                </div>
              </div>
            </div>
          </div>
        </n-card>

        <!-- Lessons Extracted -->
        <div v-if="selectedTrace.lessons?.length" class="space-y-1">
          <div class="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            💡 本次踩坑提炼出的工程教训:
          </div>
          <ul class="text-xs space-y-1 list-disc list-inside text-neutral-500">
            <li v-for="l in selectedTrace.lessons" :key="l">
              {{ l }}
            </li>
          </ul>
        </div>

        <!-- Generated Draft SKILL.md -->
        <n-card size="small" title="提炼生成的候选 SKILL.md (Draft)">
          <div class="font-mono text-xs overflow-x-auto p-3 rounded bg-neutral-900 text-neutral-100 max-h-60 leading-relaxed">
            <pre>{{ selectedTrace.draftSkillMd }}</pre>
          </div>
        </n-card>
      </div>

      <template #footer>
        <div class="flex justify-between items-center w-full">
          <n-button @click="showDetailModal = false">
            关闭
          </n-button>
          <div v-if="selectedTrace && !selectedTrace.mergedToSkill" class="flex gap-2">
            <n-button type="primary" :loading="merging" @click="handleMergeSkill">
              ✨ 批准并一键合入活跃技能库
            </n-button>
          </div>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.self-evolution-view {
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
}
</style>
