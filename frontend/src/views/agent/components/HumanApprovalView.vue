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
  NFlex,
  NGrid,
  NGridItem,
  NInput,
  NModal,
  NPopconfirm,
  NRadio,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NStatistic,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  fetchApprovalList,
  submitApprovalDecision,
} from '@/service/api/agent'
import type {
  HumanApprovalRequestRecord,
} from '@/service/api/agent'

const message = useMessage()

// ─── State ───────────────────────────────────────────────────────────────────

const loading = ref(false)
const approvalsData = ref<HumanApprovalRequestRecord[]>([])
const selectedApproval = ref<HumanApprovalRequestRecord | null>(null)
const showDetailModal = ref(false)
const filterStatus = ref<'all' | 'pending' | 'approved' | 'rejected'>('pending')
const deciding = ref(false)
const rejectReason = ref('')

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function loadApprovals() {
  loading.value = true
  try {
    const res = await fetchApprovalList({ page: 1, pageSize: 50 })
    if (res.data?.items) {
      approvalsData.value = res.data.items
    }
  } catch (err: any) {
    message.error(err?.message || '加载审批列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadApprovals()
})

const filteredList = computed(() => {
  if (filterStatus.value === 'all') return approvalsData.value
  return approvalsData.value.filter(a => a.status === filterStatus.value)
})

const pendingCount = computed(() => {
  return approvalsData.value.filter(a => a.status === 'pending').length
})

// ─── Actions ─────────────────────────────────────────────────────────────────

function handleOpenDetail(record: HumanApprovalRequestRecord) {
  selectedApproval.value = record
  rejectReason.value = ''
  showDetailModal.value = true
}

async function handleDecide(decision: 'approved' | 'rejected', record?: HumanApprovalRequestRecord) {
  const target = record || selectedApproval.value
  if (!target) return
  deciding.value = true
  try {
    await submitApprovalDecision(target.requestId, {
      decision,
      reason: rejectReason.value || (decision === 'approved' ? '人工控制台直接授权' : '人工控制台驳回执行'),
    })
    message.success(decision === 'approved' ? '已批准并通知 Agent 继续执行！' : '已成功驳回该操作')
    showDetailModal.value = false
    await loadApprovals()
  } catch (err: any) {
    message.error(err?.message || '提交决策失败')
  } finally {
    deciding.value = false
  }
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const columns: DataTableColumns<HumanApprovalRequestRecord> = [
  {
    title: '审批编号',
    key: 'requestId',
    width: 150,
    render(row) {
      return h('span', { class: 'font-mono text-xs font-semibold text-primary' }, row.requestId)
    },
  },
  {
    title: '风险级别',
    key: 'riskLevel',
    width: 110,
    render(row) {
      const riskMap: Record<string, { type: 'error' | 'warning' | 'info' | 'default'; label: string }> = {
        critical: { type: 'error', label: '🔴 严重风险' },
        high: { type: 'warning', label: '🟠 高危' },
        medium: { type: 'info', label: '🟡 中危' },
        low: { type: 'default', label: '🔵 低危' },
      }
      const r = riskMap[row.riskLevel] || { type: 'default', label: row.riskLevel }
      return h(NTag, { type: r.type, size: 'small', round: true }, { default: () => r.label })
    },
  },
  {
    title: '拟执行动作',
    key: 'action',
    render(row) {
      return h('div', { class: 'space-y-0.5' }, [
        h('div', { class: 'text-xs font-semibold text-neutral-800 dark:text-neutral-200' }, row.action.title),
        h('div', { class: 'text-[11px] text-neutral-400 font-mono' }, row.action.command || row.action.path || row.action.summary),
      ])
    },
  },
  {
    title: '请求来源',
    key: 'source',
    width: 180,
    render(row) {
      return h('div', { class: 'text-xs space-y-0.5' }, [
        h('div', { class: 'flex items-center gap-1' }, [
          h(NTag, { size: 'tiny', type: row.platform === 'qq' ? 'info' : 'success' }, { default: () => row.platform.toUpperCase() }),
          h('span', { class: 'font-mono text-[11px]' }, row.sessionId),
        ]),
        h('div', { class: 'text-neutral-400 text-[11px]' }, `发起: ${row.requestedBy.initiatorRole}`),
      ])
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      const statusMap: Record<string, { type: 'default' | 'success' | 'error' | 'warning'; label: string }> = {
        pending: { type: 'warning', label: '待处理' },
        approved: { type: 'success', label: '已批准' },
        rejected: { type: 'error', label: '已驳回' },
        expired: { type: 'default', label: '已超时' },
      }
      const s = statusMap[row.status] || { type: 'default', label: row.status }
      return h(NTag, { type: s.type, size: 'small', bordered: false }, { default: () => s.label })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 170,
    render(row) {
      if (row.status === 'pending') {
        return h('div', { class: 'flex gap-1.5' }, [
          h(
            NButton,
            { size: 'tiny', type: 'success', onClick: () => handleDecide('approved', row) },
            { default: () => '批准' },
          ),
          h(
            NButton,
            { size: 'tiny', type: 'error', secondary: true, onClick: () => handleOpenDetail(row) },
            { default: () => '驳回' },
          ),
          h(
            NButton,
            { size: 'tiny', secondary: true, onClick: () => handleOpenDetail(row) },
            { default: () => '详情' },
          ),
        ])
      }
      return h(
        NButton,
        { size: 'tiny', secondary: true, onClick: () => handleOpenDetail(row) },
        { default: () => '查看记录' },
      )
    },
  },
]
</script>

<template>
  <div class="human-approval-view space-y-4">
    <!-- Hero Warning & Principle Card -->
    <n-card :bordered="false" class="bg-gradient-to-r from-rose-500/10 via-red-500/5 to-amber-500/10 border border-rose-500/20 rounded-xl">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-xl">🛡️</span>
            <h3 class="text-lg font-bold tracking-tight">
              Human-in-the-Loop 实时安全审批门禁
            </h3>
            <n-tag v-if="pendingCount > 0" type="error" size="small" round>
              {{ pendingCount }} 项操作等待裁决
            </n-tag>
            <n-tag v-else type="success" size="small" round>
              安全守门中 · 无待办
            </n-tag>
          </div>
          <p class="text-xs text-neutral-500 max-w-2xl leading-relaxed">
            严格拦截高危 Shell 命令（如 rm / systemctl）、敏感配置变更与不可逆外部副作用。无论来自 QQ 群聊还是 Web API，Agent 在执行敏感工具时必须获得人类确认或 DSH Mobile 远程授权，确保绝对安全。
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <n-radio-group v-model:value="filterStatus" size="small">
            <n-radio-button value="pending">
              待处理 ({{ pendingCount }})
            </n-radio-button>
            <n-radio-button value="all">
              全部记录
            </n-radio-button>
          </n-radio-group>
          <n-button secondary @click="loadApprovals">
            刷新
          </n-button>
        </div>
      </div>
    </n-card>

    <!-- Table of Approvals -->
    <n-card size="small" :bordered="false" class="rounded-lg shadow-sm border border-neutral-200/60 dark:border-neutral-800">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">敏感操作拦截与授权队列</span>
          <span class="text-xs text-neutral-400">支持 SHA-256 完整性防篡改签名校验</span>
        </div>
      </template>
      <n-data-table
        :columns="columns"
        :data="filteredList"
        :loading="loading"
        :pagination="{ pageSize: 10 }"
        size="small"
        striped
      />
    </n-card>

    <!-- Detailed Inspection & Decision Modal -->
    <n-modal
      v-model:show="showDetailModal"
      preset="card"
      title="安全审计与决策终审 (Human Gate)"
      class="max-w-2xl"
      :segmented="{ content: 'soft', footer: 'soft' }"
    >
      <div v-if="selectedApproval" class="space-y-4">
        <!-- Alert Box -->
        <n-alert
          :type="selectedApproval.riskLevel === 'critical' ? 'error' : selectedApproval.riskLevel === 'high' ? 'warning' : 'info'"
          title="拟执行敏感动作预警"
          :bordered="false"
        >
          <div class="text-xs font-semibold">
            {{ selectedApproval.action.title }}
          </div>
          <div class="text-xs mt-1 text-neutral-600 dark:text-neutral-300">
            {{ selectedApproval.action.summary }}
          </div>
        </n-alert>

        <!-- Command / Path Box -->
        <n-card size="small" title="拟调用指令 / 变更目标" embedded>
          <div class="font-mono text-xs bg-neutral-900 text-neutral-100 p-3 rounded overflow-x-auto">
            <span v-if="selectedApproval.action.command" class="text-amber-400">$ {{ selectedApproval.action.command }}</span>
            <span v-else-if="selectedApproval.action.path" class="text-blue-400">Target Path: {{ selectedApproval.action.path }}</span>
            <span v-else>{{ JSON.stringify(selectedApproval.action.parameters, null, 2) }}</span>
          </div>
        </n-card>

        <!-- Descriptions -->
        <n-descriptions bordered size="small" :column="2">
          <n-descriptions-item label="审批编号">
            <span class="font-mono text-xs">{{ selectedApproval.requestId }}</span>
          </n-descriptions-item>
          <n-descriptions-item label="平台与会话">
            <n-tag size="small" type="info">{{ selectedApproval.platform }}: {{ selectedApproval.sessionId }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="发起 Agent">
            <span>{{ selectedApproval.requestedBy.initiatorRole }} ({{ selectedApproval.requestedBy.agentId || 'default' }})</span>
          </n-descriptions-item>
          <n-descriptions-item label="当前状态">
            <n-tag size="small" :type="selectedApproval.status === 'pending' ? 'warning' : 'success'">
              {{ selectedApproval.status }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="Agent 阐述原因" :span="2">
            <div class="text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800 p-2 rounded">
              {{ selectedApproval.reason || '无特别说明' }}
            </div>
          </n-descriptions-item>
          <n-descriptions-item label="SHA-256 签名" :span="2">
            <span class="font-mono text-[11px] text-neutral-400 break-all">{{ selectedApproval.integrityDigest }}</span>
          </n-descriptions-item>
        </n-descriptions>

        <!-- Reject Reason Input if Pending -->
        <div v-if="selectedApproval.status === 'pending'" class="space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <div class="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            批注意见 (如驳回将原样回传给 Agent 作为反馈):
          </div>
          <n-input
            v-model:value="rejectReason"
            type="textarea"
            placeholder="填写驳回或修改原因..."
            rows="2"
            size="small"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between items-center w-full">
          <n-button @click="showDetailModal = false">
            关闭
          </n-button>
          <div v-if="selectedApproval && selectedApproval.status === 'pending'" class="flex gap-2">
            <n-button type="error" secondary :loading="deciding" @click="handleDecide('rejected')">
              驳回操作
            </n-button>
            <n-button type="success" :loading="deciding" @click="handleDecide('approved')">
              批准并立即放行
            </n-button>
          </div>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.human-approval-view {
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
}
</style>
