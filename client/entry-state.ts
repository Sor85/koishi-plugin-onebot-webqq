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
  // 只清会话态，不清配置镜像。
  // HMR/插件重载时 dispose 可能在新实例 applyClientData 之后执行；
  // 若把 enableWebQQSend 等配置重置为默认 false，发送栏会“配置已开却不显示”。
  capsule.value = undefined
  availableBots.value = []
  webQQOpen.value = false
  webQQTotalUnread.value = 0
  selectedBotSelfId.value = ''
}
