/**
 * Pi Agent 风格扩展插件示例：数学表达式求值工具
 */
export default function (pi: any) {
  pi.registerTool({
    name: 'calculate_expression',
    description: '高精度数学表达式求值工具，支持四则运算与复合括号计算。',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: '待求值的数学表达式，例如 "(38 * 42) + 128"' },
      },
      required: ['expression'],
    },
    execute: async (args: { expression: string }) => {
      const sanitized = String(args.expression || '').replace(/[^0-9+\-*/().\s]/g, '')
      try {
        const val = new Function(`return (${sanitized})`)()
        return {
          expression: args.expression,
          result: val,
          status: 'success',
        }
      } catch (err: any) {
        return {
          expression: args.expression,
          error: `Invalid expression: ${err.message}`,
        }
      }
    },
  })
}
