import type { WebQQForwardItem, WebQQMessage } from '../state'

export type WebQQMessageElement = WebQQMessage['elements'][number]

export type WebQQElementRun =
  | { type: 'inline'; elements: WebQQMessageElement[] }
  | { type: 'block'; element: WebQQMessageElement }

export function getUnreadText(count: number) {
  return count > 9999 ? '9999+' : String(count)
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
