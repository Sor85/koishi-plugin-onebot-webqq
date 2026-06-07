import type { WebQQMessage, WebQQMessageQuery } from '../onebot'

type WebQQLiveMessageKeyInput = Pick<WebQQMessageQuery, 'type' | 'peerId'>

export function getWebQQLiveMessageKey(query: WebQQLiveMessageKeyInput) {
  return `${query.type}:${query.peerId}`
}

function getMessageKey(message: WebQQMessage) {
  return message.id || message.sequence || `${message.senderId}:${message.time}:${message.summary}`
}

export function mergeWebQQLiveMessages(history: WebQQMessage[], live: WebQQMessage[] = [], limit?: number) {
  const messages = new Map<string, WebQQMessage>()
  for (const message of [...history, ...live]) {
    messages.set(getMessageKey(message), message)
  }
  const merged = [...messages.values()].sort((a, b) => a.time - b.time)
  return limit ? merged.slice(-limit) : merged
}
