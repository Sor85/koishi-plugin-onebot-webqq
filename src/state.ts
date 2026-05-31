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
    userId: string
    userName: string
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

// 记录收到的消息，并将其设为当前会话。
export function recordIncomingMessage(capsule: CapsuleState, input: CapsuleMessageInput) {
  const state = getState(capsule)
  state.counters.received += 1
  state.current = {
    bot: {
      platform: input.bot.platform,
      selfId: input.bot.selfId,
      status: input.bot.status,
      name: input.bot.name || `${input.bot.platform}:${input.bot.selfId}`,
      avatar: input.bot.avatar,
    },
    conversation: {
      channelId: input.channel.id,
      channelName: input.channel.name || input.channel.id,
      userId: input.user.id,
      userName: input.user.name || input.user.id,
      timestamp: input.timestamp,
    },
    counters: {
      ...state.counters,
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
