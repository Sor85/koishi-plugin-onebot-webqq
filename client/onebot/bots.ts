import { send } from '@koishijs/client'
import { ref, type Ref } from 'vue'

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

const BOT_STATE_KEY = '__onebot_webqq_client_bots__'

function createOneBotClientState(): OneBotClientState {
  return {
    availableBots: ref<OneBotRobotProfile[]>([]),
    selectedBotSelfId: ref(''),
  }
}

// portal + Vite @fs 可能让同一 bots.ts 产生多个模块实例；机器人状态必须跨路径共享。
// 否则 entry data 写入的 selfId 不会到达消息菜单，权限判断会隐藏“贴表情”和“撤回”。
const botState: OneBotClientState = (() => {
  const scope = globalThis as typeof globalThis & {
    [BOT_STATE_KEY]?: OneBotClientState
  }
  if (!scope[BOT_STATE_KEY]) scope[BOT_STATE_KEY] = createOneBotClientState()
  return scope[BOT_STATE_KEY]
})()

export const availableBots = botState.availableBots
export const selectedBotSelfId = botState.selectedBotSelfId

export async function selectWebQQBot(selfId: string) {
  return await send('onebot-webqq/webqq/bot/select', { selfId }) as OneBotRobotState
}
