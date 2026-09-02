import { readFile, readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const testsDir = new URL('./', import.meta.url)
// 刻意不写出完整的环境 docblock 字面量：vitest 扫描整个文件内容判定环境，写全会把本文件也切进 DOM 环境。
const docblockPattern = /^\/\/ @vitest-environment (\S+)$/
const domEnvironment = 'happy-dom'

async function listTestFiles(dir: URL): Promise<URL[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: URL[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...await listTestFiles(new URL(`${entry.name}/`, dir)))
      continue
    }
    if (entry.name.endsWith('.test.ts')) files.push(new URL(entry.name, dir))
  }
  return files
}

// DOM 环境按文件开启：一旦挂成全局，其余几十个 node 环境测试文件的运行条件会被静默改变。
describe('测试环境', () => {
  it('默认环境是 node，没有全局 DOM', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  it('挂载组件的测试文件各自声明 happy-dom', async () => {
    const files = await listTestFiles(testsDir)
    const missing: string[] = []
    for (const file of files) {
      const name = file.pathname.split('/').pop() ?? ''
      // 本守卫自己也提到组件测试工具的包名，按名字排除，避免自证不成立。
      if (name === 'test-environment.test.ts') continue
      const source = await readFile(file, 'utf8')
      if (!source.includes('@vue/test-utils')) continue
      const declared = docblockPattern.exec(source.split('\n')[0])?.[1]
      if (declared !== domEnvironment) missing.push(name)
    }
    expect(missing).toEqual([])
  })

  it('构建配置不给测试挂全局环境', async () => {
    const viteConfig = await readFile(new URL('../vite.config.mts', import.meta.url), 'utf8')
    expect(viteConfig).not.toContain('environment')
    expect(viteConfig).not.toContain('test:')
  })
})
