import { describe, expect, it } from 'vitest'
import {
  createCapsuleState,
  recordIncomingMessage,
  recordOutgoingMessage,
} from '../src/state'

describe('chat capsule state', () => {
  it('starts without a snapshot', () => {
    const state = createCapsuleState()

    expect(state.snapshot()).toBeUndefined()
  })

  it('records the latest incoming message as the active conversation', () => {
    const state = createCapsuleState()

    recordIncomingMessage(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Capsule Bot',
        avatar: 'https://example.com/avatar.png',
      },
      channel: {
        id: '20000',
        name: 'General',
      },
      user: {
        id: '30000',
        name: 'Alice',
      },
      timestamp: 1710000000000,
    })

    expect(state.snapshot()).toEqual({
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Capsule Bot',
        avatar: 'https://example.com/avatar.png',
      },
      conversation: {
        channelId: '20000',
        channelName: 'General',
        userId: '30000',
        userName: 'Alice',
        timestamp: 1710000000000,
      },
      counters: {
        received: 1,
        sent: 0,
      },
    })
  })

  it('falls back to ids and platform self id when names are missing', () => {
    const state = createCapsuleState()

    recordIncomingMessage(state, {
      bot: {
        platform: 'discord',
        selfId: 'bot-1',
        status: 1,
      },
      channel: {
        id: 'channel-1',
      },
      user: {
        id: 'user-1',
      },
      timestamp: 1710000000001,
    })

    expect(state.snapshot()?.bot.name).toBe('discord:bot-1')
    expect(state.snapshot()?.bot.avatar).toBeUndefined()
    expect(state.snapshot()?.conversation.channelName).toBe('channel-1')
    expect(state.snapshot()?.conversation.userName).toBe('user-1')
  })

  it('tracks sent and received counters from plugin startup', () => {
    const state = createCapsuleState()

    recordOutgoingMessage(state)
    recordOutgoingMessage(state)
    recordIncomingMessage(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
      },
      channel: {
        id: '20000',
      },
      user: {
        id: '30000',
      },
      timestamp: 1710000000002,
    })
    recordIncomingMessage(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
      },
      channel: {
        id: '20001',
      },
      user: {
        id: '30001',
      },
      timestamp: 1710000000003,
    })

    expect(state.snapshot()?.conversation).toMatchObject({
      channelId: '20001',
      userId: '30001',
      timestamp: 1710000000003,
    })
    expect(state.snapshot()?.counters).toEqual({
      received: 2,
      sent: 2,
    })
  })

  it('does not let snapshot mutation change internal state', () => {
    const state = createCapsuleState()

    recordIncomingMessage(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
      },
      channel: {
        id: '20000',
      },
      user: {
        id: '30000',
      },
      timestamp: 1710000000004,
    })

    const snapshot = state.snapshot()
    snapshot!.conversation.channelName = 'mutated'
    snapshot!.counters.received = 999

    expect(state.snapshot()?.conversation.channelName).toBe('20000')
    expect(state.snapshot()?.counters.received).toBe(1)
  })
})
