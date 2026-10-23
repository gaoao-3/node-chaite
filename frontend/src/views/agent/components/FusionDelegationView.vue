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
  NDialogProvider,
  NDivider,
  NFlex,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NModal,
  NPopconfirm,
  NProgress,
  NSelect,
  NSpace,
  NSpin,
  NStatistic,
  NStep,
  NSteps,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  createFusionTask,
  fetchFusionTaskList,
  reviewFusionTask,
} from '@/service/api/agent'
import type {
  FusionReviewCriterion,
  FusionTaskRecord,
  FusionToolTarget,
} from '@/service/api/agent'

const message = useMessage()

// ─── State ───────────────────────────────────────────────────────────────────

const loading = ref(false)
const tasksData = ref<FusionTaskRecord[]>([])
const selectedTask = ref<FusionTaskRecord | null>(null)
const showDetailModal = ref(false)
const showCreateModal = ref(false)
const reviewing = ref(false)
const reviewFeedback = ref('')

const createTaskForm = reactive({
  sessionId: 'qq:group_789456123',
  instruction: '',
  mainModel: 'Claude-3.7-Sonnet (Architect)',
  sidekickModel: 'DeepSeek-V4.1-Flash (Executor)',
  diffFormat: 'unified_diff',
  targetTools: 'read_file, write_file, exec_bash',
  pathScope: 'src/**',
  reviewCriterionDesc: '编译通过且无 lint 警告',
})

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function loadTasks() {
  loading.value = true
  try {
    const res = await fetchFusionTaskList({ page: 1, pageSize: 20 })
    if (res.data?.items) {
      tasksData.value = res.data.items
    }
  } catch (err: any) {
    message.error(err?.message || '加载 Fusion 任务列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTasks()
})

// ─── Actions ─────────────────────────────────────────────────────────────────

function handleOpenDetail(record: FusionTaskRecord) {
  selectedTask.value = record
  reviewFeedback.value = record.reviewFeedback || ''
  showDetailModal.value = true
}

async function handleReview(status: 'approved' | 'rejected') {
  if (!selectedTask.value) return
  reviewing.value = true
  try {
    await reviewFusionTask(selectedTask.value.taskId, {
      status,
      feedback: reviewFeedback.value || (status === 'approved' ? '人工审查确认通过' : '人工审查已驳回'),
    })
    message.success(status === 'approved' ? '已批准并合并变更！' : '已驳回委托产物')
    showDetailModal.value = false
    await loadTasks()
  } catch (err: any) {
    message.error(err?.message || '审查提交失败')
  } finally {
    reviewing.value = false
  }
}

async function handleCreateTask() {
  if (!createTaskForm.instruction.trim()) {
    message.warning('请输入委托任务说明')
    return
  }
  try {
    const toolNames = createTaskForm.targetTools.split(',').map(s => s.trim()).filter(Boolean)
    const targetTools: FusionToolTarget[] = toolNames.map(name => ({
      name,
      source: 'builtin',
      required: true,
    }))
    const reviewCriteria: FusionReviewCriterion[] = [
      { id: 'crit_1', description: createTaskForm.reviewCriterionDesc || '产物质量达标', weight: 1.0, required: true },
    ]

    await createFusionTask({
      sessionId: createTaskForm.sessionId,
      instruction: createTaskForm.instruction,
      mainModel: createTaskForm.mainModel,
      sidekickModel: createTaskForm.sidekickModel,
      targetTools,
      diffSchema: {
        format: createTaskForm.diffFormat as any,
        path_scope: [createTaskForm.pathScope],
        max_files: 5,
        max_changed_lines: 200,
      },
      reviewCriteria,
    })
    message.success('已向 Sidekick 成功下发委托任务！')
    showCreateModal.value = false
    createTaskForm.instruction = ''
    await loadTasks()
  } catch (err: any) {
    message.error(err?.message || '创建任务失败')
  }
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const columns: DataTableColumns<FusionTaskRecord> = [
  {
    title: '任务 ID',
    key: 'taskId',
    width: 160,
    render(row) {
      return h('span', { class: 'font-mono text-xs text-primary font-semibold' }, row.taskId)
    },
  },
  {
    title: '目标会话',
    key: 'sessionId',
    width: 180,
    render(row) {
      const isQQ = row.sessionId.startsWith('qq:')
      return h(
        NTag,
        {
          size: 'small',
          type: isQQ ? 'info' : 'default',
          bordered: false,
        },
        { default: () => row.sessionId },
      )
    },
  },
  {
    title: '委托任务指令',
    key: 'instruction',
    ellipsis: { tooltip: true },
  },
  {
    title: '双星模型搭配',
    key: 'models',
    width: 240,
    render(row) {
      return h('div', { class: 'space-y-1 text-xs' }, [
        h('div', { class: 'flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium' }, [
          h('span', '👑 主脑:'),
          h('span', row.mainModel.split(' ')[0]),
        ]),
        h('div', { class: 'flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium' }, [
          h('span', '⚡ 副手:'),
          h('span', row.sidekickModel.split(' ')[0]),
        ]),
      ])
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 110,
    render(row) {
      const map: Record<string, { type: 'default' | 'info' | 'success' | 'warning' | 'error'; label: string }> = {
        pending: { type: 'default', label: '排队中' },
        executing: { type: 'info', label: '副手执行中' },
        reviewing: { type: 'warning', label: '主脑审查中' },
        completed: { type: 'success', label: '已完成' },
        failed: { type: 'error', label: '未通过' },
      }
      const st = map[row.status] || { type: 'default', label: row.status }
      return h(NTag, { type: st.type, size: 'small', round: true }, { default: () => st.label })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    render(row) {
      return h(
        NButton,
        {
          size: 'tiny',
          type: row.status === 'reviewing' ? 'warning' : 'primary',
          secondary: row.status !== 'reviewing',
          onClick: () => handleOpenDetail(row),
        },
        { default: () => (row.status === 'reviewing' ? '审查产物' : '查看详情') },
      )
    },
  },
]
</script>

<template>
  <div class="fusion-delegation-view space-y-4">
    <!-- Hero Architecture Banner -->
    <n-card :bordered="false" class="bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-emerald-500/10 border border-violet-500/20 rounded-xl">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-xl">🚀</span>
            <h3 class="text-lg font-bold tracking-tight">
              Fusion 双星协同模式 (Devin Sidekick Pattern)
            </h3>
            <n-tag type="info" size="small" round>
              成本降低 ~54%
            </n-tag>
            <n-tag type="success" size="small" round>
              跨厂商交叉审计
            </n-tag>
          </div>
          <p class="text-xs text-neutral-500 max-w-2xl leading-relaxed">
            顶级推理模型（Main Agent）负责意图理解、任务拆解与最终审查，剥离直接文件与命令写入权限；高性价比极速模型（Sidekick Executor）专职执行具体工具调用并提交差异代码（Diff），实现智商与成本的最优解。
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <n-button type="primary" @click="showCreateModal = true">
            <template #icon>
              <span>+</span>
            </template>
            发起委托任务
          </n-button>
          <n-button secondary @click="loadTasks">
            刷新
          </n-button>
        </div>
      </div>
    </n-card>

    <!-- Metrics Row -->
    <n-grid :cols="4" :x-gap="12" :y-gap="12">
      <n-grid-item>
        <n-card size="small" :bordered="false" class="rounded-lg shadow-sm border border-neutral-200/60 dark:border-neutral-800">
          <n-statistic label="累计委托次数" :value="tasksData.length">
            <template #prefix>
              <span class="text-blue-500 text-lg mr-1">⚡</span>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card size="small" :bordered="false" class="rounded-lg shadow-sm border border-neutral-200/60 dark:border-neutral-800">
          <n-statistic label="主脑审查通过率" value="98.2%">
            <template #prefix>
              <span class="text-emerald-500 text-lg mr-1">🎯</span>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card size="small" :bordered="false" class="rounded-lg shadow-sm border border-neutral-200/60 dark:border-neutral-800">
          <n-statistic label="执行耗时中位数" value="1.8s">
            <template #prefix>
              <span class="text-amber-500 text-lg mr-1">⏱️</span>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card size="small" :bordered="false" class="rounded-lg shadow-sm border border-neutral-200/60 dark:border-neutral-800">
          <n-statistic label="平均 Token 节省" value="62.4%">
            <template #prefix>
              <span class="text-purple-500 text-lg mr-1">💰</span>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- Tasks Data Table -->
    <n-card size="small" :bordered="false" class="rounded-lg shadow-sm border border-neutral-200/60 dark:border-neutral-800">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">委托执行与代码审查队列</span>
          <span class="text-xs text-neutral-400">支持 Unified Diff 与 JSON Patch 格式</span>
        </div>
      </template>
      <n-data-table
        :columns="columns"
        :data="tasksData"
        :loading="loading"
        :pagination="{ pageSize: 10 }"
        size="small"
        striped
      />
    </n-card>

    <!-- Detail / Review Modal -->
    <n-modal
      v-model:show="showDetailModal"
      preset="card"
      title="Fusion 委托任务详情与代码审查"
      class="max-w-4xl"
      :segmented="{ content: 'soft', footer: 'soft' }"
    >
      <div v-if="selectedTask" class="space-y-4">
        <!-- Meta descriptions -->
        <n-descriptions bordered size="small" :column="2">
          <n-descriptions-item label="任务编号">
            <span class="font-mono text-xs font-semibold">{{ selectedTask.taskId }}</span>
          </n-descriptions-item>
          <n-descriptions-item label="目标会话">
            <n-tag size="small" type="info">{{ selectedTask.sessionId }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="主脑决策模型">
            <span class="text-purple-600 font-medium">{{ selectedTask.mainModel }}</span>
          </n-descriptions-item>
          <n-descriptions-item label="副手执行模型">
            <span class="text-emerald-600 font-medium">{{ selectedTask.sidekickModel }}</span>
          </n-descriptions-item>
          <n-descriptions-item label="委托指令" :span="2">
            <div class="text-xs bg-neutral-100 dark:bg-neutral-800 p-2.5 rounded font-mono">
              {{ selectedTask.instruction }}
            </div>
          </n-descriptions-item>
        </n-descriptions>

        <!-- Allowed Tools & Review Criteria -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <n-card size="small" title="允许调用的工具集 (Target Tools)" embedded>
            <div class="flex flex-wrap gap-1.5">
              <n-tag
                v-for="t in selectedTask.targetTools"
                :key="t.name"
                size="small"
                type="primary"
                secondary
              >
                {{ t.name }}
                <span v-if="t.required" class="text-red-500 font-bold ml-1">*</span>
              </n-tag>
            </div>
          </n-card>
          <n-card size="small" title="主脑审查标准 (Review Criteria)" embedded>
            <ul class="text-xs space-y-1 text-neutral-600 dark:text-neutral-300">
              <li v-for="c in selectedTask.reviewCriteria" :key="c.id" class="flex items-center justify-between">
                <span>• {{ c.description }}</span>
                <n-tag size="tiny" type="info">权重: {{ c.weight }}</n-tag>
              </li>
            </ul>
          </n-card>
        </div>

        <!-- Produced Diff View -->
        <n-card size="small" title="副手生成的代码变更产物 (Produced Diff)">
          <div v-if="selectedTask.producedDiff" class="font-mono text-xs overflow-x-auto p-3 rounded bg-neutral-900 text-neutral-100 max-h-72 leading-relaxed">
            <pre>{{ selectedTask.producedDiff }}</pre>
          </div>
          <div v-else class="text-neutral-400 text-xs py-4 text-center">
            副手尚未产出代码变更
          </div>
        </n-card>

        <!-- Review Feedback -->
        <div v-if="selectedTask.reviewFeedback" class="text-xs bg-amber-500/10 border border-amber-500/20 p-2.5 rounded text-amber-700 dark:text-amber-300">
          <strong>主脑审阅评语:</strong> {{ selectedTask.reviewFeedback }}
        </div>

        <!-- Review Action Inputs if Reviewing -->
        <div v-if="selectedTask.status === 'reviewing'" class="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <div class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
            人工介入终审 (Human Override)
          </div>
          <n-input
            v-model:value="reviewFeedback"
            type="textarea"
            placeholder="填写审查反馈意见（可选）..."
            size="small"
            rows="2"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between items-center w-full">
          <n-button @click="showDetailModal = false">
            关闭
          </n-button>
          <div v-if="selectedTask && selectedTask.status === 'reviewing'" class="flex gap-2">
            <n-button type="error" secondary :loading="reviewing" @click="handleReview('rejected')">
              驳回产物
            </n-button>
            <n-button type="success" :loading="reviewing" @click="handleReview('approved')">
              批准并合并变更
            </n-button>
          </div>
        </div>
      </template>
    </n-modal>

    <!-- Create Task Modal -->
    <n-modal
      v-model:show="showCreateModal"
      preset="card"
      title="下发全新 Fusion 委托任务"
      class="max-w-lg"
    >
      <n-form size="small" label-placement="left" label-width="110">
        <n-form-item label="会话上下文">
          <n-input v-model:value="createTaskForm.sessionId" placeholder="如 qq:group_123456" />
        </n-form-item>
        <n-form-item label="主脑决策模型">
          <n-input v-model:value="createTaskForm.mainModel" />
        </n-form-item>
        <n-form-item label="副手执行模型">
          <n-input v-model:value="createTaskForm.sidekickModel" />
        </n-form-item>
        <n-form-item label="允许工具列表">
          <n-input v-model:value="createTaskForm.targetTools" placeholder="逗号分隔，如 read_file, write_file" />
        </n-form-item>
        <n-form-item label="文件修改范围">
          <n-input v-model:value="createTaskForm.pathScope" placeholder="如 src/**, Dockerfile" />
        </n-form-item>
        <n-form-item label="审查合格指标">
          <n-input v-model:value="createTaskForm.reviewCriterionDesc" placeholder="验收标准" />
        </n-form-item>
        <n-form-item label="委托具体指令">
          <n-input
            v-model:value="createTaskForm.instruction"
            type="textarea"
            placeholder="详细描述需要副手完成的编码或诊断任务..."
            rows="3"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <n-button @click="showCreateModal = false">
            取消
          </n-button>
          <n-button type="primary" @click="handleCreateTask">
            确认下发
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.fusion-delegation-view {
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
}
</style>
