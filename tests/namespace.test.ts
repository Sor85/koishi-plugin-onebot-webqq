import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('project namespace', () => {
  it('does not keep the previous plugin namespace in tracked files', () => {
    const previousNamespace = ['chat', 'capsule'].join('-')
    const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)

    const filesWithPreviousNamespace = trackedFiles.filter((file) =>
      readFileSync(file, 'utf8').includes(previousNamespace)
    )

    expect(filesWithPreviousNamespace).toEqual([])
  })
})
