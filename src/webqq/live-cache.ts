import type { WebQQMessage, WebQQMessageQuery, WebQQMessageReaction, WebQQRecallPayload } from '../onebot'

type WebQQLiveMessageKeyInput = Pick<WebQQMessageQuery, 'type' | 'peerId'>

export function getWebQQLiveMessageKey(query: WebQQLiveMessageKeyInput) {
  return `${query.type}:${query.peerId}`
}

function getMessageKey(message: WebQQMessage) {
  return message.id || message.sequence || `${message.senderId}:${message.time}:${message.summary}`
}

function isMessageTarget(message: WebQQMessage, messageId: string) {
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

export function applyWebQQReactionToLiveMessages(messages: WebQQMessage[], messageId: string, reaction: WebQQMessageReaction) {
  let matched = false
  const nextMessages = messages.map((message) => {
    if (!isMessageTarget(message, messageId)) return message
    matched = true
    const reactions = message.reactions?.slice() ?? []
    const index = reactions.findIndex((item) => item.emojiId === reaction.emojiId)
    if (index >= 0) {
      reactions[index] = {
        ...reactions[index],
        label: reaction.label || reactions[index].label,
        count: reactions[index].count + reaction.count,
      }
    } else {
      reactions.push(reaction)
    }
    return { ...message, reactions }
  })
  return matched ? nextMessages : undefined
}

export function applyWebQQRecallToLiveMessages(messages: WebQQMessage[], payload: WebQQRecallPayload, limit?: number) {
  if (payload.mode === 'mark') {
    return messages.map((message) => isMessageTarget(message, payload.messageId)
      ? { ...message, recalled: true }
      : message)
  }
  const nextMessages = messages.filter((message) => !isMessageTarget(message, payload.messageId))
  return payload.eventMessage
    ? mergeWebQQLiveMessages(nextMessages, [payload.eventMessage], limit)
    : nextMessages
}
