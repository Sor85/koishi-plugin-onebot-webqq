import type { Session } from 'koishi'
import * as qface from 'qface'
import type { Config as PluginConfig } from '../config'
import type { ChatLunaCharacterAfterChatPayload as BaseChatLunaCharacterAfterChatPayload } from '../chatluna/thinking'
import { parseThinkContent, readCharacterAfterChatText } from '../chatluna/thinking'
import type { createOneBotWebQQService, WebQQChatType, WebQQLiveMessage, WebQQMessage, WebQQMessageReaction, WebQQRecallPayload } from '../onebot'
import type { WebQQRawReaction } from '../onebot/raw-event'
import type { ChatCapsuleContext, DebugLogger } from '../plugin-context'
import { isRecord, readRecordText } from '../shared/structured-text'
import { attachWebQQAffinityBadges } from './affinity'
import { applyWebQQReactionToLiveMessages, applyWebQQRecallToLiveMessages, getWebQQLiveMessageKey, mergeWebQQLiveMessages } from './live-cache'
import { createWebQQLiveMessage } from './live-message'
import type { WebQQImageUrlResolver } from './live-elements'
import {
  readWebQQPeer,
  readWebQQLiveDirection,
  getWebQQUserAvatar,
} from './session'
import {
  readWebQQGroupMemberName,
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

function readRawEventData(session: Session) {
  const data = (session.event as { _data?: unknown })._data
  return isRecord(data) ? data : {}
}

function readWebQQNoticePeer(session: Session) {
  const groupId = readRecordText(readRawEventData(session), ['group_id', 'groupId'])
  if (groupId) return { type: 'group' as const, peerId: groupId }
  return readWebQQPeer(session)
}

function readSessionUserName(session: Session, fallbackId = '') {
  return session.event.member?.name || session.event.operator?.name || session.event.user?.name || session.username || fallbackId || '有人'
}

async function readWebQQNoticeMemberName(session: Session, userId: string, fallbackName: string, genericName: string) {
  if (userId) {
    try {
      const name = await readWebQQGroupMemberName(session, userId, true)
      if (name) return name
    } catch {}
  }
  return fallbackName && fallbackName !== userId && !/^\d+$/.test(fallbackName) ? fallbackName : genericName
}

function formatMuteDuration(seconds: number) {
  if (!seconds) return ''
  if (seconds % 3600 === 0) return `${seconds / 3600} 小时`
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`
  return `${seconds} 秒`
}

// QQ 表情贴上报的 emoji_id 多为数字 ID，用 qface 转成可读名（如「赞」）；
// 取不到时回退原值（unicode emoji 可直接显示，纯数字 ID 兜底为 [表情]）。
function readWebQQReactionLabel(emojiId: string) {
  const name = qface.get(emojiId)?.QDes?.replace(/^\//, '')
  if (name) return name
  return /^\d+$/.test(emojiId) ? '[表情]' : emojiId
}

function readWebQQReactionEmojiUrl(emojiId: string) {
  return qface.getUrl(emojiId) || ''
}

function createWebQQEventMessage(
  peer: { type: WebQQChatType; peerId: string },
  time: number,
  type: NonNullable<WebQQMessage['event']>['type'],
  summary: string,
  senderId: string,
  senderName: string,
  targetMessageId?: string,
): WebQQMessage {
  return {
    id: `${type}:${peer.type}:${peer.peerId}:${time}:${senderId}:${targetMessageId || ''}`,
    sequence: `${type}:${time}:${targetMessageId || senderId}`,
    time,
    senderId,
    senderName,
    senderAvatar: getWebQQUserAvatar(senderId),
    direction: 'incoming',
    summary,
    event: {
      type,
      ...(targetMessageId ? { targetMessageId } : {}),
    },
    elements: [{ type: 'unknown', text: summary }],
  }
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
  const recordWebQQNotice = async (session: Session | undefined) => {
    if (!session || (session.bot.platform || session.platform) !== 'onebot') return
    const data = readRawEventData(session)
    const noticeType = readRecordText(data, ['notice_type', 'noticeType'])
    const subType = readRecordText(data, ['sub_type', 'subType'])
    if (noticeType !== 'group_ban' && !(noticeType === 'notify' && subType === 'poke')) return
    const peer = readWebQQNoticePeer(session)
    if (!peer) return
    if (noticeType === 'notify' && subType === 'poke') {
      const senderId = readRecordText(data, ['user_id', 'userId', 'sender_id', 'senderId']) || session.userId || session.event.user?.id || ''
      const targetId = readRecordText(data, ['target_id', 'targetId']) || session.event.operator?.id || ''
      const senderName = await readWebQQNoticeMemberName(
        session,
        senderId,
        readRecordText(data, ['sender_nickname', 'senderNickname', 'user_name', 'userName']) || readSessionUserName(session, senderId),
        '某成员',
      )
      const targetName = await readWebQQNoticeMemberName(
        session,
        targetId,
        readRecordText(data, ['target_nickname', 'targetNickname', 'target_name', 'targetName']),
        '对方',
      )
      broadcastWebQQLivePayload({
        ...peer,
        message: createWebQQEventMessage(peer, session.timestamp, 'poke', `${senderName} 戳了戳 ${targetName}`, senderId, readSessionUserName(session, senderId)),
      })
      return
    }
    if (noticeType === 'group_ban') {
      const operatorId = readRecordText(data, ['operator_id', 'operatorId']) || session.operatorId || session.event.operator?.id || ''
      const targetId = readRecordText(data, ['user_id', 'userId', 'target_id', 'targetId']) || session.userId || session.event.user?.id || ''
      const operatorName = await readWebQQNoticeMemberName(
        session,
        operatorId,
        readRecordText(data, ['operator_name', 'operatorName']) || session.event.operator?.name || '',
        '管理员',
      )
      const targetName = await readWebQQNoticeMemberName(
        session,
        targetId,
        readRecordText(data, ['user_name', 'userName', 'target_name', 'targetName']) || session.event.user?.name || '',
        '对方',
      )
      const duration = Number(data.duration) || 0
      const durationText = formatMuteDuration(duration)
      const summary = subType === 'lift_ban'
        ? `${operatorName} 解除了 ${targetName} 的禁言`
        : `${operatorName} 禁言了 ${targetName}${durationText ? ` ${durationText}` : ''}`
      broadcastWebQQLivePayload({
        ...peer,
        message: createWebQQEventMessage(peer, session.timestamp, 'mute', summary, operatorId, readSessionUserName(session, operatorId)),
      })
    }
  }
  const getReactionTargetIds = (reaction: WebQQRawReaction) => {
    return [reaction.messageSeq, reaction.messageId].filter((id, index, array): id is string => !!id && array.indexOf(id) === index)
  }
  const applyWebQQReaction = (messages: WebQQMessage[], targetIds: string[], entry: WebQQMessageReaction, isAdd: boolean) => {
    for (const targetId of targetIds) {
      const nextMessages = applyWebQQReactionToLiveMessages(messages, targetId, entry, isAdd)
      if (!nextMessages) continue
      const message = nextMessages.find((item) => item.id === targetId || item.sequence === targetId)
      if (message) return { messages: nextMessages, message }
    }
  }
  const recordWebQQReaction = async (reaction: WebQQRawReaction) => {
    const peer = { type: 'group' as const, peerId: reaction.groupId }
    const label = readWebQQReactionLabel(reaction.emojiId)
    const emojiUrl = readWebQQReactionEmojiUrl(reaction.emojiId)
    const userAvatar = reaction.userId ? getWebQQUserAvatar(reaction.userId) : ''
    const entry: WebQQMessageReaction = {
      emojiId: reaction.emojiId,
      label,
      ...(emojiUrl ? { emojiUrl } : {}),
      count: reaction.count,
      ...(reaction.userId ? {
        userId: reaction.userId,
        userAvatar,
        users: [{ userId: reaction.userId, userAvatar }],
      } : {}),
    }
    const key = getWebQQLiveMessageKey(peer)
    const targetIds = getReactionTargetIds(reaction)
    const applied = applyWebQQReaction(liveMessages.get(key) ?? [], targetIds, entry, reaction.isAdd)
    if (applied) {
      liveMessages.set(key, applied.messages)
      options.ctx.console?.broadcast('chat-capsule/webqq/message', { ...peer, message: applied.message }, options.consoleAuthOptions)
      return
    }
    // 目标消息可能是前端已加载的历史消息，而不是后端 live cache 中的实时消息。
    // OneBot reaction 只有短 message_id 时，拉一次 get_msg 得到同一条消息和 message_seq，
    // 再广播带 reaction 的原消息，让前端用正常消息合并逻辑更新气泡。
    try {
      const targetMessage = await options.webqq.resolveMessage(reaction.messageId)
      const targetApplied = applyWebQQReaction(
        [targetMessage],
        [...targetIds, targetMessage.id, targetMessage.sequence],
        entry,
        reaction.isAdd,
      )
      if (targetApplied) {
        broadcastWebQQLivePayload({ ...peer, message: targetApplied.message })
      }
      return
    } catch (error) {
      options.logger?.info('webqq reaction target resolve failed %s', error instanceof Error ? error.message : String(error))
    }
    if (!reaction.isAdd) return
    const senderName = reaction.userId || '有人'
    broadcastWebQQLivePayload({
      ...peer,
      message: createWebQQEventMessage(peer, Date.now(), 'reaction', `${senderName} 给一条消息贴了 ${label}`, reaction.userId, senderName, reaction.messageId),
    })
  }

  return {
    liveMessages,
    recordWebQQLiveMessage,
    recordWebQQNotice,
    recordWebQQReaction,
    recordWebQQRecall,
    updateLastOutgoingWebQQThinking,
  }
}
