import type { Session } from 'koishi'
import { resolve } from 'path'
import { createReadStream } from 'fs'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import type { Entry } from '@koishijs/console'
import type { Config as PluginConfig } from './config'
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
  WebQQChatType,
  WebQQContacts,
  WebQQGroupInfo,
  WebQQGroupInfoQuery,
  WebQQLiveMessage,
  WebQQMessage,
  WebQQMessageElement,
  WebQQMessageQuery,
  WebQQNotice,
  WebQQNoticeAction,
} from './onebot'
import {
  chatCapsuleStorageTable,
  loadKoishiWebQQMessageCache,
  loadWebQQStorage,
  saveKoishiWebQQMessageCache,
  saveWebQQStorage,
} from './webqq-storage'
import type {
  ChatCapsuleStorageRow,
  WebQQMessageCachePayload,
  WebQQMessageCacheQuery,
  WebQQStoredState,
} from './webqq-storage'
import { attachWebQQAffinityBadges } from './webqq-affinity'

export { Config } from './config'

export const name = 'onebot-webqq'

// 声明控制台为可选服务，缺失时只保留后端状态监听。
export const inject = {
  optional: ['console', 'server', 'database', 'chatluna', 'chatluna_character'],
}

declare module '@koishijs/console' {
  interface Events {
    'chat-capsule/update'(data: CapsuleSnapshot | undefined): void
    'chat-capsule/webqq/message'(data: WebQQLiveMessage): void
    'chat-capsule/webqq/contacts'(): Promise<WebQQContacts>
    'chat-capsule/webqq/group-info'(query: WebQQGroupInfoQuery): Promise<WebQQGroupInfo>
    'chat-capsule/webqq/messages'(query: WebQQMessageQuery): Promise<WebQQMessage[]>
    'chat-capsule/webqq/notices'(): Promise<WebQQNotice[]>
    'chat-capsule/webqq/notice-action'(action: WebQQNoticeAction): Promise<void>
    'chat-capsule/webqq/storage/load'(): Promise<WebQQStoredState>
    'chat-capsule/webqq/storage/save'(state: WebQQStoredState): Promise<void>
    'chat-capsule/webqq/messages/cache/load'(query: WebQQMessageCacheQuery): Promise<WebQQMessage[]>
    'chat-capsule/webqq/messages/cache/save'(payload: WebQQMessageCachePayload): Promise<void>
  }
}

declare module 'koishi' {
  interface Tables {
    onebot_webqq_storage: ChatCapsuleStorageRow
  }
}

interface ConsoleService {
  addEntry(files: Entry.Files, data?: () => unknown): unknown
  addListener(event: string, callback: (...args: any[]) => unknown, options?: { authority?: number }): unknown
  broadcast(type: string, body: unknown, options?: { authority?: number }): unknown
}

interface ModelService {
  extend(table: string, fields: Record<string, string>, options?: { primary?: string }): unknown
}

interface DatabaseService {
  get(table: string, query: Record<string, unknown>): Promise<unknown[]>
  upsert(table: string, rows: unknown[]): Promise<unknown>
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
  source?: string
  context?: {
    conversationId?: string
  }
  usageMetadata?: {
    input_tokens?: number
    output_tokens?: number
  }
}

interface ChatLunaCharacterAfterChatPayload {
  session?: Session
  lastResponseMessage?: unknown
  completionMessages?: unknown
  text?: unknown
}

interface WebQQSenderMetadata {
  senderRole?: string
  senderLevel?: string
  senderTitle?: string
}

const visibleUsageSources = new Set(['chatluna', 'chatluna-character', 'character'])

function shouldDisplayModelUsage(usage: ChatLunaModelUsage) {
  return visibleUsageSources.has(usage.source || '')
}

// 描述插件运行所需的最小 Koishi 上下文能力。
export interface ChatCapsuleContext {
  console?: ConsoleService
  server?: WebQQImageServer
  database?: DatabaseService
  model?: ModelService
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
  const senderMetadata = readWebQQLiveSenderMetadata(session)
  return {
    bot: readBotProfile(session),
    channel: {
      id: session.channelId || session.event.channel?.id || 'unknown',
      name: readChannelName(session),
    },
    user: {
      id: message?.id || session.userId || session.event.user?.id || 'unknown',
      name: message?.name || readUserName(session),
      ...senderMetadata,
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

function readRecordText(source: unknown, keys: string[]) {
  if (!isRecord(source)) return ''
  for (const key of keys) {
    const value = source[key]
    if (value != null && String(value).trim()) return String(value)
  }
  return ''
}

function readStructuredText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(readStructuredText).join('')
  if (!isRecord(value)) return ''
  if (value.content !== undefined && value.content !== value) return readStructuredText(value.content)
  if (value.text !== undefined) return readStructuredText(value.text)
  if (Array.isArray(value.children)) return readStructuredText(value.children)
  if (isRecord(value.attrs)) return readRecordText(value.attrs, ['content', 'text'])
  if (isRecord(value.kwargs)) return readStructuredText(value.kwargs)
  if (isRecord(value.lc_kwargs)) return readStructuredText(value.lc_kwargs)
  return ''
}

function parseJsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value
  if (typeof value !== 'string') return
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function readCardMeta(payload: Record<string, unknown>) {
  const meta = isRecord(payload.meta) ? payload.meta : undefined
  if (!meta) return undefined
  const view = readRecordText(payload, ['view'])
  if (view && isRecord(meta[view])) return meta[view]
  return Object.values(meta).find(isRecord)
}

function normalizeCardElement(attrs: Record<string, unknown>): WebQQMessageElement {
  const payload = parseJsonRecord(attrs.data) ||
    parseJsonRecord(attrs.content) ||
    parseJsonRecord(attrs.json) ||
    parseJsonRecord(attrs)
  const meta = payload ? readCardMeta(payload) : undefined
  const card = meta ?? payload ?? attrs
  const title = readRecordText(card, ['title']) ||
    (payload ? readRecordText(payload, ['title', 'prompt']) : '') ||
    '卡片消息'
  const text = readRecordText(card, ['desc', 'summary', 'content']) ||
    (payload ? readRecordText(payload, ['desc', 'prompt']) : '') ||
    '[卡片消息]'
  const url = readRecordText(card, ['jumpUrl', 'jump_url', 'url', 'source_url'])
  const imageUrl = readRecordText(card, ['preview', 'image', 'imageUrl', 'image_url', 'picUrl', 'pic_url', 'icon', 'source_icon'])
  const source = readRecordText(card, ['tag', 'source', 'app'])
  return {
    type: 'card',
    title,
    text,
    ...(url ? { url } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(source ? { source } : {}),
  }
}

function normalizeLiveFaceElement(attrs: Record<string, unknown>) {
  const summary = readRecordText(attrs, ['summary', 'text', 'name'])
  if (summary) return { type: 'face' as const, text: summary }
  const id = readRecordText(attrs, ['emoji_id', 'emojiId', 'id'])
  return { type: 'face' as const, text: id ? `[表情 ${id}]` : '[表情]' }
}

async function normalizeLiveImageElement(attrs: Record<string, unknown>, resolveImage?: WebQQImageResolver): Promise<WebQQMessageElement> {
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

function isAssistantMessageSnapshot(value: unknown) {
  if (!isRecord(value)) return false
  const role = String(value.role ?? value.type ?? '').trim().toLowerCase()
  if (role === 'assistant' || role === 'ai') return true
  const id = Array.isArray(value.id) ? value.id.map(String).join(':').toLowerCase() : ''
  return id.includes('aimessage') || id.includes('assistantmessage')
}

function readCompletionMessagesText(value: unknown) {
  if (!Array.isArray(value)) return ''
  for (let index = value.length - 1; index >= 0; index--) {
    const message = value[index]
    if (!isAssistantMessageSnapshot(message)) continue
    const text = readStructuredText(message)
    if (text) return text
  }
  return ''
}

function readCharacterAfterChatText(payload: ChatLunaCharacterAfterChatPayload) {
  return readStructuredText(payload.lastResponseMessage)
    || readStructuredText(payload.text)
    || readCompletionMessagesText(payload.completionMessages)
}

// 提取 character 回复中的 <think> 标签内容，用于展示已完成的角色思考。
function parseThinkContent(text: string) {
  const thoughts = Array.from(text.matchAll(/<think\b[^>]*>([\s\S]*?)<\/think\s*>/gi))
    .map((match) => (match[1] ?? '').trim())
    .filter(Boolean)
  return thoughts.join('\n\n')
}

function normalizeGroupRole(role: string) {
  if (role === 'owner') return '群主'
  if (role === 'admin' || role === 'administrator') return '管理员'
  return ''
}

function toOneBotId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value
}

function getActionData(result: unknown) {
  const item = isRecord(result) ? result : {}
  return isRecord(item.data) ? item.data : item
}

function readWebQQSenderMetadata(source: unknown): WebQQSenderMetadata {
  const role = normalizeGroupRole(readRecordText(source, ['role']))
  const level = readRecordText(source, ['level', 'sender_level', 'senderLevel'])
  const title = readRecordText(source, ['title', 'special_title', 'specialTitle'])
  return {
    ...(role ? { senderRole: role } : {}),
    ...(level ? { senderLevel: level } : {}),
    ...(title ? { senderTitle: title } : {}),
  }
}

function hasWebQQSenderMetadata(metadata: WebQQSenderMetadata) {
  return !!(metadata.senderRole || metadata.senderLevel || metadata.senderTitle)
}

function readWebQQMessageSenderMetadata(message: WebQQMessage): WebQQSenderMetadata {
  return {
    ...(message.senderRole ? { senderRole: message.senderRole } : {}),
    ...(message.senderLevel ? { senderLevel: message.senderLevel } : {}),
    ...(message.senderTitle ? { senderTitle: message.senderTitle } : {}),
  }
}

function isSameWebQQSenderMetadata(left: WebQQSenderMetadata | undefined, right: WebQQSenderMetadata) {
  return !!left &&
    left.senderRole === right.senderRole &&
    left.senderLevel === right.senderLevel &&
    left.senderTitle === right.senderTitle
}

function fillWebQQMessageSenderMetadata(message: WebQQMessage, metadata?: WebQQSenderMetadata) {
  if (!metadata) return message
  return {
    ...message,
    ...(!message.senderRole && metadata.senderRole ? { senderRole: metadata.senderRole } : {}),
    ...(!message.senderLevel && metadata.senderLevel ? { senderLevel: metadata.senderLevel } : {}),
    ...(!message.senderTitle && metadata.senderTitle ? { senderTitle: metadata.senderTitle } : {}),
  }
}

function replaceWebQQMessageSenderMetadata(message: WebQQMessage, metadata: WebQQSenderMetadata) {
  const { senderRole: _senderRole, senderLevel: _senderLevel, senderTitle: _senderTitle, ...next } = message
  return {
    ...next,
    ...metadata,
  }
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

async function normalizeLiveQuoteField(session: Session, resolveQuote?: WebQQQuoteResolver): Promise<WebQQMessageElement | undefined> {
  const quote = session.quote ?? session.event.message?.quote
  if (!isRecord(quote)) return
  const user = isRecord(quote.user) ? quote.user : undefined
  const member = isRecord(quote.member) ? quote.member : undefined
  const title = (member ? readRecordText(member, ['name', 'nick']) : '') ||
    (user ? readRecordText(user, ['name', 'nick', 'id']) : '')
  const text = readStructuredText(quote.content).trim() ||
    (Array.isArray(quote.elements) ? quote.elements.map(readLiveQuoteText).join('').trim() : '')
  const id = readRecordText(quote, ['id', 'messageId', 'message_id'])
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

type WebQQResolvedImage = {
  url: string
  debug?: unknown
}

type WebQQImageResolver = (file: string, source?: 'url') => Promise<WebQQResolvedImage>
type WebQQImageUrlResolver = (file: string) => string
type WebQQQuoteResolver = (id: string) => Promise<WebQQMessageElement>
type WebQQForwardResolver = (id: string) => Promise<WebQQMessageElement>

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

async function normalizeLiveElement(
  raw: unknown,
  resolveImage?: WebQQImageResolver,
  resolveQuote?: WebQQQuoteResolver,
  resolveForward?: WebQQForwardResolver,
): Promise<WebQQMessageElement | undefined> {
  if (typeof raw === 'string') return { type: 'text', text: raw }
  if (!isRecord(raw)) return undefined
  const type = readElementText(raw.type)
  const attrs = isRecord(raw.attrs) ? raw.attrs : {}
  if (type === 'text') return { type: 'text', text: readElementText(attrs.content) }
  if (type === 'at') {
    const target = readRecordText(attrs, ['name', 'nickname', 'card', 'text', 'content', 'id', 'qq', 'user_id', 'uin'])
    return target ? { type: 'text', text: `@${target}` } : { type: 'unknown', text: '[消息]' }
  }
  if (type === 'quote' || type === 'reply') {
    const title = readElementText(attrs.name || attrs.nickname || attrs.senderName || attrs.sender_name)
    const text = readElementText(attrs.content || attrs.text || attrs.sourceMsgText) ||
      (Array.isArray(attrs.message) ? attrs.message.map(readLiveQuoteText).join('').trim() : '') ||
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
  if (type === 'img' || type === 'image') return normalizeLiveImageElement(attrs, resolveImage)
  if (type === 'forward') {
    const id = readElementText(attrs.id || attrs.messageId || attrs.message_id || attrs.resid)
    if (!id) return { type: 'forward', title: '合并转发', text: '[合并转发]' }
    if (resolveForward) {
      try {
        return await resolveForward(id)
      } catch {
        return { type: 'forward', title: '合并转发', text: '[合并转发]' }
      }
    }
    return { type: 'forward', title: '合并转发', text: '[合并转发]' }
  }
  if (type === 'json' || type === 'lightapp' || type === 'xml') return normalizeCardElement(attrs)
  if (type === 'mface') {
    if (readRecordText(attrs, ['src', 'url', 'file', 'file_id'])) return normalizeLiveImageElement(attrs, resolveImage)
    return normalizeLiveFaceElement(attrs)
  }
  if (type === 'face') return normalizeLiveFaceElement(attrs)
  if (type === 'file') return { type: 'file', text: readElementText(attrs.name || attrs.file) || '[文件]' }
  if (type === 'audio' || type === 'record') return { type: 'record', text: '[语音]' }
  if (type === 'video') return { type: 'video', text: '[视频]' }
  return { type: 'unknown', text: '[消息]' }
}

async function normalizeLiveElements(
  session: Session,
  resolveImage?: WebQQImageResolver,
  resolveQuote?: WebQQQuoteResolver,
  resolveForward?: WebQQForwardResolver,
): Promise<WebQQMessageElement[]> {
  const quote = await normalizeLiveQuoteField(session, resolveQuote)
  const elements = (await Promise.all((session.elements ?? session.event.message?.elements ?? [])
    .map((element) => normalizeLiveElement(element, resolveImage, resolveQuote, resolveForward))))
    .filter((element): element is WebQQMessageElement => !!element)
  if (quote) elements.unshift(quote)
  if (elements.length) return elements
  const content = session.content?.trim()
  return content ? [{ type: 'text', text: content }] : [{ type: 'unknown', text: '[消息]' }]
}

function summarizeWebQQElements(elements: WebQQMessageElement[]) {
  const summary = elements.map((element) => {
    if (element.type === 'text') return element.text
    if (element.type === 'image') return '[图片]'
    if (element.type === 'quote') return ''
    if (element.type === 'forward') return '[合并转发]'
    if (element.type === 'card') return element.title && element.title !== '卡片消息' ? element.title : element.text || '[卡片消息]'
    if (element.type === 'face') return element.text || '[表情]'
    return element.text || '[消息]'
  }).filter(Boolean).join('').replace(/\s+/g, ' ').trim()
  return summary || '[消息]'
}

function getWebQQUserAvatar(userId: string) {
  return userId ? `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640` : ''
}

function getWebQQGroupAvatar(groupId: string) {
  return groupId ? `https://p.qlogo.cn/gh/${groupId}/${groupId}/640/` : ''
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

function readWebQQLiveSenderMetadata(session: Session) {
  return readWebQQSenderMetadata(session.event.member)
}

async function readWebQQGroupSenderMetadata(session: Session, userId: string, noCache: boolean): Promise<WebQQSenderMetadata | undefined> {
  if ((session.bot.platform || session.platform) !== 'onebot') return
  const groupId = session.channelId || session.guildId || session.event.channel?.id || session.event.guild?.id
  if (!groupId || !userId || !isRecord(session.bot)) return
  const internal = isRecord(session.bot.internal) ? session.bot.internal : undefined
  if (!internal) return
  const params = {
    group_id: toOneBotId(groupId),
    user_id: toOneBotId(userId),
    no_cache: noCache,
  }
  let result: unknown
  if (typeof internal.get_group_member_info === 'function') {
    result = await internal.get_group_member_info(params)
  } else if (typeof internal._request === 'function') {
    result = await internal._request('get_group_member_info', params)
  } else {
    return
  }
  const metadata = readWebQQSenderMetadata(getActionData(result))
  return hasWebQQSenderMetadata(metadata) ? metadata : undefined
}

async function readWebQQBotGroupSenderMetadata(session: Session): Promise<WebQQSenderMetadata | undefined> {
  const userId = session.bot.selfId || session.selfId
  if (!userId) return
  return readWebQQGroupSenderMetadata(session, userId, false)
}

function createWebQQFriendRequestNotice(session: Session): WebQQNotice | undefined {
  if ((session.bot.platform || session.platform) !== 'onebot') return
  const raw = isRecord(session.event) && isRecord(session.event._data) ? session.event._data : {}
  const requesterId = session.userId || session.event.user?.id
  const requesterName = readUserName(session) || requesterId
  if (!requesterId && !requesterName) return
  const flag = readRecordText(raw, ['flag', 'request_id', 'requestId'])
  const comment = readRecordText(raw, ['comment', 'message', 'reason'])
  const id = flag || requesterId || String(session.timestamp)
  return {
    id: `friend:${id}`,
    type: 'friend-request',
    title: requesterName || '好友申请',
    subtitle: requesterId ? `来自 QQ ${requesterId}` : '新的好友申请',
    avatar: getWebQQUserAvatar(requesterId || ''),
    status: 'pending',
    time: session.timestamp,
    ...(flag ? { flag } : {}),
    ...(requesterId ? { requesterId } : {}),
    ...(requesterName ? { requesterName } : {}),
    ...(comment ? { comment } : {}),
  }
}

function createWebQQGroupLeaveNotice(session: Session): WebQQNotice | undefined {
  if ((session.bot.platform || session.platform) !== 'onebot') return
  const groupId = session.channelId || session.guildId || session.event.channel?.id || session.event.guild?.id
  const groupName = session.event.guild?.name || session.event.channel?.name || groupId
  const requesterId = session.userId || session.event.user?.id
  const requesterName = readUserName(session) || requesterId
  if (!groupId) return
  return {
    id: `group:leave:${groupId}:${requesterId || 'unknown'}:${session.timestamp}`,
    type: 'group-notice',
    title: groupName || '群通知',
    subtitle: requesterName ? `${requesterName} 退出群聊` : '成员退出群聊',
    avatar: getWebQQGroupAvatar(groupId),
    status: 'approved',
    time: session.timestamp,
    subType: 'leave',
    groupId,
    ...(groupName ? { groupName } : {}),
    ...(requesterId ? { requesterId } : {}),
    ...(requesterName ? { requesterName } : {}),
  }
}

async function createWebQQLiveMessage(
  session: Session,
  direction: WebQQMessage['direction'],
  resolveImage?: WebQQImageResolver,
  resolveQuote?: WebQQQuoteResolver,
  resolveForward?: WebQQForwardResolver,
): Promise<WebQQLiveMessage | undefined> {
  if ((session.bot.platform || session.platform) !== 'onebot') return
  const peer = readWebQQPeer(session)
  if (!peer) return
  if (!(session.elements ?? session.event.message?.elements)?.length && !session.quote && !session.event.message?.quote && !session.content?.trim()) return
  const bot = readBotProfile(session)
  const elements = await normalizeLiveElements(session, resolveImage, resolveQuote, resolveForward)
  const senderId = direction === 'outgoing'
    ? bot.selfId
    : session.userId || session.event.user?.id || 'unknown'
  const senderName = direction === 'outgoing'
    ? readMemberName(session) || bot.name || '机器人'
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
      ...readWebQQLiveSenderMetadata(session),
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
export function apply(ctx: ChatCapsuleContext, config: PluginConfig = {}) {
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
  const pendingWebQQThinking = new Map<string, NonNullable<WebQQMessage['thinking']>>()
  const liveSenderMetadata = new Map<string, WebQQSenderMetadata>()
  const friendRequestNotices = new Map<string, WebQQNotice>()
  const groupLeaveNotices = new Map<string, WebQQNotice>()
  let currentThinkingStartedAt: number | undefined

  ctx.model?.extend(chatCapsuleStorageTable, {
    id: 'string(128)',
    payload: 'object',
    updatedAt: 'timestamp',
  }, {
    primary: 'id',
  })

  const getLiveMessageKey = (query: WebQQMessageQuery) => `${query.type}:${query.peerId}`
  const getLiveSenderMetadataKey = (groupId: string, userId: string) => `${groupId}:${userId}`
  const getLiveSenderMetadata = (type: WebQQChatType, peerId: string, userId: string) => {
    return type === 'group' ? liveSenderMetadata.get(getLiveSenderMetadataKey(peerId, userId)) : undefined
  }
  // 记录 live 消息路径里最新的群成员身份缓存。
  const rememberLiveSenderMetadata = (type: WebQQChatType, peerId: string, userId: string, metadata: WebQQSenderMetadata) => {
    if (type !== 'group' || !hasWebQQSenderMetadata(metadata)) return false
    const key = getLiveSenderMetadataKey(peerId, userId)
    if (isSameWebQQSenderMetadata(liveSenderMetadata.get(key), metadata)) return false
    liveSenderMetadata.set(key, metadata)
    return true
  }
  // 写入 live 消息缓存并推送给 WebQQ 前端。
  const broadcastWebQQLivePayload = (payload: WebQQLiveMessage) => {
    const key = getLiveMessageKey(payload)
    const messages = mergeWebQQMessages(liveMessages.get(key) ?? [], [payload.message], 100)
    liveMessages.set(key, messages)
    ctx.console?.broadcast('chat-capsule/webqq/message', payload, consoleAuthOptions)
  }
  const attachPendingWebQQThinking = (payload: WebQQLiveMessage): WebQQLiveMessage => {
    if (payload.message.direction !== 'outgoing') return payload
    const key = getLiveMessageKey(payload)
    const thinking = pendingWebQQThinking.get(key)
    if (!thinking) return payload
    pendingWebQQThinking.delete(key)
    return {
      ...payload,
      message: {
        ...payload.message,
        thinking,
      },
    }
  }
  // 每条群 live 消息后台刷新发送者群身份，变化时用同 id 消息覆盖。
  const refreshWebQQLiveSenderMetadata = async (session: Session, payload: WebQQLiveMessage) => {
    if (payload.type !== 'group') return
    let metadata: WebQQSenderMetadata | undefined
    try {
      metadata = await readWebQQGroupSenderMetadata(session, payload.message.senderId, true)
    } catch (error) {
      logger?.info('webqq sender metadata refresh failed %s', error instanceof Error ? error.message : String(error))
      return
    }
    if (!metadata) return
    if (!rememberLiveSenderMetadata(payload.type, payload.peerId, payload.message.senderId, metadata)) return
    broadcastWebQQLivePayload({
      ...payload,
      message: replaceWebQQMessageSenderMetadata(payload.message, metadata),
    })
  }
  const recordWebQQLiveMessage = async (session: Session | undefined, direction: WebQQMessage['direction']) => {
    if (!session) return
    let payload = await createWebQQLiveMessage(
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
      async (id) => webqq.resolveForward(id),
    )
    if (!payload) return
    payload = attachPendingWebQQThinking({
      ...payload,
      message: fillWebQQMessageSenderMetadata(
        payload.message,
        getLiveSenderMetadata(payload.type, payload.peerId, payload.message.senderId),
      ),
    })
    const [messageWithAffinity = payload.message] = await attachWebQQAffinityBadges(ctx, config, [payload.message], logger)
    payload = {
      ...payload,
      message: messageWithAffinity,
    }
    rememberLiveSenderMetadata(payload.type, payload.peerId, payload.message.senderId, readWebQQMessageSenderMetadata(payload.message))
    broadcastWebQQLivePayload(payload)
    await refreshWebQQLiveSenderMetadata(session, payload)
  }
  const recordGenerating = async (session: Session, message?: ChatLunaMessage, conversationId?: string) => {
    const thinkingStartedAt = Date.now()
    currentThinkingStartedAt = thinkingStartedAt
    const input = createMessageInput(session, message)
    input.user.name = readMemberName(session) || input.user.name
    recordConversationActivity(state, input, '正在思考', { conversationId, now: thinkingStartedAt })
    logSnapshot('generating')
    broadcast()
    const botSenderMetadata = await readWebQQBotGroupSenderMetadata(session)
    if (!botSenderMetadata) return
    recordConversationActivity(state, {
      ...input,
      user: {
        ...input.user,
        ...botSenderMetadata,
      },
    }, '正在思考', { conversationId, now: thinkingStartedAt })
    logSnapshot('generating-metadata')
    broadcast()
  }
  const clearActivity = (source: string) => {
    clearConversationActivity(state)
    currentThinkingStartedAt = undefined
    logSnapshot(source)
    broadcast()
  }
  const getCurrentThinkingDurationMs = () => {
    return currentThinkingStartedAt == null ? 0 : Math.max(0, Date.now() - currentThinkingStartedAt)
  }
  const updateLastOutgoingWebQQThinking = (payload: ChatLunaCharacterAfterChatPayload) => {
    if (!payload.session) return
    const content = parseThinkContent(readCharacterAfterChatText(payload))
    if (!content) return
    const peer = readWebQQPeer(payload.session)
    if (!peer) return
    const key = getLiveMessageKey(peer)
    const usage = state.snapshot()?.conversation.usage
    const thinking = {
      content,
      durationMs: getCurrentThinkingDurationMs(),
      ...(usage ? {
        usage,
      } : {}),
    }
    const messages = liveMessages.get(key)
    const message = messages?.slice().reverse().find((item) => item.direction === 'outgoing')
    if (!message) {
      pendingWebQQThinking.set(key, thinking)
      return
    }
    pendingWebQQThinking.delete(key)
    broadcastWebQQLivePayload({
      ...peer,
      message: {
        ...message,
        thinking,
      },
    })
  }

  ctx.on('message', async (session) => {
    recordIncomingMessage(state, createMessageInput(session))
    logSnapshot('message')
    broadcast()
    await recordWebQQLiveMessage(session, readWebQQLiveDirection(session))
  })

  ctx.on('friend-request', (session) => {
    const notice = createWebQQFriendRequestNotice(session)
    if (!notice) return
    friendRequestNotices.set(notice.id, notice)
  })

  ctx.on('guild-member-removed', (session) => {
    const notice = createWebQQGroupLeaveNotice(session)
    if (!notice) return
    groupLeaveNotices.set(notice.id, notice)
  })

  ctx.on('chatluna/before-chat', async (conversationId, message, _variables, _chatInterface, session) => {
    await recordGenerating(session, message, conversationId)
  })

  ctx.on('chatluna/after-chat', () => {
    clearActivity('after-chat')
  })

  ctx.on('chatluna/after-chat-error', () => {
    clearActivity('after-chat-error')
  })

  ctx.on('chatluna_character/after-chat', (payload: ChatLunaCharacterAfterChatPayload) => {
    updateLastOutgoingWebQQThinking(payload)
  })

  ctx.before('send', async (session) => {
    recordOutgoingMessage(state)
    logSnapshot('send')
    broadcast()
  })

  ctx.on('chatluna/model-usage', (usage: ChatLunaModelUsage) => {
    if (!shouldDisplayModelUsage(usage)) return
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
    database: { required: false },
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
        webQQTheme: config.webQQTheme ?? 'fresh',
        webQQChatStyle: config.webQQChatStyle ?? 'qq',
        webQQColorMode: config.webQQColorMode ?? 'auto',
        webQQAccentColor: config.webQQAccentColor ?? '#2563eb',
        useBotAvatarThemeColor: config.useBotAvatarThemeColor ?? false,
        hideWebQQGroupLevel: config.hideWebQQGroupLevel ?? false,
        showWebQQAffinity: config.showWebQQAffinity ?? false,
        showWebQQRelationship: config.showWebQQRelationship ?? false,
        showWebQQCapsuleUnread: config.showWebQQCapsuleUnread ?? true,
        webQQStorageBackend: config.webQQStorageBackend ?? 'browser',
      }
    })
    console.addListener('chat-capsule/webqq/contacts', () => webqq.loadContacts(), consoleAuthOptions)
    console.addListener('chat-capsule/webqq/messages', async (query: WebQQMessageQuery) => {
      const nextQuery = {
        ...query,
        limit: query.limit ?? historyLimit,
      }
      const history = await webqq.loadMessages(nextQuery)
      return attachWebQQAffinityBadges(inner, config, mergeWebQQMessages(history, liveMessages.get(getLiveMessageKey(nextQuery)), nextQuery.limit), logger)
    }, consoleAuthOptions)
    console.addListener('chat-capsule/webqq/group-info', (query: WebQQGroupInfoQuery) => {
      return webqq.loadGroupInfo(query)
    }, consoleAuthOptions)
    console.addListener('chat-capsule/webqq/notices', () => {
      return webqq.loadNotices([...friendRequestNotices.values(), ...groupLeaveNotices.values()])
    }, consoleAuthOptions)
    console.addListener('chat-capsule/webqq/notice-action', async (action: WebQQNoticeAction) => {
      await webqq.handleNotice(action)
      if (action.type !== 'friend-request') return
      const notice = friendRequestNotices.get(action.id)
      if (!notice) return
      friendRequestNotices.set(action.id, {
        ...notice,
        status: action.approve ? 'approved' : 'rejected',
      })
    }, consoleAuthOptions)
    console.addListener('chat-capsule/webqq/storage/load', () => {
      return loadWebQQStorage(inner, config)
    }, consoleAuthOptions)
    console.addListener('chat-capsule/webqq/storage/save', (state: WebQQStoredState) => {
      return saveWebQQStorage(inner, config, state)
    }, consoleAuthOptions)
    console.addListener('chat-capsule/webqq/messages/cache/load', (query: WebQQMessageCacheQuery) => {
      return loadKoishiWebQQMessageCache(inner, config, query)
    }, consoleAuthOptions)
    console.addListener('chat-capsule/webqq/messages/cache/save', (payload: WebQQMessageCachePayload) => {
      return saveKoishiWebQQMessageCache(inner, config, payload)
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

  ctx.on('chatluna_character/message_collect', async (session, messages) => {
    await recordGenerating(session, messages?.at(-1))
  })
}
