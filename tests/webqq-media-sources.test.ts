import type { Session } from 'koishi'
import { describe, expect, it, vi } from 'vitest'
import { createOneBotWebQQService } from '../src/webqq/adapters/onebot/service'
import { normalizeLiveElements } from '../src/webqq/message-flow/live-elements'
import {
  isDirectMediaSource,
  isUnresolvableMediaSource,
  resolveWebQQMediaUrl,
} from '../src/webqq/media/image-url-resolver'

const sandboxReference = 'sandbox-media://0123456789abcdef0123456789abcdef'
const pngDataUrl = 'data:image/png;base64,AAA'

function createLiveSession(elements: unknown[]) {
  return { elements, event: {} } as unknown as Session
}

function createBot(internal: Record<string, unknown> = {}) {
  return {
    platform: 'onebot',
    selfId: '10000',
    status: 1,
    internal: {
      get_friend_list: vi.fn(async () => []),
      get_group_list: vi.fn(async () => []),
      ...internal,
    } as Record<string, any>,
  }
}

function createHistoryBot(segment: Record<string, unknown>, internal: Record<string, unknown> = {}) {
  return createBot({
    get_group_msg_history: vi.fn(async () => ({
      messages: [{
        message_id: 8,
        message_seq: 18,
        time: 1710000007,
        sender: { user_id: 30000, nickname: 'Alice' },
        message: [segment],
      }],
    })),
    get_image: vi.fn(),
    get_record: vi.fn(),
    ...internal,
  })
}

describe('webqq 媒体取值', () => {
  it('http(s) 取值照旧进图片代理', () => {
    const resolve = vi.fn(() => '/onebot-webqq/webqq/image/id')
    expect(resolveWebQQMediaUrl('https://example.com/a.jpg', resolve)).toBe('/onebot-webqq/webqq/image/id')
    expect(resolve).toHaveBeenCalledWith('https://example.com/a.jpg')
  })

  it('文件 ID 与本地路径照旧进图片代理', () => {
    const resolve = vi.fn(() => '/onebot-webqq/webqq/image/id')
    expect(resolveWebQQMediaUrl('ABCDEF.image', resolve)).toBe('/onebot-webqq/webqq/image/id')
    expect(resolveWebQQMediaUrl('/var/napcat/cache/a.jpg', resolve)).toBe('/onebot-webqq/webqq/image/id')
    expect(resolveWebQQMediaUrl('C:\\napcat\\cache\\a.jpg', resolve)).toBe('/onebot-webqq/webqq/image/id')
  })

  // 代理既不会 fetch data: 也没法把它当路径读盘；绕进去只会 502，换回一张碎图。
  it('浏览器能直接渲染的取值不进图片代理', () => {
    const resolve = vi.fn(() => '/onebot-webqq/webqq/image/id')
    expect(isDirectMediaSource(pngDataUrl)).toBe(true)
    expect(resolveWebQQMediaUrl(pngDataUrl, resolve)).toBe(pngDataUrl)
    expect(resolveWebQQMediaUrl('data:audio/mpeg;base64,AAA', resolve)).toBe('data:audio/mpeg;base64,AAA')
    expect(resolve).not.toHaveBeenCalled()
  })

  // 提供方自己的受管媒体引用只有它自己解得开；伪造一个代理地址只会让 <img> 渲染成碎图。
  it('代理取不回的引用不再伪造地址', () => {
    const resolve = vi.fn(() => '/onebot-webqq/webqq/image/id')
    expect(isUnresolvableMediaSource(sandboxReference)).toBe(true)
    expect(isUnresolvableMediaSource('file:///tmp/a.jpg')).toBe(true)
    expect(isUnresolvableMediaSource('data:text/html,<b>x</b>')).toBe(true)
    expect(isUnresolvableMediaSource('https://example.com/a.jpg')).toBe(false)
    expect(isUnresolvableMediaSource(pngDataUrl)).toBe(false)
    expect(resolveWebQQMediaUrl(sandboxReference, resolve)).toBe('')
    expect(resolveWebQQMediaUrl('', resolve)).toBe('')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('历史图片段的受管媒体引用渲染成占位而不是碎图', async () => {
    const bot = createHistoryBot({ type: 'image', data: { file: sandboxReference, url: sandboxReference } })
    const imageUrlResolver = vi.fn((file: string) => `/onebot-webqq/webqq/image/${encodeURIComponent(file)}`)
    const service = createOneBotWebQQService({ bots: [bot] }, { imageUrlResolver })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[图片]',
        elements: [{ type: 'image', text: '[图片]' }],
      }),
    ])
    expect(imageUrlResolver).not.toHaveBeenCalled()
    // 带 scheme 的引用连 assertSafeOneBotMediaFile 都过不了，不该白跑一次 action。
    expect(bot.internal.get_image).not.toHaveBeenCalled()
  })

  it('历史图片段里的 Data URL 原样交给前端', async () => {
    const bot = createHistoryBot({ type: 'image', data: { file: sandboxReference, url: pngDataUrl } })
    const imageUrlResolver = vi.fn((file: string) => `/onebot-webqq/webqq/image/${encodeURIComponent(file)}`)
    const service = createOneBotWebQQService({ bots: [bot] }, { imageUrlResolver })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        elements: [{ type: 'image', url: pngDataUrl }],
      }),
    ])
    expect(imageUrlResolver).not.toHaveBeenCalled()
  })

  it('历史语音段的受管媒体引用不再伪造地址', async () => {
    const bot = createHistoryBot({ type: 'record', data: { file: sandboxReference, url: sandboxReference } })
    const imageUrlResolver = vi.fn((file: string) => `/onebot-webqq/webqq/image/${encodeURIComponent(file)}`)
    const service = createOneBotWebQQService({ bots: [bot] }, { imageUrlResolver })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        elements: [{ type: 'record', text: '[语音]' }],
      }),
    ])
    expect(imageUrlResolver).not.toHaveBeenCalled()
    expect(bot.internal.get_record).not.toHaveBeenCalled()
  })

  it('实时消息里的 Data URL 原样交给前端，受管媒体引用渲染成占位', async () => {
    const resolveImage = vi.fn(async (file: string) => ({ url: `/onebot-webqq/webqq/image/${encodeURIComponent(file)}` }))

    await expect(normalizeLiveElements(
      createLiveSession([{ type: 'img', attrs: { src: pngDataUrl, url: pngDataUrl } }]),
      resolveImage,
    )).resolves.toEqual([{ type: 'image', url: pngDataUrl }])
    await expect(normalizeLiveElements(
      createLiveSession([{ type: 'img', attrs: { src: sandboxReference, file: sandboxReference } }]),
      resolveImage,
    )).resolves.toEqual([{ type: 'image', text: '[图片]' }])
    await expect(normalizeLiveElements(
      createLiveSession([{ type: 'audio', attrs: { src: sandboxReference, duration: 3 } }]),
      undefined,
      undefined,
      undefined,
      resolveImage,
    )).resolves.toEqual([{ type: 'record', text: '[语音]', duration: 3 }])
    expect(resolveImage).not.toHaveBeenCalled()
  })

  it('实时消息里的远程图片仍走图片代理', async () => {
    const resolveImage = vi.fn(async (file: string) => ({ url: `/onebot-webqq/webqq/image/${encodeURIComponent(file)}` }))

    await expect(normalizeLiveElements(
      createLiveSession([{ type: 'img', attrs: { src: 'https://example.com/a.jpg' } }]),
      resolveImage,
    )).resolves.toEqual([{ type: 'image', url: '/onebot-webqq/webqq/image/https%3A%2F%2Fexample.com%2Fa.jpg' }])
    expect(resolveImage).toHaveBeenCalledWith('https://example.com/a.jpg', 'url')
  })
})
