import type { Config as PluginConfig } from './config'
import type {
  ChatCapsuleStorageRow,
} from './webqq/storage/schema'
import type {
  ChatCapsuleContext,
} from './plugin-context'
import type { ConsoleContract } from './shared/console-contract'
import { registerPluginRuntime } from './runtime/register'

export { Config } from './config'
export type { ChatCapsuleContext } from './plugin-context'

export const name = 'onebot-webqq'

// 声明控制台为可选服务，缺失时只保留后端状态监听。
export const inject = {
  optional: ['console', 'server', 'database', 'chatluna', 'chatluna_character', 'ffmpeg', 'chatluna_schedule'],
}

// 面向控制台包的全局声明由控制台契约派生。这一份在本仓库内没有消费者——注册侧的类型锚是
// plugin-context 的请求映射，客户端走自己的类型垫片——所以它过去与那份请求映射漂移时零报错。
declare module '@koishijs/console' {
  interface Events extends ConsoleContract {}
}

declare module 'koishi' {
  interface Tables {
    onebot_webqq_storage: ChatCapsuleStorageRow
  }
}

// 注册聊天胶囊的状态监听和控制台前端入口。
export function apply(ctx: ChatCapsuleContext, config: PluginConfig = {}) {
  registerPluginRuntime(ctx, config)
}
