import { useColorMode } from '@koishijs/client'
import { computed, ref, type Ref } from 'vue'
import { resolveWebQQColorMode } from './utils/webqq-color-mode'

export type WebQQChatStyle = 'qq' | 'tim'
export type WebQQColorMode = 'auto' | 'light' | 'dark'
export type WebQQStorageBackend = 'browser' | 'koishi'

interface WebQQClientSettingsState {
  enableWebQQFrostedGlass: Ref<boolean>
  enableWebQQSend: Ref<boolean>
  enableCapsuleFrostedGlass: Ref<boolean>
  hideWebQQGroupLevel: Ref<boolean>
  allowWebQQResize: Ref<boolean>
  showWebQQAffinity: Ref<boolean>
  showWebQQCapsuleUnread: Ref<boolean>
  showWebQQRelationship: Ref<boolean>
  showWebQQThinkingTokens: Ref<boolean>
  showWebQQThinkingTiming: Ref<boolean>
  useCompactCapsuleShadow: Ref<boolean>
  webQQTotalUnread: Ref<number>
  webQQAccentColor: Ref<string>
  webQQChatStyle: Ref<WebQQChatStyle>
  webQQColorMode: Ref<WebQQColorMode>
  webQQMessageCacheLimit: Ref<number>
  webQQStorageBackend: Ref<WebQQStorageBackend>
  webQQTimBubbleTail: Ref<boolean>
}

const SETTINGS_STATE_KEY = '__onebot_webqq_client_settings__'

function createWebQQClientSettingsState(): WebQQClientSettingsState {
  return {
    enableWebQQFrostedGlass: ref(true),
    enableWebQQSend: ref(false),
    enableCapsuleFrostedGlass: ref(true),
    hideWebQQGroupLevel: ref(true),
    allowWebQQResize: ref(false),
    showWebQQAffinity: ref(false),
    showWebQQCapsuleUnread: ref(true),
    showWebQQRelationship: ref(false),
    showWebQQThinkingTokens: ref(true),
    showWebQQThinkingTiming: ref(true),
    useCompactCapsuleShadow: ref(true),
    webQQTotalUnread: ref(0),
    webQQAccentColor: ref('#2563eb'),
    webQQChatStyle: ref<WebQQChatStyle>('tim'),
    webQQColorMode: ref<WebQQColorMode>('auto'),
    webQQMessageCacheLimit: ref(100),
    webQQStorageBackend: ref<WebQQStorageBackend>('koishi'),
    webQQTimBubbleTail: ref(true),
  }
}

// portal + Vite @fs 可能把同一源码解析成两个模块实例（node_modules 软链路径 vs 真实源码路径）。
// 配置镜像必须挂在 globalThis 上，否则 entry apply 写 A 实例、组件读 B 实例，会出现“配置已开但发送栏不显示”。
const settingsState: WebQQClientSettingsState = (() => {
  const scope = globalThis as typeof globalThis & {
    [SETTINGS_STATE_KEY]?: WebQQClientSettingsState
  }
  if (!scope[SETTINGS_STATE_KEY]) scope[SETTINGS_STATE_KEY] = createWebQQClientSettingsState()
  return scope[SETTINGS_STATE_KEY]
})()

export const enableWebQQFrostedGlass = settingsState.enableWebQQFrostedGlass
export const enableWebQQSend = settingsState.enableWebQQSend
export const enableCapsuleFrostedGlass = settingsState.enableCapsuleFrostedGlass
export const hideWebQQGroupLevel = settingsState.hideWebQQGroupLevel
export const allowWebQQResize = settingsState.allowWebQQResize
export const showWebQQAffinity = settingsState.showWebQQAffinity
export const showWebQQCapsuleUnread = settingsState.showWebQQCapsuleUnread
export const showWebQQRelationship = settingsState.showWebQQRelationship
export const showWebQQThinkingTokens = settingsState.showWebQQThinkingTokens
export const showWebQQThinkingTiming = settingsState.showWebQQThinkingTiming
export const useCompactCapsuleShadow = settingsState.useCompactCapsuleShadow
export const webQQTotalUnread = settingsState.webQQTotalUnread
export const webQQAccentColor = settingsState.webQQAccentColor
export const webQQChatStyle = settingsState.webQQChatStyle
export const webQQColorMode = settingsState.webQQColorMode

const koishiColorMode = useColorMode()

// Koishi 已经把控制台的“自动”与系统偏好解析成最终明暗模式；这里直接继承该结果，
// 避免 WebQQ 再读 prefers-color-scheme，导致控制台强制主题与插件主题互相矛盾。
export const resolvedWebQQColorMode = computed(() => (
  resolveWebQQColorMode(webQQColorMode.value, koishiColorMode.value)
))
export const webQQMessageCacheLimit = settingsState.webQQMessageCacheLimit
export const webQQStorageBackend = settingsState.webQQStorageBackend
export const webQQTimBubbleTail = settingsState.webQQTimBubbleTail
