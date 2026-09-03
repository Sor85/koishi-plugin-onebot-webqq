declare module '@koishijs/client' {
  import type { Component } from 'vue'
  // 契约类型走 import() 类型而不是声明块内的 import 语句：这个文件是全局脚本，环境模块声明里的
  // 相对 import 语句不按文件位置解析，会静默退化成 any——两端的收窄会一起消失且不报错。
  type ConsoleRequests = import('../src/shared/console-contract').ConsoleRequests
  type ConsoleBroadcasts = import('../src/shared/console-contract').ConsoleBroadcasts
  type ConsoleBroadcastBody<Event extends keyof ConsoleBroadcasts> =
    import('../src/shared/console-contract').ConsoleBroadcastBody<Event>

  export interface Context {
    slot(options: { type: string; component: Component; order?: number }): unknown
    schema(options: { type?: string; role?: string; component: Component }): unknown
    effect(callback: () => void | (() => void)): unknown
    $router: {
      pages: Record<string, {
        id: string
        name: string
        order: number
        disabled(): boolean
      }>
    }
  }

  export const Universal: {
    Status: {
      ONLINE: number
      CONNECT: number
      RECONNECT: number
    }
  }
  export const activities: { login?: unknown }
  export const router: { currentRoute: { value: { path: string; meta?: { activity?: { id?: string } } } } }
  export const store: Record<string, unknown>
  export const SchemaBase: Component
  export const Binary: {
    toBase64(value: ArrayBuffer): string
  }

  export function useContext(): Context
  export function useColorMode(): import('vue').ComputedRef<'light' | 'dark'>
  export function withProxy(url: string): string

  // 事件名、载荷与返回类型全部按控制台契约检查。在这之前这一端完全没有类型：事件名是纯字符串、
  // 载荷是 unknown、返回值靠调用点自己手转，所以写错名字、传错载荷、把返回值当成另一种东西用，
  // 三种错都要等到运行时——表现成「加载聊天历史失败」而日志里查不到原因。
  //
  // ADR 0010：不留字符串兜底重载。留了就等于没约束。撞上「某个事件名编译不过」时，正确反应是回头
  // 看哪一端的声明不对，不是给这里加一条 (event: string, payload?: unknown) 的分支。真出现要发送
  // 非契约事件的需求时再加，判据是「有真实的非契约消费者」。
  export function receive<Event extends keyof ConsoleBroadcasts>(
    event: Event,
    listener: (value: ConsoleBroadcastBody<Event>) => unknown,
  ): (() => void) | void
  export function send<Event extends keyof ConsoleRequests>(
    event: Event,
    ...payload: Parameters<ConsoleRequests[Event]>
  ): ReturnType<ConsoleRequests[Event]>
}
