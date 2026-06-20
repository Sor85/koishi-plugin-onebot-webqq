import type { Config } from '../../config'
import { isRecord } from '../../shared/record'
import type { WebQQChatType, WebQQMessage, WebQQMessageElement, WebQQMessageReaction, WebQQMessageReactionUser } from '../types'
import { chatCapsuleStorageTable, getWebQQDatabase, type WebQQStorageContext } from './schema'
import { getWebQQMessageStorageId } from './scope'

export interface WebQQMessageCacheQuery {
  type: WebQQChatType
  peerId: string
}

export interface WebQQMessageCachePayload extends WebQQMessageCacheQuery {
  messages: WebQQMessage[]
}

export const defaultWebQQMessageCacheLimit = 100

function readStringField(source: Record<string, unknown>, key: string) {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

function readNumberField(source: Record<string, unknown>, key: string) {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readBooleanField(source: Record<string, unknown>, key: string) {
  const value = source[key]
  return typeof value === 'boolean' ? value : undefined
}

function readWebQQMessageDirection(value: unknown): WebQQMessage['direction'] | undefined {
  if (value === 'incoming') return 'incoming'
  if (value === 'outgoing') return 'outgoing'
  return undefined
}

function readWebQQMessageElementType(value: unknown): WebQQMessageElement['type'] | undefined {
  if (value === 'text') return 'text'
  if (value === 'image') return 'image'
  if (value === 'quote') return 'quote'
  if (value === 'forward') return 'forward'
  if (value === 'card') return 'card'
  if (value === 'face') return 'face'
  if (value === 'file') return 'file'
  if (value === 'record') return 'record'
  if (value === 'video') return 'video'
  if (value === 'unknown') return 'unknown'
  return undefined
}

function readWebQQMessageEventType(value: unknown): NonNullable<WebQQMessage['event']>['type'] | undefined {
  if (value === 'recall') return 'recall'
  if (value === 'poke') return 'poke'
  if (value === 'mute') return 'mute'
  if (value === 'reaction') return 'reaction'
  return undefined
}

function readArray<T>(value: unknown, read: (item: unknown) => T | undefined) {
  if (!Array.isArray(value)) return []
  return value.map(read).filter((item): item is T => item !== undefined)
}

function readWebQQForwardItem(value: unknown): NonNullable<WebQQMessageElement['items']>[number] | undefined {
  if (!isRecord(value)) return
  return {
    ...(readStringField(value, 'title') != null ? { title: readStringField(value, 'title') } : {}),
    ...(readStringField(value, 'senderId') != null ? { senderId: readStringField(value, 'senderId') } : {}),
    ...(readStringField(value, 'senderAvatar') != null ? { senderAvatar: readStringField(value, 'senderAvatar') } : {}),
    elements: readArray(value.elements, readWebQQMessageElement),
  }
}

function readWebQQMessageElement(value: unknown): WebQQMessageElement | undefined {
  if (!isRecord(value)) return
  const type = readWebQQMessageElementType(value.type)
  if (!type) return
  const element: WebQQMessageElement = { type }
  const title = readStringField(value, 'title')
  const text = readStringField(value, 'text')
  const targetMessageId = readStringField(value, 'targetMessageId')
  const duration = readNumberField(value, 'duration')
  const transcript = readStringField(value, 'transcript')
  const url = readStringField(value, 'url')
  const imageUrl = readStringField(value, 'imageUrl')
  const source = readStringField(value, 'source')
  const items = readArray(value.items, readWebQQForwardItem)
  if (title != null) element.title = title
  if (text != null) element.text = text
  if (targetMessageId != null) element.targetMessageId = targetMessageId
  if (duration != null) element.duration = duration
  if (transcript != null) element.transcript = transcript
  if (url != null) element.url = url
  if (imageUrl != null) element.imageUrl = imageUrl
  if (source != null) element.source = source
  if (items.length) element.items = items
  return element
}

function readWebQQMessageReactionUser(value: unknown): WebQQMessageReactionUser | undefined {
  if (!isRecord(value)) return
  const userId = readStringField(value, 'userId')
  const userAvatar = readStringField(value, 'userAvatar')
  if (userId == null || userAvatar == null) return
  return {
    userId,
    ...(readStringField(value, 'userName') != null ? { userName: readStringField(value, 'userName') } : {}),
    userAvatar,
  }
}

function readWebQQMessageReaction(value: unknown): WebQQMessageReaction | undefined {
  if (!isRecord(value)) return
  const emojiId = readStringField(value, 'emojiId')
  const label = readStringField(value, 'label')
  const count = readNumberField(value, 'count')
  if (emojiId == null || label == null || count == null) return
  const reaction: WebQQMessageReaction = { emojiId, label, count }
  const emojiUrl = readStringField(value, 'emojiUrl')
  const userId = readStringField(value, 'userId')
  const userAvatar = readStringField(value, 'userAvatar')
  const users = readArray(value.users, readWebQQMessageReactionUser)
  if (emojiUrl != null) reaction.emojiUrl = emojiUrl
  if (userId != null) reaction.userId = userId
  if (userAvatar != null) reaction.userAvatar = userAvatar
  if (users.length) reaction.users = users
  return reaction
}

function readWebQQStoredMessage(value: unknown): WebQQMessage | undefined {
  if (!isRecord(value)) return
  const id = readStringField(value, 'id')
  const sequence = readStringField(value, 'sequence')
  const time = readNumberField(value, 'time')
  const senderId = readStringField(value, 'senderId')
  const senderName = readStringField(value, 'senderName')
  const senderAvatar = readStringField(value, 'senderAvatar')
  const direction = readWebQQMessageDirection(value.direction)
  const summary = readStringField(value, 'summary')
  if (
    id == null ||
    sequence == null ||
    time == null ||
    senderId == null ||
    senderName == null ||
    senderAvatar == null ||
    !direction ||
    summary == null ||
    !Array.isArray(value.elements)
  ) return
  const message: WebQQMessage = {
    id,
    sequence,
    time,
    senderId,
    senderName,
    senderAvatar,
    direction,
    summary,
    elements: readArray(value.elements, readWebQQMessageElement),
  }
  const senderRole = readStringField(value, 'senderRole')
  const senderLevel = readStringField(value, 'senderLevel')
  const senderTitle = readStringField(value, 'senderTitle')
  const senderAffinity = readNumberField(value, 'senderAffinity')
  const senderRelationship = readStringField(value, 'senderRelationship')
  const recalled = readBooleanField(value, 'recalled')
  const reactions = readArray(value.reactions, readWebQQMessageReaction)
  if (senderRole != null) message.senderRole = senderRole
  if (senderLevel != null) message.senderLevel = senderLevel
  if (senderTitle != null) message.senderTitle = senderTitle
  if (senderAffinity != null) message.senderAffinity = senderAffinity
  if (senderRelationship != null) message.senderRelationship = senderRelationship
  if (recalled != null) message.recalled = recalled
  if (reactions.length) message.reactions = reactions
  if (isRecord(value.event)) {
    const eventType = readWebQQMessageEventType(value.event.type)
    if (eventType) {
      const targetMessageId = readStringField(value.event, 'targetMessageId')
      message.event = {
        type: eventType,
        ...(targetMessageId != null ? { targetMessageId } : {}),
      }
    }
  }
  if (isRecord(value.thinking)) {
    const content = readStringField(value.thinking, 'content')
    const durationMs = readNumberField(value.thinking, 'durationMs')
    if (content != null && durationMs != null) {
      const inputTokens = isRecord(value.thinking.usage) ? readNumberField(value.thinking.usage, 'inputTokens') : undefined
      const outputTokens = isRecord(value.thinking.usage) ? readNumberField(value.thinking.usage, 'outputTokens') : undefined
      message.thinking = {
        content,
        durationMs,
        ...(inputTokens != null && outputTokens != null ? { usage: { inputTokens, outputTokens } } : {}),
      }
    }
  }
  return message
}

export function readWebQQStoredMessages(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.messages)) return []
  return readArray(value.messages, readWebQQStoredMessage)
}

export async function loadKoishiWebQQMessageCache(ctx: WebQQStorageContext, config: Config, query: WebQQMessageCacheQuery, scopeId?: string) {
  if (config.webQQStorageBackend !== 'koishi') return []
  const database = getWebQQDatabase(ctx)
  const [row] = await database.get(chatCapsuleStorageTable, { id: getWebQQMessageStorageId(query, scopeId) })
  return readWebQQStoredMessages(isRecord(row) ? row.payload : undefined)
}

export async function saveKoishiWebQQMessageCache(ctx: WebQQStorageContext, config: Config, payload: WebQQMessageCachePayload, scopeId?: string) {
  if (config.webQQStorageBackend !== 'koishi') return
  const database = getWebQQDatabase(ctx)
  const messageCacheLimit = config.webQQMessageCacheLimit ?? defaultWebQQMessageCacheLimit
  const messages = payload.messages.slice(-messageCacheLimit)
  await database.upsert(chatCapsuleStorageTable, [{
    id: getWebQQMessageStorageId(payload, scopeId),
    payload: { messages },
    updatedAt: new Date(),
  }])
}
