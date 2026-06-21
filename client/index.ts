import { Context, receive } from '@koishijs/client'
import type { Ref } from 'vue'
import ClientShell from './ClientShell.vue'
import { capsule, type CapsuleData } from './capsule/state'
import { debug, resetWebQQClientState } from './entry-state'
import { availableBots, selectedBotSelfId, type OneBotRobotState } from './onebot/bots'
import { hideWebQQGroupLevel, showWebQQAffinity, showWebQQCapsuleUnread, showWebQQRelationship, showWebQQThinkingTiming, showWebQQThinkingTokens, useCompactCapsuleShadow, webQQAccentColor, webQQChatStyle, webQQColorMode, webQQMessageCacheLimit, webQQStorageBackend, webQQTheme, webQQTimBubbleTail, type WebQQChatStyle, type WebQQColorMode, type WebQQStorageBackend, type WebQQTheme } from './webqq/settings'
import './style.scss'

interface ClientData {
  capsule?: CapsuleData
  bots?: OneBotRobotState['bots']
  selectedSelfId?: string
  debug?: boolean
  webQQTheme?: WebQQTheme
  webQQChatStyle?: WebQQChatStyle
  webQQTimBubbleTail?: boolean
  webQQColorMode?: WebQQColorMode
  webQQStorageBackend?: WebQQStorageBackend
  webQQMessageCacheLimit?: number
  webQQAccentColor?: string
  useCompactCapsuleShadow?: boolean
  hideWebQQGroupLevel?: boolean
  showWebQQAffinity?: boolean
  showWebQQRelationship?: boolean
  showWebQQThinkingTokens?: boolean
  showWebQQThinkingTiming?: boolean
  showWebQQCapsuleUnread?: boolean
}

function applyOneBotRobotState(state?: Partial<OneBotRobotState>) {
  availableBots.value = state?.bots ?? []
  selectedBotSelfId.value = state?.selectedSelfId || ''
}

export default function (ctx: Context, data?: Ref<ClientData>) {
  capsule.value = data?.value?.capsule
  applyOneBotRobotState(data?.value)
  debug.value = !!data?.value?.debug
  webQQTheme.value = data?.value?.webQQTheme || 'fresh'
  webQQChatStyle.value = data?.value?.webQQChatStyle || 'telegram'
  webQQTimBubbleTail.value = data?.value?.webQQTimBubbleTail ?? true
  webQQColorMode.value = data?.value?.webQQColorMode || 'auto'
  webQQStorageBackend.value = data?.value?.webQQStorageBackend || 'koishi'
  webQQMessageCacheLimit.value = data?.value?.webQQMessageCacheLimit ?? 100
  webQQAccentColor.value = data?.value?.webQQAccentColor || '#2563eb'
  useCompactCapsuleShadow.value = data?.value?.useCompactCapsuleShadow ?? true
  hideWebQQGroupLevel.value = data?.value?.hideWebQQGroupLevel ?? true
  showWebQQAffinity.value = data?.value?.showWebQQAffinity ?? false
  showWebQQRelationship.value = data?.value?.showWebQQRelationship ?? false
  showWebQQThinkingTokens.value = data?.value?.showWebQQThinkingTokens ?? true
  showWebQQThinkingTiming.value = data?.value?.showWebQQThinkingTiming ?? true
  showWebQQCapsuleUnread.value = data?.value?.showWebQQCapsuleUnread ?? true

  if (debug.value) {
    console.debug('[onebot-webqq] entry data', data?.value)
  }

  ctx.effect(() => {
    const disposeUpdateReceive = receive('onebot-webqq/update', (value) => {
      capsule.value = value as CapsuleData | undefined
      availableBots.value = capsule.value?.bots ?? availableBots.value
      if (debug.value) {
        console.debug('[onebot-webqq] update', value)
      }
    })
    const disposeBotsUpdateReceive = receive('onebot-webqq/bots/update', (value) => {
      applyOneBotRobotState(value as OneBotRobotState)
      if (debug.value) {
        console.debug('[onebot-webqq] bots update', value)
      }
    })

    return () => {
      // Koishi client receive 旧实现没有 disposer；插件卸载时覆盖为空回调，避免 update 事件继续持有旧的全局 ref 闭包。
      if (typeof disposeUpdateReceive === 'function') disposeUpdateReceive()
      else receive('onebot-webqq/update', () => {})
      if (typeof disposeBotsUpdateReceive === 'function') disposeBotsUpdateReceive()
      else receive('onebot-webqq/bots/update', () => {})
      resetWebQQClientState()
    }
  })

  ctx.slot({
    type: 'global',
    component: ClientShell,
    order: 100,
  })
}
