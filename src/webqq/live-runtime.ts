import type { Session } from 'koishi'
import type { Config as PluginConfig } from '../config'
import type { ChatLunaCharacterAfterChatPayload as BaseChatLunaCharacterAfterChatPayload } from './thinking'
import { parseThinkContent, readCharacterAfterChatText } from './thinking'
import type { createOneBotWebQQService } from '../onebot'
import type { WebQQChatType, WebQQLiveMessage, WebQQMessage, WebQQRecallPayload } from './types'
import type { ChatCapsuleContext, DebugLogger } from '../plugin-context'
import { attachWebQQAffinityBadges } from './affinity'
import { applyWebQQRecallToLiveMessages, getWebQQLiveMessageKey, mergeWebQQLiveMessages } from './live-cache'
import { createWebQQLiveMessage } from './live-message'
import type { WebQQImageUrlResolver } from './live-elements'
import {
  readWebQQPeer,
  readWebQQLiveDirection,
  getWebQQUserAvatar,
} from './session'
import {
  readWebQQGroupSenderMetadata,
} from './group-sender-metadata'
import {
  fillWebQQMessageSenderMetadata,
  hasWebQQSenderMetadata,
  isSameWebQQSenderMetadata,
  readWebQQMessageSenderMetadata,
  replaceWebQQMessageSenderMetadata,
  type WebQQSenderMetadata,
} from './sender-metadata'
import {
  loadKoishiWebQQRecalledMessageCache,
  saveKoishiWebQQRecalledMessageCache,
} from './storage'
import { createWebQQNoticeRuntime } from './live-notices'
import { createWebQQReactionRuntime } from './live-reactions'

type OneBotWebQQService = ReturnType<typeof createOneBotWebQQService>
type WebQQThinking = NonNullable<WebQQMessage['thinking']>
const WEBQQ_LIVE_CONVERSATION_LIMIT = 100
const WEBQQ_LIVE_SENDER_METADATA_LIMIT = 1000

export type ChatLunaCharacterAfterChatPayload = BaseChatLunaCharacterAfterChatPayload & { session?: Session }

function readRawRecallMessageId(session: Session) {
  const data = (session.event as { _data?: Record<string, unknown> })._data
  const value = data?.message_id ?? data?.messageId ?? data?.msg_id ?? data?.msgId
  return value == null ? '' : String(value)
}

export function createWebQQLiveRuntime(options: {
  ctx: ChatCapsuleContext
  config: PluginConfig
  webqq: OneBotWebQQService
  imageUrlResolver: WebQQImageUrlResolver
  consoleAuthOptions: { authority: number }
  logger?: DebugLogger
  getThinkingDurationMs: () => number
  getThinkingUsage: () => WebQQThinking['usage'] | undefined
  getStorageScope: () => string | undefined
}) {
  const liveMessages = new Map<string, WebQQMessage[]>()
  const pendingWebQQThinking = new Map<string, WebQQThinking>()
  const liveSenderMetadata = new Map<string, WebQQSenderMetadata>()

  function isSelectedWebQQSession(session: Session) {
    // 多 OneBot 实例会共享同一套 Koishi 事件；模拟 bot 的 selfId 又会映射回源 bot。
    // 因此匹配规则必须由 OneBot WebQQ 服务统一判断，避免真实消息在切到模拟头像后被误过滤。
    return options.webqq.isSelectedSelfId(session.bot.selfId)
  }

  function trimOldestMapEntries<TKey, TValue>(map: Map<TKey, TValue>, limit: number, onEvict?: (key: TKey) => void) {
    while (map.size > limit) {
      const oldestKey = map.keys().next().value
      if (oldestKey == null) break
      map.delete(oldestKey)
      onEvict?.(oldestKey)
    }
  }

  function rememberLiveMessages(key: string, messages: WebQQMessage[]) {
    liveMessages.delete(key)
    liveMessages.set(key, messages)
    trimOldestMapEntries(liveMessages, WEBQQ_LIVE_CONVERSATION_LIMIT, (evictedKey) => {
      pendingWebQQThinking.delete(evictedKey)
    })
  }

  function rememberPendingWebQQThinking(key: string, thinking: WebQQThinking) {
    pendingWebQQThinking.delete(key)
    pendingWebQQThinking.set(key, thinking)
    trimOldestMapEntries(pendingWebQQThinking, WEBQQ_LIVE_CONVERSATION_LIMIT)
  }

  const getLiveSenderMetadataKey = (groupId: string, userId: string) => `${groupId}:${userId}`
  const getLiveSenderMetadata = (type: WebQQChatType, peerId: string, userId: string) => {
    return type === 'group' ? liveSenderMetadata.get(getLiveSenderMetadataKey(peerId, userId)) : undefined
  }
  const rememberLiveSenderMetadata = (type: WebQQChatType, peerId: string, userId: string, metadata: WebQQSenderMetadata) => {
    if (type !== 'group' || !hasWebQQSenderMetadata(metadata)) return false
    const key = getLiveSenderMetadataKey(peerId, userId)
    if (isSameWebQQSenderMetadata(liveSenderMetadata.get(key), metadata)) return false
    liveSenderMetadata.delete(key)
    liveSenderMetadata.set(key, metadata)
    trimOldestMapEntries(liveSenderMetadata, WEBQQ_LIVE_SENDER_METADATA_LIMIT)
    return true
  }
  const broadcastWebQQLivePayload = (payload: WebQQLiveMessage) => {
    const key = getWebQQLiveMessageKey(payload)
    const messages = mergeWebQQLiveMessages(liveMessages.get(key) ?? [], [payload.message], 100)
    rememberLiveMessages(key, messages)
    options.ctx.console?.broadcast('onebot-webqq/webqq/message', payload, options.consoleAuthOptions)
  }
  const broadcastWebQQRecallPayload = (payload: WebQQRecallPayload) => {
    const key = getWebQQLiveMessageKey(payload)
    const messages = applyWebQQRecallToLiveMessages(liveMessages.get(key) ?? [], payload, 100)
    rememberLiveMessages(key, messages)
    options.ctx.console?.broadcast('onebot-webqq/webqq/recall', payload, options.consoleAuthOptions)
    return messages
  }
  const persistMarkedWebQQRecall = async (peer: { type: WebQQChatType; peerId: string }, message: WebQQMessage) => {
    try {
      const cachedMessages = await loadKoishiWebQQRecalledMessageCache(options.ctx, peer, options.getStorageScope())
      await saveKoishiWebQQRecalledMessageCache(options.ctx, options.config, {
        ...peer,
        messages: mergeWebQQLiveMessages(cachedMessages, [{ ...message, recalled: true }]),
      }, options.getStorageScope())
    } catch (error) {
      options.logger?.info('webqq recalled message cache failed %s', error instanceof Error ? error.message : String(error))
    }
  }
  const attachPendingWebQQThinking = (payload: WebQQLiveMessage): WebQQLiveMessage => {
    if (payload.message.direction !== 'outgoing') return payload
    const key = getWebQQLiveMessageKey(payload)
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
  const refreshWebQQLiveSenderMetadata = async (session: Session, payload: WebQQLiveMessage) => {
    if (payload.type !== 'group') return
    let metadata: WebQQSenderMetadata | undefined
    try {
      metadata = await readWebQQGroupSenderMetadata(session, payload.message.senderId, true)
    } catch (error) {
      options.logger?.info('webqq sender metadata refresh failed %s', error instanceof Error ? error.message : String(error))
      return
    }
    if (!metadata) return
    if (!rememberLiveSenderMetadata(payload.type, payload.peerId, payload.message.senderId, metadata)) return
    broadcastWebQQLivePayload({
      ...payload,
      message: replaceWebQQMessageSenderMetadata(payload.message, metadata),
    })
  }
  const recordWebQQLiveMessage = async (session: Session | undefined) => {
    if (!session) return
    if (!isSelectedWebQQSession(session)) return
    const direction = readWebQQLiveDirection(session)
    let payload = await createWebQQLiveMessage(
      session,
      direction,
      async (file, source) => {
        if (source === 'url') {
          const url = options.imageUrlResolver(file) || file
          options.logger?.info('webqq image url %s', JSON.stringify({ direction, url: file, proxyUrl: url }))
          return { url, debug: { url: file } }
        }
        const image = await options.webqq.resolveImage(file)
        options.logger?.info('webqq image %s', JSON.stringify({ direction, file, result: image.debug, url: image.url }))
        return image
      },
      async (id) => options.webqq.resolveQuote(id),
      async (id) => options.webqq.resolveForward(id),
      async (file, source) => {
        if (source === 'url') {
          const url = options.imageUrlResolver(file) || file
          options.logger?.info('webqq record url %s', JSON.stringify({ direction, url: file, proxyUrl: url }))
          return { url, debug: { url: file } }
        }
        const record = await options.webqq.resolveRecord(file)
        options.logger?.info('webqq record %s', JSON.stringify({ direction, file, result: record.debug, url: record.url }))
        return record
      },
    )
    if (!payload) return
    payload = attachPendingWebQQThinking({
      ...payload,
      message: fillWebQQMessageSenderMetadata(
        payload.message,
        getLiveSenderMetadata(payload.type, payload.peerId, payload.message.senderId),
      ),
    })
    const [messageWithAffinity = payload.message] = await attachWebQQAffinityBadges(options.ctx, options.config, [payload.message], options.logger)
    payload = {
      ...payload,
      message: messageWithAffinity,
    }
    rememberLiveSenderMetadata(payload.type, payload.peerId, payload.message.senderId, readWebQQMessageSenderMetadata(payload.message))
    broadcastWebQQLivePayload(payload)
    await refreshWebQQLiveSenderMetadata(session, payload)
  }
  const updateLastOutgoingWebQQThinking = (payload: ChatLunaCharacterAfterChatPayload) => {
    if (!payload.session) return
    if (!isSelectedWebQQSession(payload.session)) return
    const content = parseThinkContent(readCharacterAfterChatText(payload))
    if (!content) return
    const peer = readWebQQPeer(payload.session)
    if (!peer) return
    const key = getWebQQLiveMessageKey(peer)
    const usage = options.getThinkingUsage()
    const thinking = {
      content,
      durationMs: options.getThinkingDurationMs(),
      ...(usage ? {
        usage,
      } : {}),
    }
    const messages = liveMessages.get(key)
    const message = messages?.slice().reverse().find((item) => item.direction === 'outgoing')
    if (!message) {
      rememberPendingWebQQThinking(key, thinking)
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
  const recordWebQQRecall = async (session: Session | undefined) => {
    if (!session || (session.bot.platform || session.platform) !== 'onebot') return
    if (!isSelectedWebQQSession(session)) return
    const peer = readWebQQPeer(session)
    if (!peer) return
    const messageId = session.messageId || session.event.message?.id || readRawRecallMessageId(session)
    if (!messageId) return
    const operatorId = session.operatorId || session.event.operator?.id || session.userId || ''
    const operatorName = session.event.member?.name || session.event.operator?.name || session.event.user?.name || operatorId || '有人'
    const summary = `${operatorName} 撤回了一条消息`
    const markRecalledMessage = options.config.webQQMarkRecalledMessages ?? true
    const eventMessage: WebQQMessage = {
      id: `recall:${peer.type}:${peer.peerId}:${messageId}:${session.timestamp}`,
      sequence: `recall:${messageId}:${session.timestamp}`,
      time: session.timestamp,
      senderId: operatorId,
      senderName: operatorName,
      senderAvatar: getWebQQUserAvatar(operatorId),
      direction: 'incoming',
      summary,
      event: {
        type: 'recall',
        targetMessageId: messageId,
      },
      elements: [{ type: 'unknown', text: summary }],
    }
    const messages = broadcastWebQQRecallPayload({
      ...peer,
      messageId,
      mode: markRecalledMessage ? 'mark' : 'remove',
      ...(markRecalledMessage ? {} : { eventMessage }),
    })
    if (!markRecalledMessage) return
    const recalledMessage = messages.find((message) =>
      (message.id === messageId || message.sequence === messageId) && message.recalled)
    // OneBot 历史接口通常不会再返回已撤回原消息；后端 live cache 也会在 Koishi 重启后丢失。
    // 因此在标记撤回模式下把原消息另存一份显示缓存，历史加载时再合并回来。
    if (recalledMessage) await persistMarkedWebQQRecall(peer, recalledMessage)
  }
  const noticeRuntime = createWebQQNoticeRuntime({ broadcastWebQQLivePayload })
  const reactionRuntime = createWebQQReactionRuntime({
    liveMessages,
    webqq: options.webqq,
    logger: options.logger,
    broadcastWebQQLivePayload,
    rememberLiveMessages,
  })

  return {
    liveMessages,
    recordWebQQLiveMessage,
    recordWebQQNotice: (session: Session | undefined) => {
      if (session && !isSelectedWebQQSession(session)) return
      return noticeRuntime.recordWebQQNotice(session)
    },
    recordWebQQReaction: reactionRuntime.recordWebQQReaction,
    recordWebQQRecall,
    updateLastOutgoingWebQQThinking,
  }
}
