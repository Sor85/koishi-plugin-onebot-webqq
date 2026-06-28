import { ref } from 'vue'
import { capsule, type CapsuleData } from './capsule/state'
import { availableBots, selectedBotSelfId } from './onebot/bots'
import {
  allowWebQQResize,
  enableCapsuleFrostedGlass,
  enableWebQQFrostedGlass,
  enableWebQQSend,
  hideWebQQGroupLevel,
  showWebQQAffinity,
  showWebQQCapsuleUnread,
  showWebQQRelationship,
  showWebQQThinkingTiming,
  showWebQQThinkingTokens,
  useCompactCapsuleShadow,
  webQQAccentColor,
  webQQChatStyle,
  webQQColorMode,
  webQQMessageCacheLimit,
  webQQStorageBackend,
  webQQTimBubbleTail,
  webQQTotalUnread,
} from './webqq/settings'

export const debug = ref(false)
export const webQQOpen = ref(false)
export const webQQCapsule = capsule
export {
  enableCapsuleFrostedGlass,
  showWebQQCapsuleUnread,
  useCompactCapsuleShadow,
  webQQAccentColor,
  webQQColorMode,
  webQQTotalUnread,
}
export type WebQQCapsuleData = CapsuleData

export function resetWebQQClientState() {
  capsule.value = undefined
  availableBots.value = []
  debug.value = false
  allowWebQQResize.value = false
  enableCapsuleFrostedGlass.value = true
  enableWebQQFrostedGlass.value = true
  enableWebQQSend.value = false
  hideWebQQGroupLevel.value = true
  showWebQQAffinity.value = false
  showWebQQCapsuleUnread.value = true
  showWebQQRelationship.value = false
  showWebQQThinkingTokens.value = true
  showWebQQThinkingTiming.value = true
  useCompactCapsuleShadow.value = true
  webQQOpen.value = false
  webQQTotalUnread.value = 0
  webQQAccentColor.value = '#2563eb'
  webQQChatStyle.value = 'telegram'
  webQQColorMode.value = 'auto'
  webQQMessageCacheLimit.value = 100
  webQQStorageBackend.value = 'koishi'
  webQQTimBubbleTail.value = true
  selectedBotSelfId.value = ''
}
