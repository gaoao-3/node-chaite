/**
 * Pi Agent 风格扩展插件：正则表达式验证器
 */
export default function (pi: any) {
  pi.registerTool({
    name: 'test_regex_pattern',
    description: '测试正则表达式匹配规则，验证字符串样本并提取所有命名与序号捕获组。',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: '正则表达式字符串' },
        flags: { type: 'string', description: '修饰符（默认 g）' },
        testString: { type: 'string', description: '待测试的样本文本' },
      },
      required: ['pattern', 'testString'],
    },
    execute: async (args: { pattern: string; flags?: string; testString: string }) => {
      try {
        const re = new RegExp(args.pattern, args.flags || 'g')
        const matches = Array.from(args.testString.matchAll(re)).map(m => ({
          matched: m[0],
          index: m.index,
          groups: m.slice(1),
          namedGroups: m.groups,
        }))
        return {
          pattern: args.pattern,
          flags: args.flags || 'g',
          totalMatches: matches.length,
          matches: matches.slice(0, 20),
        }
      } catch (err: any) {
        return { error: `Invalid RegExp: ${err.message}` }
      }
    },
  })
}
