import { ref } from 'vue'

export interface CapsuleData {
  bot: {
    platform: string
    selfId: string
    status?: number
    name: string
    avatar?: string
  }
  conversation: {
    channelId: string
    channelName: string
    userId?: string
    userName?: string
    senderRole?: string
    senderLevel?: string
    senderTitle?: string
    activityText?: string
    usage?: {
      inputTokens: number
      outputTokens: number
    }
    thinkingDurationMs?: number
    timestamp: number
  }
  counters: {
    received: number
    sent: number
  }
  bots?: OneBotRobotProfile[]
}

export interface OneBotRobotProfile {
  platform: string
  selfId: string
  status?: number
  name: string
  avatar?: string
}

export interface OneBotRobotState {
  bots: OneBotRobotProfile[]
  selectedSelfId?: string
}

export interface WebQQFriend {
  userId: string
  name: string
  nickname: string
  avatar: string
  categoryId?: string
  categoryName?: string
}

export interface WebQQGroup {
  groupId: string
  name: string
  memberCount: number
  avatar: string
}

export interface WebQQForwardItem {
  title?: string
  senderId?: string
  senderAvatar?: string
  elements: WebQQMessageElement[]
}

export interface WebQQMessageElement {
  type: 'text' | 'image' | 'quote' | 'forward' | 'card' | 'face' | 'file' | 'record' | 'video' | 'unknown'
  title?: string
  text?: string
  targetMessageId?: string
  duration?: number
  transcript?: string
  url?: string
  imageUrl?: string
  source?: string
  items?: WebQQForwardItem[]
}

export interface WebQQMessageReaction {
  emojiId: string
  label: string
  emojiUrl?: string
  count: number
  userId?: string
  userAvatar?: string
  users?: WebQQMessageReactionUser[]
}

export interface WebQQMessageReactionUser {
  userId: string
  userName?: string
  userAvatar: string
}

export interface WebQQMessage {
  id: string
  sequence: string
  time: number
  senderId: string
  senderName: string
  senderAvatar: string
  senderRole?: string
  senderLevel?: string
  senderTitle?: string
  senderAffinity?: number
  senderRelationship?: string
  direction: 'incoming' | 'outgoing'
  summary: string
  recalled?: boolean
  reactions?: WebQQMessageReaction[]
  event?: {
    type: 'recall' | 'poke' | 'mute' | 'reaction'
    targetMessageId?: string
  }
  thinking?: {
    content: string
    durationMs: number
    usage?: {
      inputTokens: number
      outputTokens: number
    }
  }
  elements: WebQQMessageElement[]
}

export interface WebQQLiveMessage {
  type: 'friend' | 'group'
  peerId: string
  message: WebQQMessage
}

export interface WebQQRecallPayload {
  type: 'friend' | 'group'
  peerId: string
  messageId: string
  mode: 'mark' | 'remove'
  eventMessage?: WebQQMessage
}

export interface WebQQNotice {
  id: string
  type: 'friend-request' | 'group-notice'
  title: string
  subtitle: string
  avatar: string
  status: 'pending' | 'approved' | 'rejected'
  time: number
  flag?: string
  subType?: string
  requesterId?: string
  requesterName?: string
  groupId?: string
  groupName?: string
  comment?: string
}

export interface WebQQGroupAnnouncement {
  id: string
  title: string
  content: string
  time?: number
}

export interface WebQQGroupMember {
  userId: string
  nickname: string
  card: string
  avatar: string
  role?: string
}

export interface WebQQGroupInfo {
  announcements: WebQQGroupAnnouncement[]
  members: WebQQGroupMember[]
}

export interface WebQQFriendCategory {
  id: string
  name: string
  friends: WebQQFriend[]
}

export interface WebQQRecentContact {
  type: 'friend' | 'group'
  peerId: string
  name: string
  subtitle: string
  avatar: string
  summary: string
  time: number
}

export type ConversationSummary = { summary: string; time: number }
export type WebQQChatType = 'friend' | 'group'

export type WebQQStoredState = {
  conversationSummaries: Record<string, ConversationSummary>
  conversationUnreadCounts: Record<string, number>
}

const webQQGroupRoleRanks: Record<string, number> = {
  群主: 0,
  管理员: 1,
}

function getWebQQGroupMemberDisplayName(member: WebQQGroupMember) {
  return member.card || member.nickname || member.userId
}

function getWebQQGroupMemberNameRank(member: WebQQGroupMember) {
  const first = getWebQQGroupMemberDisplayName(member).trim()[0] || ''
  if (/^[A-Za-z]$/.test(first)) return 0
  if (/^[0-9\u4e00-\u9fff]$/.test(first)) return 1
  return 2
}

// 按群角色优先级和展示名称排序群成员。
export function sortWebQQGroupMembers(members: WebQQGroupMember[]) {
  return members.slice().sort((left, right) => {
    const roleDiff = (webQQGroupRoleRanks[left.role || ''] ?? 2) - (webQQGroupRoleRanks[right.role || ''] ?? 2)
    if (roleDiff) return roleDiff
    const nameRankDiff = getWebQQGroupMemberNameRank(left) - getWebQQGroupMemberNameRank(right)
    if (nameRankDiff) return nameRankDiff
    const nameDiff = getWebQQGroupMemberDisplayName(left).localeCompare(getWebQQGroupMemberDisplayName(right), 'en', { sensitivity: 'base' })
    if (nameDiff) return nameDiff
    return left.userId.localeCompare(right.userId, 'en', { numeric: true, sensitivity: 'base' })
  })
}

export interface WebQQContacts {
  friends: WebQQFriend[]
  groups: WebQQGroup[]
  friendCategories?: WebQQFriendCategory[]
  recent?: WebQQRecentContact[]
}

export type WebQQTheme = 'fresh' | 'frosted'
export type WebQQChatStyle = 'qq' | 'telegram'
export type WebQQColorMode = 'auto' | 'light' | 'dark'
export type WebQQStorageBackend = 'browser' | 'koishi'

export const capsule = ref<CapsuleData>()
export const availableBots = ref<OneBotRobotProfile[]>([])
export const debug = ref(false)
export const hideWebQQGroupLevel = ref(true)
export const showWebQQAffinity = ref(false)
export const showWebQQCapsuleUnread = ref(true)
export const showWebQQRelationship = ref(false)
export const useBotAvatarThemeColor = ref(false)
export const webQQTotalUnread = ref(0)
export const webQQAccentColor = ref('#2563eb')
export const webQQAvatarAccentColor = ref('')
export const webQQChatStyle = ref<WebQQChatStyle>('telegram')
export const webQQColorMode = ref<WebQQColorMode>('auto')
export const webQQMessageCacheLimit = ref(100)
export const webQQStorageBackend = ref<WebQQStorageBackend>('koishi')
export const webQQTheme = ref<WebQQTheme>('fresh')
export const webQQTimBubbleTail = ref(true)
export const selectedBotSelfId = ref('')

export function resetWebQQClientState() {
  capsule.value = undefined
  availableBots.value = []
  debug.value = false
  hideWebQQGroupLevel.value = true
  showWebQQAffinity.value = false
  showWebQQCapsuleUnread.value = true
  showWebQQRelationship.value = false
  useBotAvatarThemeColor.value = false
  webQQTotalUnread.value = 0
  webQQAccentColor.value = '#2563eb'
  webQQAvatarAccentColor.value = ''
  webQQChatStyle.value = 'telegram'
  webQQColorMode.value = 'auto'
  webQQMessageCacheLimit.value = 100
  webQQStorageBackend.value = 'koishi'
  webQQTheme.value = 'fresh'
  webQQTimBubbleTail.value = true
  selectedBotSelfId.value = ''
}
