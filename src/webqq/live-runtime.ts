import type { Session } from 'koishi'
import type { Config as PluginConfig } from '../config'
import type { ChatLunaCharacterAfterChatPayload as BaseChatLunaCharacterAfterChatPayload } from '../chatluna/thinking'
import { parseThinkContent, readCharacterAfterChatText } from '../chatluna/thinking'
import type { createOneBotWebQQService, WebQQChatType, WebQQLiveMessage, WebQQMessage, WebQQRecallPayload } from '../onebot'
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

type OneBotWebQQService = ReturnType<typeof createOneBotWebQQService>
type WebQQThinking = NonNullable<WebQQMessage['thinking']>

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
}) {
  const liveMessages = new Map<string, WebQQMessage[]>()
  const pendingWebQQThinking = new Map<string, WebQQThinking>()
  const liveSenderMetadata = new Map<string, WebQQSenderMetadata>()

  const getLiveSenderMetadataKey = (groupId: string, userId: string) => `${groupId}:${userId}`
  const getLiveSenderMetadata = (type: WebQQChatType, peerId: string, userId: string) => {
    return type === 'group' ? liveSenderMetadata.get(getLiveSenderMetadataKey(peerId, userId)) : undefined
  }
  const rememberLiveSenderMetadata = (type: WebQQChatType, peerId: string, userId: string, metadata: WebQQSenderMetadata) => {
    if (type !== 'group' || !hasWebQQSenderMetadata(metadata)) return false
    const key = getLiveSenderMetadataKey(peerId, userId)
    if (isSameWebQQSenderMetadata(liveSenderMetadata.get(key), metadata)) return false
    liveSenderMetadata.set(key, metadata)
    return true
  }
  const broadcastWebQQLivePayload = (payload: WebQQLiveMessage) => {
    const key = getWebQQLiveMessageKey(payload)
    const messages = mergeWebQQLiveMessages(liveMessages.get(key) ?? [], [payload.message], 100)
    liveMessages.set(key, messages)
    options.ctx.console?.broadcast('chat-capsule/webqq/message', payload, options.consoleAuthOptions)
  }
  const broadcastWebQQRecallPayload = (payload: WebQQRecallPayload) => {
    const key = getWebQQLiveMessageKey(payload)
    const messages = applyWebQQRecallToLiveMessages(liveMessages.get(key) ?? [], payload, 100)
    liveMessages.set(key, messages)
    options.ctx.console?.broadcast('chat-capsule/webqq/recall', payload, options.consoleAuthOptions)
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
  const recordWebQQRecall = (session: Session | undefined) => {
    if (!session || (session.bot.platform || session.platform) !== 'onebot') return
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
    broadcastWebQQRecallPayload({
      ...peer,
      messageId,
      mode: markRecalledMessage ? 'mark' : 'remove',
      ...(markRecalledMessage ? {} : { eventMessage }),
    })
  }

  return {
    liveMessages,
    recordWebQQLiveMessage,
    recordWebQQRecall,
    updateLastOutgoingWebQQThinking,
  }
}
