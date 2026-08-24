import { describe, expect, it, vi } from 'vitest'
import type { ChatCapsuleContext, ConsoleEvents, ConsoleService } from '../src/plugin-context'
import { readWebQQErrorMessage } from '../client/webqq/utils/webqq-error'

const koishiMock = vi.hoisted(() => {
  function createSchemaNode() {
    const node = {
      description: () => node,
      default: () => node,
      role: () => node,
      min: () => node,
      max: () => node,
    }
    return node
  }

  return {
    Schema: {
      intersect: createSchemaNode,
      object: createSchemaNode,
      string: createSchemaNode,
      array: createSchemaNode,
      union: createSchemaNode,
      const: createSchemaNode,
      natural: createSchemaNode,
      boolean: createSchemaNode,
    },
  }
})

vi.mock('koishi', () => koishiMock)

const plugin = await import('../src')

type Listener = (...payload: any[]) => void

// 复刻 Koishi Console 的真实语义：addListener 只是往全局 listeners 里写一个键，
// 既不返回 disposable 也不随 ctx 回收。停用插件后残留的回调就是生产事故的来源。
function createKoishiLikeConsole() {
  const listeners: Record<string, { callback?: unknown } | undefined> = Object.create(null)
  const console: ConsoleService = {
    addEntry: vi.fn(() => {}),
    broadcast: vi.fn(() => {}),
    listeners,
    addListener<Event extends keyof ConsoleEvents>(event: Event, callback: ConsoleEvents[Event], options?: { authority?: number }) {
      listeners[event] = { callback, ...options }
    },
  }
  return { console, listeners }
}

function createSocket() {
  const bound: Array<{ type: string; listener: (event: { data: unknown }) => void }> = []
  return {
    bound,
    socket: {
      addEventListener(type: 'message', listener: (event: { data: unknown }) => void) {
        bound.push({ type, listener })
      },
      removeEventListener(type: 'message', listener: (event: { data: unknown }) => void) {
        const index = bound.findIndex((item) => item.type === type && item.listener === listener)
        if (index >= 0) bound.splice(index, 1)
      },
    },
  }
}

function createContext(options: {
  console: ConsoleService
  bots?: unknown[]
  logger?: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> }
}) {
  const listeners: Record<string, Listener[]> = {}
  const ctx: ChatCapsuleContext = {
    console: options.console,
    ...(options.bots ? { bots: options.bots } : {}),
    ...(options.logger ? { logger: () => options.logger! } : {}),
    on(event, listener) {
      ;(listeners[event] ||= []).push(listener as Listener)
    },
    before(event, listener) {
      ;(listeners[`before:${event}`] ||= []).push(listener as Listener)
    },
    setInterval() {
      return () => {}
    },
    inject(services, callback) {
      if ('console' in services) callback(ctx)
    },
  }
  const dispose = async () => {
    for (const listener of listeners.dispose ?? []) await listener()
  }
  return { ctx, listeners, dispose }
}

function createOneBotBot(socket: unknown) {
  return {
    platform: 'onebot',
    selfId: '10000',
    status: 1,
    adapter: { socket },
    internal: { _request: vi.fn(async () => ({})) },
  }
}

describe('plugin disposal releases everything it registered', () => {
  it('removes its console RPC listeners when the plugin is disabled', async () => {
    const { console, listeners: consoleListeners } = createKoishiLikeConsole()
    const { ctx, dispose } = createContext({ console })

    plugin.apply(ctx)
    const registered = Object.keys(consoleListeners).filter((name) => name.startsWith('onebot-webqq/'))
    expect(registered.length).toBeGreaterThan(0)

    await dispose()

    // 残留回调会闭包已 dispose 的 ctx，之后控制台请求会拿到「Koishi 数据库服务不可用」，
    // 前端只显示「加载聊天历史失败」，后端不开 debug 则完全没有日志。
    expect(Object.keys(consoleListeners).filter((name) => name.startsWith('onebot-webqq/'))).toEqual([])
  })

  it('keeps a listener that a newer plugin instance already re-registered', async () => {
    const { console, listeners: consoleListeners } = createKoishiLikeConsole()
    const first = createContext({ console })
    plugin.apply(first.ctx)

    const second = createContext({ console })
    plugin.apply(second.ctx)
    const takenOver = consoleListeners['onebot-webqq/webqq/messages']

    // 修改插件时旧实例后 dispose；若不按 owner 判断归属就会把新实例刚注册好的监听器一起摘掉。
    await first.dispose()

    expect(consoleListeners['onebot-webqq/webqq/messages']).toBe(takenOver)
    expect(takenOver).toBeDefined()

    // 新实例自己 dispose 时仍要能清干净。
    await second.dispose()
    expect(Object.keys(consoleListeners).filter((name) => name.startsWith('onebot-webqq/'))).toEqual([])
  })

  it('restores a working listener set after a dispose and re-apply cycle', async () => {
    const { console, listeners: consoleListeners } = createKoishiLikeConsole()
    const first = createContext({ console })
    plugin.apply(first.ctx)
    await first.dispose()

    const second = createContext({ console })
    plugin.apply(second.ctx)

    expect(Object.keys(consoleListeners).filter((name) => name.startsWith('onebot-webqq/')).length)
      .toBeGreaterThan(0)
  })

  it('unbinds the raw OneBot socket listener instead of leaking one per reload', async () => {
    const { console } = createKoishiLikeConsole()
    const { bound, socket } = createSocket()
    const bot = createOneBotBot(socket)

    const first = createContext({ console, bots: [bot] })
    plugin.apply(first.ctx)
    expect(bound).toHaveLength(1)

    await first.dispose()
    expect(bound).toHaveLength(0)

    // 三轮「修改插件」后 socket 上仍然只应有当前实例的一个监听器。
    for (let round = 0; round < 3; round++) {
      const next = createContext({ console, bots: [bot] })
      plugin.apply(next.ctx)
      expect(bound).toHaveLength(1)
      await next.dispose()
      expect(bound).toHaveLength(0)
    }
  })

  it('ignores socket frames that arrive after disposal', async () => {
    const { console } = createKoishiLikeConsole()
    const bound: Array<(event: { data: unknown }) => void> = []
    // 不实现 removeEventListener 的 socket 实现也不能让已 dispose 的运行时继续处理帧。
    const socket = { addEventListener: (_type: 'message', listener: (event: { data: unknown }) => void) => bound.push(listener) }
    const bot = createOneBotBot(socket)
    const { ctx, dispose } = createContext({ console, bots: [bot] })

    plugin.apply(ctx)
    await dispose()
    bound[0]?.({
      data: JSON.stringify({
        post_type: 'notice',
        notice_type: 'group_msg_emoji_like',
        group_id: '20000',
        user_id: '40000',
        message_id: 'new-1',
        likes: [{ emoji_id: '76', count: 1 }],
        is_add: true,
      }),
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bot.internal._request).not.toHaveBeenCalled()
  })
})

describe('console RPC failures are visible without the debug switch', () => {
  it('logs a console listener failure even when debug is disabled', async () => {
    const logger = { info: vi.fn(), warn: vi.fn() }
    const { console, listeners: consoleListeners } = createKoishiLikeConsole()
    // 没有可用 OneBot 机器人时，加载历史必然抛错，这正是生产上「有时加载失败」的场景。
    const { ctx } = createContext({ console, bots: [], logger })

    plugin.apply(ctx, { debug: false })
    const loadMessages = consoleListeners['onebot-webqq/webqq/messages']?.callback as
      | ((query: unknown) => Promise<unknown>)
      | undefined

    await expect(loadMessages?.({ type: 'group', peerId: '20000' })).rejects.toThrow()
    expect(logger.warn).toHaveBeenCalledWith(
      'console listener %s failed: %s',
      'onebot-webqq/webqq/messages',
      expect.stringContaining('OneBot'),
    )
  })
})

describe('readWebQQErrorMessage', () => {
  it('reads the reason out of the coerced stack string Koishi rejects with', () => {
    // 服务端用 coerce() 序列化后发回，客户端 send() 以纯字符串 reject。
    const coerced = 'Error: 未找到可用的 OneBot 机器人\n    at loadMessages (/app/lib/index.js:1:1)'
    expect(readWebQQErrorMessage(coerced, '加载聊天历史失败')).toBe('未找到可用的 OneBot 机器人')
  })

  it('still handles real Error instances and unknown rejections', () => {
    expect(readWebQQErrorMessage(new Error('数据库连接中断'), '兜底')).toBe('数据库连接中断')
    expect(readWebQQErrorMessage(undefined, '兜底')).toBe('兜底')
    expect(readWebQQErrorMessage('', '兜底')).toBe('兜底')
  })

  it('explains the 60 second console timeout instead of showing "timeout"', () => {
    expect(readWebQQErrorMessage(new Error('timeout'), '加载聊天历史失败'))
      .toBe('加载聊天历史失败：服务端 60 秒内没有响应')
  })
})
