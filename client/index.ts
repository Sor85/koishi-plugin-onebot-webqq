import { Context, receive } from '@koishijs/client'
import { watch, type Ref } from 'vue'
import {
  mirroredConfigKeys,
  readConfigValue,
  type ConfigValue,
  type MirroredConfigKey,
  type MirroredConfigValues,
} from '../src/config/spec'
import ClientShell from './ClientShell.vue'
import { capsule, hiddenCapsuleActivityIds, type CapsuleData } from './capsule/state'
import CapsuleActivitySelect from './capsule/CapsuleActivitySelect.vue'
import { debug, resetWebQQClientState } from './entry-state'
import { availableBots, selectedBotSelfId, type OneBotRobotState } from './onebot/bots'
import { allowWebQQResize, enableCapsuleFrostedGlass, enableWebQQFrostedGlass, enableWebQQSend, hideWebQQGroupLevel, showWebQQAffinity, showWebQQCapsuleUnread, showWebQQRelationship, showWebQQThinkingTiming, showWebQQThinkingTokens, useCompactCapsuleShadow, webQQAccentColor, webQQChatStyle, webQQColorMode, webQQMessageCacheLimit, webQQStorageBackend, webQQTimBubbleTail } from './webqq/settings'
import './style.scss?onebot-webqq=composer-mention-v3'

// 配置镜像的类型由配置规格派生，只覆盖镜像配置项；非配置字段仍然手写。
interface ClientData extends Partial<MirroredConfigValues> {
  capsule?: CapsuleData
  bots?: OneBotRobotState['bots']
  selectedSelfId?: string
}

// 组合根把三个领域各自持有的配置镜像 ref 拼成一张完整的表。少一个键就编译报错，
// 因此「新增镜像配置项时漏掉前端这一端」不再可能静默通过。
const configMirror: { [K in MirroredConfigKey]: Ref<ConfigValue<K>> } = {
  allowWebQQResize,
  debug,
  enableCapsuleFrostedGlass,
  enableWebQQFrostedGlass,
  enableWebQQSend,
  hiddenCapsuleActivityIds,
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
}

function applyOneBotRobotState(state?: Partial<OneBotRobotState>) {
  availableBots.value = state?.bots ?? []
  selectedBotSelfId.value = state?.selectedSelfId || ''
}

// 逐键泛型赋值：直接在循环里写 configMirror[key].value 会退化成联合类型而无法赋值。
function applyMirroredConfigValue<K extends MirroredConfigKey>(key: K, data?: ClientData) {
  configMirror[key].value = readConfigValue(data, key)
}

function applyClientData(value?: ClientData) {
  capsule.value = value?.capsule
  applyOneBotRobotState(value)
  // 空值语义由配置规格统一裁决：只有未设置才落默认值，标注了 blankIsUnset 的枚举与颜色
  // 配置项额外把空字符串视为未设置。前端不再各处写 `?? 字面量` 或 `|| 字面量`。
  for (const key of mirroredConfigKeys) {
    applyMirroredConfigValue(key, value)
  }
}

export default function (ctx: Context, data?: Ref<ClientData>) {
  // 首次加载与 HMR 重进 effect 时都从 entry data 同步配置，避免 dispose 竞态后发送开关停留在默认 false。
  applyClientData(data?.value)

  if (debug.value) {
    console.debug('[onebot-webqq] entry data', data?.value)
  }

  ctx.effect(() => {
    applyClientData(data?.value)
    const stopDataWatch = data
      ? watch(data, (value) => {
        applyClientData(value)
        if (debug.value) {
          console.debug('[onebot-webqq] entry data update', value)
        }
      }, { deep: true })
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
