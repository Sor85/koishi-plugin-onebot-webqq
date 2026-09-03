import { send } from '@koishijs/client'
import { ref, type Ref } from 'vue'
import type { OneBotRobotProfile } from '../../src/onebot/types'
import { defineCrossInstanceState } from '../shared/cross-instance-state'

// 客户端的机器人状态门面：类型只在 ../../src/onebot/types 声明一次，这里原样转发，不做别名导出。
// 文件留在原地，跨实例状态与选择机器人的请求都是客户端专属的，仍然住在这里。
// ADR 0003：这条跨端 import 边只能指向零 koishi 依赖的 module。
export type { OneBotRobotProfile, OneBotRobotState } from '../../src/onebot/types'

interface OneBotClientState {
  availableBots: Ref<OneBotRobotProfile[]>
  selectedBotSelfId: Ref<string>
}

function createOneBotClientState(): OneBotClientState {
  return {
    availableBots: ref<OneBotRobotProfile[]>([]),
    selectedBotSelfId: ref(''),
  }
}

// 症状：entry data 写入的 selfId 不会到达消息菜单，权限判断会隐藏“贴表情”和“撤回”。
const botState = defineCrossInstanceState('__onebot_webqq_client_bots__', createOneBotClientState)

export const availableBots = botState.availableBots
export const selectedBotSelfId = botState.selectedBotSelfId

export async function selectWebQQBot(selfId: string) {
  return await send('onebot-webqq/webqq/bot/select', { selfId })
}
