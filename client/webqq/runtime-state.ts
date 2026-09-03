import { ref, type Ref } from 'vue'
import { defineCrossInstanceState } from '../shared/cross-instance-state'

// 观察窗的运行时状态：不来自配置、不参与控制台下发，因此不放在配置镜像 settings.ts 里。
// 分开之后「每个镜像配置项都必须四端一致」这条不变量的适用范围就等于 settings.ts 的导出面。
interface WebQQRuntimeState {
  webQQTotalUnread: Ref<number>
}

function createWebQQRuntimeState(): WebQQRuntimeState {
  return {
    webQQTotalUnread: ref(0),
  }
}

// 症状：观察窗写的未读数与小胶囊读的不是同一个 ref，头像徽标不会更新。
const runtimeState = defineCrossInstanceState('__onebot_webqq_client_webqq_runtime__', createWebQQRuntimeState)

export const webQQTotalUnread = runtimeState.webQQTotalUnread
