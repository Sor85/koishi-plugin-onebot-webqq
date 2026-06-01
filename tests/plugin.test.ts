import { describe, expect, it, vi } from 'vitest'
import * as plugin from '../src'
import type { ChatCapsuleContext } from '../src'
import type { CapsuleSnapshot } from '../src/state'

type Listener = (...payload: any[]) => void
type TestLogger = {
  info: ReturnType<typeof vi.fn>
}

function createFakeContext(options: { console?: boolean; character?: Record<string, unknown> } = {}) {
  const listeners: Record<string, Listener[]> = {}
  const addEntry = vi.fn((_files: unknown, _data?: () => { capsule: CapsuleSnapshot | undefined }) => {})
  const broadcast = vi.fn((_type: string, _body: CapsuleSnapshot | undefined) => {})
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
    const ctx: ChatCapsuleContext & { console: NonNullable<ChatCapsuleContext['console']> } = {
      ...base,
      console: {
        addEntry,
        broadcast,
      },
      ...(options.character ? { chatluna_character: options.character } : {}),
      inject(services, callback) {
        if ('console' in services) callback(ctx)
        if ('chatluna_character' in services && options.character) callback(ctx)
      },
    }
    return { ctx, listeners, addEntry, broadcast }
  }

  const ctx: ChatCapsuleContext = {
    ...base,
    ...(options.character ? { chatluna_character: options.character } : {}),
    inject(services, callback) {
      if ('chatluna_character' in services && options.character) callback(ctx)
    },
  }

  return { ctx, listeners, addEntry, broadcast }
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

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toEqual({
      channelId: '20000',
      channelName: 'Guild Name',
      timestamp: 1710000000000,
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

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toEqual({
      channelId: '20000',
      channelName: 'Guild Name',
      timestamp: 1710000000000,
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
