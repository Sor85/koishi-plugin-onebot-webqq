import type { WebQQForwardItem, WebQQGroupMember, WebQQMessage } from '../state'

export type WebQQMessageElement = WebQQMessage['elements'][number]

export type WebQQElementRun =
  | { type: 'inline'; elements: WebQQMessageElement[] }
  | { type: 'block'; element: WebQQMessageElement }

export type WebQQThinkingMessage = WebQQMessage & { thinking: NonNullable<WebQQMessage['thinking']> }

export function getUnreadText(count: number) {
  return count > 9999 ? '9999+' : String(count)
}

export function getMessageKey(message: WebQQMessage) {
  return message.id || message.sequence || `${message.senderId}:${message.time}:${message.summary}`
}

export function mergeWebQQMessage(current: WebQQMessage | undefined, next: WebQQMessage) {
  if (!current) return next
  if (!next.thinking && !current.thinking) return { ...current, ...next }
  return {
    ...current,
    ...next,
    thinking: next.thinking || current.thinking,
  }
}

export function mergeMessages(currentMessages: WebQQMessage[], nextMessages: WebQQMessage[]) {
  const merged = new Map(currentMessages.map((item) => [getMessageKey(item), item]))
  for (const message of nextMessages) {
    const key = getMessageKey(message)
    merged.set(key, mergeWebQQMessage(merged.get(key), message))
  }
  return [...merged.values()].sort((a, b) => a.time - b.time)
}

export function isSameOutgoingClusterMessage(left: WebQQMessage | undefined, right: WebQQMessage | undefined) {
  return !!left &&
    !!right &&
    left.direction === 'outgoing' &&
    right.direction === 'outgoing' &&
    left.senderId === right.senderId
}

export function getLastOutgoingClusterThinkingMessage(messages: WebQQMessage[], index: number): WebQQThinkingMessage | undefined {
  const message = messages[index]
  if (!message || message.direction !== 'outgoing') return
  if (isSameOutgoingClusterMessage(message, messages[index + 1])) return
  for (let cursor = index; cursor >= 0; cursor--) {
    const candidate = messages[cursor]
    if (!candidate) break
    if (!isSameOutgoingClusterMessage(message, candidate)) break
    if (candidate.thinking?.content) return {
      ...candidate,
      thinking: candidate.thinking,
    }
  }
}

export function hasOutgoingMessageAfter(messages: WebQQMessage[], timestamp: number) {
  return messages.some((message) => message.direction === 'outgoing' && message.time >= timestamp)
}

export function formatThinkingDuration(durationMs: number) {
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  return `已思考 ${seconds}s`
}

export function isInlineWebQQElement(element: WebQQMessageElement) {
  return element.type !== 'quote' && element.type !== 'image' && element.type !== 'forward' && element.type !== 'card'
}

export function getWebQQElementRuns(elements: WebQQMessageElement[]) {
  const runs: WebQQElementRun[] = []
  for (const element of elements) {
    if (!isInlineWebQQElement(element)) {
      runs.push({ type: 'block', element })
      continue
    }
    const last = runs.at(-1)
    if (last?.type === 'inline') {
      last.elements.push(element)
    } else {
      runs.push({ type: 'inline', elements: [element] })
    }
  }
  return runs
}

export function getForwardPreviewText(item: WebQQForwardItem) {
  return item.elements.map((element) => {
    if (element.type === 'text') return element.text
    if (element.type === 'image') return '[图片]'
    if (element.type === 'quote') return element.text || '[引用消息]'
    if (element.type === 'forward') return '[合并转发]'
    if (element.type === 'card') return element.title || element.text || '[卡片消息]'
    if (element.type === 'face') return element.text || '[表情]'
    return element.text || '[消息]'
  }).filter(Boolean).join('') || '[消息]'
}

export function isImageOnlyMessage(message: WebQQMessage) {
  return message.elements.length === 1 &&
    message.elements[0].type === 'image' &&
    !!message.elements[0].url
}

export function getForwardItemName(item: WebQQForwardItem) {
  return item.title || item.senderId || 'QQ 用户'
}

export function getForwardItemAvatar(item: WebQQForwardItem, defaultAvatar: string) {
  return item.senderAvatar || defaultAvatar
}

export function getForwardPreviewItems(element: WebQQMessageElement, limit: number) {
  return element.items?.slice(0, limit) ?? []
}

function getForwardItemSenderKey(item: WebQQForwardItem | undefined) {
  return item ? item.senderId || item.title || '' : ''
}

function isSameForwardItemSender(left: WebQQForwardItem | undefined, right: WebQQForwardItem | undefined) {
  const leftKey = getForwardItemSenderKey(left)
  return !!leftKey && leftKey === getForwardItemSenderKey(right)
}

export function isMergedForwardItem(items: WebQQForwardItem[], index: number, chatStyle: string) {
  return chatStyle === 'telegram' &&
    isSameForwardItemSender(items[index - 1], items[index])
}

export function getForwardItemClusterClass(items: WebQQForwardItem[], index: number, chatStyle: string) {
  if (chatStyle !== 'telegram') return ''
  const hasPrevious = isSameForwardItemSender(items[index - 1], items[index])
  const hasNext = isSameForwardItemSender(items[index], items[index + 1])
  if (hasPrevious && hasNext) return 'is-cluster-middle'
  if (hasNext) return 'is-cluster-first'
  if (hasPrevious) return 'is-cluster-last'
  return ''
}

function getClusterBubbleMessage(messages: WebQQMessage[], index: number, step: 1 | -1) {
  const message = messages[index]
  if (!message) return
  for (let cursor = index + step; cursor >= 0 && cursor < messages.length; cursor += step) {
    const candidate = messages[cursor]
    if (
      !candidate ||
      candidate.senderId !== message.senderId ||
      candidate.direction !== message.direction
    ) return
    if (!isImageOnlyMessage(candidate)) return candidate
  }
}

export function isMergedMessage(messages: WebQQMessage[], index: number, chatStyle: string) {
  if (chatStyle !== 'telegram') return false
  const message = messages[index]
  const previous = messages[index - 1]
  return !!message &&
    !!previous &&
    previous.senderId === message.senderId &&
    previous.direction === message.direction
}

export function getMessageClusterClass(messages: WebQQMessage[], index: number, chatStyle: string) {
  if (chatStyle !== 'telegram') return ''
  const message = messages[index]
  if (!message) return ''
  const hasPrevious = !!getClusterBubbleMessage(messages, index, -1)
  const hasNext = !!getClusterBubbleMessage(messages, index, 1)
  if (hasPrevious && hasNext) return 'is-cluster-middle'
  if (hasNext) return 'is-cluster-first'
  if (hasPrevious) return 'is-cluster-last'
  return ''
}

export function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatListTime(timestamp: number) {
  return formatTime(timestamp)
}

function padNoticeTimePart(value: number) {
  return String(value).padStart(2, '0')
}

export function formatNoticeTime(timestamp: number) {
  const date = new Date(timestamp)
  const month = padNoticeTimePart(date.getMonth() + 1)
  const day = padNoticeTimePart(date.getDate())
  const hour = padNoticeTimePart(date.getHours())
  const minute = padNoticeTimePart(date.getMinutes())
  return `${month}/${day} ${hour}:${minute}`
}

export function formatSenderLevel(level: string) {
  return level.startsWith('Lv.') ? level : `Lv.${level}`
}

export function getGroupMemberName(member: WebQQGroupMember) {
  return member.card || member.nickname || member.userId
}

export function getSenderAuthorityText(message: WebQQMessage) {
  return message.senderTitle || message.senderRole || ''
}

export function getSenderAuthorityClass(message: WebQQMessage) {
  if (message.senderRole === '群主') return 'is-owner'
  if (message.senderRole === '管理员') return 'is-admin'
  return 'is-title'
}
