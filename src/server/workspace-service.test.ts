import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { WorkspaceService } from './workspace-service'

it('workspace service lists, reads and writes files inside the root', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chaite-workspace-'))
  try {
    const service = new WorkspaceService(root)
    await service.writeFile('notes/todo.md', '# 工作区\n\n- [x] 测试\n')
    const tree = await service.list('.')
    assert.ok(tree.entries.some(entry => entry.name === 'notes' && entry.type === 'directory'))

    const file = await service.readFile('notes/todo.md')
    assert.equal(file.language, 'markdown')
    assert.match(file.content, /工作区/)

    const changed = await service.writeFile('notes/todo.md', '# 已保存\n')
    assert.ok(changed.bytes > 0)
    assert.equal((await service.readFile('notes/todo.md')).content, '# 已保存\n')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

it('workspace terminal keeps cwd and blocks dangerous commands', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chaite-workspace-'))
  try {
    fs.mkdirSync(path.join(root, 'src'))
    const service = new WorkspaceService(root)
    const changed = await service.runTerminal('cd src')
    assert.equal(changed.cwd, 'src')

    const pwd = await service.runTerminal('pwd', changed.cwd)
    assert.equal(pwd.exitCode, 0)
    assert.ok(pwd.stdout.includes(path.join(root, 'src')))

    const dangerous = await service.runTerminal('rm -rf /', changed.cwd)
    assert.equal(dangerous.approvalRequired, true)
    assert.equal(dangerous.exitCode, 126)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

it('workspace service rejects traversal and private files', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chaite-workspace-'))
  try {
    const service = new WorkspaceService(root)
    await assert.rejects(() => service.readFile('../outside.txt'), /escapes/)
    await assert.rejects(() => service.readFile('.env'), /private/)
    await assert.rejects(() => service.list('data'), /private/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
