import { describe, expect, it } from 'vitest'
import { resolveWebQQColorMode } from '../client/webqq/utils/webqq-color-mode'

describe('WebQQ color mode', () => {
  it('follows the resolved Koishi mode when configured as auto', () => {
    expect(resolveWebQQColorMode('auto', 'dark')).toBe('dark')
    expect(resolveWebQQColorMode('auto', 'light')).toBe('light')
  })

  it('keeps explicit WebQQ color modes above the Koishi mode', () => {
    expect(resolveWebQQColorMode('dark', 'light')).toBe('dark')
    expect(resolveWebQQColorMode('light', 'dark')).toBe('light')
  })
})
