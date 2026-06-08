import type { Session } from 'koishi'
import { extname } from 'path'
import type { WebQQMessageElement } from '../onebot'
import { decodeTextEntity, normalizeMentionMarkupText, readMarkupAttribute } from '../onebot/text'
import { isRecord, readRecordText, readStructuredText } from '../shared/structured-text'

function readElementText(value: unknown) {
  return value == null ? '' : String(value)
}

function normalizeLiveQuoteMarkupText(value: string) {
  const source = value.trim()
  if (!source) return ''
  const hasMarkup = /\[CQ:at,[^\]]+\]/i.test(source) ||
    /<(?:[\w-]+:)?(?:msg|at|qqbot-at-user|img|image|mface|file|face|record|audio|video)\b/i.test(source)
  if (!hasMarkup) return normalizeMentionMarkupText(source)

  // 新消息的引用内容可能是 OneBot 适配器塞进 Koishi live element 的 XML 文本；
  // 历史消息会先走 segment 解析。这里在引用边界压成摘要，避免 UI 直接露出 XML。
  const normalizedMedia = source
    .replace(/<(?:[\w-]+:)?(?:img|image|mface)\b[^>]*\/?>/gi, '[图片]')
    .replace(/<(?:[\w-]+:)?file\b[^>]*\/?>/gi, (tag: string) =>
      readMarkupAttribute(tag, ['name', 'file']) || '[文件]')
    .replace(/<(?:[\w-]+:)?(?:record|audio)\b[^>]*\/?>/gi, '[语音]')
    .replace(/<(?:[\w-]+:)?video\b[^>]*\/?>/gi, '[视频]')
    .replace(/<(?:[\w-]+:)?face\b[^>]*\/?>/gi, (tag: string) => {
      const id = readMarkupAttribute(tag, ['id', 'face_id', 'emoji_id'])
      return id ? `[表情 ${id}]` : '[表情]'
    })

  return decodeTextEntity(normalizeMentionMarkupText(normalizedMedia))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

export type WebQQResolvedImage = {
  url: string
  debug?: unknown
}

export type WebQQImageResolver = (file: string, source?: 'url') => Promise<WebQQResolvedImage>
export type WebQQImageUrlResolver = (file: string) => string
export type WebQQQuoteResolver = (id: string) => Promise<WebQQMessageElement>
export type WebQQForwardResolver = (id: string) => Promise<WebQQMessageElement>

export function isRemoteImageSource(file: string) {
  return /^https?:\/\//.test(file)
}

export function getImageContentType(file: string) {
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

function readLiveQuoteText(raw: unknown): string {
  if (typeof raw === 'string') return normalizeLiveQuoteMarkupText(raw)
  if (!isRecord(raw)) return ''
  const type = readElementText(raw.type)
  const attrs = isRecord(raw.attrs) ? raw.attrs : {}
  if (type === 'text') return normalizeLiveQuoteMarkupText(readElementText(attrs.content))
  if (type === 'img' || type === 'image') return '[图片]'
  if (type === 'face') return `[表情 ${readElementText(attrs.id)}]`
  if (Array.isArray(raw.children)) return raw.children.map(readLiveQuoteText).join('').trim()
  return normalizeLiveQuoteMarkupText(readElementText(attrs.content || attrs.text))
}

async function normalizeLiveQuoteField(session: Session, resolveQuote?: WebQQQuoteResolver): Promise<WebQQMessageElement | undefined> {
  const quote = session.quote ?? session.event.message?.quote
  if (!isRecord(quote)) return
  const user = isRecord(quote.user) ? quote.user : undefined
  const member = isRecord(quote.member) ? quote.member : undefined
  const title = (member ? readRecordText(member, ['name', 'nick']) : '') ||
    (user ? readRecordText(user, ['name', 'nick', 'id']) : '')
  const text = normalizeLiveQuoteMarkupText(readStructuredText(quote.content)) ||
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
    const text = normalizeLiveQuoteMarkupText(readElementText(attrs.content || attrs.text || attrs.sourceMsgText)) ||
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

export async function normalizeLiveElements(
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

export function summarizeWebQQElements(elements: WebQQMessageElement[]) {
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
