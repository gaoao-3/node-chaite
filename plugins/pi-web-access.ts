/**
 * Pi Agent 扩展：网页解析与纯净阅读流 (pi-web-access)
 */
export default function (pi: any) {
  pi.registerTool({
    name: 'extract_web_page',
    description: '抓取互联网网页内容并提取核心正文文本，自动过滤广告与多余脚本。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '待解析的目标网页链接' },
      },
      required: ['url'],
    },
    execute: async (args: { url: string }) => {
      try {
        const res = await fetch(args.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Compatible; PiAgent/1.0)' } })
        const html = await res.text()
        const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        return { url: args.url, title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'WebPage', text: text.slice(0, 4000) }
      } catch (e: any) {
        return { error: 'Fetch failed: ' + e.message }
      }
    },
  })
}
