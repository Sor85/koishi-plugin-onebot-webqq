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
  }
  timestamp: number
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
    activityText?: string
    timestamp: number
  }
  counters: {
    received: number
    sent: number
  }
}

const capsuleStateBrand: unique symbol = Symbol('chat-capsule-state')

export interface CapsuleState {
  readonly [capsuleStateBrand]: true
  snapshot(): CapsuleSnapshot | undefined
}

interface MutableCapsuleState {
  current?: CapsuleSnapshot
  counters: {
    received: number
    sent: number
  }
}

const states = new WeakMap<CapsuleState, MutableCapsuleState>()

function cloneSnapshot(snapshot: CapsuleSnapshot): CapsuleSnapshot {
  return {
    bot: { ...snapshot.bot },
    conversation: { ...snapshot.conversation },
    counters: { ...snapshot.counters },
  }
}

function getState(capsule: CapsuleState) {
  const state = states.get(capsule)
  if (!state) throw new TypeError('unknown capsule state')
  return state
}

function getBotName(input: CapsuleBotInput) {
  const name = input.name?.trim()
  if (name && name !== input.selfId) return name
  return '机器人'
}

// 创建聊天胶囊的内存状态容器。
export function createCapsuleState(): CapsuleState {
  const state: MutableCapsuleState = {
    counters: {
      received: 0,
      sent: 0,
    },
  }

  const capsule = {
    [capsuleStateBrand]: true,
    snapshot() {
      return state.current && cloneSnapshot(state.current)
    },
  } satisfies CapsuleState
  states.set(capsule, state)
  return capsule
}

function createSnapshot(input: CapsuleMessageInput, counters: MutableCapsuleState['counters']): CapsuleSnapshot {
  return {
    bot: {
      platform: input.bot.platform,
      selfId: input.bot.selfId,
      status: input.bot.status,
      name: getBotName(input.bot),
      avatar: input.bot.avatar,
    },
    conversation: {
      channelId: input.channel.id,
      channelName: input.channel.name || input.channel.id,
      timestamp: input.timestamp,
    },
    counters: {
      ...counters,
    },
  }
}

// 记录收到的消息上下文；空闲态不暴露最后发言用户。
export function recordIncomingMessage(capsule: CapsuleState, input: CapsuleMessageInput) {
  const state = getState(capsule)
  state.counters.received += 1
  const currentActivity = state.current?.conversation.activityText
    ? {
        userId: state.current.conversation.userId,
        userName: state.current.conversation.userName,
        activityText: state.current.conversation.activityText,
      }
    : {}
  const snapshot = createSnapshot(input, state.counters)
  state.current = {
    ...snapshot,
    conversation: {
      ...snapshot.conversation,
      ...currentActivity,
    },
  }
}

// 记录 ChatLuna 或伪装插件的当前对话状态。
export function recordConversationActivity(capsule: CapsuleState, input: CapsuleMessageInput, activityText: string) {
  const state = getState(capsule)
  const snapshot = createSnapshot(input, state.counters)
  state.current = {
    ...snapshot,
    conversation: {
      ...snapshot.conversation,
      userId: input.user.id,
      userName: input.user.name || input.user.id,
      activityText,
    },
  }
}

// 清除当前对话状态，保留最近的 bot、群聊和计数上下文。
export function clearConversationActivity(capsule: CapsuleState) {
  const state = getState(capsule)
  if (!state.current) return
  state.current = {
    ...state.current,
    conversation: {
      channelId: state.current.conversation.channelId,
      channelName: state.current.conversation.channelName,
      timestamp: state.current.conversation.timestamp,
    },
  }
}

// 记录插件启动后的发送消息计数。
export function recordOutgoingMessage(capsule: CapsuleState) {
  const state = getState(capsule)
  state.counters.sent += 1
  if (!state.current) return
  state.current = {
    ...state.current,
    counters: {
      ...state.counters,
    },
  }
}
