import { describe, expect, it, vi } from 'vitest'
import type { ChatCapsuleContext, ConsoleService } from '../src/plugin-context'
import { createKoishiLikeConsole } from './helpers/koishi-console'

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

function createContext(options: { console: ConsoleService; bots: unknown[] }) {
  const listeners: Record<string, Listener[]> = {}
  const intervals: Array<() => void> = []
  const ctx: ChatCapsuleContext = {
    console: options.console,
    bots: options.bots,
    on(event, listener) {
      ;(listeners[event] ||= []).push(listener as Listener)
    },
    before(event, listener) {
      ;(listeners[`before:${event}`] ||= []).push(listener as Listener)
    },
    setInterval(callback) {
      intervals.push(callback)
      return () => {}
    },
    inject(services, callback) {
      if ('console' in services) callback(ctx)
    },
  }
  const emit = async (event: string, ...payload: unknown[]) => {
    for (const listener of listeners[event] ?? []) await listener(...payload)
  }
  const runIntervals = async () => {
    for (const callback of intervals) await callback()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return { ctx, listeners, emit, runIntervals }
}

// NapCat / LLBot 在 Koishi 重启后会有一段时间继续上报非 ONLINE 状态，
// 但 action 通道其实已经可用。这类 Bot 过去只能靠一条外部消息激活。
function createLaggingStatusBot(options: { probeFails?: boolean } = {}) {
  const request = vi.fn(async (action: string) => {
    if (action === 'get_login_info') {
      if (options.probeFails) throw new Error('socket not ready')
      return { user_id: 10000, nickname: '彩虹猫' }
    }
    if (action === 'get_group_list') return []
    if (action === 'get_friend_list') return []
    return {}
  })
  return {
    platform: 'onebot',
    selfId: '10000',
    name: '彩虹猫',
    // 0 = OFFLINE：适配器滞后上报，但 internal._request 已经能用。
    status: 0,
    internal: { _request: request },
    request,
  }
}

async function loadContacts(listeners: Record<string, { callback?: unknown } | undefined>) {
  const callback = listeners['onebot-webqq/webqq/contacts']?.callback as (() => Promise<unknown>) | undefined
  return callback?.()
}

describe('WebQQ 在 Koishi 重启后无需外部消息即可可用', () => {
  it('主动探测 action 通道，让滞后上报离线的 Bot 直接变为可用', async () => {
    const { console, listeners: consoleListeners, broadcast } = createKoishiLikeConsole()
    const bot = createLaggingStatusBot()
    const { ctx, emit } = createContext({ console, bots: [bot] })

    plugin.apply(ctx)
    // 探测前：适配器上报 OFFLINE，联系人加载必然失败——这正是重启后看到的现象。
    await expect(loadContacts(consoleListeners)).rejects.toThrow('未找到可用的 OneBot 机器人')

    // Bot 注册进运行时后触发探测，不依赖任何外部消息。
    broadcast.mockClear()
    await emit('login-added')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bot.request).toHaveBeenCalledWith('get_login_info', {})
    await expect(loadContacts(consoleListeners)).resolves.toEqual({ friends: [], groups: [] })
    // 必须广播新的 Bot 状态，前端失败过的联系人列表才会自动重载。
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/bots/update', expect.objectContaining({
      selectedSelfId: '10000',
    }), { authority: 1 })
  })

  it('轮询兜底覆盖启动时 Bot 还没进入运行时的情况', async () => {
    const { console, listeners: consoleListeners } = createKoishiLikeConsole()
    const bot = createLaggingStatusBot()
    const bots: unknown[] = []
    const { ctx, runIntervals } = createContext({ console, bots })

    plugin.apply(ctx)
    // apply 时运行时里还没有 Bot，启动探测找不到候选。
    expect(bot.request).not.toHaveBeenCalled()

    // 适配器随后注册 Bot，但不再发出生命周期事件。
    bots.push(bot)
    await runIntervals()

    expect(bot.request).toHaveBeenCalledWith('get_login_info', {})
    await expect(loadContacts(consoleListeners)).resolves.toEqual({ friends: [], groups: [] })
  })

  it('探测失败时不把 Bot 标成可用', async () => {
    const { console, listeners: consoleListeners, broadcast } = createKoishiLikeConsole()
    const bot = createLaggingStatusBot({ probeFails: true })
    const { ctx, emit } = createContext({ console, bots: [bot] })

    plugin.apply(ctx)
    broadcast.mockClear()
    await emit('login-added')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bot.request).toHaveBeenCalledWith('get_login_info', {})
    await expect(loadContacts(consoleListeners)).rejects.toThrow('未找到可用的 OneBot 机器人')
    // 胶囊本来就会在生命周期事件上广播一次状态；关键是探测失败后不能出现可用 Bot。
    for (const [event, body] of broadcast.mock.calls) {
      if (event !== 'onebot-webqq/bots/update') continue
      expect(body).toEqual({ bots: [] })
    }
  })

  it('不探测已经如实上报在线的 Bot', async () => {
    const { console } = createKoishiLikeConsole()
    const bot = createLaggingStatusBot()
    bot.status = 1
    const { ctx, emit, runIntervals } = createContext({ console, bots: [bot] })

    plugin.apply(ctx)
    await emit('login-updated')
    await runIntervals()

    // 健康环境下这条链路完全不产生额外的 OneBot 请求。
    expect(bot.request).not.toHaveBeenCalledWith('get_login_info', {})
  })
})
