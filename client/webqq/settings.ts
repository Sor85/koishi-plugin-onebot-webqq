import { ref } from 'vue'

export type WebQQChatStyle = 'qq' | 'telegram'
export type WebQQColorMode = 'auto' | 'light' | 'dark'
export type WebQQStorageBackend = 'browser' | 'koishi'

export const enableWebQQFrostedGlass = ref(true)
export const enableCapsuleFrostedGlass = ref(true)
export const hideWebQQGroupLevel = ref(true)
export const allowWebQQResize = ref(false)
export const showWebQQAffinity = ref(false)
export const showWebQQCapsuleUnread = ref(true)
export const showWebQQRelationship = ref(false)
export const showWebQQThinkingTokens = ref(true)
export const showWebQQThinkingTiming = ref(true)
export const useCompactCapsuleShadow = ref(true)
export const webQQTotalUnread = ref(0)
export const webQQAccentColor = ref('#2563eb')
export const webQQChatStyle = ref<WebQQChatStyle>('telegram')
export const webQQColorMode = ref<WebQQColorMode>('auto')
export const webQQMessageCacheLimit = ref(100)
export const webQQStorageBackend = ref<WebQQStorageBackend>('koishi')
export const webQQTimBubbleTail = ref(true)
