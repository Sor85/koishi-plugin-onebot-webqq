declare module '@koishijs/client' {
  import type { Component } from 'vue'

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
  export function receive<T = unknown>(event: string, listener: (value: T) => unknown): (() => void) | void
  export function send<T = unknown>(event: string, payload?: unknown): Promise<T>
}
