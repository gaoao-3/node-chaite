/**
 * DSH / Cordis 风格微内核插件示例：系统运行状态工具
 */
export function apply(ctx: any) {
  ctx.tools.register({
    name: 'get_system_metrics',
    description: '获取宿主机运行指标：CPU 架构、空闲内存与 Node.js 运行时版本。',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      const os = await import('node:os')
      return {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
        totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
        uptimeSeconds: Math.round(os.uptime()),
      }
    },
  })
}
