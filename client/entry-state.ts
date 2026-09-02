import { ref, type Ref } from 'vue'
import { readConfigDefault, type ConfigValue } from '../src/config/spec'
import { capsule, type CapsuleData } from './capsule/state'
import {
  enableCapsuleFrostedGlass,
  resolvedWebQQColorMode,
  showWebQQCapsuleUnread,
  useCompactCapsuleShadow,
  webQQAccentColor,
  webQQColorMode,
} from './webqq/settings'
import { webQQTotalUnread } from './webqq/runtime-state'

interface WebQQEntryState {
  debug: Ref<ConfigValue<'debug'>>
  webQQOpen: Ref<boolean>
}

const ENTRY_STATE_KEY = '__onebot_webqq_client_entry__'

function createWebQQEntryState(): WebQQEntryState {
  return {
    // debug 是镜像配置项，初始值来自配置规格；webQQOpen 只是会话态，与配置无关。
    debug: ref(readConfigDefault('debug')),
    webQQOpen: ref(false),
  }
}

// 与 settings.ts / bots.ts 同理：dev 下同一份 entry-state.ts 可能存在多个模块实例，
// 必须挂 globalThis。否则 Capsule.vue 点头像写的 webQQOpen 与 ClientShell.vue 读的不是同一个 ref，
// 观察窗会点不开。
const entryState: WebQQEntryState = (() => {
  const scope = globalThis as typeof globalThis & {
    [ENTRY_STATE_KEY]?: WebQQEntryState
  }
  if (!scope[ENTRY_STATE_KEY]) scope[ENTRY_STATE_KEY] = createWebQQEntryState()
  return scope[ENTRY_STATE_KEY]
})()

export const debug = entryState.debug
export const webQQOpen = entryState.webQQOpen
export const webQQCapsule = capsule
export {
  enableCapsuleFrostedGlass,
  resolvedWebQQColorMode,
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
  // availableBots 与 selectedBotSelfId 来自 entry data，是权限判断和当前操作员身份的一部分；
  // HMR dispose 不能清空它们，否则群消息菜单会误判为无操作员，隐藏“贴表情”和“撤回”。
  webQQOpen.value = false
  webQQTotalUnread.value = 0
}
