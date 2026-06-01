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
    userId?: string
    userName?: string
    activityText?: string
    usage?: {
      inputTokens: number
      outputTokens: number
    }
    thinkingDurationMs?: number
    timestamp: number
  }
  counters: {
    received: number
    sent: number
  }
}

export interface WebQQFriend {
  userId: string
  name: string
  nickname: string
  avatar: string
}

export interface WebQQGroup {
  groupId: string
  name: string
  memberCount: number
  avatar: string
}

export interface WebQQMessage {
  id: string
  sequence: string
  time: number
  senderId: string
  senderName: string
  direction: 'incoming' | 'outgoing'
  summary: string
  elements: {
    type: 'text' | 'image' | 'face' | 'file' | 'record' | 'video' | 'unknown'
    text?: string
    url?: string
  }[]
}

export interface WebQQLiveMessage {
  type: 'friend' | 'group'
  peerId: string
  message: WebQQMessage
}

export interface WebQQContacts {
  friends: WebQQFriend[]
  groups: WebQQGroup[]
}

export const capsule = ref<CapsuleData>()
export const debug = ref(false)
