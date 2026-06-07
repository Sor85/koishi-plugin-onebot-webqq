import { randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import type { WebQQImageUrlResolver } from './live-elements'
import { getImageContentType, isRemoteImageSource } from './live-elements'

export interface WebQQImageContext {
  params: Record<string, string>
  status?: number
  body?: unknown
  set(name: string, value: string): unknown
}

export interface WebQQImageServer {
  get(path: string, callback: (ctx: WebQQImageContext) => unknown): unknown
}

interface WebQQImageUrlResolverContext {
  server?: WebQQImageServer
}

interface WebQQImageUrlResolverLogger {
  info(format: string, ...param: unknown[]): unknown
}

export function createWebQQImageUrlResolver(ctx: WebQQImageUrlResolverContext, logger?: WebQQImageUrlResolverLogger): WebQQImageUrlResolver {
  const files = new Map<string, string>()
  const ids = new Map<string, string>()
  ctx.server?.get('/chat-capsule/webqq/image/:id', async (routerCtx) => {
    const file = files.get(routerCtx.params.id)
    if (!file) {
      routerCtx.status = 404
      return
    }
    logger?.info('webqq image proxy %s', JSON.stringify({ id: routerCtx.params.id, file }))
    if (isRemoteImageSource(file)) {
      const response = await fetch(file)
      routerCtx.status = response.status
      if (!response.ok) return
      routerCtx.set('content-type', response.headers.get('content-type') || getImageContentType(file))
      routerCtx.body = Buffer.from(await response.arrayBuffer())
      return
    }
    routerCtx.set('content-type', getImageContentType(file))
    routerCtx.body = createReadStream(file)
  })
  return (file: string) => {
    if (!ctx.server) return ''
    const cached = ids.get(file)
    if (cached) return `/chat-capsule/webqq/image/${cached}`
    const id = randomUUID()
    files.set(id, file)
    ids.set(file, id)
    return `/chat-capsule/webqq/image/${id}`
  }
}
