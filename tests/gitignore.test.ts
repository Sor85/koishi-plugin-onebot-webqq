import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('gitignore', () => {
  it('tracks client/lib source used by shadcn components', async () => {
    const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8')
    const utils = await readFile(new URL('../client/lib/utils.ts', import.meta.url), 'utf8')
    const ignoredDirs = gitignore.split(/\r?\n/).map((line) => line.trim())

    expect(ignoredDirs).toContain('/lib')
    expect(ignoredDirs).toContain('/dist')
    expect(ignoredDirs).not.toContain('lib')
    expect(ignoredDirs).not.toContain('dist')
    expect(utils).toContain('export function cn')
  })
})
