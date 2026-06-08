import { randomUUID } from 'crypto'
import { readFile } from 'fs/promises'
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

export interface WebQQImageUrlResolverOptions {
  cacheEnabled?: boolean
  cacheLimitBytes?: number
  cacheItemLimitBytes?: number
}

interface CachedWebQQImage {
  body: Buffer
  contentType: string
  size: number
  lastAccessed: number
}

const WEBQQ_IMAGE_CACHE_CONTROL = 'private, max-age=86400, immutable'
const WEBQQ_IMAGE_CACHE_LIMIT = 100 * 1024 * 1024
const WEBQQ_IMAGE_CACHE_ITEM_LIMIT = 10 * 1024 * 1024

export function createWebQQImageUrlResolver(
  ctx: WebQQImageUrlResolverContext,
  logger?: WebQQImageUrlResolverLogger,
  options: WebQQImageUrlResolverOptions = {},
): WebQQImageUrlResolver {
  const files = new Map<string, string>()
  const ids = new Map<string, string>()
  const imageCache = new Map<string, CachedWebQQImage>()
  let imageCacheSize = 0
  const cacheEnabled = options.cacheEnabled ?? true
  const cacheLimitBytes = options.cacheLimitBytes ?? WEBQQ_IMAGE_CACHE_LIMIT
  const cacheItemLimitBytes = options.cacheItemLimitBytes ?? WEBQQ_IMAGE_CACHE_ITEM_LIMIT

  function setImageHeaders(routerCtx: WebQQImageContext, id: string, contentType: string) {
    routerCtx.set('content-type', contentType)
    routerCtx.set('cache-control', WEBQQ_IMAGE_CACHE_CONTROL)
    routerCtx.set('etag', `"${id}"`)
  }

  function cacheImage(id: string, body: Buffer, contentType: string) {
    if (!cacheEnabled || body.length > cacheItemLimitBytes) return

    const cached = imageCache.get(id)
    if (cached) imageCacheSize -= cached.size

    imageCache.set(id, {
      body,
      contentType,
      size: body.length,
      lastAccessed: Date.now(),
    })
    imageCacheSize += body.length

    while (imageCacheSize > cacheLimitBytes) {
      let oldestId: string | undefined
      let oldestAccess = Infinity
      for (const [cacheId, cachedImage] of imageCache) {
        if (cachedImage.lastAccessed < oldestAccess) {
          oldestId = cacheId
          oldestAccess = cachedImage.lastAccessed
        }
      }
      if (!oldestId) break
      const oldest = imageCache.get(oldestId)
      if (oldest) imageCacheSize -= oldest.size
      imageCache.delete(oldestId)
    }
  }

  ctx.server?.get('/onebot-webqq/webqq/image/:id', async (routerCtx) => {
    const id = routerCtx.params.id
    const file = files.get(id)
    if (!file) {
      routerCtx.status = 404
      return
    }
    if (cacheEnabled) {
      const cached = imageCache.get(id)
      if (cached) {
        cached.lastAccessed = Date.now()
        routerCtx.status = 200
        setImageHeaders(routerCtx, id, cached.contentType)
        routerCtx.body = cached.body
        return
      }
    }
    logger?.info('webqq image proxy %s', JSON.stringify({ id, file }))
    if (isRemoteImageSource(file)) {
      const response = await fetch(file)
      routerCtx.status = response.status
      if (!response.ok) return
      const contentType = response.headers.get('content-type') || getImageContentType(file)
      const body = Buffer.from(await response.arrayBuffer())
      setImageHeaders(routerCtx, id, contentType)
      routerCtx.body = body
      cacheImage(id, body, contentType)
      return
    }
    const contentType = getImageContentType(file)
    const body = await readFile(file)
    setImageHeaders(routerCtx, id, contentType)
    routerCtx.body = body
    cacheImage(id, body, contentType)
  })

  return (file: string) => {
    if (!ctx.server) return ''
    const cached = ids.get(file)
    if (cached) return `/onebot-webqq/webqq/image/${cached}`
    const id = randomUUID()
    files.set(id, file)
    ids.set(file, id)
    return `/onebot-webqq/webqq/image/${id}`
  }
}
