import { describe, expect, it, vi } from 'vitest'
import * as plugin from '../src'
import type { ChatCapsuleContext } from '../src'
import type { CapsuleSnapshot } from '../src/state'

type Listener = (payload?: any) => void

function createFakeContext(options: { console?: boolean } = {}) {
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
      inject(_services, callback) {
        callback(ctx)
      },
    }
    return { ctx, listeners, addEntry, broadcast }
  }

  const ctx: ChatCapsuleContext = {
    ...base,
    inject() {},
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
      optional: ['console'],
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
        userId: '30000',
        userName: 'Event Alice',
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
        userId: '30000',
        userName: 'Event Alice',
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
      userName: 'Session Alice',
    })
    expect(broadcast.mock.calls[1][1]?.conversation).toMatchObject({
      channelId: 'channel-id',
      channelName: 'channel-id',
      userId: 'user-id',
      userName: 'user-id',
      timestamp: 1710000000001,
    })
  })

  it('keeps message and send listeners safe when console is unavailable', () => {
    const { ctx, listeners } = createFakeContext({ console: false })

    plugin.apply(ctx)

    expect(() => listeners.message[0](createSession())).not.toThrow()
    expect(() => listeners['before:send'][0]()).not.toThrow()
  })
})
