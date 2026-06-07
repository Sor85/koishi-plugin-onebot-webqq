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

// 贴表情事件的 count 是该表情的全量人数，因此直接覆盖；is_add 为 false（取消）
// 或 count 归零时移除该表情，移空后清掉 reactions 字段避免渲染空容器。
export function applyWebQQReactionToLiveMessages(messages: WebQQMessage[], messageId: string, reaction: WebQQMessageReaction, isAdd: boolean) {
  let matched = false
  const nextMessages = messages.map((message) => {
    if (!isMessageTarget(message, messageId)) return message
    matched = true
    const reactions = message.reactions?.slice() ?? []
    const index = reactions.findIndex((item) => item.emojiId === reaction.emojiId)
    if (!isAdd || reaction.count <= 0) {
      if (index >= 0) reactions.splice(index, 1)
    } else if (index >= 0) {
      reactions[index] = { ...reactions[index], label: reaction.label || reactions[index].label, count: reaction.count }
    } else {
      reactions.push(reaction)
    }
    const next: WebQQMessage = { ...message, reactions }
    if (!reactions.length) delete next.reactions
    return next
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
