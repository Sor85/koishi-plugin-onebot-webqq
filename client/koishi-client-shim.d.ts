declare module '@koishijs/client' {
  import type { Component } from 'vue'

  export interface Context {
    slot(options: { type: string; component: Component; order?: number }): unknown
    effect(callback: () => void | (() => void)): unknown
  }

  export const Universal: {
    Status: {
      ONLINE: number
      CONNECT: number
      RECONNECT: number
    }
  }
  export const activities: { login?: unknown }
  export const router: { currentRoute: { value: { path: string } } }
  export const store: Record<string, unknown>

  export function withProxy(url: string): string
  export function receive<T = unknown>(event: string, listener: (value: T) => unknown): (() => void) | void
  export function send<T = unknown>(event: string, payload?: unknown): Promise<T>
}
