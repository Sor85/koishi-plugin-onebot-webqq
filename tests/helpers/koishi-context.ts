import { vi } from 'vitest'
import type { CapsuleSnapshot } from '../../src/capsule/state'
import type { ChatCapsuleContext, ConsoleService, DatabaseService } from '../../src/plugin-context'
import type { WebQQMessage } from '../../src/webqq/types'

export type Listener = (...payload: any[]) => void
export type TestBroadcastBody = {
  message?: WebQQMessage
  conversation?: CapsuleSnapshot['conversation']
  [key: string]: unknown
} | undefined
export type TestLogger = {
  info: ReturnType<typeof vi.fn>
}

/** 事件注册表里同一个事件可能挂了多个监听器；逐个 await，否则异步落地只跑到一半就断言。 */
export async function emitAll(listeners: Listener[] | undefined, ...payload: unknown[]) {
  for (const listener of listeners ?? []) {
    await listener(...payload)
  }
}

/**
 * Koishi 上下文替身。
 *
 * 提供事件注册、可选控制台（含广播、监听器与入口收集器）、可选数据库与模型扩展、bot 列表、日志器。
 * 住在共享脚手架里而不是某个测试文件内部：需要它的测试文件不止一个，而放在最大的那个测试文件里
 * 会让别处只能在「再抄一份」和「import 一个顶层有十几个读文件操作的两千行模块」之间选。
 */
export function createFakeContext(options: { console?: boolean; character?: ChatCapsuleContext['chatluna_character']; schedule?: ChatCapsuleContext['chatluna_schedule']; bots?: unknown[]; server?: boolean; database?: DatabaseService; logger?: TestLogger } = {}) {
  const listeners: Record<string, Listener[]> = {}
  const addEntry = vi.fn((_files: unknown, _data?: () => { capsule: CapsuleSnapshot | undefined }) => {})
  const broadcast = vi.fn((_type: string, _body: TestBroadcastBody, _options?: { authority?: number }) => {})
  const addListener = vi.fn<ConsoleService['addListener']>((_event, _listener, _options) => {})
  const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
  const modelExtend = vi.fn((_table: string, _fields: unknown, _options?: unknown) => {})
  const hasConsole = options.console ?? true

  const base: Pick<ChatCapsuleContext, 'on' | 'before' | 'setInterval'> = {
    on(event, listener) {
      ;(listeners[event] ||= []).push(listener)
    },
    before(event, listener) {
      ;(listeners[`before:${event}`] ||= []).push(listener)
    },
    setInterval() {
      return () => {}
    },
  }

  if (hasConsole) {
    const ctx: ChatCapsuleContext & { console: NonNullable<ChatCapsuleContext['console']>; bots?: unknown[] } = {
      ...base,
      ...(options.bots ? { bots: options.bots } : {}),
      ...(options.logger ? { logger: (_name: string) => options.logger! } : {}),
      console: {
        addEntry,
        broadcast,
        addListener,
      },
      ...(options.server ? { server: { get: serverGet } } : {}),
      ...(options.character ? { chatluna_character: options.character } : {}),
      ...(options.schedule ? { chatluna_schedule: options.schedule } : {}),
      ...(options.database ? { database: options.database, model: { extend: modelExtend } } : {}),
      inject(services, callback) {
        if ('console' in services) callback(ctx)
        if ('chatluna_character' in services && options.character) callback(ctx)
      },
    }
    return { ctx, listeners, addEntry, broadcast, addListener, serverGet, modelExtend }
  }

  const ctx: ChatCapsuleContext & { bots?: unknown[] } = {
    ...base,
    ...(options.bots ? { bots: options.bots } : {}),
    ...(options.logger ? { logger: (_name: string) => options.logger! } : {}),
    ...(options.server ? { server: { get: serverGet } } : {}),
    ...(options.character ? { chatluna_character: options.character } : {}),
    ...(options.schedule ? { chatluna_schedule: options.schedule } : {}),
    ...(options.database ? { database: options.database, model: { extend: modelExtend } } : {}),
    inject(services, callback) {
      if ('chatluna_character' in services && options.character) callback(ctx)
    },
  }

  return { ctx, listeners, addEntry, broadcast, addListener, serverGet, modelExtend }
}
