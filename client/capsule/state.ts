import { ref, type Ref } from 'vue'
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
  hiddenCapsuleActivityIds: Ref<string[]>
}

const CAPSULE_STATE_KEY = '__onebot_webqq_client_capsule__'

function createCapsuleClientState(): CapsuleClientState {
  return {
    capsule: ref<CapsuleData>(),
    hiddenCapsuleActivityIds: ref(['logs']),
  }
}

// portal + Vite @fs 会把同一份 state.ts 解析成多个模块实例：dev 入口走
// node_modules 软链路径，子模块被 Vite 改写成真实源码路径，且部分改写会带上
// `?v=<browserHash>`、部分不带，同一个文件因此出现带/不带版本号的两个 URL。
// 胶囊状态必须挂在 globalThis 上，否则 entry apply 写 A 实例、Capsule.vue 读 B 实例，
// hiddenCapsuleActivityIds 永远停在默认的 ['logs']，表现为只有日志页能隐藏小胶囊。
const capsuleState: CapsuleClientState = (() => {
  const scope = globalThis as typeof globalThis & {
    [CAPSULE_STATE_KEY]?: CapsuleClientState
  }
  if (!scope[CAPSULE_STATE_KEY]) scope[CAPSULE_STATE_KEY] = createCapsuleClientState()
  return scope[CAPSULE_STATE_KEY]
})()

export const capsule = capsuleState.capsule
export const hiddenCapsuleActivityIds = capsuleState.hiddenCapsuleActivityIds
