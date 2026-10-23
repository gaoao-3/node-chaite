<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import {
  NAlert,
  NBadge,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NFlex,
  NGrid,
  NGridItem,
  NPopconfirm,
  NProgress,
  NSpace,
  NStatistic,
  NSwitch,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  fetchGatewayStatusList,
  restartGatewayAdapter,
} from '@/service/api/agent'
import type {
  GatewayPlatformStatus,
} from '@/service/api/agent'

const message = useMessage()

// ─── State ───────────────────────────────────────────────────────────────────

const loading = ref(false)
const gatewaysData = ref<GatewayPlatformStatus[]>([])
const restartingPlatform = ref<string | null>(null)

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function loadGateways() {
  loading.value = true
  try {
    const res = await fetchGatewayStatusList()
    if (res.data) {
      gatewaysData.value = res.data
    }
  } catch (err: any) {
    message.error(err?.message || '加载网关状态失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadGateways()
})

async function handleRestart(platform: string) {
  restartingPlatform.value = platform
  try {
    await restartGatewayAdapter(platform)
    message.success(`已向 ${platform.toUpperCase()} 适配器发送重启与重连指令！`)
    await loadGateways()
  } catch (err: any) {
    message.error(err?.message || '重启网关失败')
  } finally {
    restartingPlatform.value = null
  }
}

// ─── Sample Active Sessions ──────────────────────────────────────────────────

const activeSessions = [
  {
    sessionId: 'qq:group_984512301',
    platform: 'qq',
    botId: '2854129840',
    chatType: '群聊 (DevOps 技术群)',
    turns: 18,
    activeSkill: 'troubleshoot-docker-network',
    lastActive: '12 秒前',
    isolation: '完全隔离',
  },
  {
    sessionId: 'qq:private_39201948',
    platform: 'qq',
    botId: '2854129840',
    chatType: '管理员私聊',
    turns: 6,
    activeSkill: 'direct',
    lastActive: '2 分钟前',
    isolation: '完全隔离',
  },
  {
    sessionId: 'dsh:mobile_sync',
    platform: 'dsh',
    botId: 'dsh_cordis_core',
    chatType: '移动端中枢通道',
    turns: 42,
    activeSkill: 'generate-model-token-report',
    lastActive: '5 秒前',
    isolation: '完全隔离',
  },
  {
    sessionId: 'web:playground_default',
    platform: 'web',
    botId: 'chaite_web_srv',
    chatType: 'Web 控制台测试',
    turns: 3,
    activeSkill: 'direct',
    lastActive: '30 秒前',
    isolation: '完全隔离',
  },
]

const sessionColumns: DataTableColumns<typeof activeSessions[0]> = [
  {
    title: '平台',
    key: 'platform',
    width: 90,
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
    title: '会话识别符 (Session ID)',
    key: 'sessionId',
    width: 220,
    render(row) {
      return h('span', { class: 'font-mono text-xs font-semibold' }, row.sessionId)
    },
  },
  {
    title: '会话类型',
    key: 'chatType',
  },
  {
    title: '挂载技能 (Skill)',
    key: 'activeSkill',
    render(row) {
      return h('span', { class: 'font-mono text-xs text-primary' }, row.activeSkill)
    },
  },
  {
    title: '对话轮次',
    key: 'turns',
    width: 100,
    render(row) {
      return h(NTag, { size: 'tiny', round: true }, { default: () => `${row.turns} 轮` })
    },
  },
  {
    title: '最后活跃',
    key: 'lastActive',
    width: 120,
    render(row) {
      return h('span', { class: 'text-xs text-neutral-400' }, row.lastActive)
    },
  },
]
</script>

<template>
  <div class="gateway-monitor-view space-y-4">
    <!-- Hero Gateway Architecture Card -->
    <n-card :bordered="false" class="bg-gradient-to-r from-cyan-500/10 via-sky-500/5 to-blue-500/10 border border-cyan-500/20 rounded-xl">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-xl">🌐</span>
            <h3 class="text-lg font-bold tracking-tight">
              多平台进程隔离网关与 QQBot 枢纽
            </h3>
            <n-tag type="info" size="small" round>
              OneBot v11/v12 WS 适配
            </n-tag>
            <n-tag type="success" size="small" round>
              流式聚合缓冲防风控
            </n-tag>
            <n-tag type="warning" size="small" round>
              DSH Mobile 远程中枢
            </n-tag>
          </div>
          <p class="text-xs text-neutral-500 max-w-2xl leading-relaxed">
            所有外部聊天平台均作为独立子进程或外部适配器运行。QQ 掉线、协议崩溃绝不影响 Agent Core 核心调度！内置流式消息缓冲器与防刷屏节流器，保护 QQ 账号免遭腾讯风控。
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <n-button secondary @click="loadGateways">
            刷新状态
          </n-button>
        </div>
      </div>
    </n-card>

    <!-- Gateway Adapters Status Cards -->
    <n-grid :cols="3" :x-gap="14" :y-gap="14">
      <n-grid-item v-for="gw in gatewaysData" :key="gw.platform">
        <n-card size="small" :bordered="false" class="rounded-xl border border-neutral-200/70 dark:border-neutral-800 shadow-sm relative overflow-hidden">
          <div class="space-y-3">
            <!-- Header -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xl">
                  {{ gw.platform === 'qq' ? '🐧' : gw.platform === 'dsh' ? '📱' : '💻' }}
                </span>
                <div>
                  <div class="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                    {{ gw.name }}
                  </div>
                  <div class="text-[11px] text-neutral-400 font-mono">
                    {{ gw.adapterType }}
                  </div>
                </div>
              </div>
              <n-tag size="small" type="success" round>
                ● 在线运行
              </n-tag>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 gap-2 bg-neutral-50 dark:bg-neutral-800/60 p-2.5 rounded-lg text-xs font-mono">
              <div>
                <span class="text-neutral-400">已处理消息:</span>
                <span class="font-bold ml-1 text-primary">{{ gw.messageCount }}</span>
              </div>
              <div>
                <span class="text-neutral-400">风控节流拦截:</span>
                <span class="font-bold ml-1 text-amber-500">{{ gw.throttledCount }}</span>
              </div>
              <div>
                <span class="text-neutral-400">缓冲队列长:</span>
                <span class="font-bold ml-1">{{ gw.bufferQueueLength }}</span>
              </div>
              <div>
                <span class="text-neutral-400">异常报错:</span>
                <span class="font-bold ml-1 text-red-500">{{ gw.errorCount }}</span>
              </div>
            </div>

            <!-- QQ Specific Features -->
            <div v-if="gw.platform === 'qq'" class="text-[11px] space-y-1 text-neutral-500 border-t border-neutral-100 dark:border-neutral-800 pt-2">
              <div class="flex items-center justify-between">
                <span>🛡️ 流式转整发聚合缓冲:</span>
                <span class="text-emerald-600 font-medium font-mono">已启用 (1.2s 聚合)</span>
              </div>
              <div class="flex items-center justify-between">
                <span>💭 思考过程折叠/转图:</span>
                <span class="text-blue-600 font-medium font-mono">已启用 (免刷屏)</span>
              </div>
              <div class="flex items-center justify-between">
                <span>🤖 绑定 QQ 账号:</span>
                <span class="font-mono text-neutral-700 dark:text-neutral-300">{{ gw.botId }}</span>
              </div>
            </div>

            <!-- Footer Action -->
            <div class="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <span class="text-[11px] text-neutral-400">心跳正常 (刚刚)</span>
              <n-button
                size="tiny"
                secondary
                type="warning"
                :loading="restartingPlatform === gw.platform"
                @click="handleRestart(gw.platform)"
              >
                重连适配器
              </n-button>
            </div>
          </div>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- Active Sessions Table -->
    <n-card size="small" :bordered="false" class="rounded-lg shadow-sm border border-neutral-200/60 dark:border-neutral-800">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span>⚡</span>
            <span class="text-sm font-semibold">多端会话隔离池 (Active Sessions)</span>
          </div>
          <span class="text-xs text-neutral-400">每个 Session 具备独立的 AsyncLocalStorage 上下文</span>
        </div>
      </template>
      <n-data-table
        :columns="sessionColumns"
        :data="activeSessions"
        size="small"
        striped
      />
    </n-card>
  </div>
</template>

<style scoped>
.gateway-monitor-view {
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
}
</style>
