import type { ChatCapsuleContext, ConsoleEvents, ConsoleService, DebugLogger } from '../plugin-context'

// 用来标记「这个监听器属于哪一次 apply」。停用插件时只摘掉本次 apply 注册的回调，
// 修改插件时新实例的回调带着新 token，旧实例的清理逻辑就不会误删。
const consoleListenerOwner = Symbol('onebot-webqq.console-listener-owner')

type OwnedCallback = { [consoleListenerOwner]?: object }

export function createConsoleOwnerToken() {
  return {}
}

function logListenerFailure(logger: DebugLogger | undefined, event: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  // 必须显式打一条可见日志：Koishi 的 Console.receive 只在 `logger.debug` 里记录监听器异常，
  // 默认日志级别看不到，控制台又只把错误回传成一段字符串。少了这条日志，
  // 「加载聊天历史失败」和「操作失败，请检查日志！」就永远查不到原因。
  const warn = logger?.warn ?? logger?.info
  warn?.call(logger, 'console listener %s failed: %s', event, message)
}

// Koishi 的 `Console.addListener` 只是把回调写进全局 `listeners[event]`，既不返回 disposable，
// 也不参与 `ctx.collect` / `ctx.on('dispose')` 的作用域回收。停用或修改插件后旧回调仍留在 Console 上
// 并闭包着已 dispose 的 ctx，控制台随后发来的 RPC 会打到死掉的运行时，读数据库时抛
// 「Koishi 数据库服务不可用」，前端只显示「加载聊天历史失败」。
//
// 这里返回一个与 ConsoleService 同形的门面：注册时打上 owner 标记并补上可见日志，
// dispose 时按 owner 回收。不能用闭包函数的引用相等来判断归属——`ctx.inject` 的回调可能在
// 同一次 apply 内多次执行，导致 Console 上留下的是后一次注册的函数，引用比对会整体失配。
export function createManagedConsole(
  console: ConsoleService,
  ctx: ChatCapsuleContext,
  owner: object,
  logger?: DebugLogger,
): ConsoleService {
  const registeredEvents = new Set<string>()

  ctx.on('dispose', () => {
    const listeners = console.listeners
    if (!listeners) return
    for (const event of registeredEvents) {
      const callback = listeners[event]?.callback as OwnedCallback | undefined
      // owner 不同说明已被新实例接管，必须保留，否则会把健康的新监听器一起摘掉。
      if (callback?.[consoleListenerOwner] === owner) delete listeners[event]
    }
    registeredEvents.clear()
  })

  return {
    addEntry(files, data) {
      return console.addEntry(files, data)
    },
    broadcast(type, body, options) {
      return console.broadcast(type, body, options)
    },
    get listeners() {
      return console.listeners
    },
    addListener<Event extends keyof ConsoleEvents>(
      event: Event,
      callback: ConsoleEvents[Event],
      options?: { authority?: number },
    ) {
      const guarded = (async (...args: unknown[]) => {
        try {
          return await (callback as (...input: unknown[]) => unknown)(...args)
        } catch (error) {
          logListenerFailure(logger, event, error)
          throw error
        }
      }) as ConsoleEvents[Event] & OwnedCallback
      guarded[consoleListenerOwner] = owner
      registeredEvents.add(event)
      return console.addListener(event, guarded, options)
    },
  }
}
