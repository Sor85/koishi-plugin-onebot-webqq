import { useColorMode } from '@koishijs/client'
import { computed, ref, type Ref } from 'vue'
import { readConfigDefault, type ConfigValue, type MirroredConfigKey } from '../../src/config/spec'
import { resolveWebQQColorMode } from './utils/webqq-color-mode'

// 取值类型由配置规格统一声明，前端只做转发，避免同一个联合类型在两侧各写一遍。
export type { WebQQChatStyle, WebQQColorMode, WebQQStorageBackend } from '../../src/config/spec'

// 观察窗领域持有的那一批镜像配置项。小胶囊的 hiddenCapsuleActivityIds 与入口的 debug 各自留在
// 自己的领域里（ADR 0001：不新建被两个前端领域共同依赖的 module），组合根负责把三份拼起来。
const WEBQQ_SETTINGS_KEYS = [
  'enableWebQQFrostedGlass',
  'enableWebQQSend',
  'enableCapsuleFrostedGlass',
  'hideWebQQGroupLevel',
  'allowWebQQResize',
  'showWebQQAffinity',
  'showWebQQCapsuleUnread',
  'showWebQQRelationship',
  'showWebQQThinkingTokens',
  'showWebQQThinkingTiming',
  'useCompactCapsuleShadow',
  'webQQAccentColor',
  'webQQChatStyle',
  'webQQColorMode',
  'webQQMessageCacheLimit',
  'webQQStorageBackend',
  'webQQTimBubbleTail',
] as const satisfies readonly MirroredConfigKey[]

type WebQQClientSettingsState = {
  [K in typeof WEBQQ_SETTINGS_KEYS[number]]: Ref<ConfigValue<K>>
}

const SETTINGS_STATE_KEY = '__onebot_webqq_client_settings__'

function createWebQQClientSettingsState(): WebQQClientSettingsState {
  // ref 初始值全部来自配置规格；前端不再自带一份默认值，也就不会和服务端兜底的那一份分叉。
  return Object.fromEntries(
    WEBQQ_SETTINGS_KEYS.map((key) => [key, ref(readConfigDefault(key))]),
  ) as WebQQClientSettingsState
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
