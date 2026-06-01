import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const style = await readFile(new URL('../client/style.scss', import.meta.url), 'utf8')

function ruleBody(selector: string) {
  const start = style.indexOf(`${selector} {`)
  if (start < 0) return ''
  const bodyStart = style.indexOf('{', start) + 1
  let depth = 1
  for (let index = bodyStart; index < style.length; index++) {
    if (style[index] === '{') depth++
    if (style[index] === '}') depth--
    if (depth === 0) return style.slice(bodyStart, index)
  }
  return ''
}

describe('chat capsule styles', () => {
  it('keeps the status dot visible outside the avatar curve', () => {
    expect(ruleBody('.chat-capsule__avatar')).not.toContain('overflow: hidden')
    expect(ruleBody('.chat-capsule__avatar').match(/img\s*{[\s\S]*border-radius:\s*inherit/)).toBeTruthy()
  })

  it('keeps the bot name smaller and anchored near the top', () => {
    expect(ruleBody('.chat-capsule__body')).toContain('align-self: stretch')
    expect(ruleBody('.chat-capsule__body')).toContain('justify-content: flex-start')
    expect(ruleBody('.chat-capsule__body')).toContain('padding-top: 4px')
    expect(ruleBody('.chat-capsule__title')).toContain('font-size: 13px')
    expect(ruleBody('.chat-capsule__title')).toContain('line-height: 18px')
  })
})
