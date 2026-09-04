import { ref, type Ref } from 'vue'
import { readConfigDefault, type ConfigValue } from '../../src/config/spec'
import type { CapsuleSnapshot } from '../../src/capsule/state/types'
import { defineCrossInstanceState } from '../shared/cross-instance-state'
import type { CapsuleAnchor } from './capsule-anchor'

// 客户端的小胶囊状态门面：快照类型只在 ../../src/capsule/state/types 声明一次，这里原样转发，
// 不做别名导出。文件留在原地，跨实例状态与那个镜像配置项仍然住在这里。
// ADR 0003：这条跨端 import 边只能指向零 koishi 依赖的 module。
export type { CapsuleSnapshot } from '../../src/capsule/state/types'
export type { CapsuleAnchor } from './capsule-anchor'

interface CapsuleClientState {
  capsule: Ref<CapsuleSnapshot | undefined>
  hiddenCapsuleActivityIds: Ref<ConfigValue<'hiddenCapsuleActivityIds'>>
  // 入口锚点住在小胶囊领域，观察窗经组合根读它（ADR 0001 的前端依赖方向）。
  // undefined 表示「没拖动过」：此时落位完全由样式表里的默认锚点和窄屏媒体查询决定，
  // 不由 JS 复述一份等价数值，否则窄屏默认值会有两个来源。
  capsuleAnchor: Ref<CapsuleAnchor | undefined>
}

function createCapsuleClientState(): CapsuleClientState {
  return {
    capsule: ref<CapsuleSnapshot>(),
    // 镜像配置项的初始值来自配置规格，小胶囊领域不再自带一份默认值。
    hiddenCapsuleActivityIds: ref(readConfigDefault('hiddenCapsuleActivityIds')),
    capsuleAnchor: ref<CapsuleAnchor>(),
  }
}

// 症状：entry apply 写 A 实例、Capsule.vue 读 B 实例，hiddenCapsuleActivityIds 永远停在默认的
// ['logs']，表现为只有日志页能隐藏小胶囊。
const capsuleState = defineCrossInstanceState('__onebot_webqq_client_capsule__', createCapsuleClientState)

export const capsule = capsuleState.capsule
export const hiddenCapsuleActivityIds = capsuleState.hiddenCapsuleActivityIds
export const capsuleAnchor = capsuleState.capsuleAnchor
