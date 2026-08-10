import type { WebQQColorMode } from '../settings'

export function resolveWebQQColorMode(
  mode: WebQQColorMode,
  inheritedMode: 'light' | 'dark',
): 'light' | 'dark' {
  return mode === 'auto' ? inheritedMode : mode
}
