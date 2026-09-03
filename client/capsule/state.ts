import { ref, type Ref } from 'vue'
import { readConfigDefault, type ConfigValue } from '../../src/config/spec'
import { defineCrossInstanceState } from '../shared/cross-instance-state'
import type { OneBotRobotProfile } from '../onebot/bots'

export interface CapsuleData {
  bot: {
    platform: string
    selfId: string
    status?: number
    name: string
    avatar?: string
  }
  conversation: {
    channelId: string
    channelName: string
    userId?: string
    userName?: string
    senderRole?: string
    senderLevel?: string
    senderTitle?: string
    activityText?: string
    thinkingDurationMs?: number
    timestamp: number
  }
  counters: {
    received: number
    sent: number
  }
  bots?: OneBotRobotProfile[]
}

interface CapsuleClientState {
  capsule: Ref<CapsuleData | undefined>
  hiddenCapsuleActivityIds: Ref<ConfigValue<'hiddenCapsuleActivityIds'>>
}

function createCapsuleClientState(): CapsuleClientState {
  return {
    capsule: ref<CapsuleData>(),
    // 镜像配置项的初始值来自配置规格，小胶囊领域不再自带一份默认值。
    hiddenCapsuleActivityIds: ref(readConfigDefault('hiddenCapsuleActivityIds')),
  }
}

// 症状：entry apply 写 A 实例、Capsule.vue 读 B 实例，hiddenCapsuleActivityIds 永远停在默认的
// ['logs']，表现为只有日志页能隐藏小胶囊。
const capsuleState = defineCrossInstanceState('__onebot_webqq_client_capsule__', createCapsuleClientState)

export const capsule = capsuleState.capsule
export const hiddenCapsuleActivityIds = capsuleState.hiddenCapsuleActivityIds
