import { ref } from 'vue'

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
    userId: string
    userName: string
    timestamp: number
  }
  counters: {
    received: number
    sent: number
  }
}

export const capsule = ref<CapsuleData>()
