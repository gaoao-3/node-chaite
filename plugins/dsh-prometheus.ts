/**
 * DSH Prometheus 监控探针插件 (xxiaoxiong / dsh-prometheus)
 *
 * 采集 Agent Turns、LLM 延迟、Token 消耗与工具耗时，导出标准 Prometheus /metrics 指标。
 */
import { getPrometheusService } from '../src/agent/monitoring/prometheus'

export function apply(ctx: any) {
  ctx.tools.register({
    name: 'get_prometheus_endpoint',
    description: '获取当前 Chaite Agent 暴露的标准 Prometheus /metrics 监控端点地址与指标概览。',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      const prom = getPrometheusService()
      return {
        service: 'Chaite Prometheus Metrics Exporter',
        endpoint: 'http://127.0.0.1:3200/metrics',
        contentType: prom.getContentType(),
        monitoredTargets: [
          'chaite_agent_turns_total (会话与轮次)',
          'chaite_llm_tokens_total (模型 Token 消耗)',
          'chaite_tool_calls_total (工具调用率与状态)',
          'chaite_tool_duration_seconds (工具执行延迟直方图)',
          'chaite_active_sessions (活跃会话指标)',
          'chaite_nodejs_* (运行时内存与事件循环)'
        ],
        grafanaIntegration: '支持直接导入 Grafana Dashboard 模板'
      }
    },
  })
}
