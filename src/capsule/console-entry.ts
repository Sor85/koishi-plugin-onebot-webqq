import { resolve } from 'path'
import type { Config as PluginConfig } from '../config'
import type { OneBotRobotState } from '../onebot/types'
import type { ConsoleService } from '../plugin-context'
import type { CapsuleState } from './state'

export function registerConsoleEntry(
  console: ConsoleService,
  state: CapsuleState,
  config: PluginConfig,
  options: {
    debug: boolean
    logSnapshot: (source: string) => void
    readBotState: () => OneBotRobotState
  },
) {
  console.addEntry(process.env.KOISHI_BASE ? [
    process.env.KOISHI_BASE + '/dist/index.js',
    process.env.KOISHI_BASE + '/dist/style.css',
  ] : {
    dev: resolve(__dirname, '../client/index.ts'),
    prod: resolve(__dirname, '../dist'),
  }, () => {
    options.logSnapshot('entry')
    const botState = options.readBotState()
    return {
      capsule: state.snapshot(),
      ...botState,
      debug: options.debug,
      enableWebQQFrostedGlass: config.enableWebQQFrostedGlass ?? true,
      webQQChatStyle: config.webQQChatStyle ?? 'telegram',
      webQQTimBubbleTail: config.webQQTimBubbleTail ?? true,
      webQQColorMode: config.webQQColorMode ?? 'auto',
      webQQAccentColor: config.webQQAccentColor ?? '#2563eb',
      webQQMessageCacheLimit: config.webQQMessageCacheLimit ?? 100,
      enableCapsuleFrostedGlass: config.enableCapsuleFrostedGlass ?? true,
      useCompactCapsuleShadow: config.useCompactCapsuleShadow ?? true,
      allowWebQQResize: config.allowWebQQResize ?? false,
      hideWebQQGroupLevel: config.hideWebQQGroupLevel ?? true,
      showWebQQAffinity: config.showWebQQAffinity ?? false,
      showWebQQRelationship: config.showWebQQRelationship ?? false,
      showWebQQThinkingTokens: config.showWebQQThinkingTokens ?? true,
      showWebQQThinkingTiming: config.showWebQQThinkingTiming ?? true,
      showWebQQCapsuleUnread: config.showWebQQCapsuleUnread ?? true,
      webQQStorageBackend: config.webQQStorageBackend ?? 'koishi',
    }
  })
}
