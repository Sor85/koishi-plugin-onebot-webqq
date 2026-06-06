import type { Session } from 'koishi'
import { resolve } from 'path'
import type { Entry } from '@koishijs/console'
import type { Config as PluginConfig } from './config'
import {
  parseThinkContent,
  readCharacterAfterChatText,
  type ChatLunaCharacterAfterChatPayload as BaseChatLunaCharacterAfterChatPayload,
} from './chatluna-thinking'
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
import { isRecord, readRecordText } from './structured-text'
import {
  normalizeLiveElements,
  summarizeWebQQElements,
  type WebQQForwardResolver,
  type WebQQImageResolver,
  type WebQQQuoteResolver,
} from './webqq-live-elements'
import { createWebQQImageUrlResolver, type WebQQImageServer } from './webqq-image-url-resolver'
import {
  getWebQQGroupAvatar,
  getWebQQUserAvatar,
  readBotProfile,
  readChannelName,
  readMemberName,
  readUserName,
  readWebQQPeer,
  readWebQQLiveDirection,
} from './webqq-session'
import {
  fillWebQQMessageSenderMetadata,
  hasWebQQSenderMetadata,
  isSameWebQQSenderMetadata,
  readWebQQMessageSenderMetadata,
  readWebQQSenderMetadata,
  replaceWebQQMessageSenderMetadata,
  type WebQQSenderMetadata,
} from './webqq-sender-metadata'

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

type ChatLunaCharacterAfterChatPayload = BaseChatLunaCharacterAfterChatPayload & { session?: Session }

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

function toOneBotId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value
}

function getActionData(result: unknown) {
  const item = isRecord(result) ? result : {}
  return isRecord(item.data) ? item.data : item
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
