import type { Session } from 'koishi'
import Schema from 'schemastery'
import { resolve } from 'path'
import { createReadStream } from 'fs'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import type { Entry } from '@koishijs/console'
import {
  CapsuleSnapshot,
  clearConversationActivity,
  createCapsuleState,
  recordConversationActivity,
  recordIncomingMessage,
  recordModelUsage,
  recordOutgoingMessage,
} from './state'
import {
  createOneBotWebQQService,
  WebQQContacts,
  WebQQLiveMessage,
  WebQQMessage,
  WebQQMessageElement,
  WebQQMessageQuery,
  WebQQProtocol,
} from './onebot'

export const name = 'chat-capsule'

// 声明控制台为可选服务，缺失时只保留后端状态监听。
export const inject = {
  optional: ['console', 'server', 'chatluna', 'chatluna_character'],
}

export interface Config {
  debug?: boolean
  onebotSelfId?: string
  onebotProtocol?: WebQQProtocol
  historyLimit?: number
}

export const Config: Schema<Config> = Schema.object({
  debug: Schema.boolean().default(false).description('显示前端调试信息'),
  onebotSelfId: Schema.string().description('用于读取 WebQQ 数据的 OneBot 机器人 selfId，留空时自动选择第一个支持读取接口的机器人'),
  onebotProtocol: Schema.union([
    Schema.const('napcat').description('NapCat'),
    Schema.const('llbot').description('LLBot'),
  ]).default('napcat').role('radio').description('WebQQ 读取接口使用的 OneBot 实现协议'),
  historyLimit: Schema.natural().min(1).max(100).default(100).description('每次加载聊天历史的消息数量'),
})

declare module '@koishijs/console' {
  interface Events {
    'chat-capsule/update'(data: CapsuleSnapshot | undefined): void
    'chat-capsule/webqq/message'(data: WebQQLiveMessage): void
    'chat-capsule/webqq/contacts'(): Promise<WebQQContacts>
    'chat-capsule/webqq/messages'(query: WebQQMessageQuery): Promise<WebQQMessage[]>
  }
}

interface ConsoleService {
  addEntry(files: Entry.Files, data?: () => unknown): unknown
  addListener(event: string, callback: (...args: any[]) => unknown, options?: { authority?: number }): unknown
  broadcast(type: string, body: unknown, options?: { authority?: number }): unknown
}

interface DebugLogger {
  info(format: string, ...param: unknown[]): unknown
}

interface WebQQImageContext {
  params: Record<string, string>
  status?: number
  body?: unknown
  set(name: string, value: string): unknown
}

interface WebQQImageServer {
  get(path: string, callback: (ctx: WebQQImageContext) => unknown): unknown
}

interface ChatLunaMessage {
  id?: string
  name?: string
}

interface ChatLunaCharacterService {
  acquireResponseLock(session: Session, message: ChatLunaMessage): Promise<boolean>
  releaseResponseLock(session: Session): Promise<void>
}

interface ChatLunaModelUsage {
  context?: {
    conversationId?: string
  }
  usageMetadata?: {
    input_tokens?: number
    output_tokens?: number
  }
}

// 描述插件运行所需的最小 Koishi 上下文能力。
export interface ChatCapsuleContext {
  console?: ConsoleService
  server?: WebQQImageServer
  chatluna_character?: ChatLunaCharacterService
  bots?: unknown[]
  logger?(name: string): DebugLogger
  on(event: string, listener: (...args: any[]) => void): unknown
  before(event: 'send', listener: (session?: Session) => unknown): unknown
  inject(services: Record<string, { required: boolean }>, callback: (inner: ChatCapsuleContext) => void): unknown
}

function readBotProfile(session: Session) {
  const user = session.bot.toJSON?.().user
  return {
    platform: session.bot.platform || session.platform || 'unknown',
    selfId: session.bot.selfId,
    status: session.bot.status,
    name: user?.name,
    avatar: user?.avatar,
  }
}

function readChannelName(session: Session) {
  return session.event.guild?.name || session.event.channel?.name
}

function readMemberName(session: Session) {
  return session.event.member?.name || session.event.member?.nick
}

function readUserName(session: Session) {
  return readMemberName(session) || session.event.user?.name || session.username
}

function createMessageInput(session: Session, message?: ChatLunaMessage) {
  return {
    bot: readBotProfile(session),
    channel: {
      id: session.channelId || session.event.channel?.id || 'unknown',
      name: readChannelName(session),
    },
    user: {
      id: message?.id || session.userId || session.event.user?.id || 'unknown',
      name: message?.name || readUserName(session),
    },
    timestamp: session.timestamp,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function readElementText(value: unknown) {
  return value == null ? '' : String(value)
}

function readLiveQuoteText(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (!isRecord(raw)) return ''
  const type = readElementText(raw.type)
  const attrs = isRecord(raw.attrs) ? raw.attrs : {}
  if (type === 'text') return readElementText(attrs.content)
  if (type === 'img' || type === 'image') return '[图片]'
  if (type === 'face') return `[表情 ${readElementText(attrs.id)}]`
  if (Array.isArray(raw.children)) return raw.children.map(readLiveQuoteText).join('').trim()
  return readElementText(attrs.content || attrs.text)
}

type WebQQResolvedImage = {
  url: string
  debug?: unknown
}

type WebQQImageResolver = (file: string, source?: 'url') => Promise<WebQQResolvedImage>
type WebQQQuoteResolver = (id: string) => Promise<WebQQMessageElement>

function isRemoteImageSource(file: string) {
  return /^https?:\/\//.test(file)
}

function getImageContentType(file: string) {
  switch (extname(file).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.bmp':
      return 'image/bmp'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'image/png'
  }
}

function createWebQQImageUrlResolver(ctx: ChatCapsuleContext, logger?: DebugLogger) {
  const files = new Map<string, string>()
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
    const id = randomUUID()
    files.set(id, file)
    return `/chat-capsule/webqq/image/${id}`
  }
}

async function normalizeLiveElement(raw: unknown, resolveImage?: WebQQImageResolver, resolveQuote?: WebQQQuoteResolver): Promise<WebQQMessageElement | undefined> {
  if (typeof raw === 'string') return { type: 'text', text: raw }
  if (!isRecord(raw)) return undefined
  const type = readElementText(raw.type)
  const attrs = isRecord(raw.attrs) ? raw.attrs : {}
  if (type === 'text') return { type: 'text', text: readElementText(attrs.content) }
  if (type === 'quote' || type === 'reply') {
    const title = readElementText(attrs.name || attrs.nickname || attrs.senderName || attrs.sender_name)
    const text = readElementText(attrs.content || attrs.text || attrs.sourceMsgText) ||
      (Array.isArray(raw.children) ? raw.children.map(readLiveQuoteText).join('').trim() : '')
    const id = readElementText(attrs.id || attrs.messageId || attrs.message_id)
    if (!text && id && resolveQuote) {
      try {
        return await resolveQuote(id)
      } catch {
        return { type: 'quote', text: '[引用消息]' }
      }
    }
    return {
      type: 'quote',
      ...(title ? { title } : {}),
      text: text || '[引用消息]',
    }
  }
  if (type === 'img' || type === 'image') {
    const url = readElementText(attrs.src || attrs.url)
    if (url) {
      try {
        return { type: 'image', url: resolveImage ? (await resolveImage(url, 'url')).url : url }
      } catch {
        return { type: 'image', url }
      }
    }
    const file = readElementText(attrs.file || attrs.file_id)
    if (!file) return { type: 'image' }
    if (isRemoteImageSource(file)) {
      try {
        return { type: 'image', url: resolveImage ? (await resolveImage(file, 'url')).url : file }
      } catch {
        return { type: 'image', url: file }
      }
    }
    try {
      return { type: 'image', url: resolveImage ? (await resolveImage(file)).url : '' }
    } catch {
      return { type: 'image' }
    }
  }
  if (type === 'face') return { type: 'face', text: `[表情 ${readElementText(attrs.id)}]` }
  if (type === 'file') return { type: 'file', text: readElementText(attrs.name || attrs.file) || '[文件]' }
  if (type === 'audio' || type === 'record') return { type: 'record', text: '[语音]' }
  if (type === 'video') return { type: 'video', text: '[视频]' }
  return { type: 'unknown', text: '[消息]' }
}

async function normalizeLiveElements(session: Session, resolveImage?: WebQQImageResolver, resolveQuote?: WebQQQuoteResolver): Promise<WebQQMessageElement[]> {
  const elements = (await Promise.all((session.elements ?? session.event.message?.elements ?? [])
    .map((element) => normalizeLiveElement(element, resolveImage, resolveQuote))))
    .filter((element): element is WebQQMessageElement => !!element)
  if (elements.length) return elements
  const content = session.content?.trim()
  return content ? [{ type: 'text', text: content }] : [{ type: 'unknown', text: '[消息]' }]
}

function summarizeWebQQElements(elements: WebQQMessageElement[]) {
  const summary = elements.map((element) => {
    if (element.type === 'text') return element.text
    if (element.type === 'image') return '[图片]'
    if (element.type === 'quote') return ''
    if (element.type === 'face') return element.text || '[表情]'
    return element.text || '[消息]'
  }).filter(Boolean).join('').replace(/\s+/g, ' ').trim()
  return summary || '[消息]'
}

function getWebQQUserAvatar(userId: string) {
  return userId ? `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640` : ''
}

function readWebQQPeer(session: Session) {
  const isGroup = !!(session.guildId || session.event.guild)
  const peerId = isGroup
    ? session.channelId || session.guildId || session.event.channel?.id || session.event.guild?.id
    : session.userId || session.event.user?.id || session.channelId || session.event.channel?.id
  if (!peerId) return
  return {
    type: isGroup ? 'group' as const : 'friend' as const,
    peerId,
  }
}

function readWebQQLiveDirection(session: Session): WebQQMessage['direction'] {
  const senderId = session.userId || session.event.user?.id
  return senderId && senderId === session.bot.selfId ? 'outgoing' : 'incoming'
}

async function createWebQQLiveMessage(session: Session, direction: WebQQMessage['direction'], resolveImage?: WebQQImageResolver, resolveQuote?: WebQQQuoteResolver): Promise<WebQQLiveMessage | undefined> {
  if ((session.bot.platform || session.platform) !== 'onebot') return
  const peer = readWebQQPeer(session)
  if (!peer) return
  if (!(session.elements ?? session.event.message?.elements)?.length && !session.content?.trim()) return
  const bot = readBotProfile(session)
  const elements = await normalizeLiveElements(session, resolveImage, resolveQuote)
  const senderId = direction === 'outgoing'
    ? bot.selfId
    : session.userId || session.event.user?.id || 'unknown'
  const senderName = direction === 'outgoing'
    ? bot.name || '机器人'
    : readUserName(session) || senderId
  const id = session.messageId || session.event.message?.id || `${direction}:${peer.type}:${peer.peerId}:${session.timestamp}`
  return {
    ...peer,
    message: {
      id,
      sequence: session.messageId || session.event.message?.id || String(session.timestamp),
      time: session.timestamp,
      senderId,
      senderName,
      senderAvatar: getWebQQUserAvatar(senderId),
      direction,
      summary: summarizeWebQQElements(elements),
      elements,
    },
  }
}

function getMessageKey(message: WebQQMessage) {
  return message.id || message.sequence || `${message.senderId}:${message.time}:${message.summary}`
}

function mergeWebQQMessages(history: WebQQMessage[], live: WebQQMessage[] = [], limit?: number) {
  const messages = new Map<string, WebQQMessage>()
  for (const message of [...history, ...live]) {
    messages.set(getMessageKey(message), message)
  }
  const merged = [...messages.values()].sort((a, b) => a.time - b.time)
  return limit ? merged.slice(-limit) : merged
}

// 注册聊天胶囊的状态监听和控制台前端入口。
export function apply(ctx: ChatCapsuleContext, config: Config = {}) {
  const state = createCapsuleState()
  const historyLimit = config.historyLimit ?? 100
  const debug = !!config.debug
  const logger = debug ? ctx.logger?.('chat-capsule') : undefined
  const imageUrlResolver = createWebQQImageUrlResolver(ctx, logger)
  const webqq = createOneBotWebQQService(ctx, {
    selfId: config.onebotSelfId,
    protocol: config.onebotProtocol,
    imageUrlResolver,
  })
  const consoleAuthOptions = { authority: 1 }
  const logSnapshot = (source: string) => logger?.info(`${source} %s`, JSON.stringify(state.snapshot() ?? null))
  const broadcast = () => ctx.console?.broadcast('chat-capsule/update', state.snapshot(), consoleAuthOptions)
  const liveMessages = new Map<string, WebQQMessage[]>()
  const getLiveMessageKey = (query: WebQQMessageQuery) => `${query.type}:${query.peerId}`
  const recordWebQQLiveMessage = async (session: Session | undefined, direction: WebQQMessage['direction']) => {
    if (!session) return
    const payload = await createWebQQLiveMessage(
      session,
      direction,
      async (file, source) => {
        if (source === 'url') {
          const url = imageUrlResolver(file) || file
          logger?.info('webqq image url %s', JSON.stringify({ direction, url: file, proxyUrl: url }))
          return { url, debug: { url: file } }
        }
        const image = await webqq.resolveImage(file)
        logger?.info('webqq image %s', JSON.stringify({ direction, file, result: image.debug, url: image.url }))
        return image
      },
      async (id) => webqq.resolveQuote(id),
    )
    if (!payload) return
    const key = getLiveMessageKey(payload)
    const messages = mergeWebQQMessages(liveMessages.get(key) ?? [], [payload.message], 100)
    liveMessages.set(key, messages)
    ctx.console?.broadcast('chat-capsule/webqq/message', payload, consoleAuthOptions)
  }
  const recordGenerating = (session: Session, message?: ChatLunaMessage, conversationId?: string) => {
    const input = createMessageInput(session, message)
    input.user.name = readMemberName(session) || input.user.name
    recordConversationActivity(state, input, '正在思考', { conversationId })
    logSnapshot('generating')
    broadcast()
  }
  const clearActivity = (source: string) => {
    clearConversationActivity(state)
    logSnapshot(source)
    broadcast()
  }

  ctx.on('message', async (session) => {
    recordIncomingMessage(state, createMessageInput(session))
    logSnapshot('message')
    broadcast()
    await recordWebQQLiveMessage(session, readWebQQLiveDirection(session))
  })

  ctx.on('chatluna/before-chat', (conversationId, message, _variables, _chatInterface, session) => {
    recordGenerating(session, message, conversationId)
  })

  ctx.on('chatluna/after-chat', () => {
    clearActivity('after-chat')
  })

  ctx.on('chatluna/after-chat-error', () => {
    clearActivity('after-chat-error')
  })

  ctx.before('send', async (session) => {
    recordOutgoingMessage(state)
    logSnapshot('send')
    broadcast()
  })

  ctx.on('chatluna/model-usage', (usage: ChatLunaModelUsage) => {
    const changed = recordModelUsage(state, {
      conversationId: usage.context?.conversationId,
      inputTokens: usage.usageMetadata?.input_tokens,
      outputTokens: usage.usageMetadata?.output_tokens,
    })
    if (!changed) return
    logSnapshot('model-usage')
    broadcast()
  })

  ctx.inject({
    console: { required: true },
  }, (inner) => {
    const console = inner.console
    if (!console) return
    console.addEntry(process.env.KOISHI_BASE ? [
      process.env.KOISHI_BASE + '/dist/index.js',
      process.env.KOISHI_BASE + '/dist/style.css',
    ] : {
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    }, () => {
      logSnapshot('entry')
      return {
        capsule: state.snapshot(),
        debug,
      }
    })
    console.addListener('chat-capsule/webqq/contacts', () => webqq.loadContacts(), consoleAuthOptions)
    console.addListener('chat-capsule/webqq/messages', async (query: WebQQMessageQuery) => {
      const nextQuery = {
        ...query,
        limit: query.limit ?? historyLimit,
      }
      const history = await webqq.loadMessages(nextQuery)
      return mergeWebQQMessages(history, liveMessages.get(getLiveMessageKey(nextQuery)), nextQuery.limit)
    }, consoleAuthOptions)
  })

  ctx.inject({
    chatluna_character: { required: true },
  }, (inner) => {
    const service = inner.chatluna_character
    if (!service) return
    const acquireResponseLock = service.acquireResponseLock
    const releaseResponseLock = service.releaseResponseLock

    // 包裹 character 响应锁以同步胶囊状态，dispose 时恢复原方法。
    service.acquireResponseLock = async (session, message) => {
      const acquired = await acquireResponseLock.call(service, session, message)
      if (acquired) {
        const input = createMessageInput(session, message)
        input.user.name = readMemberName(session) || input.user.name
        recordConversationActivity(state, input, `正在与 ${input.user.name || input.user.id} 对话`)
        logSnapshot('character-lock')
        broadcast()
      }
      return acquired
    }

    service.releaseResponseLock = async (session) => {
      try {
        await releaseResponseLock.call(service, session)
      } finally {
        clearActivity('character-release')
      }
    }

    ctx.on('dispose', () => {
      service.acquireResponseLock = acquireResponseLock
      service.releaseResponseLock = releaseResponseLock
    })
  })

  ctx.on('chatluna_character/message_collect', (session, messages) => {
    recordGenerating(session, messages?.at(-1))
  })
}
