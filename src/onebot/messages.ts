import {
  getActionData,
  getStringField,
  isRecord,
  toArrayResult,
  toOneBotId,
  toTimestampMs,
} from './data'
import {
  callAction,
  type OneBotBot,
} from './actions'
import { getTextValue, normalizeMentionMarkupText } from './text'
import { normalizeCardElement } from './card'
import {
  getUserAvatar,
  normalizeGroupRole,
} from './display'
import {
  normalizeImageElement,
} from './images'
import {
  normalizeFaceElement,
  summarizeElements,
} from './message-elements'
import type {
  WebQQMessage,
  WebQQMessageElement,
} from './types'

export async function resolveOneBotQuote(bot: OneBotBot, id: string, imageUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
  const item = getActionData(await callAction(bot, 'get_msg', { message_id: toOneBotId(id) }))
  const sender = isRecord(item.sender) ? item.sender : {}
  const elements = await normalizeMessageElements(item.message, bot, imageUrlResolver)
  const title = getStringField(sender, ['nickname', 'card', 'name'])
  return {
    type: 'quote',
    ...(title ? { title } : {}),
    text: summarizeElements(elements),
  }
}

// 不同 OneBot 实现对合并转发详情参数命名不一致，优先标准 id，再兼容 message_id。
async function callForwardMessage(bot: OneBotBot, id: string) {
  try {
    return await callAction(bot, 'get_forward_msg', { id })
  } catch (error) {
    try {
      return await callAction(bot, 'get_forward_msg', { message_id: id })
    } catch {
      throw error
    }
  }
}

function readForwardNodes(result: unknown) {
  const message = toArrayResult(result, 'message')
  if (message.length) return message
  const messages = toArrayResult(result, 'messages')
  if (messages.length) return messages
  return toArrayResult(result, 'nodes')
}

async function normalizeForwardNode(raw: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string) {
  const item = isRecord(raw) ? raw : {}
  const data = isRecord(item.data) ? item.data : item
  const sender = isRecord(data.sender)
    ? data.sender
    : isRecord(item.sender)
      ? item.sender
      : data
  const senderId = getStringField(sender, ['user_id', 'uin', 'uid'])
  const title = getStringField(sender, ['nickname', 'card', 'name', 'senderName', 'sender_name', 'user_id', 'uin'])
  const content = data.content ?? data.message ?? item.message
  const elements = content == null ? [] : await normalizeMessageElements(content, bot, imageUrlResolver)
  const normalizedElements = elements.length ? elements : [{ type: 'unknown' as const, text: '[消息]' }]
  const summary = summarizeElements(normalizedElements) || getTextValue(content) || '[消息]'
  return {
    item: {
      ...(title ? { title } : {}),
      ...(senderId ? { senderId } : {}),
      senderAvatar: senderId ? getUserAvatar(senderId) : getUserAvatar('0'),
      elements: normalizedElements,
    },
    text: title ? `${title}：${summary}` : summary,
  }
}

// 读取合并转发详情并压缩成 WebQQ 可展示的多行摘要。
export async function resolveOneBotForward(bot: OneBotBot, id: string, imageUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
  const nodes = readForwardNodes(await callForwardMessage(bot, id))
  const nodesData = await Promise.all(nodes.map((node) => normalizeForwardNode(node, bot, imageUrlResolver)))
  const lines = nodesData.map((node) => node.text)
  return {
    type: 'forward',
    title: '合并转发',
    text: lines.join('\n') || '[合并转发]',
    items: nodesData.map((node) => node.item),
  }
}

async function normalizeSegment(raw: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
  if (typeof raw === 'string') return { type: 'text', text: normalizeMentionMarkupText(raw) }
  if (!isRecord(raw)) return { type: 'unknown', text: '[消息]' }
  const type = getStringField(raw, ['type'])
  const data = isRecord(raw.data) ? raw.data : raw
  if (type === 'text') return { type: 'text', text: normalizeMentionMarkupText(getStringField(data, ['text', 'content'])) }
  if (type === 'at') {
    const target = getStringField(data, ['name', 'nickname', 'card', 'text', 'qq', 'id', 'user_id', 'uin'])
    return target ? { type: 'text', text: `@${target}` } : { type: 'unknown', text: '[消息]' }
  }
  if (type === 'image') return normalizeImageElement(data, bot, imageUrlResolver)
  if (type === 'mface') {
    if (getStringField(data, ['url', 'src', 'file', 'file_id'])) return normalizeImageElement(data, bot, imageUrlResolver)
    return normalizeFaceElement(data)
  }
  if (type === 'face') return normalizeFaceElement(data)
  if (type === 'reply' || type === 'quote') {
    const id = getStringField(data, ['id', 'message_id', 'messageId'])
    if (id) {
      try {
        return await resolveOneBotQuote(bot, id, imageUrlResolver)
      } catch {
        return { type: 'quote', text: '[引用消息]' }
      }
    }
    const sender = isRecord(data.sender) ? data.sender : data
    const title = getStringField(sender, ['nickname', 'card', 'name', 'senderName', 'sender_name'])
    const inlineElements = data.message != null ? await normalizeMessageElements(data.message, bot, imageUrlResolver) : []
    const text = getTextValue(data.text) || getTextValue(data.content) || getTextValue(data.sourceMsgText) || (inlineElements.length ? summarizeElements(inlineElements) : '')
    return {
      type: 'quote',
      ...(title ? { title } : {}),
      text: text || '[引用消息]',
    }
  }
  if (type === 'forward') {
    const id = getStringField(data, ['id', 'message_id', 'messageId', 'resid'])
    if (!id) return { type: 'forward', title: '合并转发', text: '[合并转发]' }
    try {
      return await resolveOneBotForward(bot, id, imageUrlResolver)
    } catch {
      return { type: 'forward', title: '合并转发', text: '[合并转发]' }
    }
  }
  if (type === 'json' || type === 'lightapp' || type === 'xml') return normalizeCardElement(data)
  if (type === 'file') return { type: 'file', text: getStringField(data, ['name', 'file']) || '[文件]' }
  if (type === 'record') return { type: 'record', text: '[语音]' }
  if (type === 'video') return { type: 'video', text: '[视频]' }
  return { type: 'unknown', text: '[消息]' }
}

export async function normalizeMessageElements(message: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string) {
  if (typeof message === 'string') return [{ type: 'text' as const, text: normalizeMentionMarkupText(message) }]
  if (Array.isArray(message)) return Promise.all(message.map((segment) => normalizeSegment(segment, bot, imageUrlResolver)))
  return [{ type: 'unknown' as const, text: '[消息]' }]
}

export async function normalizeMessage(raw: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string): Promise<WebQQMessage> {
  const item = isRecord(raw) ? raw : {}
  const sender = isRecord(item.sender) ? item.sender : {}
  const senderId = getStringField(sender, ['user_id', 'uin', 'uid']) || getStringField(item, ['user_id'])
  const elements = await normalizeMessageElements(item.message, bot, imageUrlResolver)
  const senderRole = normalizeGroupRole(getStringField(sender, ['role']))
  const senderLevel = getStringField(sender, ['level', 'sender_level', 'senderLevel'])
  const senderTitle = getStringField(sender, ['title', 'special_title', 'specialTitle'])
  return {
    id: getStringField(item, ['message_id', 'msg_id', 'id']),
    sequence: getStringField(item, ['message_seq', 'msg_seq', 'seq', 'message_id']),
    time: toTimestampMs(item.time),
    senderId,
    senderName: getStringField(sender, ['card', 'nickname', 'name']) || senderId,
    senderAvatar: senderId ? getUserAvatar(senderId) : '',
    ...(senderRole ? { senderRole } : {}),
    ...(senderLevel ? { senderLevel } : {}),
    ...(senderTitle ? { senderTitle } : {}),
    direction: senderId && senderId === bot.selfId ? 'outgoing' : 'incoming',
    summary: summarizeElements(elements),
    elements,
  }
}
