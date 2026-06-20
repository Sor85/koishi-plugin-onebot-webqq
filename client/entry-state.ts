import { ref } from 'vue'
import { capsule, type CapsuleData } from './capsule/state'
import { availableBots, selectedBotSelfId } from './onebot/bots'
import {
  hideWebQQGroupLevel,
  showWebQQAffinity,
  showWebQQCapsuleUnread,
  showWebQQRelationship,
  useBotAvatarThemeColor,
  useCompactCapsuleShadow,
  webQQAccentColor,
  webQQAvatarAccentColor,
  webQQChatStyle,
  webQQColorMode,
  webQQMessageCacheLimit,
  webQQStorageBackend,
  webQQTheme,
  webQQTimBubbleTail,
  webQQTotalUnread,
} from './webqq/settings'

export const debug = ref(false)
export const webQQOpen = ref(false)
export const webQQCapsule = capsule
export {
  showWebQQCapsuleUnread,
  useCompactCapsuleShadow,
  webQQColorMode,
  webQQTotalUnread,
}
export type WebQQCapsuleData = CapsuleData

export function resetWebQQClientState() {
  capsule.value = undefined
  availableBots.value = []
  debug.value = false
  hideWebQQGroupLevel.value = true
  showWebQQAffinity.value = false
  showWebQQCapsuleUnread.value = true
  showWebQQRelationship.value = false
  useBotAvatarThemeColor.value = false
  useCompactCapsuleShadow.value = true
  webQQOpen.value = false
  webQQTotalUnread.value = 0
  webQQAccentColor.value = '#2563eb'
  webQQAvatarAccentColor.value = ''
  webQQChatStyle.value = 'telegram'
  webQQColorMode.value = 'auto'
  webQQMessageCacheLimit.value = 100
  webQQStorageBackend.value = 'koishi'
  webQQTheme.value = 'fresh'
  webQQTimBubbleTail.value = true
  selectedBotSelfId.value = ''
}
