import { vi } from 'vitest'
import type { ConsoleEvents, ConsoleService } from '../../src/plugin-context'

/**
 * 注册表型控制台替身。
 *
 * 复刻 Koishi Console 的真实语义：`addListener` 只是把回调写进全局 `listeners[event]`，既不返回
 * disposable 也不随 ctx 回收。停用插件后残留的回调就是生产事故的来源，所以要测这条路的测试必须
 * 拿到那张全局表本身，而不是一个只记调用次数的 mock。
 *
 * 住在共享脚手架里而不是某个测试文件内部：需要它的测试文件不止一个，各自抄一份的话，给广播端
 * 收类型这类改动就要在多处各改一遍。
 */
export function createKoishiLikeConsole() {
  const listeners: Record<string, { callback?: unknown } | undefined> = Object.create(null)
  // 广播记成宽松形状：事件名与载荷的收窄由生产代码那一端的 ConsoleService 签名保证，不靠替身；
  // 替身只负责让断言能读到实际发生过的调用。
  const broadcast = vi.fn((_type: string, _body?: unknown, _options?: { authority?: number }) => {})
  const console: ConsoleService = {
    addEntry: vi.fn(() => {}),
    broadcast,
    listeners,
    addListener<Event extends keyof ConsoleEvents>(event: Event, callback: ConsoleEvents[Event], options?: { authority?: number }) {
      listeners[event] = { callback, ...options }
    },
  }
  return { console, listeners, broadcast }
}
