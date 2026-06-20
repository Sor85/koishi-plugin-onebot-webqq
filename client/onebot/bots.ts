import { send } from '@koishijs/client'
import { ref } from 'vue'

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

export const availableBots = ref<OneBotRobotProfile[]>([])
export const selectedBotSelfId = ref('')

export async function selectWebQQBot(selfId: string) {
  return await send('onebot-webqq/webqq/bot/select', { selfId }) as OneBotRobotState
}
