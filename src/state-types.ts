export interface CapsuleBotInput {
  platform: string
  selfId: string
  status?: number
  name?: string
  avatar?: string
}

export interface CapsuleMessageInput {
  bot: CapsuleBotInput
  channel: {
    id: string
    name?: string
  }
  user: {
    id: string
    name?: string
    senderRole?: string
    senderLevel?: string
    senderTitle?: string
  }
  timestamp: number
}

export interface CapsuleActivityOptions {
  conversationId?: string
  now?: number
}

export interface CapsuleModelUsageInput {
  conversationId?: string
  inputTokens?: number
  outputTokens?: number
}

export interface CapsuleSnapshot {
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
    conversationId?: string
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
  thinkingStartedAt?: number
}
