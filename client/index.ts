import { Context, receive } from '@koishijs/client'
import { watch, type Ref } from 'vue'
import ClientShell from './ClientShell.vue'
import { capsule, hiddenCapsuleActivityIds, type CapsuleData } from './capsule/state'
import CapsuleActivitySelect from './capsule/CapsuleActivitySelect.vue'
import { debug, resetWebQQClientState } from './entry-state'
import { availableBots, selectedBotSelfId, type OneBotRobotState } from './onebot/bots'
import { allowWebQQResize, enableCapsuleFrostedGlass, enableWebQQFrostedGlass, enableWebQQSend, hideWebQQGroupLevel, showWebQQAffinity, showWebQQCapsuleUnread, showWebQQRelationship, showWebQQThinkingTiming, showWebQQThinkingTokens, useCompactCapsuleShadow, webQQAccentColor, webQQChatStyle, webQQColorMode, webQQMessageCacheLimit, webQQStorageBackend, webQQTimBubbleTail, type WebQQChatStyle, type WebQQColorMode, type WebQQStorageBackend } from './webqq/settings'
import './style.scss'

interface ClientData {
  capsule?: CapsuleData
  bots?: OneBotRobotState['bots']
  selectedSelfId?: string
  debug?: boolean
  enableWebQQFrostedGlass?: boolean
  enableWebQQSend?: boolean
  webQQChatStyle?: WebQQChatStyle
  webQQTimBubbleTail?: boolean
  webQQColorMode?: WebQQColorMode
  webQQStorageBackend?: WebQQStorageBackend
  webQQMessageCacheLimit?: number
  webQQAccentColor?: string
  enableCapsuleFrostedGlass?: boolean
  useCompactCapsuleShadow?: boolean
  hiddenCapsuleActivityIds?: string[]
  allowWebQQResize?: boolean
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

function applyClientData(value?: ClientData) {
  capsule.value = value?.capsule
  applyOneBotRobotState(value)
  debug.value = !!value?.debug
  enableWebQQFrostedGlass.value = value?.enableWebQQFrostedGlass ?? true
  enableWebQQSend.value = value?.enableWebQQSend ?? false
  webQQChatStyle.value = value?.webQQChatStyle || 'telegram'
  webQQTimBubbleTail.value = value?.webQQTimBubbleTail ?? true
  webQQColorMode.value = value?.webQQColorMode || 'auto'
  webQQStorageBackend.value = value?.webQQStorageBackend || 'koishi'
  webQQMessageCacheLimit.value = value?.webQQMessageCacheLimit ?? 100
  webQQAccentColor.value = value?.webQQAccentColor || '#2563eb'
  enableCapsuleFrostedGlass.value = value?.enableCapsuleFrostedGlass ?? true
  useCompactCapsuleShadow.value = value?.useCompactCapsuleShadow ?? true
  hiddenCapsuleActivityIds.value = value?.hiddenCapsuleActivityIds ?? ['logs']
  allowWebQQResize.value = value?.allowWebQQResize ?? false
  hideWebQQGroupLevel.value = value?.hideWebQQGroupLevel ?? true
  showWebQQAffinity.value = value?.showWebQQAffinity ?? false
  showWebQQRelationship.value = value?.showWebQQRelationship ?? false
  showWebQQThinkingTokens.value = value?.showWebQQThinkingTokens ?? true
  showWebQQThinkingTiming.value = value?.showWebQQThinkingTiming ?? true
  showWebQQCapsuleUnread.value = value?.showWebQQCapsuleUnread ?? true
}

export default function (ctx: Context, data?: Ref<ClientData>) {
  applyClientData(data?.value)

  if (debug.value) {
    console.debug('[onebot-webqq] entry data', data?.value)
  }

  ctx.effect(() => {
    const stopDataWatch = data
      ? watch(data, (value) => {
        applyClientData(value)
        if (debug.value) {
          console.debug('[onebot-webqq] entry data update', value)
        }
      })
      : undefined
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
      stopDataWatch?.()
      // Koishi client receive 旧实现没有 disposer；插件卸载时覆盖为空回调，避免 update 事件继续持有旧的全局 ref 闭包。
      if (typeof disposeUpdateReceive === 'function') disposeUpdateReceive()
      else receive('onebot-webqq/update', () => {})
      if (typeof disposeBotsUpdateReceive === 'function') disposeBotsUpdateReceive()
      else receive('onebot-webqq/bots/update', () => {})
      resetWebQQClientState()
    }
  })

  ctx.schema({
    type: 'array',
    role: 'onebot-webqq-activity-select',
    component: CapsuleActivitySelect,
  })

  ctx.slot({
    type: 'global',
    component: ClientShell,
    order: 100,
  })
}
