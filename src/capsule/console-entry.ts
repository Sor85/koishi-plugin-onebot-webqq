import { resolve } from 'path'
import type { Config as PluginConfig } from '../config'
import { readMirroredConfigValues } from '../config/spec'
import type { OneBotRobotState } from '../onebot/types'
import type { ConsoleService } from '../plugin-context'
import type { CapsuleState } from './state'

export function registerConsoleEntry(
  console: ConsoleService,
  state: CapsuleState,
  config: PluginConfig,
  options: {
    logSnapshot: (source: string) => void
    readBotState: () => OneBotRobotState
  },
) {
  console.addEntry(process.env.KOISHI_BASE ? [
    process.env.KOISHI_BASE + '/dist/index.js',
    process.env.KOISHI_BASE + '/dist/style.css',
  ] : {
    dev: resolve(__dirname, '../client/index.ts'),
    prod: resolve(__dirname, '../dist'),
  }, () => {
    options.logSnapshot('entry')
    const botState = options.readBotState()
    // 下发哪些配置项、各自落什么默认值全部由配置规格的镜像配置项列表决定；
    // 新增一个镜像配置项不需要再回来改这里，漏改也不会静默少下发一个字段。
    return {
      capsule: state.snapshot(),
      ...botState,
      ...readMirroredConfigValues(config),
    }
  })
}
