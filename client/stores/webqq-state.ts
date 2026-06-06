import type { WebQQMessage } from '../state'
import { getChatKey } from '../utils/webqq-contact-view'

export type ConversationSummary = { summary: string; time: number }
export type WebQQChatType = 'friend' | 'group'

export type WebQQStoredState = {
  conversationSummaries: Record<string, ConversationSummary>
  conversationUnreadCounts: Record<string, number>
}

export function setConversationSummary(conversationSummaries: Record<string, ConversationSummary>, type: WebQQChatType, peerId: string, message: WebQQMessage | undefined) {
  if (!message) return conversationSummaries
  return {
    ...conversationSummaries,
    [getChatKey(type, peerId)]: {
      summary: message.summary,
      time: message.time,
    },
  }
}

export function increaseConversationUnreadCount(conversationUnreadCounts: Record<string, number>, type: WebQQChatType, peerId: string) {
  const key = getChatKey(type, peerId)
  return {
    ...conversationUnreadCounts,
    [key]: (conversationUnreadCounts[key] || 0) + 1,
  }
}

export function clearConversationUnreadCount(conversationUnreadCounts: Record<string, number>, type: WebQQChatType, peerId: string) {
  const key = getChatKey(type, peerId)
  if (!conversationUnreadCounts[key]) return conversationUnreadCounts
  const next = { ...conversationUnreadCounts }
  delete next[key]
  return next
}
