import { describe, expect, it } from 'vitest'
import {
  clearConversationActivity,
  createCapsuleState,
  recordIdleActivity,
  recordModelUsage,
  recordConversationActivity,
  recordIncomingMessage,
  setAvailableBots,
  recordOutgoingMessage,
} from '../src/capsule/state'

describe('chat capsule state', () => {
  it('starts without a snapshot', () => {
    const state = createCapsuleState()

    expect(state.snapshot()).toBeUndefined()
  })

  it('records incoming message context without exposing an idle user', () => {
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
        timestamp: 1710000000000,
      },
      counters: {
        received: 1,
        sent: 0,
      },
    })
  })

  it('does not expose bot self id when bot name is missing', () => {
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

    expect(state.snapshot()?.bot.name).toBe('机器人')
    expect(state.snapshot()?.bot.avatar).toBeUndefined()
    expect(state.snapshot()?.conversation.channelName).toBe('channel-1')
    expect(state.snapshot()?.conversation.userName).toBeUndefined()
  })

  it('exposes available onebot robots on snapshots', () => {
    const state = createCapsuleState()

    setAvailableBots(state, [
      {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Bot A',
        avatar: 'https://example.com/a.png',
      },
      {
        platform: 'onebot',
        selfId: '10001',
        status: 1,
        name: 'Bot B',
        avatar: 'https://example.com/b.png',
      },
    ])
    recordIncomingMessage(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Bot A',
        avatar: 'https://example.com/a.png',
      },
      channel: {
        id: '20000',
      },
      user: {
        id: '30000',
      },
      timestamp: 1710000000001,
    })

    expect(state.snapshot()?.bots).toEqual([
      {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Bot A',
        avatar: 'https://example.com/a.png',
      },
      {
        platform: 'onebot',
        selfId: '10001',
        status: 1,
        name: 'Bot B',
        avatar: 'https://example.com/b.png',
      },
    ])
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

  it('records and clears the active conversation status', () => {
    const state = createCapsuleState()

    recordIncomingMessage(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
      },
      channel: {
        id: '20000',
        name: 'General',
      },
      user: {
        id: '30000',
        name: 'Alice',
      },
      timestamp: 1710000000005,
    })

    recordConversationActivity(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
      },
      channel: {
        id: '20000',
        name: 'General',
      },
      user: {
        id: '30000',
        name: 'Alice',
      },
      timestamp: 1710000000006,
    }, '正在与 Alice 对话')

    expect(state.snapshot()?.conversation).toMatchObject({
      channelId: '20000',
      channelName: 'General',
      userId: '30000',
      userName: 'Alice',
      activityText: '正在与 Alice 对话',
      timestamp: 1710000000006,
    })

    clearConversationActivity(state)

    expect(state.snapshot()?.conversation).toEqual({
      channelId: '20000',
      channelName: 'General',
      timestamp: 1710000000006,
    })
  })

  it('records idle activity without exposing a user', () => {
    const state = createCapsuleState()

    recordIncomingMessage(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
      },
      channel: {
        id: '20000',
        name: 'General',
      },
      user: {
        id: '30000',
        name: 'Alice',
      },
      timestamp: 1710000000007,
    })

    expect(recordIdleActivity(state, '晨间整理今日计划')).toBe(true)
    expect(state.snapshot()?.conversation).toEqual({
      channelId: '20000',
      channelName: 'General',
      activityText: '晨间整理今日计划',
      timestamp: 1710000000007,
    })
    expect(recordIdleActivity(state, '晨间整理今日计划')).toBe(false)
  })

  it('does not let idle activity replace an active conversation', () => {
    const state = createCapsuleState()

    recordConversationActivity(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
      },
      channel: {
        id: '20000',
        name: 'General',
      },
      user: {
        id: '30000',
        name: 'Alice',
      },
      timestamp: 1710000000008,
    }, '正在思考')

    expect(recordIdleActivity(state, '晨间整理今日计划')).toBe(false)
    expect(state.snapshot()?.conversation).toMatchObject({
      userName: 'Alice',
      activityText: '正在思考',
    })
  })

  it('keeps group sender metadata on active conversation status', () => {
    const state = createCapsuleState()

    recordConversationActivity(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
      },
      channel: {
        id: '20000',
        name: 'General',
      },
      user: {
        id: '30000',
        name: 'Alice',
        senderRole: '管理员',
        senderLevel: '100',
        senderTitle: '闪亮头衔',
      },
      timestamp: 1710000000007,
    }, '正在思考')

    expect(state.snapshot()?.conversation).toMatchObject({
      userId: '30000',
      userName: 'Alice',
      activityText: '正在思考',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('records usage for the active conversation only', () => {
    const state = createCapsuleState()

    recordConversationActivity(state, {
      bot: {
        platform: 'onebot',
        selfId: '10000',
      },
      channel: {
        id: '20000',
        name: 'General',
      },
      user: {
        id: '30000',
        name: 'Alice',
      },
      timestamp: 1710000000007,
    }, '正在思考', {
      conversationId: 'conversation-1',
    })

    expect(recordModelUsage(state, {
      conversationId: 'conversation-2',
      inputTokens: 99,
      outputTokens: 100,
    })).toBe(false)
    expect(state.snapshot()?.conversation.usage).toBeUndefined()

    expect(recordModelUsage(state, {
      conversationId: 'conversation-1',
      inputTokens: 12,
      outputTokens: 34,
      ttftMs: 120,
      totalMs: 2400,
      tps: 14.2,
    })).toBe(true)
    expect(state.snapshot()?.conversation.usage).toEqual({
      inputTokens: 12,
      outputTokens: 34,
      ttftMs: 120,
      totalMs: 2400,
      tps: 14.2,
    })
  })

  it('stores thinking duration when activity is cleared', () => {
    const state = createCapsuleState()

    recordConversationActivity(state, {
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
      timestamp: 1710000000000,
    }, '正在思考', {
      now: 1710000000000,
    })

    clearConversationActivity(state, 1710000002400)

    expect(state.snapshot()?.conversation).toMatchObject({
      channelId: '20000',
      channelName: '20000',
      thinkingDurationMs: 2400,
    })
    expect(state.snapshot()?.conversation.activityText).toBeUndefined()
  })
})
