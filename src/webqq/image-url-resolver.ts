import { randomUUID } from 'crypto'
import { readFile } from 'fs/promises'
import { isIP } from 'net'
import type { WebQQImageUrlResolver } from './live-elements'
import { detectMediaContentType, getImageContentType, isRemoteImageSource } from './live-elements'

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
  ffmpeg?: { builder(): { input(buf: Buffer): { outputOption(...opts: string[]): { run(type: 'buffer'): Promise<Buffer> } } } }
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

const BROWSER_INCOMPATIBLE_AUDIO = new Set(['audio/amr', 'application/octet-stream'])
const LOCAL_HOSTNAMES = new Set(['localhost', 'localhost.localdomain'])

function readIPv4Parts(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part))
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : undefined
}

function isPrivateIPv4(hostname: string) {
  const parts = readIPv4Parts(hostname)
  if (!parts) return false
  const [a, b] = parts
  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
}

function isPrivateIPv6(hostname: string) {
  if (hostname === '::' || hostname === '::1') return true
  const mappedIPv4 = hostname.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mappedIPv4) return isPrivateIPv4(mappedIPv4[1])
  const first = Number.parseInt(hostname.split(':')[0] || '0', 16)
  if (!Number.isFinite(first)) return false
  return first === 0 ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00
}

function isPrivateOrLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')
  if (LOCAL_HOSTNAMES.has(normalized) || normalized.endsWith('.localhost')) return true
  const ipVersion = isIP(normalized)
  if (ipVersion === 4) return isPrivateIPv4(normalized)
  if (ipVersion === 6) return isPrivateIPv6(normalized)
  return false
}

function canProxyRemoteImageSource(file: string) {
  try {
    const url = new URL(file)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return !isPrivateOrLocalHostname(url.hostname)
  } catch {
    return false
  }
}

function readContentLength(response: Response) {
  const value = response.headers.get('content-length')
  if (!value) return undefined
  const length = Number(value)
  return Number.isFinite(length) && length >= 0 ? length : undefined
}

async function readRemoteImageBody(response: Response, limitBytes: number) {
  const contentLength = readContentLength(response)
  if (contentLength != null && contentLength > limitBytes) return undefined
  if (!response.body) {
    const body = Buffer.from(await response.arrayBuffer())
    return body.length <= limitBytes ? body : undefined
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    total += chunk.value.byteLength
    if (total > limitBytes) {
      await reader.cancel()
      return undefined
    }
    chunks.push(Buffer.from(chunk.value))
  }
  return Buffer.concat(chunks, total)
}

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

  async function transcodeIfNeeded(body: Buffer, contentType: string): Promise<{ body: Buffer, contentType: string }> {
    if (!ctx.ffmpeg || !BROWSER_INCOMPATIBLE_AUDIO.has(contentType)) return { body, contentType }
    try {
      const transcoded = await ctx.ffmpeg.builder().input(body).outputOption('-c:a', 'libopus', '-f', 'ogg').run('buffer')
      return { body: transcoded, contentType: 'audio/ogg' }
    } catch {
      return { body, contentType }
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
    try {
      logger?.info('webqq image proxy %s', JSON.stringify({ id, file }))
      if (isRemoteImageSource(file)) {
        // 入站消息里的远程 URL 由聊天发送方控制；这里必须在 fetch 前拦截内网地址，避免控制台预览触发 SSRF。
        if (!canProxyRemoteImageSource(file)) {
          routerCtx.status = 403
          return
        }
        const response = await fetch(file)
        routerCtx.status = response.status
        if (!response.ok) return
        const rawBody = await readRemoteImageBody(response, cacheItemLimitBytes)
        if (!rawBody) {
          routerCtx.status = 413
          return
        }
        const rawContentType = detectMediaContentType(rawBody) || response.headers.get('content-type') || getImageContentType(file)
        const { body, contentType } = await transcodeIfNeeded(rawBody, rawContentType)
        setImageHeaders(routerCtx, id, contentType)
        routerCtx.body = body
        cacheImage(id, body, contentType)
        return
      }
      const rawBody = await readFile(file)
      const rawContentType = detectMediaContentType(rawBody) || getImageContentType(file)
      const { body, contentType } = await transcodeIfNeeded(rawBody, rawContentType)
      setImageHeaders(routerCtx, id, contentType)
      routerCtx.body = body
      cacheImage(id, body, contentType)
    } catch (error) {
      logger?.info('webqq image proxy failed %s', JSON.stringify({ id, file, error: error instanceof Error ? error.message : String(error) }))
      routerCtx.status = 502
    }
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
