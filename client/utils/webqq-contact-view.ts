import type { WebQQContacts, WebQQGroup } from '../state'
import type { ConversationSummary } from '../stores/webqq-storage'

export type WebQQChatSelection =
  | { type: 'friend'; peerId: string; name: string; subtitle: string; avatar: string }
  | { type: 'group'; peerId: string; name: string; subtitle: string; avatar: string }

export type WebQQRecentItem = WebQQChatSelection & { summary?: string; time?: number }

export function getGroupSubtitle(group: WebQQGroup) {
  return `群聊 ${group.groupId} · ${group.memberCount} 人`
}

export function getChatKey(type: WebQQChatSelection['type'], peerId: string) {
  return `${type}:${peerId}`
}

export function findContactByKey(contacts: WebQQContacts, key: string): WebQQRecentItem | undefined {
  const [type, peerId] = key.split(':', 2)
  if (type === 'friend') {
    const friend = contacts.friends.find((item) => item.userId === peerId)
    if (!friend) return
    return {
      type: 'friend',
      peerId: friend.userId,
      name: friend.name,
      subtitle: friend.nickname,
      avatar: friend.avatar,
    }
  }
  if (type === 'group') {
    const group = contacts.groups.find((item) => item.groupId === peerId)
    if (!group) return
    return {
      type: 'group',
      peerId: group.groupId,
      name: group.name,
      subtitle: getGroupSubtitle(group),
      avatar: group.avatar,
    }
  }
}

export function getRecentItems(contacts: WebQQContacts, conversationSummaries: Record<string, ConversationSummary>) {
  const items = new Map<string, WebQQRecentItem>()
  for (const item of contacts.recent ?? []) {
    items.set(getChatKey(item.type, item.peerId), item)
  }
  for (const [key, summary] of Object.entries(conversationSummaries)) {
    const item = findContactByKey(contacts, key)
    if (!item) continue
    items.set(key, {
      ...item,
      summary: summary.summary,
      time: summary.time,
    })
  }
  return [...items.values()].sort((left, right) => (right.time || 0) - (left.time || 0))
}

export function getContactSummary(conversationSummaries: Record<string, ConversationSummary>, type: WebQQChatSelection['type'], peerId: string) {
  return conversationSummaries[getChatKey(type, peerId)]
}

export function getContactSubtitle(conversationSummaries: Record<string, ConversationSummary>, type: WebQQChatSelection['type'], peerId: string, fallback: string) {
  return getContactSummary(conversationSummaries, type, peerId)?.summary || fallback
}

export function getContactTime(conversationSummaries: Record<string, ConversationSummary>, type: WebQQChatSelection['type'], peerId: string, fallback = 0) {
  return getContactSummary(conversationSummaries, type, peerId)?.time || fallback
}

export function getUnreadCount(conversationUnreadCounts: Record<string, number>, type: WebQQChatSelection['type'], peerId: string) {
  return conversationUnreadCounts[getChatKey(type, peerId)] || 0
}
