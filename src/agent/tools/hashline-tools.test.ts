import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { HashlineEngine, createHashlineTools } from './hashline-tools'

describe('HashlineEngine & Tools', () => {
  let tmpDir: string
  let testFile: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashline-test-'))
    testFile = path.join(tmpDir, 'sample.ts')
    fs.writeFileSync(
      testFile,
      ['const a = 1;', 'const b = 2;', 'function add() {', '  return a + b;', '}', 'export default add;'].join('\n'),
      'utf8'
    )
  })

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {}
  })

  test('readFile computes 4-character deterministic anchors', async () => {
    const engine = new HashlineEngine(tmpDir)
    const result = await engine.readFile('sample.ts')

    expect(result.totalLines).toBe(6)
    expect(result.lines.length).toBe(6)
    for (const line of result.lines) {
      expect(line.anchor).toMatch(/^[a-zA-Z]{4}$/)
      expect(typeof line.line).toBe('number')
    }
  })

  test('replace modifies range and supports undo', async () => {
    const engine = new HashlineEngine(tmpDir)
    const initial = await engine.readFile('sample.ts')

    const fromAnchor = initial.lines[2].anchor // 'function add() {'
    const toAnchor = initial.lines[4].anchor // '}'

    const editRes = await engine.replace(
      'sample.ts',
      fromAnchor,
      toAnchor,
      'const add = () => a + b;'
    )

    expect(editRes.diff).toContain('-' + fromAnchor)
    expect(editRes.diff).toContain('+    │const add = () => a + b;')

    const afterRead = await engine.readFile('sample.ts')
    expect(afterRead.rendered).toContain('const add = () => a + b;')
    expect(afterRead.totalLines).toBe(4)

    // Test undo
    const undoRes = await engine.undo('sample.ts')
    expect(undoRes.restored).toBe(true)

    const afterUndo = await engine.readFile('sample.ts')
    expect(afterUndo.totalLines).toBe(6)
    expect(afterUndo.rendered).toContain('function add() {')
  })

  test('replaceMatch modifies only specific substring within anchor range', async () => {
    const engine = new HashlineEngine(tmpDir)
    const initial = await engine.readFile('sample.ts')

    const firstAnchor = initial.lines[0].anchor
    const secondAnchor = initial.lines[1].anchor

    const matchRes = await engine.replaceMatch(
      'sample.ts',
      firstAnchor,
      secondAnchor,
      'const',
      'let'
    )

    expect(matchRes.matchesReplaced).toBe(2)

    const updated = await engine.readFile('sample.ts')
    expect(updated.lines[0].content).toBe('let a = 1;')
    expect(updated.lines[1].content).toBe('let b = 2;')
  })

  test('insert inserts before or after specified anchor', async () => {
    const engine = new HashlineEngine(tmpDir)
    const initial = await engine.readFile('sample.ts')

    const anchor = initial.lines[1].anchor // 'const b = 2;'

    await engine.insert('sample.ts', anchor, 'after', 'const c = 3;')

    const updated = await engine.readFile('sample.ts')
    expect(updated.totalLines).toBe(7)
    expect(updated.lines[2].content).toBe('const c = 3;')
  })

  test('createHashlineTools returns 5 callable tool definitions', () => {
    const tools = createHashlineTools({ workspaceRoot: tmpDir })
    expect(tools.length).toBe(5)
    expect(tools.map(t => t.name)).toEqual([
      'hash_read',
      'hash_replace',
      'hash_replace_match',
      'hash_insert',
      'hash_undo',
    ])
  })
})
