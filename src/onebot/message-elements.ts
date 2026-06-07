import type { WebQQMessageElement } from './types'
import { getStringField } from './data'

export function normalizeFaceElement(data: Record<string, unknown>): WebQQMessageElement {
  const summary = getStringField(data, ['summary', 'text', 'name'])
  if (summary) return { type: 'face', text: summary }
  const id = getStringField(data, ['emoji_id', 'emojiId', 'id'])
  return { type: 'face', text: id ? `[表情 ${id}]` : '[表情]' }
}

export function summarizeElements(elements: WebQQMessageElement[]) {
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
