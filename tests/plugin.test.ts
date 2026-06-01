import { describe, expect, it, vi } from 'vitest'
import * as plugin from '../src'
import type { ChatCapsuleContext } from '../src'
import type { CapsuleSnapshot } from '../src/state'

type Listener = (...payload: any[]) => void
type TestLogger = {
  info: ReturnType<typeof vi.fn>
}

function createFakeContext(options: { console?: boolean; character?: Record<string, unknown>; bots?: unknown[] } = {}) {
  const listeners: Record<string, Listener[]> = {}
  const addEntry = vi.fn((_files: unknown, _data?: () => { capsule: CapsuleSnapshot | undefined }) => {})
  const broadcast = vi.fn((_type: string, _body: CapsuleSnapshot | undefined) => {})
  const addListener = vi.fn((_event: string, _listener: (...args: unknown[]) => unknown) => {})
  const hasConsole = options.console ?? true

  const base: Pick<ChatCapsuleContext, 'on' | 'before'> = {
    on(event, listener) {
      ;(listeners[event] ||= []).push(listener)
    },
    before(event, listener) {
      ;(listeners[`before:${event}`] ||= []).push(listener)
    },
  }

  if (hasConsole) {
    const ctx: ChatCapsuleContext & { console: NonNullable<ChatCapsuleContext['console']>; bots?: unknown[] } = {
      ...base,
      ...(options.bots ? { bots: options.bots } : {}),
      console: {
        addEntry,
        broadcast,
        addListener,
      },
      ...(options.character ? { chatluna_character: options.character } : {}),
      inject(services, callback) {
        if ('console' in services) callback(ctx)
        if ('chatluna_character' in services && options.character) callback(ctx)
      },
    }
    return { ctx, listeners, addEntry, broadcast, addListener }
  }

  const ctx: ChatCapsuleContext & { bots?: unknown[] } = {
    ...base,
    ...(options.bots ? { bots: options.bots } : {}),
    ...(options.character ? { chatluna_character: options.character } : {}),
    inject(services, callback) {
      if ('chatluna_character' in services && options.character) callback(ctx)
    },
  }

  return { ctx, listeners, addEntry, broadcast, addListener }
}

function createSession(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'onebot',
    selfId: '10000',
    channelId: '20000',
    userId: '30000',
    username: 'Session Alice',
    timestamp: 1710000000000,
    bot: {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    },
    event: {
      guild: {
        name: 'Guild Name',
      },
      channel: {
        name: 'Channel Name',
      },
      user: {
        name: 'Event Alice',
      },
    },
    ...overrides,
  }
}

describe('chat capsule plugin wiring', () => {
  it('exports plugin name and optional console injection', () => {
    expect(plugin.name).toBe('chat-capsule')
    expect(plugin.inject).toEqual({
      optional: ['console', 'chatluna', 'chatluna_character'],
    })
  })

  it('exports a Config schema for backend options', () => {
    expect(plugin.Config).toBeDefined()
  })

  it('registers a console entry with empty capsule data', () => {
    const { ctx, addEntry } = createFakeContext()

    plugin.apply(ctx)

    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(addEntry.mock.calls[0][0]).toEqual({
      dev: expect.stringContaining('/client/index.ts'),
      prod: expect.stringContaining('/dist'),
    })
    const data = addEntry.mock.calls[0][1]
    expect(data).toBeDefined()
    expect(data?.()).toEqual({
      capsule: undefined,
      debug: false,
    })
  })

  it('registers read-only WebQQ console listeners backed by OneBot actions', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)

    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/contacts', expect.any(Function))
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/messages', expect.any(Function))
    expect(addListener).not.toHaveBeenCalledWith('chat-capsule/webqq/send', expect.any(Function))

    const loadContacts = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/contacts')?.[1]
    const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]

    await expect(loadContacts?.()).resolves.toEqual({ friends: [], groups: [] })
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([])
  })

  it('uses the configured WebQQ protocol for OneBot history calls', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx, { onebotProtocol: 'llbot' })

    const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([])

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      message_seq: 0,
      count: 20,
      reverseOrder: false,
    })
  })

  it('uses 100 messages as the default WebQQ history limit', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)

    const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]
    await expect(loadMessages?.({ type: 'group', peerId: '20000' })).resolves.toEqual([])

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      message_seq: 0,
      count: 100,
    })
  })

  it('merges live OneBot messages into WebQQ message history', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 'old-1',
            message_seq: 10,
            time: 1710000000,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: 'old message',
          }],
        })),
      },
    }
    const { ctx, listeners, addListener, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    listeners.message[0](createSession({
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: {
          id: '20000',
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Guild Name',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'new message' } }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'new-1',
        senderId: '30000',
        direction: 'incoming',
        summary: 'new message',
      }),
    })

    const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        id: 'old-1',
        summary: 'old message',
      }),
      expect.objectContaining({
        id: 'new-1',
        summary: 'new message',
      }),
    ])
  })

  it('passes enabled debug config to console entry data', () => {
    const { ctx, addEntry } = createFakeContext()
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: { debug?: boolean }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, { debug: true })

    const data = addEntry.mock.calls[0][1]
    expect(data?.()).toEqual({
      capsule: undefined,
      debug: true,
    })
  })

  it('writes debug snapshots to Koishi logs when debug is enabled', () => {
    const { ctx, listeners } = createFakeContext()
    const logger: TestLogger = {
      info: vi.fn(),
    }
    const ctxWithLogger = {
      ...ctx,
      logger: vi.fn(() => logger),
    } as ChatCapsuleContext & { logger: (name: string) => TestLogger }

    plugin.apply(ctxWithLogger, { debug: true })
    listeners.message[0](createSession())

    expect(ctxWithLogger.logger).toHaveBeenCalledWith('chat-capsule')
    expect(logger.info).toHaveBeenCalledWith(
      'message %s',
      expect.stringContaining('"received":1'),
    )
  })

  it('broadcasts normalized state when a message is received', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners.message[0](createSession())

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/update', {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Capsule Bot',
        avatar: 'https://example.com/avatar.png',
      },
      conversation: {
        channelId: '20000',
        channelName: 'Guild Name',
        timestamp: 1710000000000,
      },
      counters: {
        received: 1,
        sent: 0,
      },
    })
  })

  it('increments sent counter from before send and broadcasts the latest snapshot', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners.message[0](createSession())
    broadcast.mockClear()

    listeners['before:send'][0]()

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/update', {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Capsule Bot',
        avatar: 'https://example.com/avatar.png',
      },
      conversation: {
        channelId: '20000',
        channelName: 'Guild Name',
        timestamp: 1710000000000,
      },
      counters: {
        received: 1,
        sent: 1,
      },
    })
  })

  it('falls back to session names and ids when event names are missing', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners.message[0](createSession({
      event: {
        channel: {
          name: 'Session Channel',
        },
      },
    }))
    listeners.message[0](createSession({
      channelId: 'channel-id',
      userId: 'user-id',
      username: undefined,
      timestamp: 1710000000001,
      event: {},
    }))

    expect(broadcast.mock.calls[0][1]?.conversation).toMatchObject({
      channelName: 'Session Channel',
    })
    expect(broadcast.mock.calls[1][1]?.conversation).toMatchObject({
      channelId: 'channel-id',
      channelName: 'channel-id',
      timestamp: 1710000000001,
    })
  })

  it('uses ChatLuna chat events to show and clear generation status', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners['chatluna/before-chat'][0]('conversation-1', { name: 'Alice' }, {}, {}, createSession())

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelName: 'Guild Name',
      userName: 'Alice',
      activityText: '正在思考',
    })

    listeners['chatluna/after-chat'][0]('conversation-1')

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelId: '20000',
      channelName: 'Guild Name',
      timestamp: 1710000000000,
      thinkingDurationMs: expect.any(Number),
    })
  })

  it('updates usage from matching ChatLuna model usage events', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners['chatluna/before-chat'][0]('conversation-1', { name: 'Alice' }, {}, {}, createSession())

    listeners['chatluna/model-usage'][0]({
      context: {
        conversationId: 'conversation-2',
      },
      usageMetadata: {
        input_tokens: 99,
        output_tokens: 100,
        total_tokens: 199,
      },
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation.usage).toBeUndefined()

    listeners['chatluna/model-usage'][0]({
      context: {
        conversationId: 'conversation-1',
      },
      usageMetadata: {
        input_tokens: 12,
        output_tokens: 34,
        total_tokens: 46,
      },
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation.usage).toEqual({
      inputTokens: 12,
      outputTokens: 34,
    })
  })

  it('uses character response locks and collect events to show active status', async () => {
    const character = {
      acquireResponseLock: vi.fn(async () => true),
      releaseResponseLock: vi.fn(async () => undefined),
    }
    const originalAcquireResponseLock = character.acquireResponseLock
    const originalReleaseResponseLock = character.releaseResponseLock
    const { ctx, listeners, broadcast } = createFakeContext({ character })
    const session = createSession({
      event: {
        guild: {
          name: 'Guild Name',
        },
        channel: {
          name: 'Channel Name',
        },
        member: {
          name: 'Group Card Alice',
        },
        user: {
          name: 'Event Alice',
        },
      },
    })

    plugin.apply(ctx)
    await character.acquireResponseLock(session as any, {
      id: '30000',
      name: 'Alice',
      content: 'hello',
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userName: 'Group Card Alice',
      activityText: '正在与 Group Card Alice 对话',
    })

    listeners['chatluna_character/message_collect'][0](session, [{
      id: '30000',
      name: 'Alice',
      content: 'hello',
    }], 'trigger')

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userName: 'Group Card Alice',
      activityText: '正在思考',
    })

    await character.releaseResponseLock(session as any)

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelId: '20000',
      channelName: 'Guild Name',
      timestamp: 1710000000000,
      thinkingDurationMs: expect.any(Number),
    })

    listeners.dispose[0]()

    expect(character.acquireResponseLock).toBe(originalAcquireResponseLock)
    expect(character.releaseResponseLock).toBe(originalReleaseResponseLock)
  })

  it('keeps message and send listeners safe when console is unavailable', () => {
    const { ctx, listeners } = createFakeContext({ console: false })

    plugin.apply(ctx)

    expect(() => listeners.message[0](createSession())).not.toThrow()
    expect(() => listeners['before:send'][0]()).not.toThrow()
  })
})
