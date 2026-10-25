import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as http from 'node:http'
import { AddressInfo } from 'node:net'
import { TitleNamingService, sanitizeTitle } from './title-naming-service'
import { SessionRegistry } from './session-registry'

describe('title naming service', () => {
  it('normalises model output into a compact title', () => {
    assert.equal(sanitizeTitle('标题：修复登录鉴权问题。\n更多解释'), '修复登录鉴权问题')
    assert.equal(sanitizeTitle('「移动端文件树优化」'), '移动端文件树优化')
    assert.equal(sanitizeTitle('```text\nhello\n```'), '')
  })

  it('calls only the configured auxiliary OpenAI-compatible endpoint', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chaite-title-'))
    const requests: Array<{ body: string; authorization?: string }> = []
    const server = http.createServer((req, res) => {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        requests.push({ body, authorization: req.headers.authorization })
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { content: '移动端工作区优化' } }] }))
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as AddressInfo).port

    try {
      const service = new TitleNamingService(path.join(directory, 'title.json'))
      await service.updateConfig({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        model: 'tiny-title-model',
        apiKey: 'test-key',
      })
      const title = await service.generateTitle('[深度思考模式: 请详细展现推理推演全过程] 请优化移动端工作区', '已经加入文件树和终端')
      assert.equal(title, '移动端工作区优化')
      assert.equal(requests.length, 1)
      assert.equal(requests[0].authorization, 'Bearer test-key')

      const body = JSON.parse(requests[0].body)
      assert.equal(body.model, 'tiny-title-model')
      assert.equal(body.tools, undefined)
      assert.equal(body.messages.length, 2)
      assert.ok(!body.messages[1].content.includes('深度思考模式'))
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()))
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})

describe('automatic session title lifecycle', () => {
  it('names the first turn asynchronously and never overwrites a manual rename', async () => {
    const registry = new SessionRegistry({
      driver: {
        run: async () => ({ text: '已为你准备好移动端工作区。' }),
      },
      titleNamer: async () => '移动端工作区优化',
    })
    const session = registry.create({ id: 'web:auto-title', title: '新会话' })
    const first = registry.startPrompt(session.id, { prompt: '请实现文件树与终端' })
    await first.done
    await new Promise(resolve => setImmediate(resolve))

    assert.equal(session.info().title, '移动端工作区优化')
    assert.ok(session.snapshot().events.some(event => event.type === 'session_title'))

    session.update({ title: '老师手动命名' })
    const second = registry.startPrompt(session.id, { prompt: '继续完善' })
    await second.done
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(session.info().title, '老师手动命名')
  })
})
