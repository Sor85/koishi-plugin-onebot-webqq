import { ref, type Ref } from 'vue'
import { readConfigDefault, type ConfigValue } from '../../src/config/spec'
import type { CapsuleSnapshot } from '../../src/capsule/state/types'
import { defineCrossInstanceState } from '../shared/cross-instance-state'

// 客户端的小胶囊状态门面：快照类型只在 ../../src/capsule/state/types 声明一次，这里原样转发，
// 不做别名导出。文件留在原地，跨实例状态与那个镜像配置项仍然住在这里。
// ADR 0003：这条跨端 import 边只能指向零 koishi 依赖的 module。
export type { CapsuleSnapshot } from '../../src/capsule/state/types'

interface CapsuleClientState {
  capsule: Ref<CapsuleSnapshot | undefined>
  hiddenCapsuleActivityIds: Ref<ConfigValue<'hiddenCapsuleActivityIds'>>
}

function createCapsuleClientState(): CapsuleClientState {
  return {
    capsule: ref<CapsuleSnapshot>(),
    // 镜像配置项的初始值来自配置规格，小胶囊领域不再自带一份默认值。
    hiddenCapsuleActivityIds: ref(readConfigDefault('hiddenCapsuleActivityIds')),
  }
}

// 症状：entry apply 写 A 实例、Capsule.vue 读 B 实例，hiddenCapsuleActivityIds 永远停在默认的
// ['logs']，表现为只有日志页能隐藏小胶囊。
const capsuleState = defineCrossInstanceState('__onebot_webqq_client_capsule__', createCapsuleClientState)

export const capsule = capsuleState.capsule
export const hiddenCapsuleActivityIds = capsuleState.hiddenCapsuleActivityIds
