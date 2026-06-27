import { ref } from 'vue'
import type { OneBotRobotProfile } from '../onebot/bots'

export interface CapsuleData {
  bot: {
    platform: string
    selfId: string
    status?: number
    name: string
    avatar?: string
  }
  conversation: {
    channelId: string
    channelName: string
    userId?: string
    userName?: string
    senderRole?: string
    senderLevel?: string
    senderTitle?: string
    activityText?: string
    thinkingDurationMs?: number
    timestamp: number
  }
  counters: {
    received: number
    sent: number
  }
  bots?: OneBotRobotProfile[]
}

export const capsule = ref<CapsuleData>()
export const hiddenCapsuleActivityIds = ref(['logs'])
