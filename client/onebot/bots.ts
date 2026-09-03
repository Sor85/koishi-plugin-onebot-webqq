import { send } from '@koishijs/client'
import { ref, type Ref } from 'vue'
import { defineCrossInstanceState } from '../shared/cross-instance-state'

export interface OneBotRobotProfile {
  platform: string
  selfId: string
  status?: number
  name: string
  avatar?: string
}

export interface OneBotRobotState {
  bots: OneBotRobotProfile[]
  selectedSelfId?: string
}

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
  return await send('onebot-webqq/webqq/bot/select', { selfId }) as OneBotRobotState
}
