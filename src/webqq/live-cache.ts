import type { WebQQMessage, WebQQMessageQuery, WebQQRecallPayload } from '../onebot'

type WebQQLiveMessageKeyInput = Pick<WebQQMessageQuery, 'type' | 'peerId'>

export function getWebQQLiveMessageKey(query: WebQQLiveMessageKeyInput) {
  return `${query.type}:${query.peerId}`
}

function getMessageKey(message: WebQQMessage) {
  return message.id || message.sequence || `${message.senderId}:${message.time}:${message.summary}`
}

function isRecallTarget(message: WebQQMessage, messageId: string) {
  return message.id === messageId || message.sequence === messageId
}

export function mergeWebQQLiveMessages(history: WebQQMessage[], live: WebQQMessage[] = [], limit?: number) {
  const messages = new Map<string, WebQQMessage>()
  for (const message of [...history, ...live]) {
    messages.set(getMessageKey(message), message)
  }
  const merged = [...messages.values()].sort((a, b) => a.time - b.time)
  return limit ? merged.slice(-limit) : merged
}

export function applyWebQQRecallToLiveMessages(messages: WebQQMessage[], payload: WebQQRecallPayload, limit?: number) {
  if (payload.mode === 'mark') {
    return messages.map((message) => isRecallTarget(message, payload.messageId)
      ? { ...message, recalled: true }
      : message)
  }
  const nextMessages = messages.filter((message) => !isRecallTarget(message, payload.messageId))
  return payload.eventMessage
    ? mergeWebQQLiveMessages(nextMessages, [payload.eventMessage], limit)
    : nextMessages
}
