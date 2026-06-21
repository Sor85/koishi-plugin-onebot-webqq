import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Session } from 'koishi'
import { describe, expect, it, vi } from 'vitest'
import type { ChatCapsuleContext, ChatLunaCharacterService, ConsoleEvents, ConsoleService, DatabaseService } from '../src/plugin-context'
import type { CapsuleSnapshot } from '../src/capsule/state'
import type { WebQQMessage, WebQQMessageElement } from '../src/webqq/types'
import { summarizeWebQQElements } from '../src/webqq/message-flow/live-elements'
import { createWebQQLiveMessage } from '../src/webqq/message-flow/live-message'
import { createWebQQImageUrlResolver, getImageContentType } from '../src/webqq/media/image-url-resolver'
import { getWebQQUserAvatar } from '../src/webqq/display'
import {
  readBotProfile,
  readUserName,
  readWebQQPeer,
  readWebQQLiveDirection,
} from '../src/webqq/message-flow/session'
import {
  fillWebQQMessageSenderMetadata,
  readWebQQSenderMetadata,
  replaceWebQQMessageSenderMetadata,
} from '../src/webqq/sender/sender-metadata'
import { readWebQQGroupSenderMetadata } from '../src/webqq/adapters/onebot/group-sender-metadata'
import {
  createWebQQFriendRequestNotice,
  createWebQQGroupLeaveNotice,
} from '../src/webqq/notices/event-notices'
import {
  applyWebQQReactionToLiveMessages,
  getWebQQLiveMessageKey,
  mergeWebQQLiveMessages,
} from '../src/webqq/message-flow/live-cache'
import { createMessageInput } from '../src/capsule/message-input'

const dnsMock = vi.hoisted(() => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}))

vi.mock('dns/promises', () => dnsMock)

const koishiMock = vi.hoisted(() => {
  function createSchemaNode() {
    const node = {
      description: () => node,
      default: () => node,
      role: () => node,
      min: () => node,
      max: () => node,
    }
    return node
  }

  return {
    Schema: {
      intersect: createSchemaNode,
      object: createSchemaNode,
      string: createSchemaNode,
      array: createSchemaNode,
      union: createSchemaNode,
      const: createSchemaNode,
      natural: createSchemaNode,
      boolean: createSchemaNode,
    },
  }
})

vi.mock('koishi', () => koishiMock)

const plugin = await import('../src')
const pluginSource = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
const runtimeSource = await readFile(new URL('../src/runtime/create-runtime.ts', import.meta.url), 'utf8')
const runtimeRegisterSource = await readFile(new URL('../src/runtime/register.ts', import.meta.url), 'utf8')
const capsuleRegisterSource = await readFile(new URL('../src/capsule/register.ts', import.meta.url), 'utf8')
const chatlunaActivitySource = await readFile(new URL('../src/capsule/chatluna-activity.ts', import.meta.url), 'utf8')
const chatlunaCharacterLockSource = await readFile(new URL('../src/capsule/character-lock.ts', import.meta.url), 'utf8')
const consoleEntrySource = await readFile(new URL('../src/capsule/console-entry.ts', import.meta.url), 'utf8')
const configSource = await readFile(new URL('../src/config.ts', import.meta.url), 'utf8')
const webqqRegisterSource = await readFile(new URL('../src/webqq/register.ts', import.meta.url), 'utf8')
const webqqConsoleSource = await readFile(new URL('../src/webqq/console.ts', import.meta.url), 'utf8')
const chatlunaMessageInputSource = await readFile(new URL('../src/capsule/message-input.ts', import.meta.url), 'utf8')
const webqqLiveElementsSource = await readFile(new URL('../src/webqq/message-flow/live-elements.ts', import.meta.url), 'utf8')
const webqqLiveCacheSource = await readFile(new URL('../src/webqq/message-flow/live-cache.ts', import.meta.url), 'utf8')
const webqqLiveMessageSource = await readFile(new URL('../src/webqq/message-flow/live-message.ts', import.meta.url), 'utf8')
const webqqLiveRuntimeSource = await readFile(new URL('../src/webqq/message-flow/live-runtime.ts', import.meta.url), 'utf8')
const webqqLiveNoticesSource = await readFile(new URL('../src/webqq/message-flow/live-notices.ts', import.meta.url), 'utf8')
const webqqLiveReactionsSource = await readFile(new URL('../src/webqq/message-flow/live-reactions.ts', import.meta.url), 'utf8')
const webqqImageUrlResolverSource = await readFile(new URL('../src/webqq/media/image-url-resolver.ts', import.meta.url), 'utf8')
const webqqSenderMetadataSource = await readFile(new URL('../src/webqq/sender/sender-metadata.ts', import.meta.url), 'utf8')
const webqqGroupSenderMetadataSource = await readFile(new URL('../src/webqq/adapters/onebot/group-sender-metadata.ts', import.meta.url), 'utf8')
const webqqEventNoticesSource = await readFile(new URL('../src/webqq/notices/event-notices.ts', import.meta.url), 'utf8')
const webqqSessionSource = await readFile(new URL('../src/webqq/message-flow/session.ts', import.meta.url), 'utf8')
const pluginContextSource = await readFile(new URL('../src/plugin-context.ts', import.meta.url), 'utf8')

type Listener = (...payload: any[]) => void
type TestBroadcastBody = {
  message?: WebQQMessage
  conversation?: CapsuleSnapshot['conversation']
  [key: string]: unknown
} | undefined
type TestLogger = {
  info: ReturnType<typeof vi.fn>
}

function findConsoleListener<Event extends keyof ConsoleEvents>(
  addListener: { mock: { calls: Array<[keyof ConsoleEvents, ConsoleEvents[keyof ConsoleEvents], { authority?: number }?]> } },
  event: Event,
): ConsoleEvents[Event] | undefined {
  return addListener.mock.calls.find(([name]) => name === event)?.[1] as ConsoleEvents[Event] | undefined
}

async function emitAll(listeners: Listener[] | undefined, ...payload: unknown[]) {
  for (const listener of listeners ?? []) {
    await listener(...payload)
  }
}

function createFakeContext(options: { console?: boolean; character?: ChatCapsuleContext['chatluna_character']; schedule?: ChatCapsuleContext['chatluna_schedule']; bots?: unknown[]; server?: boolean; database?: DatabaseService } = {}) {
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

function createSession(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'onebot',
    selfId: '10000',
    channelId: '20000',
    userId: '30000',
    username: 'Session Alice',
    timestamp: 1710000000000,
    bot: {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    },
    event: {
      guild: {
        name: 'Guild Name',
      },
      channel: {
        name: 'Channel Name',
      },
      user: {
        name: 'Event Alice',
      },
    },
    ...overrides,
  }
}

describe('chat capsule plugin wiring', () => {
  it('exports plugin name and optional console injection', () => {
    expect(plugin.name).toBe('onebot-webqq')
    expect(plugin.inject).toEqual({
      optional: ['console', 'server', 'database', 'chatluna', 'chatluna_character', 'ffmpeg', 'chatluna_schedule'],
    })
  })

  it('keeps Koishi context service types outside the plugin entry', () => {
    expect(pluginSource).toContain("from './plugin-context'")
    expect(pluginSource).not.toContain('interface ConsoleService')
    expect(pluginSource).not.toContain('interface ChatCapsuleContext')
    expect(pluginContextSource).toContain('export interface ChatCapsuleContext')
    expect(pluginContextSource).toContain('export interface ChatLunaScheduleService')
    expect(pluginContextSource).toContain('export interface ChatLunaModelUsage')
  })

  it('keeps shared runtime dependency creation outside the plugin entry', () => {
    expect(pluginSource).toContain("from './runtime/register'")
    expect(pluginSource).not.toContain("from './runtime/create-runtime'")
    expect(pluginSource).not.toContain('function normalizeOneBotSelfId(')
    expect(pluginSource).not.toContain('createOneBotWebQQService(ctx')
    expect(pluginSource).not.toContain('createWebQQImageUrlResolver(ctx')
    expect(runtimeRegisterSource).toContain("from './create-runtime'")
    expect(runtimeSource).toContain('export function createPluginRuntime')
    expect(runtimeSource).toContain('createOneBotWebQQService(ctx')
    expect(runtimeSource).toContain('createWebQQImageUrlResolver(ctx')
  })

  it('keeps console entry data outside the plugin entry', () => {
    expect(pluginSource).not.toContain("from './capsule/register'")
    expect(runtimeRegisterSource).toContain("from '../capsule/register'")
    expect(pluginSource).not.toContain("from './capsule/console-entry'")
    expect(capsuleRegisterSource).toContain("from './console-entry'")
    expect(pluginSource).not.toContain("dev: resolve(__dirname, '../client/index.ts')")
    expect(pluginSource).not.toContain("webQQStorageBackend: config.webQQStorageBackend ?? 'koishi'")
    expect(consoleEntrySource).toContain('export function registerConsoleEntry')
    expect(consoleEntrySource).toContain("dev: resolve(__dirname, '../client/index.ts')")
    expect(consoleEntrySource).toContain("webQQStorageBackend: config.webQQStorageBackend ?? 'koishi'")
  })

  it('keeps WebQQ console listeners outside the plugin entry', () => {
    expect(pluginSource).not.toContain("from './webqq/register'")
    expect(capsuleRegisterSource).not.toContain("from '../webqq/register'")
    expect(runtimeRegisterSource).toContain("from '../webqq/register'")
    expect(webqqRegisterSource).toContain("from './console'")
    expect(pluginSource).not.toContain("console.addListener('onebot-webqq/webqq/contacts'")
    expect(pluginSource).not.toContain("console.addListener('onebot-webqq/webqq/messages'")
    expect(webqqConsoleSource).toContain('export function registerWebQQConsoleListeners')
    expect(webqqConsoleSource).toContain("console.addListener('onebot-webqq/webqq/contacts'")
    expect(webqqConsoleSource).toContain("console.addListener('onebot-webqq/webqq/messages'")
    expect(webqqConsoleSource).toContain("console.addListener('onebot-webqq/webqq/record/transcribe'")
    expect(webqqConsoleSource).toContain("console.addListener('onebot-webqq/webqq/messages/cache/save'")
  })

  it('keeps ChatLuna character lock syncing outside the plugin entry', () => {
    expect(pluginSource).not.toContain("from './capsule/character-lock'")
    expect(capsuleRegisterSource).toContain("from './character-lock'")
    expect(pluginSource).not.toContain('service.acquireResponseLock = async')
    expect(pluginSource).not.toContain('service.releaseResponseLock = async')
    expect(chatlunaCharacterLockSource).toContain('export function registerChatLunaCharacterLockSync')
    expect(chatlunaCharacterLockSource).toContain('service.acquireResponseLock = async')
    expect(chatlunaCharacterLockSource).toContain('service.releaseResponseLock = async')
    expect(chatlunaCharacterLockSource).toContain("ctx.on('dispose'")
  })

  it('keeps ChatLuna capsule activity outside the plugin entry', () => {
    expect(pluginSource).not.toContain("from './capsule/chatluna-activity'")
    expect(capsuleRegisterSource).toContain("from './chatluna-activity'")
    expect(pluginSource).not.toContain("ctx.on('chatluna/before-chat'")
    expect(pluginSource).not.toContain("ctx.on('chatluna/model-usage'")
    expect(pluginSource).not.toContain("ctx.on('chatluna_character/message_collect'")
    expect(chatlunaActivitySource).toContain('export function registerCapsuleChatLunaActivity')
    expect(chatlunaActivitySource).toContain("ctx.on('chatluna/before-chat'")
    expect(chatlunaActivitySource).not.toContain("ctx.on('chatluna/model-usage'")
    expect(chatlunaActivitySource).toContain("ctx.on('chatluna_character/message_collect'")
  })

  it('keeps WebQQ live runtime outside the plugin entry', () => {
    expect(pluginSource).not.toContain("from './webqq/register'")
    expect(capsuleRegisterSource).not.toContain("from '../webqq/register'")
    expect(runtimeRegisterSource).toContain("from '../webqq/register'")
    expect(webqqRegisterSource).toContain("from './message-flow/live-runtime'")
    expect(pluginSource).not.toContain('const pendingWebQQThinking = new Map')
    expect(pluginSource).not.toContain('const liveSenderMetadata = new Map')
    expect(pluginSource).not.toContain('const broadcastWebQQLivePayload =')
    expect(webqqLiveRuntimeSource).toContain('export function createWebQQLiveRuntime')
    expect(webqqLiveRuntimeSource).toContain('const pendingWebQQThinking = new Map')
    expect(webqqLiveRuntimeSource).toContain("options.ctx.on('chatluna/model-usage'")
    expect(webqqLiveRuntimeSource).toContain('const liveSenderMetadata = new Map')
    expect(webqqLiveRuntimeSource).toContain('const broadcastWebQQLivePayload =')
    expect(webqqLiveRuntimeSource).toContain("from './live-notices'")
    expect(webqqLiveRuntimeSource).toContain("from './live-reactions'")
    expect(webqqLiveRuntimeSource).not.toContain('const recordWebQQNotice = async')
    expect(webqqLiveRuntimeSource).not.toContain('const recordWebQQReaction = async')
    expect(webqqLiveNoticesSource).toContain('export function createWebQQNoticeRuntime')
    expect(webqqLiveNoticesSource).toContain('const recordWebQQNotice = async')
    expect(webqqLiveReactionsSource).toContain('export function createWebQQReactionRuntime')
    expect(webqqLiveReactionsSource).toContain('const recordWebQQReaction = async')
    expect(webqqLiveMessageSource).toContain('export function createWebQQEventMessage')
    expect(webqqLiveNoticesSource).toContain('createWebQQEventMessage(peer')
    expect(webqqLiveReactionsSource).toContain('createWebQQEventMessage(peer')
    expect(webqqLiveReactionsSource).not.toContain('id: `reaction:${peer.type}:${peer.peerId}:${time}:${reaction.userId}:${reaction.messageId}`')
  })

  it('keeps message runtime orchestration order in the runtime register module', () => {
    expect(pluginSource).not.toContain("ctx.on('message'")
    expect(capsuleRegisterSource).not.toContain("ctx.on('message'")
    expect(runtimeRegisterSource).toContain("ctx.on('message'")
    expect(runtimeRegisterSource.indexOf('capsuleRuntime.recordIncomingMessage(session)'))
      .toBeLessThan(runtimeRegisterSource.indexOf('await liveRuntime.recordWebQQLiveMessage(session)'))
    expect(runtimeRegisterSource.indexOf('await liveRuntime.recordWebQQLiveMessage(session)'))
      .toBeLessThan(runtimeRegisterSource.indexOf("await capsuleRuntime.refreshIdleScheduleActivity('message-schedule', session)"))
  })

  it('keeps WebQQ live element normalization outside the plugin entry', () => {
    const elements: WebQQMessageElement[] = [
      { type: 'quote', text: '引用内容' },
      { type: 'image', url: 'cover.png' },
      { type: 'card', title: '春日影', text: 'MyGO!!!!!' },
    ]

    expect(pluginSource).not.toContain("from './webqq/message-flow/live-elements'")
    expect(webqqLiveMessageSource).toContain("from './live-elements'")
    expect(pluginSource).not.toContain('function normalizeLiveElement(')
    expect(webqqLiveElementsSource).toContain('async function normalizeLiveElement(')
    expect(webqqLiveElementsSource).toContain('export async function normalizeLiveElements(')
    expect(webqqLiveElementsSource).toContain('summarizeElements as summarizeWebQQElements')
    expect(webqqLiveElementsSource).toContain("from '../media/image-url-resolver'")
    expect(webqqImageUrlResolverSource).toContain('export function getImageContentType')
    expect(summarizeWebQQElements(elements)).toBe('[图片]春日影')
    expect(getImageContentType('cover.webp')).toBe('image/webp')
  })

  it('keeps WebQQ live message payload building outside the plugin entry', async () => {
    const payload = await createWebQQLiveMessage(createSession({
      content: 'hello',
    }) as unknown as Session, 'incoming')

    expect(webqqLiveRuntimeSource).toContain("from './live-message'")
    expect(pluginSource).not.toContain('async function createWebQQLiveMessage(')
    expect(webqqLiveMessageSource).toContain('export async function createWebQQLiveMessage')
    expect(payload).toMatchObject({
      type: 'group',
      peerId: '20000',
      message: {
        senderId: '30000',
        senderName: 'Event Alice',
        direction: 'incoming',
        summary: 'hello',
        elements: [{ type: 'text', text: 'hello' }],
      },
    })
  })

  it('uses raw OneBot message ids and sequences for WebQQ live messages', async () => {
    const payload = await createWebQQLiveMessage(createSession({
      messageId: 'koishi-id',
      content: 'hello',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        _data: {
          message_id: 'onebot-id',
          message_seq: 31318,
        },
      },
    }) as unknown as Session, 'incoming')

    expect(payload?.message).toMatchObject({
      id: 'onebot-id',
      sequence: '31318',
    })
  })

  it('keeps WebQQ image URL proxy helper outside the plugin entry', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })

    expect(runtimeSource).toContain("from '../webqq/media/image-url-resolver'")
    expect(pluginSource).not.toContain('function createWebQQImageUrlResolver(')
    expect(webqqImageUrlResolverSource).toContain('export function createWebQQImageUrlResolver')
    expect(runtimeSource).toContain('cacheEnabled: config.webQQImageCacheEnabled ?? true')
    expect(runtimeSource).toContain('cacheLimitBytes: (config.webQQImageCacheLimitMB ?? 100) * 1024 * 1024')
    expect(runtimeSource).toContain('cacheItemLimitBytes: (config.webQQImageCacheItemLimitMB ?? 10) * 1024 * 1024')
    expect(serverGet).toHaveBeenCalledWith('/onebot-webqq/webqq/image/:id', expect.any(Function))

    const localImageFile = fileURLToPath(new URL('../src/webqq/media/image-url-resolver.ts', import.meta.url))
    const firstUrl = resolver(localImageFile)
    expect(firstUrl).toMatch(/^\/onebot-webqq\/webqq\/image\//)
    expect(resolver(localImageFile)).toBe(firstUrl)

    const handler = serverGet.mock.calls[0][1]
    const routerCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
      params: { id: firstUrl.split('/').pop() || '' },
      set: vi.fn(),
    }
    await handler(routerCtx)
    expect(routerCtx.set).toHaveBeenCalledWith('content-type', 'image/png')
    expect(routerCtx.set).toHaveBeenCalledWith('cache-control', 'private, max-age=86400, immutable')
    expect(routerCtx.set).toHaveBeenCalledWith('etag', `"${routerCtx.params.id}"`)
    expect(routerCtx.body).toBeDefined()

    const missingCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
      params: { id: 'missing' },
      set: vi.fn(),
    }
    await handler(missingCtx)
    expect(missingCtx.status).toBe(404)
    expect(missingCtx.set).not.toHaveBeenCalledWith('cache-control', expect.any(String))
  })

  it('caches remote WebQQ image proxy bytes in memory', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })
    const body = Uint8Array.from([1, 2, 3, 4])
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: vi.fn((name: string) => name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://example.com/image.jpg')
      const handler = serverGet.mock.calls[0][1]
      const createRouterCtx = () => ({
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      })
      const firstCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = createRouterCtx()
      const secondCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = createRouterCtx()

      await handler(firstCtx)
      await handler(secondCtx)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(firstCtx.status).toBe(200)
      expect(secondCtx.status).toBe(200)
      expect(secondCtx.set).toHaveBeenCalledWith('content-type', 'image/jpeg')
      expect(secondCtx.set).toHaveBeenCalledWith('cache-control', 'private, max-age=86400, immutable')
      expect(secondCtx.body).toEqual(Buffer.from(body))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('refreshes WebQQ image proxy URL when the remote source returns 400', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })
    const body = Uint8Array.from([1, 2, 3, 4])
    const refresh = vi.fn(async () => 'https://example.com/fresh.jpg')
    const fetchMock = vi.fn(async (url: string) => ({
      ok: url === 'https://example.com/fresh.jpg',
      status: url === 'https://example.com/fresh.jpg' ? 200 : 400,
      headers: {
        get: vi.fn((name: string) => name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://example.com/expired.jpg', { refresh })
      const handler = serverGet.mock.calls[0][1]
      const routerCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      }

      await handler(routerCtx)

      expect(refresh).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://example.com/expired.jpg', { redirect: 'manual' })
      expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.com/fresh.jpg', { redirect: 'manual' })
      expect(routerCtx.status).toBe(200)
      expect(routerCtx.set).toHaveBeenCalledWith('content-type', 'image/jpeg')
      expect(routerCtx.body).toEqual(Buffer.from(body))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('limits WebQQ image proxy URL refreshes to three attempts per request', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })
    const refreshTargets = [
      'https://example.com/retry-1.jpg',
      'https://example.com/retry-2.jpg',
      'https://example.com/retry-3.jpg',
    ]
    let refreshIndex = 0
    const refresh = vi.fn(async () => refreshTargets[refreshIndex++] || 'https://example.com/retry-extra.jpg')
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      headers: {
        get: vi.fn(() => null),
      },
      arrayBuffer: async () => Uint8Array.from([]).buffer,
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://example.com/expired.jpg', { refresh })
      const handler = serverGet.mock.calls[0][1]
      const routerCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      }

      await handler(routerCtx)

      expect(refresh).toHaveBeenCalledTimes(3)
      expect(fetchMock).toHaveBeenCalledTimes(4)
      expect(fetchMock).toHaveBeenLastCalledWith('https://example.com/retry-3.jpg', { redirect: 'manual' })
      expect(routerCtx.status).toBe(400)
      expect(routerCtx.body).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does not refresh WebQQ image proxy URL when the remote source returns non-400 errors', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })
    const refresh = vi.fn(async () => 'https://example.com/fresh.jpg')
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      headers: {
        get: vi.fn(() => null),
      },
      arrayBuffer: async () => Uint8Array.from([]).buffer,
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://example.com/error.jpg', { refresh })
      const handler = serverGet.mock.calls[0][1]
      const routerCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      }

      await handler(routerCtx)

      expect(refresh).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(routerCtx.status).toBe(500)
      expect(routerCtx.body).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects private WebQQ image proxy targets before fetching', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('http://127.0.0.1/private.png')
      const handler = serverGet.mock.calls[0][1]
      const routerCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      }

      await handler(routerCtx)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(routerCtx.status).toBe(403)
      expect(routerCtx.body).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects WebQQ image proxy targets that resolve to private addresses', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })
    dnsMock.lookup.mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }])
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://rebind.example.com/private.png')
      const handler = serverGet.mock.calls[0][1]
      const routerCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      }

      await handler(routerCtx)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(routerCtx.status).toBe(403)
      expect(routerCtx.body).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('allows WebQQ image proxy hosts resolved through local fake-ip DNS', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })
    dnsMock.lookup.mockResolvedValueOnce([{ address: '198.18.1.72', family: 4 }])
    const body = Uint8Array.from([1, 2, 3, 4])
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: vi.fn((name: string) => name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://multimedia.nt.qq.com.cn/image.jpg')
      const handler = serverGet.mock.calls[0][1]
      const routerCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      }

      await handler(routerCtx)

      expect(fetchMock).toHaveBeenCalledWith('https://multimedia.nt.qq.com.cn/image.jpg', { redirect: 'manual' })
      expect(routerCtx.status).toBe(200)
      expect(routerCtx.set).toHaveBeenCalledWith('content-type', 'image/jpeg')
      expect(routerCtx.body).toEqual(Buffer.from(body))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects WebQQ image proxy redirects to private addresses', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 302,
      headers: {
        get: vi.fn((name: string) => name.toLowerCase() === 'location' ? 'http://169.254.169.254/private.png' : null),
      },
      arrayBuffer: async () => Uint8Array.from([]).buffer,
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://example.com/redirect.png')
      const handler = serverGet.mock.calls[0][1]
      const routerCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      }

      await handler(routerCtx)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(routerCtx.status).toBe(403)
      expect(routerCtx.body).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects WebQQ image proxy responses over the configured item limit before reading the body', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    }, undefined, {
      cacheItemLimitBytes: 4,
    })
    const arrayBuffer = vi.fn(async () => Uint8Array.from([1, 2, 3, 4, 5]).buffer)
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: vi.fn((name: string) => name.toLowerCase() === 'content-length' ? '5' : null),
      },
      arrayBuffer,
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://example.com/large.jpg')
      const handler = serverGet.mock.calls[0][1]
      const routerCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      }

      await handler(routerCtx)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(arrayBuffer).not.toHaveBeenCalled()
      expect(routerCtx.status).toBe(413)
      expect(routerCtx.body).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('skips WebQQ image memory cache when disabled', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    }, undefined, {
      cacheEnabled: false,
    })
    const body = Uint8Array.from([1, 2, 3, 4])
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: vi.fn((name: string) => name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://example.com/image.jpg')
      const handler = serverGet.mock.calls[0][1]
      const createRouterCtx = () => ({
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      })

      await handler(createRouterCtx())
      const secondCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = createRouterCtx()
      await handler(secondCtx)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(secondCtx.set).toHaveBeenCalledWith('cache-control', 'private, max-age=86400, immutable')
      expect(secondCtx.body).toEqual(Buffer.from(body))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('uses configured WebQQ image memory cache byte limits', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    }, undefined, {
      cacheLimitBytes: 4,
      cacheItemLimitBytes: 3,
    })
    const body = Uint8Array.from([1, 2, 3, 4])
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: vi.fn((name: string) => name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    }))
    vi.stubGlobal('fetch', fetchMock)

    try {
      const imageUrl = resolver('https://example.com/image.jpg')
      const handler = serverGet.mock.calls[0][1]
      const createRouterCtx = () => ({
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      })

      await handler(createRouterCtx())
      await handler(createRouterCtx())

      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('evicts least recently used WebQQ image memory cache entries over the configured total limit', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    }, undefined, {
      cacheLimitBytes: 4,
      cacheItemLimitBytes: 4,
    })
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: vi.fn((name: string) => name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    }))
    vi.stubGlobal('fetch', fetchMock)
    const nowSpy = vi.spyOn(Date, 'now')
    let now = 0
    nowSpy.mockImplementation(() => ++now)

    try {
      const firstUrl = resolver('https://example.com/first.jpg')
      const secondUrl = resolver('https://example.com/second.jpg')
      const handler = serverGet.mock.calls[0][1]
      const createRouterCtx = (imageUrl: string) => ({
        params: { id: imageUrl.split('/').pop() || '' },
        set: vi.fn(),
      })

      await handler(createRouterCtx(firstUrl))
      await handler(createRouterCtx(secondUrl))
      await handler(createRouterCtx(firstUrl))

      expect(fetchMock).toHaveBeenCalledTimes(3)
    } finally {
      nowSpy.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('evicts oldest WebQQ image proxy id mappings to avoid unbounded growth', async () => {
    const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
    const resolver = createWebQQImageUrlResolver({
      server: {
        get: serverGet,
      },
    })

    const firstUrl = resolver('/tmp/onebot-webqq-image-0.png')
    for (let index = 1; index <= 1000; index++) {
      resolver(`/tmp/onebot-webqq-image-${index}.png`)
    }

    const handler = serverGet.mock.calls[0][1]
    const firstCtx: { params: Record<string, string>; set: ReturnType<typeof vi.fn>; status?: number; body?: unknown } = {
      params: { id: firstUrl.split('/').pop() || '' },
      set: vi.fn(),
    }

    await handler(firstCtx)

    expect(firstCtx.status).toBe(404)
    expect(firstCtx.body).toBeUndefined()
  })

  it('keeps WebQQ session display helpers outside the plugin entry', () => {
    const session = createSession() as unknown as Session

    expect(pluginSource).not.toContain('function readWebQQPeer(')
    expect(webqqSessionSource).toContain('export function readWebQQPeer')
    expect(readBotProfile(session)).toMatchObject({
      platform: 'onebot',
      selfId: '10000',
      name: 'Capsule Bot',
    })
    expect(readUserName(session)).toBe('Event Alice')
    expect(readWebQQPeer(session)).toEqual({ type: 'group', peerId: '20000' })
    expect(readWebQQLiveDirection(createSession({ userId: '10000' }) as unknown as Session)).toBe('outgoing')
    expect(getWebQQUserAvatar('30000')).toBe('https://q1.qlogo.cn/g?b=qq&nk=30000&s=640')
  })

  it('uses raw OneBot group ids for WebQQ live peers when channel ids are shared', async () => {
    const first = createSession({
      channelId: 'shared-channel',
      content: 'first',
      event: {
        guild: { name: 'Shared Guild' },
        channel: { name: 'Shared Channel' },
        user: { id: '30000', name: 'Alice' },
        _data: {
          group_id: '20000',
          message_id: 'message-1',
        },
      },
    }) as unknown as Session
    const second = createSession({
      channelId: 'shared-channel',
      content: 'second',
      event: {
        guild: { name: 'Shared Guild' },
        channel: { name: 'Shared Channel' },
        user: { id: '30001', name: 'Bob' },
        _data: {
          group_id: '20001',
          message_id: 'message-2',
        },
      },
    }) as unknown as Session

    expect(readWebQQPeer(first)).toEqual({ type: 'group', peerId: '20000' })
    expect(readWebQQPeer(second)).toEqual({ type: 'group', peerId: '20001' })
    await expect(createWebQQLiveMessage(first, 'incoming')).resolves.toMatchObject({
      type: 'group',
      peerId: '20000',
    })
    await expect(createWebQQLiveMessage(second, 'incoming')).resolves.toMatchObject({
      type: 'group',
      peerId: '20001',
    })
  })

  it('keeps WebQQ live sender metadata helpers outside the plugin entry', () => {
    const message: WebQQMessage = {
      id: 'live-1',
      sequence: 'live-1',
      time: 1710000000000,
      senderId: '30000',
      senderName: 'Alice',
      senderAvatar: 'https://example.com/avatar.png',
      direction: 'incoming',
      summary: 'hello',
      elements: [{ type: 'text', text: 'hello' }],
      senderRole: '管理员',
    }
    const metadata = readWebQQSenderMetadata({
      role: 'owner',
      sender_level: '100',
      special_title: '闪亮头衔',
    })

    expect(webqqLiveRuntimeSource).toContain("from '../sender/sender-metadata'")
    expect(pluginSource).not.toContain("from './webqq/sender/sender-metadata'")
    expect(pluginSource).not.toContain('function readWebQQSenderMetadata(')
    expect(webqqSenderMetadataSource).toContain('export function readWebQQSenderMetadata')
    expect(metadata).toEqual({
      senderRole: '群主',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
    expect(fillWebQQMessageSenderMetadata(message, metadata)).toMatchObject({
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
    expect(replaceWebQQMessageSenderMetadata(message, metadata)).toMatchObject(metadata)
  })

  it('keeps WebQQ group sender metadata lookup outside the plugin entry', async () => {
    const getGroupMemberInfo = vi.fn(async () => ({
      data: {
        role: 'admin',
        sender_level: '100',
        special_title: '闪亮头衔',
      },
    }))
    const session = createSession({
      bot: {
        platform: 'onebot',
        selfId: '10000',
        internal: {
          get_group_member_info: getGroupMemberInfo,
        },
      },
    }) as unknown as Session

    expect(pluginSource).not.toContain("from './webqq/adapters/onebot/group-sender-metadata'")
    expect(capsuleRegisterSource).not.toContain("from '../webqq/adapters/onebot/group-sender-metadata'")
    expect(runtimeSource).not.toContain("from '../webqq/adapters/onebot/group-sender-metadata'")
    expect(runtimeRegisterSource).toContain("from '../webqq/adapters/onebot/group-sender-metadata'")
    expect(pluginSource).not.toContain('async function readWebQQGroupSenderMetadata(')
    expect(webqqGroupSenderMetadataSource).toContain('export async function readWebQQGroupSenderMetadata')
    await expect(readWebQQGroupSenderMetadata(session, '30000', true)).resolves.toEqual({
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
    expect(getGroupMemberInfo).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 30000,
      no_cache: true,
    })
  })

  it('keeps WebQQ event notice builders outside the plugin entry', () => {
    const friendSession = createSession({
      userId: '30000',
      event: {
        _data: {
          flag: 'flag-1',
          comment: '请通过',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
      },
    }) as unknown as Session
    const groupSession = createSession({
      userId: '30000',
      event: {
        guild: {
          id: '20000',
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Guild Name',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
      },
    }) as unknown as Session

    expect(pluginSource).not.toContain("from './webqq/register'")
    expect(capsuleRegisterSource).not.toContain("from '../webqq/register'")
    expect(runtimeRegisterSource).toContain("from '../webqq/register'")
    expect(webqqRegisterSource).toContain("from './notices/event-notices'")
    expect(pluginSource).not.toContain('function createWebQQFriendRequestNotice(')
    expect(webqqEventNoticesSource).toContain('export function createWebQQFriendRequestNotice')
    expect(createWebQQFriendRequestNotice(friendSession)).toMatchObject({
      id: 'friend:flag-1',
      type: 'friend-request',
      title: 'Alice',
      requesterId: '30000',
      requesterName: 'Alice',
      comment: '请通过',
    })
    expect(createWebQQGroupLeaveNotice(groupSession)).toMatchObject({
      id: 'group:leave:20000:30000:1710000000000',
      type: 'group-notice',
      title: 'Guild Name',
      requesterId: '30000',
      requesterName: 'Alice',
      subType: 'leave',
    })
  })

  it('keeps WebQQ live cache helpers outside the plugin entry', () => {
    const oldMessage: WebQQMessage = {
      id: 'same',
      sequence: 'old',
      time: 1710000001000,
      senderId: '30000',
      senderName: 'Alice',
      senderAvatar: 'https://example.com/avatar.png',
      direction: 'incoming',
      summary: 'old',
      elements: [{ type: 'text', text: 'old' }],
    }
    const liveMessage: WebQQMessage = {
      ...oldMessage,
      sequence: 'new',
      time: 1710000003000,
      summary: 'new',
      elements: [{ type: 'text', text: 'new' }],
    }
    const otherMessage: WebQQMessage = {
      ...oldMessage,
      id: 'other',
      sequence: 'other',
      time: 1710000002000,
      summary: 'other',
      elements: [{ type: 'text', text: 'other' }],
    }

    expect(webqqLiveRuntimeSource).toContain("from './live-cache'")
    expect(pluginSource).not.toContain("from './webqq/message-flow/live-cache'")
    expect(pluginSource).not.toContain('function mergeWebQQMessages(')
    expect(webqqLiveCacheSource).toContain('export function mergeWebQQLiveMessages')
    expect(getWebQQLiveMessageKey({ type: 'group', peerId: '20000' })).toBe('group:20000')
    expect(mergeWebQQLiveMessages([oldMessage, otherMessage], [liveMessage], 2)).toEqual([
      otherMessage,
      liveMessage,
    ])
    expect(mergeWebQQLiveMessages([{
      ...oldMessage,
      direction: 'outgoing',
      usage: {
        inputTokens: 12,
        outputTokens: 34,
      },
    }], [{
      ...oldMessage,
      direction: 'outgoing',
      thinking: {
        content: '先分析',
        durationMs: 1200,
        usage: {
          inputTokens: 12,
          outputTokens: 34,
        },
      },
    }])[0]).not.toHaveProperty('usage')
  })

  it('preserves recalled WebQQ live message content when reaction-only updates merge into cache', () => {
    const recalledMessage: WebQQMessage = {
      id: 'same',
      sequence: '31318',
      time: 1710000001000,
      senderId: '30000',
      senderName: 'Alice',
      senderAvatar: 'https://example.com/avatar.png',
      direction: 'incoming',
      summary: 'hello',
      elements: [{ type: 'text', text: 'hello' }],
      recalled: true,
    }
    const reactionOnlyUpdate: WebQQMessage = {
      ...recalledMessage,
      summary: '',
      elements: [],
      reactions: [{
        emojiId: '76',
        label: '赞',
        count: 1,
      }],
    }

    expect(mergeWebQQLiveMessages([recalledMessage], [reactionOnlyUpdate])).toEqual([
      expect.objectContaining({
        id: 'same',
        summary: 'hello',
        elements: [{ type: 'text', text: 'hello' }],
        recalled: true,
        reactions: [{
          emojiId: '76',
          label: '赞',
          count: 1,
        }],
      }),
    ])
  })

  it('marks recalled WebQQ live messages by default', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'hello' } }],
        },
      },
    }))
    await listeners['message-deleted'][0](createSession({
      bot,
      timestamp: 1710000002000,
      event: {
        platform: 'onebot',
        timestamp: 1710000002000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        operator: { id: '30000', name: 'Alice' },
        message: { id: 'new-1' },
      },
    }))

    const recallCall = broadcast.mock.calls.find(([event]) => event === 'onebot-webqq/webqq/recall')
    expect(recallCall?.[1]).toMatchObject({
      type: 'group',
      peerId: '20000',
      messageId: 'new-1',
      mode: 'mark',
    })
    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        id: 'new-1',
        recalled: true,
      }),
    ])
  })

  it('persists marked recalled WebQQ messages across Koishi restarts', async () => {
    const rows = new Map<string, unknown>()
    const database = {
      get: vi.fn(async (_table: string, query: Record<string, unknown>) => {
        const row = rows.get(String(query.id))
        return row ? [row] : []
      }),
      upsert: vi.fn(async (_table: string, nextRows: Array<{ id: string }>) => {
        for (const row of nextRows) rows.set(row.id, row)
      }),
    }
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const first = createFakeContext({ bots: [bot], database })

    plugin.apply(first.ctx)
    await first.listeners.message[0](createSession({
      bot,
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'hello' } }],
        },
      },
    }))
    await first.listeners['message-deleted'][0](createSession({
      bot,
      timestamp: 1710000002000,
      event: {
        platform: 'onebot',
        timestamp: 1710000002000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        operator: { id: '30000', name: 'Alice' },
        message: { id: 'new-1' },
      },
    }))

    expect(database.upsert).toHaveBeenCalledWith('onebot_webqq_storage', [
      expect.objectContaining({
        id: 'recalled-messages:group:20000',
        payload: {
          messages: [
            expect.objectContaining({
              id: 'new-1',
              recalled: true,
            }),
          ],
        },
      }),
    ])

    const second = createFakeContext({ bots: [bot], database })
    plugin.apply(second.ctx)
    const loadMessages = findConsoleListener(second.addListener, 'onebot-webqq/webqq/messages')

    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        id: 'new-1',
        recalled: true,
      }),
    ])

    const disabled = createFakeContext({ bots: [bot], database })
    plugin.apply(disabled.ctx, { webQQMarkRecalledMessages: false })
    const loadMessagesWithoutMarking = findConsoleListener(disabled.addListener, 'onebot-webqq/webqq/messages')

    await expect(loadMessagesWithoutMarking?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([])
  })

  it('removes recalled WebQQ messages and appends recall events when recall marking is disabled', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx, { webQQMarkRecalledMessages: false })
    await listeners.message[0](createSession({
      bot,
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'hello' } }],
        },
      },
    }))
    await listeners['message-deleted'][0](createSession({
      bot,
      timestamp: 1710000002000,
      event: {
        platform: 'onebot',
        timestamp: 1710000002000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        operator: { id: '30000', name: 'Alice' },
        member: { name: '蒸汽机' },
        message: { id: 'new-1' },
      },
    }))

    const recallCall = broadcast.mock.calls.find(([event]) => event === 'onebot-webqq/webqq/recall')
    expect(recallCall?.[1]).toMatchObject({
      type: 'group',
      peerId: '20000',
      messageId: 'new-1',
      mode: 'remove',
      eventMessage: {
        summary: '蒸汽机 撤回了一条消息',
        event: {
          type: 'recall',
          targetMessageId: 'new-1',
        },
      },
    })
    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '蒸汽机 撤回了一条消息',
        event: {
          type: 'recall',
          targetMessageId: 'new-1',
        },
      }),
    ])
  })

  it('broadcasts WebQQ poke, mute, and reaction events', async () => {
    let socketListener: ((event: { data: unknown }) => void) | undefined
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      adapter: {
        socket: {
          addEventListener: (_type: 'message', listener: (event: { data: unknown }) => void) => {
            socketListener = listener
          },
        },
      },
      internal: {
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        get_group_member_info: vi.fn(async ({ user_id }: { user_id: number | string }) => ({
          user_id,
          card: user_id === 30000 ? 'Alice Card' : 'Bob Card',
          nickname: user_id === 30000 ? 'Alice Nick' : 'Bob Nick',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    const emitReaction = (data: Record<string, unknown>) => socketListener?.({ data: JSON.stringify(data) })
    await listeners.message[0](createSession({
      bot,
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        member: { name: 'Alice Card' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'hello' } }],
        },
      },
    }))
    await listeners['internal/session'][0](createSession({
      bot,
      channelId: undefined,
      timestamp: 1710000002000,
      event: {
        platform: 'onebot',
        timestamp: 1710000002000,
        user: { id: '30000', name: 'Alice' },
        _data: {
          notice_type: 'notify',
          sub_type: 'poke',
          group_id: '20000',
          user_id: '30000',
          target_id: '40000',
        },
      },
    }))
    await listeners['internal/session'][0](createSession({
      bot,
      channelId: undefined,
      timestamp: 1710000003000,
      event: {
        platform: 'onebot',
        timestamp: 1710000003000,
        user: { id: '30000', name: 'Alice' },
        _data: {
          notice_type: 'group_ban',
          sub_type: 'ban',
          group_id: '20000',
          user_id: '40000',
          operator_id: '30000',
          duration: 600,
        },
      },
    }))
    // 贴上：count 为该表情全量人数（2 人），emoji_id 76 经 qface 转为「赞」
    emitReaction({
      post_type: 'notice',
      notice_type: 'group_msg_emoji_like',
      group_id: '20000',
      operator_id: '40000',
      message_id: 'new-1',
      likes: [{ emoji_id: '76', count: 2 }],
      is_add: true,
    })

    const webqqMessages = broadcast.mock.calls
      .filter(([event]) => event === 'onebot-webqq/webqq/message')
      .map(([, payload]) => payload)
    expect(webqqMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          summary: 'Alice Card 戳了戳 Bob Card',
          event: { type: 'poke' },
        }),
      }),
      expect.objectContaining({
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          summary: 'Alice Card 禁言了 Bob Card 10 分钟',
          event: { type: 'mute' },
        }),
      }),
      expect.objectContaining({
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          id: 'new-1',
          reactions: [{
            emojiId: '76',
            label: '赞',
            count: 2,
            userId: '40000',
            userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
            users: [{
              userId: '40000',
              userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
            }],
          }],
        }),
      }),
    ]))
    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    emitReaction({
      post_type: 'notice',
      notice_type: 'group_msg_emoji_like',
      group_id: '20000',
      user_id: '50000',
      message_id: 'new-1',
      likes: [{ emoji_id: '76', count: 3 }],
      is_add: true,
    })
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        summary: 'Alice Card 戳了戳 Bob Card',
        event: { type: 'poke' },
      }),
      expect.objectContaining({
        summary: 'Alice Card 禁言了 Bob Card 10 分钟',
        event: { type: 'mute' },
      }),
      expect.objectContaining({
        id: 'new-1',
        reactions: [{
          emojiId: '76',
          label: '赞',
          count: 3,
          userId: '50000',
          userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=50000&s=640',
          users: [{
            userId: '40000',
            userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
          }, {
            userId: '50000',
            userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=50000&s=640',
          }],
        }],
      }),
    ]))

    // 取消其中一人时保留剩余用户；count 归零后移除该表情，移空后 reactions 字段消失
    emitReaction({
      post_type: 'notice',
      notice_type: 'group_msg_emoji_like',
      group_id: '20000',
      user_id: '40000',
      message_id: 'new-1',
      likes: [{ emoji_id: '76', count: 2 }],
      is_add: false,
    })
    const afterPartialCancelMessages = await loadMessages?.({ type: 'group', peerId: '20000', limit: 20 }) as Array<{ id: string; reactions?: unknown }>
    expect(afterPartialCancelMessages.find((item) => item.id === 'new-1')).toEqual(expect.objectContaining({
      reactions: [{
        emojiId: '76',
        label: '赞',
        count: 2,
        userId: '40000',
        userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
        users: [{
          userId: '50000',
          userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=50000&s=640',
        }],
      }],
    }))

    emitReaction({
      post_type: 'notice',
      notice_type: 'group_msg_emoji_like',
      group_id: '20000',
      user_id: '50000',
      message_id: 'new-1',
      likes: [{ emoji_id: '76', count: 0 }],
      is_add: false,
    })
    const finalMessages = await loadMessages?.({ type: 'group', peerId: '20000', limit: 20 }) as Array<{ id: string; reactions?: unknown }>
    expect(finalMessages.find((item) => item.id === 'new-1')).not.toHaveProperty('reactions')
  })

  it('loads the target message when a WebQQ reaction is not in the live cache', async () => {
    let socketListener: ((event: { data: unknown }) => void) | undefined
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      adapter: {
        socket: {
          addEventListener: (_type: 'message', listener: (event: { data: unknown }) => void) => {
            socketListener = listener
          },
        },
      },
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        get_msg: vi.fn(async ({ message_id }: { message_id: string }) => ({
          message_id,
          message_seq: 31318,
          time: 1710000001,
          group_id: 20000,
          user_id: 30000,
          sender: {
            user_id: 30000,
            nickname: 'Alice',
            card: 'Alice Card',
          },
          message: [{ type: 'text', data: { text: 'history target' } }],
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    expect(socketListener).toBeDefined()
    socketListener?.({
      data: JSON.stringify({
        post_type: 'notice',
        notice_type: 'group_msg_emoji_like',
        group_id: '20000',
        user_id: '40000',
        message_id: 'onebot-id',
        likes: [{ emoji_id: '76', count: 1 }],
        is_add: true,
      }),
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bot.internal.get_msg).toHaveBeenCalledWith({ message_id: 'onebot-id' })
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'onebot-id',
        sequence: '31318',
        summary: 'history target',
        reactions: [{
          emojiId: '76',
          label: '赞',
          count: 1,
          userId: '40000',
          userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
          users: [{
            userId: '40000',
            userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
          }],
        }],
      }),
    }, { authority: 1 })
  })

  it('broadcasts a WebQQ reaction event when the target message cannot be resolved', async () => {
    let socketListener: ((event: { data: unknown }) => void) | undefined
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      adapter: {
        socket: {
          addEventListener: (_type: 'message', listener: (event: { data: unknown }) => void) => {
            socketListener = listener
          },
        },
      },
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        get_msg: vi.fn(async () => {
          throw new Error('missing')
        }),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    socketListener?.({
      data: JSON.stringify({
        post_type: 'notice',
        notice_type: 'group_msg_emoji_like',
        group_id: '20000',
        user_id: '40000',
        message_id: 'missing-id',
        likes: [{ emoji_id: '76', count: 1 }],
        is_add: true,
      }),
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bot.internal.get_msg).toHaveBeenCalledWith({ message_id: 'missing-id' })
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: expect.stringMatching(/^reaction:group:20000:\d+:40000:missing-id$/),
        sequence: expect.stringMatching(/^reaction:\d+:missing-id$/),
        senderId: '40000',
        senderName: '40000',
        senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
        direction: 'incoming',
        summary: '40000 给一条消息贴了 赞',
        event: {
          type: 'reaction',
          targetMessageId: 'missing-id',
        },
        elements: [{ type: 'unknown', text: '40000 给一条消息贴了 赞' }],
      }),
    }, { authority: 1 })
  })

  it('fills WebQQ reaction users from the emoji like list', async () => {
    let socketListener: ((event: { data: unknown }) => void) | undefined
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      adapter: {
        socket: {
          addEventListener: (_type: 'message', listener: (event: { data: unknown }) => void) => {
            socketListener = listener
          },
        },
      },
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        fetch_emoji_like: vi.fn(async () => ({
          emojiLikesList: [{
            tinyId: '40000',
            nickName: 'Ning',
            headUrl: 'https://example.com/40000.png',
          }, {
            tinyId: '50000',
            nickName: 'Other',
            headUrl: 'https://example.com/50000.png',
          }],
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'hello' } }],
        },
      },
    }))
    socketListener?.({
      data: JSON.stringify({
        post_type: 'notice',
        notice_type: 'group_msg_emoji_like',
        group_id: '20000',
        user_id: '40000',
        message_id: 'new-1',
        likes: [{ emoji_id: '76', count: 2 }],
        is_add: true,
      }),
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(bot.internal.fetch_emoji_like).toHaveBeenCalledWith({
      message_id: 'new-1',
      emoji_id: '76',
      count: 2,
    })
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'new-1',
        reactions: [{
          emojiId: '76',
          label: '赞',
          count: 2,
          userId: '40000',
          userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
          users: [{
            userId: '40000',
            userName: 'Ning',
            userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
          }, {
            userId: '50000',
            userName: 'Other',
            userAvatar: 'https://example.com/50000.png',
          }],
        }],
      }),
    }, { authority: 1 })
  })

  it('matches WebQQ reactions by message sequence when available', () => {
    const message: WebQQMessage = {
      id: 'onebot-id',
      sequence: '31318',
      time: 1710000001000,
      senderId: '30000',
      senderName: 'Alice',
      senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
      direction: 'incoming',
      summary: 'history target',
      elements: [{ type: 'text', text: 'history target' }],
    }

    expect(applyWebQQReactionToLiveMessages([message], '31318', {
      emojiId: '76',
      label: '赞',
      count: 1,
    }, true)).toEqual([{
      ...message,
      reactions: [{
        emojiId: '76',
        label: '赞',
        count: 1,
        users: [],
      }],
    }])
  })

  it('keeps ChatLuna message input building outside the plugin entry', () => {
    const session = createSession({
      event: {
        guild: {
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Channel Name',
        },
        member: {
          name: '群昵称',
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        },
        user: {
          id: '30000',
          name: 'Event Alice',
        },
      },
    }) as unknown as Session

    expect(pluginSource).not.toContain("from './capsule/message-input'")
    expect(capsuleRegisterSource).toContain("from './message-input'")
    expect(pluginSource).not.toContain('function createMessageInput(')
    expect(chatlunaMessageInputSource).not.toContain("from '../webqq")
    expect(chatlunaActivitySource).not.toContain("from '../webqq")
    expect(chatlunaCharacterLockSource).not.toContain("from '../webqq")
    expect(chatlunaMessageInputSource).toContain('export function createMessageInput')
    expect(createMessageInput(session, {
      id: '40000',
      name: 'Message Alice',
    })).toMatchObject({
      channel: {
        id: '20000',
        name: 'Guild Name',
      },
      user: {
        id: '40000',
        name: 'Message Alice',
        senderRole: '管理员',
        senderLevel: '100',
        senderTitle: '闪亮头衔',
      },
    })
  })

  it('exports a Config schema for backend options', () => {
    expect(plugin.Config).toBeDefined()
    expect(configSource).toContain("description('小胶囊设置')")
    expect(configSource).toContain("description('WebQQ 设置')")
    expect(configSource).not.toContain("description('界面外观')")
    expect(configSource).not.toContain("description('消息显示')")
    expect(configSource).toContain('webQQTheme?:')
    expect(configSource).toContain("Schema.const('fresh').description('清爽')")
    expect(configSource).toContain("Schema.const('frosted').description('毛玻璃')")
    expect(configSource).not.toContain("Schema.const('glass').description('玻璃')")
    expect(configSource).toContain(".default('fresh')")
    expect(configSource).toContain("description('WebQQ 主题')")
    expect(configSource).toContain("webQQChatStyle?:")
    expect(configSource).toMatch(/webQQChatStyle:\s*Schema\.union\(\[[\s\S]*Schema\.const\('telegram'\)\.description\('TIM'\)[\s\S]*Schema\.const\('qq'\)\.description\('QQ'\)[\s\S]*\]\)\.default\('telegram'\)\.role\('radio'\)/)
    expect(configSource).not.toContain("Schema.const('telegram').description('Telegram')")
    expect(configSource).toContain("description('WebQQ 聊天页面样式')")
    expect(configSource).toContain("webQQTimBubbleTail?: boolean")
    expect(configSource).toContain("Schema.boolean().default(true).description('显示 TIM 气泡小尖角')")
    expect(configSource).toMatch(/webQQColorMode\?:\s*'auto'\s*\|\s*'light'\s*\|\s*'dark'/)
    expect(configSource).toMatch(/webQQColorMode:\s*Schema\.union\(\[[\s\S]*Schema\.const\('auto'\)\.description\('自动'\)[\s\S]*Schema\.const\('light'\)\.description\('明亮'\)[\s\S]*Schema\.const\('dark'\)\.description\('暗色'\)[\s\S]*\]\)\.default\('auto'\)\.role\('radio'\)/)
    expect(configSource).toContain("webQQAccentColor?:")
    expect(configSource).toContain("Schema.string().default('#2563eb').role('color').description('WebQQ 主题色')")
    expect(configSource).toContain("useCompactCapsuleShadow?: boolean")
    expect(configSource).toContain("Schema.boolean().default(true).description('使用较窄的小胶囊阴影，关闭后使用较宽的阴影')")
    expect(configSource).toContain("hideWebQQGroupLevel?: boolean")
    expect(configSource).toContain("Schema.boolean().default(true).description('隐藏 WebQQ 消息中的群等级徽标')")
    expect(configSource).toContain("showWebQQAffinity?: boolean")
    expect(configSource).toContain("Schema.boolean().default(false).description('在 WebQQ 用户昵称右侧显示 ChatLuna 好感度')")
    expect(configSource).toContain("showWebQQRelationship?: boolean")
    expect(configSource).toContain("Schema.boolean().default(false).description('在 WebQQ 用户昵称右侧显示 ChatLuna 关系')")
    expect(configSource).toContain("showWebQQCharacterThinking?: boolean")
    expect(configSource).toContain("Schema.boolean().default(true).description('在 WebQQ 中显示 chatluna-character 的 think 内容')")
    expect(configSource).toContain("showWebQQThinkingTokens?: boolean")
    expect(configSource).toContain("Schema.boolean().default(true).description('在 WebQQ 中显示 ChatLuna 输入/输出 token，使用主插件时需关闭`showWebQQCharacterThinking`才能正常显示')")
    expect(configSource).toContain("showWebQQThinkingTiming?: boolean")
    expect(configSource).toContain("Schema.boolean().default(true).description('在 WebQQ 中显示 ChatLuna TTFT、TPS 和 Total，使用主插件时需关闭`showWebQQCharacterThinking`才能正常显示')")
    expect(configSource).toContain("webQQAffinityScopeId?: string")
    expect(configSource).toContain("Schema.string().description('ChatLuna 好感度插件的 scopeId，留空且当前只有一个 scopeId 时自动使用')")
    expect(configSource).toContain("showWebQQCapsuleUnread?: boolean")
    expect(configSource).toContain("Schema.boolean().default(true).description('在小胶囊 bot 头像上显示 WebQQ 总未读数')")
    expect(configSource).toContain("webQQStorageBackend?: 'browser' | 'koishi'")
    expect(configSource).toMatch(/webQQStorageBackend:\s*Schema\.union\(\[[\s\S]*Schema\.const\('koishi'\)\.description\('Koishi 数据库'\)[\s\S]*Schema\.const\('browser'\)\.description\('浏览器'\)[\s\S]*\]\)\.default\('koishi'\)\.role\('radio'\)/)
    expect(configSource).toContain("description('WebQQ 状态存储后端')")
    expect(configSource).toContain("webQQMessageCacheLimit?: number")
    expect(configSource).toContain("Schema.natural().min(1).max(1000).default(100).description('每个 WebQQ 会话保留的最近消息缓存数量')")
    expect(configSource).toContain("webQQImageCacheEnabled?: boolean")
    expect(configSource).toContain("Schema.boolean().default(true).description('启用 WebQQ 图片代理内存缓存，会额外占用服务器内存')")
    expect(configSource).toContain("webQQImageCacheLimitMB?: number")
    expect(configSource).toContain("Schema.natural().min(1).max(4096).default(100).description('WebQQ 图片代理内存缓存总上限，单位 MB')")
    expect(configSource).toContain("webQQImageCacheItemLimitMB?: number")
    expect(configSource).toContain("Schema.natural().min(1).max(1024).default(10).description('单张 WebQQ 图片超过此大小时不写入内存缓存，单位 MB')")
    expect(configSource).toContain("webQQMarkRecalledMessages?: boolean")
    expect(configSource).toContain("Schema.boolean().default(true).description('保留被撤回的 WebQQ 消息并显示删除线。关闭后显示撤回事件并移除原消息')")
    expect(configSource).toContain('onebotMockBotCount?: number')
    expect(configSource).toContain("Schema.natural().max(20).default(0).description('额外模拟的 OneBot 机器人数量，勿动')")
    expect(configSource).not.toContain("Schema.const('s3')")
    expect(configSource).not.toContain('webQQS3')
    expect(configSource).not.toContain('@aws-sdk/client-s3')
  })

  it('registers a console entry with empty capsule data', () => {
    const { ctx, addEntry } = createFakeContext()

    plugin.apply(ctx)

    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(addEntry.mock.calls[0][0]).toEqual({
      dev: expect.stringContaining('/client/index.ts'),
      prod: expect.stringContaining('/dist'),
    })
    const data = addEntry.mock.calls[0][1]
    expect(data).toBeDefined()
    expect(data?.()).toEqual({
      capsule: undefined,
      bots: [],
      debug: false,
      webQQTheme: 'fresh',
      webQQChatStyle: 'telegram',
      webQQTimBubbleTail: true,
      webQQColorMode: 'auto',
      webQQAccentColor: '#2563eb',
      useCompactCapsuleShadow: true,
      hideWebQQGroupLevel: true,
      showWebQQAffinity: false,
      showWebQQRelationship: false,
      showWebQQThinkingTokens: true,
      showWebQQThinkingTiming: true,
      showWebQQCapsuleUnread: true,
      webQQStorageBackend: 'koishi',
      webQQMessageCacheLimit: 100,
    })
  })

  it('adds configured mock OneBot robots to console entry data', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      name: 'Capsule Bot',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
    }
    const { ctx, addEntry, addListener, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx, { onebotMockBotCount: 2 })

    const data = addEntry.mock.calls[0][1]
    expect(data?.()).toMatchObject({
      bots: [
        { selfId: '10000', name: 'Capsule Bot' },
        { selfId: '10000:mock:1', name: 'Capsule Bot 模拟 1' },
        { selfId: '10000:mock:2', name: 'Capsule Bot 模拟 2' },
      ],
    })

    const selectBot = findConsoleListener(addListener, 'onebot-webqq/webqq/bot/select')
    await expect(selectBot?.({ selfId: '10000:mock:2' })).resolves.toMatchObject({
      selectedSelfId: '10000:mock:2',
    })
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/bots/update', expect.objectContaining({
      selectedSelfId: '10000:mock:2',
    }), { authority: 1 })
  })

  it('registers read-only WebQQ console listeners backed by OneBot actions', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        get_group_member_list: vi.fn(async () => []),
        voice_msg_to_text: vi.fn(async () => ({ text: '语音内容' })),
      },
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)

    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/contacts', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/messages', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/group-info', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/record/transcribe', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/notices', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/notice-action', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/storage/load', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/storage/save', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/messages/cache/load', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/messages/cache/save', expect.any(Function), { authority: 1 })
    expect(addListener).not.toHaveBeenCalledWith('onebot-webqq/webqq/send', expect.any(Function))

    const loadContacts = findConsoleListener(addListener, 'onebot-webqq/webqq/contacts')
    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    const loadGroupInfo = findConsoleListener(addListener, 'onebot-webqq/webqq/group-info')
    const transcribeRecord = findConsoleListener(addListener, 'onebot-webqq/webqq/record/transcribe')

    await expect(loadContacts?.()).resolves.toEqual({ friends: [], groups: [] })
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([])
    await expect(loadGroupInfo?.({ groupId: '20000' })).resolves.toEqual({ announcements: [], members: [] })
    await expect(transcribeRecord?.({ messageId: '12345' })).resolves.toBe('语音内容')
    expect(bot.internal.voice_msg_to_text).toHaveBeenCalledWith({ message_id: 12345 })
  })

  it('loads and saves WebQQ state and message cache through the Koishi database backend', async () => {
    const storedState = {
      conversationSummaries: {
        'friend:10001': { summary: '你好', time: 1710000000000 },
      },
      conversationUnreadCounts: {
        'friend:10001': 2,
      },
    }
    const cachedMessages: WebQQMessage[] = [{
      id: 'msg-1',
      sequence: '100',
      time: 1710000000000,
      senderId: '10000',
      senderName: 'Capsule Bot',
      senderAvatar: 'https://example.com/avatar.png',
      direction: 'outgoing',
      summary: '这是答案',
      thinking: {
        content: '先分析',
        durationMs: 2400,
        usage: {
          inputTokens: 12,
          outputTokens: 34,
        },
      },
      elements: [{ type: 'text', text: '这是答案' }],
    }]
    const database = {
      get: vi.fn(async (_table: string, query: { id?: string }) => {
        if (query.id === 'state:webqq') return [{ id: 'state:webqq', payload: storedState }]
        if (query.id === 'messages:friend:10001') return [{ id: 'messages:friend:10001', payload: { messages: cachedMessages } }]
        return []
      }),
      upsert: vi.fn(async () => {}),
    }
    const { ctx, addListener, modelExtend } = createFakeContext({ database })
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: { webQQStorageBackend?: 'koishi' }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, { webQQStorageBackend: 'koishi' })

    expect(modelExtend).toHaveBeenCalledWith('onebot_webqq_storage', {
      id: 'string(128)',
      payload: 'object',
      updatedAt: 'timestamp',
    }, { primary: 'id' })

    const loadStorage = findConsoleListener(addListener, 'onebot-webqq/webqq/storage/load')
    const saveStorage = findConsoleListener(addListener, 'onebot-webqq/webqq/storage/save')
    const loadMessageCache = findConsoleListener(addListener, 'onebot-webqq/webqq/messages/cache/load')
    const saveMessageCache = findConsoleListener(addListener, 'onebot-webqq/webqq/messages/cache/save')
    await expect(loadStorage?.()).resolves.toEqual(storedState)
    await saveStorage?.(storedState)
    await expect(loadMessageCache?.({ type: 'friend', peerId: '10001' })).resolves.toEqual(cachedMessages)
    await saveMessageCache?.({ type: 'friend', peerId: '10001', messages: cachedMessages })

    expect(database.get).toHaveBeenCalledWith('onebot_webqq_storage', { id: 'state:webqq' })
    expect(database.get).toHaveBeenCalledWith('onebot_webqq_storage', { id: 'messages:friend:10001' })
    expect(database.upsert).toHaveBeenCalledWith('onebot_webqq_storage', [{
      id: 'state:webqq',
      payload: storedState,
      updatedAt: expect.any(Date),
    }])
    expect(database.upsert).toHaveBeenCalledWith('onebot_webqq_storage', [{
      id: 'messages:friend:10001',
      payload: { messages: cachedMessages },
      updatedAt: expect.any(Date),
    }])
  })

  it('limits Koishi WebQQ message cache per conversation', async () => {
    const database = {
      get: vi.fn(async () => []),
      upsert: vi.fn(async () => {}),
    }
    const { ctx, addListener } = createFakeContext({ database })
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: { webQQStorageBackend?: 'koishi'; webQQMessageCacheLimit?: number }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, { webQQStorageBackend: 'koishi', webQQMessageCacheLimit: 2 })

    const saveMessageCache = findConsoleListener(addListener, 'onebot-webqq/webqq/messages/cache/save')
    const messages: WebQQMessage[] = [1, 2, 3].map((index) => ({
      id: `msg-${index}`,
      sequence: `${index}`,
      time: 1710000000000 + index,
      senderId: '10000',
      senderName: 'Capsule Bot',
      senderAvatar: '',
      direction: 'incoming',
      summary: `消息 ${index}`,
      elements: [{ type: 'text', text: `消息 ${index}` }],
    }))

    await saveMessageCache?.({ type: 'group', peerId: '20000', messages })

    expect(database.upsert).toHaveBeenCalledWith('onebot_webqq_storage', [{
      id: 'messages:group:20000',
      payload: { messages: messages.slice(-2) },
      updatedAt: expect.any(Date),
    }])
  })

  it('exposes pending WebQQ friend requests and group notices through the console listener', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_system_msg: vi.fn(async () => ({
          data: {
            join_requests: [{
              request_id: 'join-1',
              group_id: 20000,
              group_name: 'General',
              requester_uin: 30000,
              requester_nick: 'Alice',
              checked: false,
            }],
          },
        })),
        set_friend_add_request: vi.fn(async () => ({})),
        set_group_add_request: vi.fn(async () => ({})),
      },
    }
    const { ctx, listeners, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    listeners['friend-request'][0](createSession({
      userId: '40000',
      username: 'Bob',
      event: {
        user: { id: '40000', name: 'Bob' },
        _data: { flag: 'friend-flag', comment: '加个好友' },
      },
    }))
    listeners['guild-member-removed'][0](createSession({
      channelId: '20000',
      userId: '50000',
      username: 'Carol',
      event: {
        guild: { id: '20000', name: 'General' },
        user: { id: '50000', name: 'Carol' },
      },
    }))

    const loadNotices = findConsoleListener(addListener, 'onebot-webqq/webqq/notices')
    await expect(loadNotices?.()).resolves.toEqual([
      expect.objectContaining({
        id: 'friend:friend-flag',
        type: 'friend-request',
        title: 'Bob',
        avatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
        status: 'pending',
        comment: '加个好友',
      }),
      expect.objectContaining({
        id: 'group:leave:20000:50000:1710000000000',
        type: 'group-notice',
        title: 'General',
        subtitle: 'Carol 退出群聊',
        avatar: 'https://p.qlogo.cn/gh/20000/20000/640/',
        status: 'approved',
        subType: 'leave',
      }),
      expect.objectContaining({
        id: 'group:join-1',
        type: 'group-notice',
        title: 'General',
        avatar: 'https://p.qlogo.cn/gh/20000/20000/640/',
        status: 'pending',
      }),
    ])

    const handleNotice = findConsoleListener(addListener, 'onebot-webqq/webqq/notice-action')
    await handleNotice?.({ id: 'friend:friend-flag', type: 'friend-request', flag: 'friend-flag', approve: true })
    await handleNotice?.({ id: 'group:join-1', type: 'group-notice', flag: 'join-1', subType: 'add', approve: false })

    expect(bot.internal.set_friend_add_request).toHaveBeenCalledWith({
      flag: 'friend-flag',
      approve: true,
    })
    expect(bot.internal.set_group_add_request).toHaveBeenCalledWith({
      flag: 'join-1',
      sub_type: 'add',
      approve: false,
    })
  })

  it('requires a logged-in console user for WebQQ data and live broadcasts', async () => {
    const { ctx, listeners, addListener, broadcast } = createFakeContext()

    plugin.apply(ctx)

    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/contacts', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('onebot-webqq/webqq/messages', expect.any(Function), { authority: 1 })

    await listeners.message[0](createSession({
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'new message' } }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/update', expect.any(Object), { authority: 1 })
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', expect.any(Object), { authority: 1 })
  })

  it('uses the configured WebQQ protocol for OneBot history calls', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx, { onebotProtocol: 'llbot' })

    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([])

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      message_seq: 0,
      count: 20,
      reverseOrder: false,
    })
  })

  it('uses 100 messages as the default WebQQ history limit', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)

    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    await expect(loadMessages?.({ type: 'group', peerId: '20000' })).resolves.toEqual([])

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      message_seq: 0,
      count: 100,
    })
  })

  it('merges live OneBot messages into WebQQ message history', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 'old-1',
            message_seq: 10,
            time: 1710000000,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: 'old message',
          }],
        })),
      },
    }
    const { ctx, listeners, addListener, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: {
          id: '20000',
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Guild Name',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
        member: {
          name: '群昵称',
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'new message' } }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'new-1',
        senderId: '30000',
        senderName: '群昵称',
        senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
        senderRole: '管理员',
        senderLevel: '100',
        senderTitle: '闪亮头衔',
        direction: 'incoming',
        summary: 'new message',
      }),
    }, { authority: 1 })

    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        id: 'old-1',
        summary: 'old message',
      }),
      expect.objectContaining({
        id: 'new-1',
        summary: 'new message',
      }),
    ])
  })

  it('attaches ChatLuna affinity data to WebQQ message history when enabled', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 'old-1',
            message_seq: 10,
            time: 1710000000,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: 'old message',
          }],
        })),
      },
    }
    const database = {
      get: vi.fn(async (table: string) => {
        if (table === 'chatluna_affinity_v2') {
          return [{
            scopeId: 'cat',
            userId: '30000',
            affinity: 88,
            relation: '熟悉',
            specialRelation: null,
          }]
        }
        return []
      }),
      upsert: vi.fn(async () => {}),
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot], database })
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: {
      showWebQQAffinity?: boolean
      showWebQQRelationship?: boolean
      webQQAffinityScopeId?: string
    }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, {
      showWebQQAffinity: true,
      showWebQQRelationship: true,
      webQQAffinityScopeId: 'cat',
    })

    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        id: 'old-1',
        senderAffinity: 88,
        senderRelationship: '熟悉',
      }),
    ])
    expect(database.get).toHaveBeenCalledWith('chatluna_affinity_v2', {
      scopeId: 'cat',
      userId: { $in: ['30000'] },
    })
  })

  it('uses the only ChatLuna affinity scope when no WebQQ affinity scope is configured', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 'old-1',
            message_seq: 10,
            time: 1710000000,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: 'old message',
          }],
        })),
      },
    }
    const database = {
      get: vi.fn(async (table: string) => {
        if (table === 'chatluna_affinity_v2') {
          return [{
            scopeId: 'cat',
            userId: '30000',
            affinity: 88,
            relation: '熟悉',
            specialRelation: null,
          }]
        }
        return []
      }),
      upsert: vi.fn(async () => {}),
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot], database })
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: {
      showWebQQAffinity?: boolean
      showWebQQRelationship?: boolean
    }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, {
      showWebQQAffinity: true,
      showWebQQRelationship: true,
    })

    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        id: 'old-1',
        senderAffinity: 88,
        senderRelationship: '熟悉',
      }),
    ])
    expect(database.get).toHaveBeenCalledWith('chatluna_affinity_v2', {})
  })

  it('does not guess a ChatLuna affinity scope when multiple scopes exist', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 'old-1',
            message_seq: 10,
            time: 1710000000,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: 'old message',
          }],
        })),
      },
    }
    const database = {
      get: vi.fn(async (table: string) => {
        if (table === 'chatluna_affinity_v2') {
          return [
            { scopeId: 'cat', userId: '30000', affinity: 88, relation: '熟悉' },
            { scopeId: 'dog', userId: '30000', affinity: 20, relation: '陌生' },
          ]
        }
        return []
      }),
      upsert: vi.fn(async () => {}),
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot], database })
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: { showWebQQAffinity?: boolean }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, { showWebQQAffinity: true })

    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.not.objectContaining({
        senderAffinity: expect.any(Number),
      }),
    ])
  })

  it('refreshes live group sender metadata from OneBot member info and overwrites cached changes', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        get_group_member_info: vi.fn()
          .mockResolvedValueOnce({
            role: 'admin',
            level: '100',
            title: '旧头衔',
          })
          .mockResolvedValueOnce({
            role: 'owner',
            level: '101',
            title: '新头衔',
          }),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, addListener, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'first' } }],
        },
      },
    }))
    await listeners.message[0](createSession({
      bot,
      timestamp: 1710000002000,
      event: {
        platform: 'onebot',
        timestamp: 1710000002000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-2',
          elements: [{ type: 'text', attrs: { content: 'second' } }],
        },
      },
    }))

    expect(bot.internal.get_group_member_info).toHaveBeenNthCalledWith(1, {
      group_id: 20000,
      user_id: 30000,
      no_cache: true,
    })
    expect(bot.internal.get_group_member_info).toHaveBeenNthCalledWith(2, {
      group_id: 20000,
      user_id: 30000,
      no_cache: true,
    })
    const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
    expect(webQQCalls[0]?.[1]?.message).not.toHaveProperty('senderRole')
    expect(webQQCalls[1]?.[1]?.message).toMatchObject({
      id: 'new-1',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '旧头衔',
    })
    expect(webQQCalls[2]?.[1]?.message).toMatchObject({
      id: 'new-2',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '旧头衔',
    })
    expect(webQQCalls[3]?.[1]?.message).toMatchObject({
      id: 'new-2',
      senderRole: '群主',
      senderLevel: '101',
      senderTitle: '新头衔',
    })

    const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        id: 'new-1',
        senderRole: '管理员',
        senderLevel: '100',
        senderTitle: '旧头衔',
      }),
      expect.objectContaining({
        id: 'new-2',
        senderRole: '群主',
        senderLevel: '101',
        senderTitle: '新头衔',
      }),
    ])
  })

  it('refreshes outgoing bot WebQQ group sender metadata from OneBot member info', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_group_member_info: vi.fn(async () => ({
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'bot-1',
          elements: [{ type: 'text', attrs: { content: 'bot reply' } }],
        },
      },
    }))

    expect(bot.internal.get_group_member_info).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 10000,
      no_cache: true,
    })
    const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
    expect(webQQCalls[0]?.[1]?.message).toMatchObject({
      id: 'bot-1',
      senderId: '10000',
      direction: 'outgoing',
    })
    expect(webQQCalls[0]?.[1]?.message).not.toHaveProperty('senderRole')
    expect(webQQCalls[1]?.[1]?.message).toMatchObject({
      id: 'bot-1',
      senderId: '10000',
      direction: 'outgoing',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('keeps live WebQQ messages when OneBot member info refresh fails', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_group_member_info: vi.fn(async () => {
          throw new Error('member info failed')
        }),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await expect(listeners.message[0](createSession({
      bot,
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'first' } }],
        },
      },
    }))).resolves.toBeUndefined()

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'new-1',
        summary: 'first',
      }),
    }, { authority: 1 })
  })

  it('broadcasts live at segments as text in WebQQ messages', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      event: {
        guild: {
          id: '20000',
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Guild Name',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
        message: {
          id: 'at-1',
          elements: [
            { type: 'at', attrs: { id: '10000', name: '宁宁' } },
            { type: 'text', attrs: { content: ' 那我自己去吃' } },
          ],
        },
      },
      elements: [
        { type: 'at', attrs: { id: '10000', name: '宁宁' } },
        { type: 'text', attrs: { content: ' 那我自己去吃' } },
      ],
    }))

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'at-1',
        summary: '@宁宁 那我自己去吃',
        elements: [
          { type: 'text', text: '@宁宁' },
          { type: 'text', text: ' 那我自己去吃' },
        ],
      }),
    }, { authority: 1 })
  })

  it('broadcasts live mface segments as readable WebQQ face elements', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      event: {
        guild: {
          id: '20000',
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Guild Name',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
        message: {
          id: 'mface-1',
          elements: [{ type: 'mface', attrs: { summary: '[开心]', emoji_id: '123' } }],
        },
      },
    }))
    await listeners.message[0](createSession({
      event: {
        guild: {
          id: '20000',
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Guild Name',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
        message: {
          id: 'mface-2',
          elements: [{ type: 'mface', attrs: { id: '456' } }],
        },
      },
    }))

    const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
    expect(webQQCalls).toHaveLength(2)
    expect(webQQCalls[0]).toEqual([
      'onebot-webqq/webqq/message',
      {
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          id: 'mface-1',
          summary: '[开心]',
          elements: [{ type: 'face', text: '[开心]' }],
        }),
      },
      { authority: 1 },
    ])
    expect(webQQCalls[1]).toEqual([
      'onebot-webqq/webqq/message',
      {
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          id: 'mface-2',
          summary: '[表情 456]',
          elements: [{ type: 'face', text: '[表情 456]' }],
        }),
      },
      { authority: 1 },
    ])
  })

  it('broadcasts live mface URL segments as WebQQ image elements', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      event: {
        guild: {
          id: '20000',
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Guild Name',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
        message: {
          id: 'mface-url-1',
          elements: [{
            type: 'mface',
            attrs: {
              summary: '[开心]',
              url: 'https://example.com/mface.gif',
            },
          }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'mface-url-1',
        elements: [{ type: 'image', url: 'https://example.com/mface.gif' }],
      }),
    }, { authority: 1 })
  })

  it('records OneBot self message echoes as outgoing WebQQ messages', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'self-1',
          elements: [{ type: 'text', attrs: { content: 'sent message' } }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'self-1',
        senderId: '10000',
        senderName: 'Capsule Bot',
        direction: 'outgoing',
        summary: 'sent message',
      }),
    }, { authority: 1 })
  })

  it('does not broadcast WebQQ live messages from before send', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners['before:send'][0](createSession({
      content: 'sent message',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
      },
    }))

    expect(broadcast).not.toHaveBeenCalledWith('onebot-webqq/webqq/message', expect.any(Object), { authority: 1 })
  })

  it('resolves live OneBot image messages before broadcasting WebQQ updates', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_image: vi.fn(async () => ({
          url: 'https://example.com/live.jpg',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'image-1',
          elements: [{ type: 'img', attrs: { file: 'live.image' } }],
        },
      },
    }))

    expect(bot.internal.get_image).toHaveBeenCalledWith({
      file: 'live.image',
    })
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'image-1',
        summary: '[图片]',
        elements: [{ type: 'image', url: 'https://example.com/live.jpg' }],
      }),
    }, { authority: 1 })
  })

  it('resolves live OneBot record messages before broadcasting playable WebQQ updates', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_record: vi.fn(async () => ({
          url: 'https://example.com/live.mp3',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'record-1',
          elements: [{ type: 'record', attrs: { file: 'live.silk', duration: 5 } }],
        },
      },
    }))

    expect(bot.internal.get_record).toHaveBeenCalledWith({
      file: 'live.silk',
      out_format: 'mp3',
    })
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'record-1',
        summary: '[语音]',
        elements: [{
          type: 'record',
          text: '[语音]',
          duration: 5,
          url: 'https://example.com/live.mp3',
        }],
      }),
    }, { authority: 1 })
  })

  it('proxies live OneBot image URLs before broadcasting WebQQ updates', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_image: vi.fn(async () => ({
          url: 'https://example.com/unused.jpg',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot], server: true })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'image-url-1',
          elements: [{
            type: 'img',
            attrs: {
              src: 'https://multimedia.nt.qq.com.cn/download?fileid=remote',
            },
          }],
        },
      },
    }))

    expect(bot.internal.get_image).not.toHaveBeenCalled()
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'image-url-1',
        summary: '[图片]',
        elements: [{
          type: 'image',
          url: expect.stringMatching(/^\/onebot-webqq\/webqq\/image\//),
        }],
      }),
    }, { authority: 1 })
  })

  it('renders live quote elements before the WebQQ message body', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'quote-1',
          elements: [
            {
              type: 'quote',
              attrs: { name: '彩虹猫' },
              children: [{ type: 'text', attrs: { content: '宁宁摸摸头' } }],
            },
            { type: 'text', attrs: { content: '这还差不多' } },
          ],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'quote-1',
        summary: '这还差不多',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    }, { authority: 1 })
  })

  it('renders live quote attrs message payloads before the WebQQ message body', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'quote-attrs-1',
          elements: [
            {
              type: 'quote',
              attrs: {
                name: '彩虹猫',
                message: [{ type: 'text', attrs: { content: '宁宁摸摸头' } }],
              },
            },
            { type: 'text', attrs: { content: '这还差不多' } },
          ],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'quote-attrs-1',
        summary: '这还差不多',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    }, { authority: 1 })
  })

  it('renders markup inside live quote text as readable content', async () => {
    const mentionPayload = await createWebQQLiveMessage(createSession({
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'quote-markup-1',
          elements: [
            {
              type: 'quote',
              attrs: {
                name: '彩虹猫',
                sourceMsgText: '宁宁这是一个测试，禁言<at id="1511991473" name="蒸汽机"/>1分钟',
              },
            },
            { type: 'text', attrs: { content: '好哦，已经把他禁言一分钟啦' } },
          ],
        },
      },
    }) as unknown as Session, 'incoming')
    const mediaPayload = await createWebQQLiveMessage(createSession({
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'quote-markup-2',
          quote: {
            id: 'quoted-markup-2',
            user: { id: '40000', name: '笨蛋喵喵小尼' },
            content: '<msg><img src="https://multimedia.nt.qq.com.cn/download?appid=1407&amp;fileid=remote" file="cover.jpg" sub-type="1"/><file name="作业.zip" file-size="1024"/></msg>',
          },
          elements: [
            { type: 'text', attrs: { content: '@宁宁 这个苹果可以吗' } },
          ],
        },
      },
    }) as unknown as Session, 'incoming')

    expect(mentionPayload?.message.elements).toEqual([
      { type: 'quote', title: '彩虹猫', text: '宁宁这是一个测试，禁言@蒸汽机1分钟' },
      { type: 'text', text: '好哦，已经把他禁言一分钟啦' },
    ])
    expect(mediaPayload?.message.elements).toEqual([
      { type: 'quote', title: '笨蛋喵喵小尼', text: '[图片]作业.zip', targetMessageId: 'quoted-markup-2' },
      { type: 'text', text: '@宁宁 这个苹果可以吗' },
    ])
  })

  it('renders live event message quote fields before the WebQQ message body', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'quote-field-1',
          quote: {
            id: 'quoted-field-1',
            user: { id: '40000', name: '彩虹猫' },
            content: '宁宁摸摸头',
          },
          elements: [
            { type: 'text', attrs: { content: '这还差不多' } },
          ],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'quote-field-1',
        summary: '这还差不多',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头', targetMessageId: 'quoted-field-1' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    }, { authority: 1 })
  })

  it('resolves live reply ids before rendering WebQQ quote elements', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_msg: vi.fn(async () => ({
          message_id: 'quoted-1',
          sender: {
            user_id: 40000,
            nickname: '彩虹猫',
          },
          message: [{ type: 'text', data: { text: '宁宁摸摸头' } }],
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'reply-1',
          elements: [
            { type: 'reply', attrs: { id: 'quoted-1' } },
            { type: 'text', attrs: { content: '这还差不多' } },
          ],
        },
      },
    }))

    expect(bot.internal.get_msg).toHaveBeenCalledWith({
      message_id: 'quoted-1',
    })
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'reply-1',
        direction: 'outgoing',
        summary: '这还差不多',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头', targetMessageId: 'quoted-1' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    }, { authority: 1 })
  })

  it('reads live forward elements before broadcasting WebQQ updates', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_forward_msg: vi.fn(async () => ({
          message: [{
            type: 'node',
            data: {
              user_id: 30000,
              nickname: 'Alice',
              content: [{ type: 'text', data: { text: '第一条' } }],
            },
          }],
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'forward-1',
          elements: [{ type: 'forward', attrs: { id: 'forward-detail-1' } }],
        },
      },
    }))

    expect(bot.internal.get_forward_msg).toHaveBeenCalledWith({
      id: 'forward-detail-1',
    })
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'forward-1',
        summary: '[合并转发]',
        elements: [{
          type: 'forward',
          title: '合并转发',
          text: 'Alice：第一条',
          items: [{
            title: 'Alice',
            senderId: '30000',
            senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
            elements: [{ type: 'text', text: '第一条' }],
          }],
        }],
      }),
    }, { authority: 1 })
  })

  it('renders live json card elements before broadcasting WebQQ updates', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'card-1',
          elements: [{
            type: 'json',
            attrs: {
              data: JSON.stringify({
                meta: {
                  music: {
                    title: '春日影',
                    desc: 'MyGO!!!!!',
                    preview: 'https://example.com/cover.jpg',
                    jumpUrl: 'https://example.com/song',
                    tag: 'QQ音乐',
                  },
                },
              }),
            },
          }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'card-1',
        summary: '春日影',
        elements: [{
          type: 'card',
          title: '春日影',
          text: 'MyGO!!!!!',
          url: 'https://example.com/song',
          imageUrl: 'https://example.com/cover.jpg',
          source: 'QQ音乐',
        }],
      }),
    }, { authority: 1 })
  })

  it('passes enabled debug config to console entry data', () => {
    const { ctx, addEntry } = createFakeContext()
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: { debug?: boolean }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, { debug: true })

    const data = addEntry.mock.calls[0][1]
    expect(data?.()).toEqual({
      capsule: undefined,
      bots: [],
      debug: true,
      webQQTheme: 'fresh',
      webQQChatStyle: 'telegram',
      webQQTimBubbleTail: true,
      webQQColorMode: 'auto',
      webQQAccentColor: '#2563eb',
      useCompactCapsuleShadow: true,
      hideWebQQGroupLevel: true,
      showWebQQAffinity: false,
      showWebQQRelationship: false,
      showWebQQThinkingTokens: true,
      showWebQQThinkingTiming: true,
      showWebQQCapsuleUnread: true,
      webQQStorageBackend: 'koishi',
      webQQMessageCacheLimit: 100,
    })
  })

  it('passes configured WebQQ theme and accent settings to console entry data', () => {
    const { ctx, addEntry } = createFakeContext()
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: {
      webQQTheme?: 'fresh' | 'frosted'
      webQQChatStyle?: 'qq' | 'telegram'
      webQQTimBubbleTail?: boolean
      webQQColorMode?: 'auto' | 'light' | 'dark'
      webQQAccentColor?: string
      useCompactCapsuleShadow?: boolean
      hideWebQQGroupLevel?: boolean
      showWebQQAffinity?: boolean
      showWebQQRelationship?: boolean
      showWebQQThinkingTokens?: boolean
      showWebQQThinkingTiming?: boolean
      webQQAffinityScopeId?: string
      showWebQQCapsuleUnread?: boolean
      webQQStorageBackend?: 'browser' | 'koishi'
      webQQMessageCacheLimit?: number
    }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, {
      webQQTheme: 'fresh',
      webQQChatStyle: 'telegram',
      webQQTimBubbleTail: false,
      webQQColorMode: 'dark',
      webQQAccentColor: '#22c55e',
      useCompactCapsuleShadow: false,
      hideWebQQGroupLevel: true,
      showWebQQAffinity: true,
      showWebQQRelationship: true,
      showWebQQThinkingTokens: false,
      showWebQQThinkingTiming: false,
      webQQAffinityScopeId: 'cat',
      showWebQQCapsuleUnread: false,
      webQQStorageBackend: 'koishi',
      webQQMessageCacheLimit: 50,
    })

    const data = addEntry.mock.calls[0][1]
    expect(data?.()).toEqual({
      capsule: undefined,
      bots: [],
      debug: false,
      webQQTheme: 'fresh',
      webQQChatStyle: 'telegram',
      webQQTimBubbleTail: false,
      webQQColorMode: 'dark',
      webQQAccentColor: '#22c55e',
      useCompactCapsuleShadow: false,
      hideWebQQGroupLevel: true,
      showWebQQAffinity: true,
      showWebQQRelationship: true,
      showWebQQThinkingTokens: false,
      showWebQQThinkingTiming: false,
      showWebQQCapsuleUnread: false,
      webQQStorageBackend: 'koishi',
      webQQMessageCacheLimit: 50,
    })
  })

  it('writes debug snapshots to Koishi logs when debug is enabled', () => {
    const { ctx, listeners } = createFakeContext()
    const logger: TestLogger = {
      info: vi.fn(),
    }
    const ctxWithLogger = {
      ...ctx,
      logger: vi.fn(() => logger),
    } as ChatCapsuleContext & { logger: (name: string) => TestLogger }

    plugin.apply(ctxWithLogger, { debug: true })
    listeners.message[0](createSession())

    expect(ctxWithLogger.logger).toHaveBeenCalledWith('onebot-webqq')
    expect(logger.info).toHaveBeenCalledWith(
      'message %s',
      expect.stringContaining('"received":1'),
    )
  })

  it('broadcasts normalized state when a message is received', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners.message[0](createSession())

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/update', {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Capsule Bot',
        avatar: 'https://example.com/avatar.png',
      },
      conversation: {
        channelId: '20000',
        channelName: 'Guild Name',
        timestamp: 1710000000000,
      },
      counters: {
        received: 1,
        sent: 0,
      },
    }, { authority: 1 })
  })

  it('keeps bot avatar URLs stable in console entry data when server image proxy exists', () => {
    const { ctx, listeners, addEntry, broadcast } = createFakeContext({ server: true })

    plugin.apply(ctx)
    listeners.message[0](createSession())

    const data = addEntry.mock.calls[0][1]
    const entryData = data?.()
    expect(entryData).toEqual(expect.objectContaining({
      capsule: expect.objectContaining({
        bot: expect.objectContaining({
          avatar: 'https://example.com/avatar.png',
        }),
      }),
    }))
    expect(entryData?.capsule?.bot.avatar).not.toMatch(/^\/onebot-webqq\/webqq\/image\//)
    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/update', expect.objectContaining({
      bot: expect.objectContaining({
        avatar: 'https://example.com/avatar.png',
      }),
    }), { authority: 1 })
  })

  it('increments sent counter from before send and broadcasts the latest snapshot', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners.message[0](createSession())
    broadcast.mockClear()

    await listeners['before:send'][0]()

    expect(broadcast).toHaveBeenCalledWith('onebot-webqq/update', {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Capsule Bot',
        avatar: 'https://example.com/avatar.png',
      },
      conversation: {
        channelId: '20000',
        channelName: 'Guild Name',
        timestamp: 1710000000000,
      },
      counters: {
        received: 1,
        sent: 1,
      },
    }, { authority: 1 })
  })

  it('falls back to session names and ids when event names are missing', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners.message[0](createSession({
      event: {
        channel: {
          name: 'Session Channel',
        },
      },
    }))
    listeners.message[0](createSession({
      channelId: 'channel-id',
      userId: 'user-id',
      username: undefined,
      timestamp: 1710000000001,
      event: {},
    }))

    expect(broadcast.mock.calls[0][1]?.conversation).toMatchObject({
      channelName: 'Session Channel',
    })
    expect(broadcast.mock.calls[1][1]?.conversation).toMatchObject({
      channelId: 'channel-id',
      channelName: 'channel-id',
      timestamp: 1710000000001,
    })
  })

  it('uses ChatLuna chat events to show and clear generation status', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners['chatluna/before-chat'][0]('conversation-1', { name: 'Alice' }, {}, {}, createSession())

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelName: 'Guild Name',
      userName: 'Alice',
      activityText: '正在思考',
    })

    listeners['chatluna/after-chat'][0]('conversation-1')

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelId: '20000',
      channelName: 'Guild Name',
      timestamp: 1710000000000,
      thinkingDurationMs: expect.any(Number),
    })
  })

  it('shows ChatLuna schedule activity while idle', async () => {
    const schedule = {
      getCurrentActivity: vi.fn(async () => '晨间整理今日计划'),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ schedule })

    plugin.apply(ctx)
    await listeners.message[0](createSession())

    const updateCalls = broadcast.mock.calls.filter(([type]) => type === 'onebot-webqq/update')
    expect(schedule.getCurrentActivity).toHaveBeenCalledWith(expect.objectContaining({
      selfId: '10000',
      channelId: '20000',
    }))
    expect(updateCalls.at(-1)?.[1]?.conversation).toEqual({
      channelId: '20000',
      channelName: 'Guild Name',
      activityText: '晨间整理今日计划',
      timestamp: 1710000000000,
    })
  })

  it('carries group sender metadata from ChatLuna before-chat sessions into thinking conversation', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners['chatluna/before-chat'][0]('conversation-1', {
      id: '30000',
      name: 'Alice',
    }, {}, {}, createSession({
      event: {
        guild: {
          name: 'Guild Name',
        },
        channel: {
          name: 'Channel Name',
        },
        member: {
          name: '群昵称',
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        },
        user: {
          name: 'Event Alice',
        },
      },
    }))

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userId: '30000',
      userName: '群昵称',
      activityText: '正在思考',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('loads bot group sender metadata from OneBot before showing ChatLuna thinking status', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_group_member_info: vi.fn(async () => ({
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners['chatluna/before-chat'][0]('conversation-1', {
      id: '30000',
      name: 'Alice',
    }, {}, {}, createSession({ bot }))

    expect(bot.internal.get_group_member_info).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 10000,
      no_cache: false,
    })
    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelId: '20000',
      activityText: '正在思考',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('adds ChatLuna usage to outgoing WebQQ messages without character thinking', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await emitAll(listeners['chatluna/before-chat'], 'conversation-1', { name: 'Alice' }, {}, {}, createSession({ bot }))
    await emitAll(listeners['chatluna/model-usage'], {
      source: 'chatluna',
      context: {
        conversationId: 'conversation-2',
      },
      usageMetadata: {
        input_tokens: 90,
        output_tokens: 91,
        total_tokens: 181,
      },
    })
    await emitAll(listeners['chatluna/model-usage'], {
      source: 'extension-agent',
      context: {
        conversationId: 'conversation-1',
      },
      usageMetadata: {
        input_tokens: 56,
        output_tokens: 78,
        total_tokens: 134,
      },
    })
    await emitAll(listeners['chatluna/model-usage'], {
      source: 'chatluna',
      context: {
        conversationId: 'conversation-1',
      },
      usageMetadata: {
        input_tokens: 12,
        output_tokens: 34,
        total_tokens: 46,
      },
      timing: {
        ttftMs: 120,
        totalMs: 2400,
        tps: 14.2,
      },
    })
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      timestamp: 1710000003600,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'self-main',
          elements: [{ type: 'text', attrs: { content: '主插件回复' } }],
        },
      },
    }))

    const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
    expect(webQQCalls.at(-1)?.[1]?.message).toMatchObject({
      id: 'self-main',
      usage: {
        inputTokens: 12,
        outputTokens: 34,
        ttftMs: 120,
        totalMs: 2400,
        tps: 14.2,
      },
    })
    expect(webQQCalls.at(-1)?.[1]?.message).not.toHaveProperty('thinking')

    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      timestamp: 1710000003700,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'self-main-2',
          elements: [{ type: 'text', attrs: { content: '第二条回复' } }],
        },
      },
    }))
    expect(broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message').at(-1)?.[1]?.message)
      .not.toHaveProperty('usage')
  })

  it('uses character response locks and collect events to show active status', async () => {
    const character: ChatLunaCharacterService = {
      acquireResponseLock: vi.fn(async () => true),
      releaseResponseLock: vi.fn(async () => undefined),
    }
    const originalAcquireResponseLock = character.acquireResponseLock
    const originalReleaseResponseLock = character.releaseResponseLock
    const { ctx, listeners, broadcast } = createFakeContext({ character })
    const session = createSession({
      event: {
        guild: {
          name: 'Guild Name',
        },
        channel: {
          name: 'Channel Name',
        },
        member: {
          name: 'Group Card Alice',
        },
        user: {
          name: 'Event Alice',
        },
      },
    })

    plugin.apply(ctx)
    await character.acquireResponseLock(session as any, {
      id: '30000',
      name: 'Alice',
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userName: 'Group Card Alice',
      activityText: '正在与 Group Card Alice 对话',
    })

    await emitAll(listeners['chatluna_character/message_collect'], session, [{
      id: '30000',
      name: 'Alice',
    }], 'trigger')

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userName: 'Group Card Alice',
      activityText: '正在思考',
    })

    await character.releaseResponseLock(session as any)

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelId: '20000',
      channelName: 'Guild Name',
      timestamp: 1710000000000,
      thinkingDurationMs: expect.any(Number),
    })

    listeners.dispose[0]()

    expect(character.acquireResponseLock).toBe(originalAcquireResponseLock)
    expect(character.releaseResponseLock).toBe(originalReleaseResponseLock)
  })

  it('carries group sender metadata from ChatLuna character collect sessions into thinking conversation', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()
    const session = createSession({
      event: {
        guild: {
          name: 'Guild Name',
        },
        channel: {
          name: 'Channel Name',
        },
        member: {
          name: '群昵称',
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        },
        user: {
          name: 'Event Alice',
        },
      },
    })

    plugin.apply(ctx)
    await emitAll(listeners['chatluna_character/message_collect'], session, [{
      id: '30000',
      name: 'Alice',
    }], 'trigger')

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userId: '30000',
      userName: '群昵称',
      activityText: '正在思考',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('updates the last outgoing WebQQ message with completed character thinking content', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1710000000000)
      const bot = {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        internal: {
          get_friend_list: vi.fn(async () => []),
          get_group_list: vi.fn(async () => []),
          get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        },
        toJSON: () => ({
          user: {
            name: 'Capsule Bot',
            avatar: 'https://example.com/avatar.png',
          },
        }),
      }
      const { ctx, listeners, addListener, broadcast } = createFakeContext({ bots: [bot] })
      const session = createSession({
        bot,
        timestamp: 1710000000000,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '30000', name: 'Alice' },
        },
      })

      plugin.apply(ctx)
      await emitAll(listeners['chatluna_character/message_collect'], session, [{ id: '30000', name: 'Alice' }])
      await emitAll(listeners['chatluna/model-usage'], {
        source: 'chatluna-character',
        usageMetadata: {
          input_tokens: 12,
          output_tokens: 34,
          total_tokens: 46,
        },
        timing: {
          ttftMs: 180,
          totalMs: 4200,
          tps: 8.1,
        },
      })
      await emitAll(listeners['chatluna/model-usage'], {
        source: 'extension-agent',
        context: {
          conversationId: 'conversation-1',
        },
        usageMetadata: {
          input_tokens: 90,
          output_tokens: 91,
          total_tokens: 181,
        },
      })
      await listeners.message[0](createSession({
        bot,
        userId: '10000',
        timestamp: 1710000003600,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '10000', name: 'Capsule Bot' },
          message: {
            id: 'self-1',
            elements: [{ type: 'text', attrs: { content: '这是答案' } }],
          },
        },
      }))

      const initialWebQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
      expect(initialWebQQCalls).toHaveLength(1)
      expect(initialWebQQCalls[0]?.[1]?.message).not.toHaveProperty('thinking')
      expect(initialWebQQCalls[0]?.[1]?.message).not.toHaveProperty('usage')

      vi.setSystemTime(1710000004200)
      listeners['chatluna_character/after-chat'][0]({
        session,
        lastResponseMessage: {
          content: '开头<think>\n先分析\n再回答\n</think>这是答案',
        },
      })

      const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
      expect(webQQCalls.at(-1)?.[1]).toEqual({
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          id: 'self-1',
          direction: 'outgoing',
          summary: '这是答案',
          thinking: {
            content: '先分析\n再回答',
            durationMs: 4200,
            usage: {
              inputTokens: 12,
              outputTokens: 34,
              ttftMs: 180,
              totalMs: 4200,
              tps: 8.1,
            },
          },
        }),
      })
      expect(webQQCalls.at(-1)?.[1]?.message).not.toHaveProperty('usage')

      const loadMessages = findConsoleListener(addListener, 'onebot-webqq/webqq/messages')
      await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
        expect.objectContaining({
          id: 'self-1',
          thinking: {
            content: '先分析\n再回答',
            durationMs: 4200,
            usage: {
              inputTokens: 12,
              outputTokens: 34,
              ttftMs: 180,
              totalMs: 4200,
              tps: 8.1,
            },
          },
        }),
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not show completed character thinking when disabled', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1710000000000)
      const bot = {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        internal: {
          get_friend_list: vi.fn(async () => []),
          get_group_list: vi.fn(async () => []),
          get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        },
        toJSON: () => ({
          user: {
            name: 'Capsule Bot',
            avatar: 'https://example.com/avatar.png',
          },
        }),
      }
      const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })
      const session = createSession({
        bot,
        timestamp: 1710000000000,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '30000', name: 'Alice' },
        },
      })

      plugin.apply(ctx, { showWebQQCharacterThinking: false })
      await emitAll(listeners['chatluna_character/message_collect'], session, [{ id: '30000', name: 'Alice' }])
      await emitAll(listeners['chatluna/model-usage'], {
        source: 'chatluna-character',
        usageMetadata: {
          input_tokens: 12,
          output_tokens: 34,
          total_tokens: 46,
        },
        timing: {
          ttftMs: 180,
          totalMs: 4200,
          tps: 8.1,
        },
      })
      await listeners.message[0](createSession({
        bot,
        userId: '10000',
        timestamp: 1710000003600,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '10000', name: 'Capsule Bot' },
          message: {
            id: 'self-1',
            elements: [{ type: 'text', attrs: { content: '这是答案' } }],
          },
        },
      }))

      listeners['chatluna_character/after-chat'][0]({
        session,
        lastResponseMessage: {
          content: '开头<think>\n不应显示\n</think>这是答案',
        },
      })

      const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
      expect(webQQCalls).toHaveLength(1)
      expect(webQQCalls[0]?.[1]?.message).toMatchObject({
        usage: {
          inputTokens: 12,
          outputTokens: 34,
          ttftMs: 180,
          totalMs: 4200,
          tps: 8.1,
        },
      })
      expect(webQQCalls[0]?.[1]?.message).not.toHaveProperty('thinking')
    } finally {
      vi.useRealTimers()
    }
  })

  it('extracts character thinking from completionMessages LangChain AIMessage snapshots', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1710000000000)
      const bot = {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        internal: {
          get_friend_list: vi.fn(async () => []),
          get_group_list: vi.fn(async () => []),
          get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        },
        toJSON: () => ({
          user: {
            name: 'Capsule Bot',
            avatar: 'https://example.com/avatar.png',
          },
        }),
      }
      const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })
      const session = createSession({
        bot,
        timestamp: 1710000000000,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '30000', name: 'Alice' },
        },
      })

      plugin.apply(ctx)
      await emitAll(listeners['chatluna_character/message_collect'], session, [{ id: '30000', name: 'Alice' }])
      await listeners.message[0](createSession({
        bot,
        userId: '10000',
        timestamp: 1710000003600,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '10000', name: 'Capsule Bot' },
          message: {
            id: 'self-1',
            elements: [{ type: 'text', attrs: { content: '这是答案' } }],
          },
        },
      }))

      const initialWebQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
      expect(initialWebQQCalls).toHaveLength(1)
      expect(initialWebQQCalls[0]?.[1]?.message).not.toHaveProperty('thinking')

      vi.setSystemTime(1710000004200)
      listeners['chatluna_character/after-chat'][0]({
        session,
        completionMessages: [{
          lc: 1,
          type: 'constructor',
          id: ['langchain_core', 'messages', 'AIMessage'],
          kwargs: {
            content: '前<think>\n从快照分析\n</think>后',
          },
        }],
      })

      const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
      expect(webQQCalls.at(-1)?.[1]).toEqual({
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          id: 'self-1',
          direction: 'outgoing',
          thinking: {
            content: '从快照分析',
            durationMs: 4200,
          },
        }),
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps completed character thinking pending until the matching outgoing WebQQ message arrives', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1710000000000)
      const bot = {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        internal: {
          get_friend_list: vi.fn(async () => []),
          get_group_list: vi.fn(async () => []),
          get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        },
        toJSON: () => ({
          user: {
            name: 'Capsule Bot',
            avatar: 'https://example.com/avatar.png',
          },
        }),
      }
      const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })
      const session = createSession({
        bot,
        timestamp: 1710000000000,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '30000', name: 'Alice' },
        },
      })

      plugin.apply(ctx)
      await emitAll(listeners['chatluna_character/message_collect'], session, [{ id: '30000', name: 'Alice' }])

      vi.setSystemTime(1710000004200)
      listeners['chatluna_character/after-chat'][0]({
        session,
        lastResponseMessage: {
          content: '开头<think>\n先分析\n再回答\n</think>这是答案',
        },
      })

      expect(broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')).toHaveLength(0)

      await listeners.message[0](createSession({
        bot,
        userId: '30000',
        timestamp: 1710000004300,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '30000', name: 'Alice' },
          message: {
            id: 'incoming-1',
            elements: [{ type: 'text', attrs: { content: '收到' } }],
          },
        },
      }))

      await listeners.message[0](createSession({
        bot,
        channelId: '20001',
        userId: '10000',
        timestamp: 1710000004400,
        event: {
          guild: { id: '20001', name: 'Other Guild' },
          channel: { id: '20001', name: 'Other Guild' },
          user: { id: '10000', name: 'Capsule Bot' },
          message: {
            id: 'other-self-1',
            elements: [{ type: 'text', attrs: { content: '别处回复' } }],
          },
        },
      }))

      const nonMatchingWebQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
      expect(nonMatchingWebQQCalls).toHaveLength(2)
      expect(nonMatchingWebQQCalls[0]?.[1]?.message).toMatchObject({
        id: 'incoming-1',
        direction: 'incoming',
      })
      expect(nonMatchingWebQQCalls[0]?.[1]?.message).not.toHaveProperty('thinking')
      expect(nonMatchingWebQQCalls[1][1]).toEqual(expect.objectContaining({
        peerId: '20001',
        message: expect.objectContaining({
          id: 'other-self-1',
          direction: 'outgoing',
        }),
      }))
      expect(nonMatchingWebQQCalls[1]?.[1]?.message).not.toHaveProperty('thinking')

      await listeners.message[0](createSession({
        bot,
        userId: '10000',
        timestamp: 1710000004500,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '10000', name: 'Capsule Bot' },
          message: {
            id: 'self-1',
            elements: [{ type: 'text', attrs: { content: '这是答案' } }],
          },
        },
      }))

      const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
      expect(webQQCalls.at(-1)?.[1]).toEqual({
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          id: 'self-1',
          direction: 'outgoing',
          summary: '这是答案',
          thinking: {
            content: '先分析\n再回答',
            durationMs: 4200,
          },
        }),
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not add thinking data to WebQQ messages when character output has no non-empty think content', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })
    const session = createSession({
      bot,
      timestamp: 1710000000000,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
      },
    })

    plugin.apply(ctx)
    await emitAll(listeners['chatluna_character/message_collect'], session, [{ id: '30000', name: 'Alice' }])
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      timestamp: 1710000003600,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'self-1',
          elements: [{ type: 'text', attrs: { content: '这是答案' } }],
        },
      },
    }))

    listeners['chatluna_character/after-chat'][0]({
      session,
      text: '开头<think>   </think>这是答案',
    })

    const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'onebot-webqq/webqq/message')
    expect(webQQCalls).toHaveLength(1)
    expect(webQQCalls[0]?.[1]?.message).toMatchObject({
      id: 'self-1',
      direction: 'outgoing',
      summary: '这是答案',
    })
    expect(webQQCalls[0]?.[1]?.message).not.toHaveProperty('thinking')
  })

  it('keeps message and send listeners safe when console is unavailable', () => {
    const { ctx, listeners } = createFakeContext({ console: false })

    plugin.apply(ctx)

    expect(() => listeners.message[0](createSession())).not.toThrow()
    expect(() => listeners['before:send'][0]()).not.toThrow()
  })
})
