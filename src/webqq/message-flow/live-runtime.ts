import type { Session } from 'koishi'
import { isVisibleBotSession } from '../../onebot/session'
import type { Config as PluginConfig } from '../../config'
import { readConfigValue } from '../../config/spec'
import type { ChatLunaCharacterAfterChatPayload as BaseChatLunaCharacterAfterChatPayload } from '../thinking'
import { parseThinkContent, readCharacterAfterChatText } from '../thinking'
import type { WebQQService } from '../adapters/types'
import type { WebQQChatType, WebQQLiveMessage, WebQQMessage, WebQQRecallPayload } from '../types'
import type { ChatCapsuleContext, ChatLunaModelUsage, DebugLogger } from '../../plugin-context'
import { attachWebQQAffinityBadges } from '../affinity'
import { applyWebQQRecallToLiveMessages, getWebQQLiveMessageKey, mergeWebQQLiveMessages } from './live-cache'
import { createWebQQLiveMessage } from './live-message'
import type { WebQQImageUrlResolver } from '../media/image-url-resolver'
import {
  readWebQQPeer,
  readWebQQLiveDirection,
} from './session'
import { getWebQQUserAvatar } from '../display'
import {
  readWebQQGroupSenderMetadata,
} from '../adapters/onebot/group-sender-metadata'
import {
  fillWebQQMessageSenderMetadata,
  hasWebQQSenderMetadata,
  isSameWebQQSenderMetadata,
  readWebQQMessageSenderMetadata,
  replaceWebQQMessageSenderMetadata,
  type WebQQSenderMetadata,
} from '../sender/sender-metadata'
import {
  loadKoishiWebQQRecalledMessageCache,
  saveKoishiWebQQRecalledMessageCache,
} from '../storage/recall-cache'
import { createWebQQNoticeRuntime } from './live-notices'
import { createWebQQReactionRuntime } from './live-reactions'

type WebQQThinking = NonNullable<WebQQMessage['thinking']>
type WebQQUsage = NonNullable<WebQQMessage['usage']>
const WEBQQ_LIVE_CONVERSATION_LIMIT = 100
const WEBQQ_LIVE_SENDER_METADATA_LIMIT = 1000
const visibleUsageSources = new Set(['chatluna', 'chatluna-character', 'character'])

export type ChatLunaCharacterAfterChatPayload = BaseChatLunaCharacterAfterChatPayload & { session?: Session }
export type WebQQLiveRuntime = ReturnType<typeof createWebQQLiveRuntime>

function readRawRecallMessageId(session: Session) {
  const data = (session.event as { _data?: Record<string, unknown> })._data
  const value = data?.message_id ?? data?.messageId ?? data?.msg_id ?? data?.msgId
  return value == null ? '' : String(value)
}

function shouldDisplayModelUsage(usage: ChatLunaModelUsage) {
  return visibleUsageSources.has(usage.source || '')
}

export function createWebQQLiveRuntime(options: {
  ctx: ChatCapsuleContext
  config: PluginConfig
  webqq: WebQQService
  imageUrlResolver: WebQQImageUrlResolver
  consoleAuthOptions: { authority: number }
  logger?: DebugLogger
  getThinkingDurationMs: () => number
  getStorageScope: () => string | undefined
}) {
  const liveMessages = new Map<string, WebQQMessage[]>()
  const pendingWebQQThinking = new Map<string, WebQQThinking>()
  const liveSenderMetadata = new Map<string, WebQQSenderMetadata>()
  let currentUsageConversationId: string | undefined
  let currentUsageSource: string | undefined
  let currentUsage: WebQQUsage | undefined
  let currentUsageActive = false

  function isSelectedWebQQSession(session: Session) {
    // 多 OneBot 实例会共享同一套 Koishi 事件；模拟 bot 的 selfId 又会映射回源 bot。
    // 因此匹配规则必须由 OneBot WebQQ 服务统一判断，避免真实消息在切到模拟头像后被误过滤。
    return isVisibleBotSession(session) && options.webqq.isSelectedSelfId(session.bot.selfId)
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

  function resetCurrentWebQQUsage() {
    currentUsageConversationId = undefined
    currentUsageSource = undefined
    currentUsage = undefined
    currentUsageActive = false
  }

  function rememberCurrentWebQQUsage(usage: ChatLunaModelUsage) {
    if (!currentUsageActive) return false
    if (!shouldDisplayModelUsage(usage)) return false
    const conversationId = usage.context?.conversationId
    if (
      conversationId &&
      currentUsageConversationId &&
      conversationId !== currentUsageConversationId
    ) {
      return false
    }
    if (
      usage.usageMetadata?.input_tokens == null &&
      usage.usageMetadata?.output_tokens == null &&
      usage.timing?.ttftMs == null &&
      usage.timing?.totalMs == null &&
      usage.timing?.tps == null
    ) return false
    currentUsageSource = usage.source
    currentUsage = {
      inputTokens: usage.usageMetadata?.input_tokens ?? currentUsage?.inputTokens ?? 0,
      outputTokens: usage.usageMetadata?.output_tokens ?? currentUsage?.outputTokens ?? 0,
      ...(usage.timing?.ttftMs != null || currentUsage?.ttftMs != null ? {
        ttftMs: usage.timing?.ttftMs ?? currentUsage?.ttftMs,
      } : {}),
      ...(usage.timing?.totalMs != null || currentUsage?.totalMs != null ? {
        totalMs: usage.timing?.totalMs ?? currentUsage?.totalMs,
      } : {}),
      ...(usage.timing?.tps != null || currentUsage?.tps != null ? {
        tps: usage.timing?.tps ?? currentUsage?.tps,
      } : {}),
    }
    return true
  }

  function consumeCurrentWebQQUsage() {
    const usage = currentUsage
    resetCurrentWebQQUsage()
    return usage
  }

  function attachCurrentWebQQUsage(message: WebQQMessage): WebQQMessage {
    if (message.direction !== 'outgoing' || message.thinking?.content || message.usage) return message
    if (readConfigValue(options.config, 'showWebQQCharacterThinking') && (currentUsageSource === 'chatluna-character' || currentUsageSource === 'character')) return message
    const usage = consumeCurrentWebQQUsage()
    return usage ? { ...message, usage } : message
  }

  function withoutWebQQUsage(message: WebQQMessage): WebQQMessage {
    if (!message.usage) return message
    const next = { ...message }
    delete next.usage
    return next
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
    payload = {
      ...payload,
      message: attachCurrentWebQQUsage(payload.message),
    }
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
    const usage = consumeCurrentWebQQUsage()
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
        ...withoutWebQQUsage(message),
        thinking,
      },
    })
  }
  options.ctx.on('chatluna/before-chat', (conversationId, _message, _variables, _chatInterface, session) => {
    resetCurrentWebQQUsage()
    if (!session || !isSelectedWebQQSession(session)) return
    currentUsageConversationId = conversationId
    currentUsageActive = true
  })
  options.ctx.on('chatluna_character/message_collect', (session) => {
    resetCurrentWebQQUsage()
    if (!session || !isSelectedWebQQSession(session)) return
    currentUsageActive = true
  })
  options.ctx.on('chatluna/model-usage', (usage) => {
    rememberCurrentWebQQUsage(usage)
  })
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
    const markRecalledMessage = readConfigValue(options.config, 'webQQMarkRecalledMessages')
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
