import { ref, type Ref } from 'vue'

// 观察窗的运行时状态：不来自配置、不参与控制台下发，因此不放在配置镜像 settings.ts 里。
// 分开之后「每个镜像配置项都必须四端一致」这条不变量的适用范围就等于 settings.ts 的导出面。
interface WebQQRuntimeState {
  webQQTotalUnread: Ref<number>
}

const RUNTIME_STATE_KEY = '__onebot_webqq_client_webqq_runtime__'

function createWebQQRuntimeState(): WebQQRuntimeState {
  return {
    webQQTotalUnread: ref(0),
  }
}

// 与 settings.ts / entry-state.ts 同理：portal + Vite @fs 可能把同一源码解析成两个模块实例，
// 必须挂 globalThis。否则观察窗写的未读数与小胶囊读的不是同一个 ref，头像徽标不会更新。
const runtimeState: WebQQRuntimeState = (() => {
  const scope = globalThis as typeof globalThis & {
    [RUNTIME_STATE_KEY]?: WebQQRuntimeState
  }
  if (!scope[RUNTIME_STATE_KEY]) scope[RUNTIME_STATE_KEY] = createWebQQRuntimeState()
  return scope[RUNTIME_STATE_KEY]
})()

export const webQQTotalUnread = runtimeState.webQQTotalUnread
