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
  emojiUrl?: string
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
  usage?: {
    inputTokens: number
    outputTokens: number
    ttftMs?: number
    totalMs?: number
    tps?: number
  }
  thinking?: {
    content: string
    durationMs: number
    usage?: {
      inputTokens: number
      outputTokens: number
      ttftMs?: number
      totalMs?: number
      tps?: number
    }
  }
  elements: WebQQMessageElement[]
}

export interface WebQQMessageSearchQuery {
  type: WebQQChatType
  peerId: string
  keyword: string
  createdAtStart?: string
  createdAtEnd?: string
  beforeSequence?: string
}

export interface WebQQMessageSearchResult {
  messages: WebQQMessage[]
  scannedCount: number
  exhausted: boolean
  nextBeforeSequence?: string
}

export interface WebQQSendElement {
  type: 'text' | 'image' | 'video' | 'file' | 'quote' | 'at' | 'face'
  text?: string
  data?: string
  name?: string
  userId?: string
  targetMessageId?: string
  faceId?: string
}

export interface WebQQSendPayload {
  type: WebQQChatType
  peerId: string
  elements: WebQQSendElement[]
  /** 回复目标消息 ID；会在 OneBot message 前插入 reply 段。 */
  replyToMessageId?: string
}

export interface WebQQMessageRecallInput {
  type: WebQQChatType
  peerId: string
  messageId: string
}

export interface WebQQMessageReactionInput {
  type: WebQQChatType
  peerId: string
  messageId: string
  emojiId: string
  enabled: boolean
}

export type WebQQFriendAction =
  | { action: 'poke'; targetId: string }
  | { action: 'delete'; targetId: string }
  | { action: 'set-remark'; targetId: string; remark: string }

export type WebQQGroupAction =
  | { action: 'kick'; groupId: string; targetId: string }
  | { action: 'set-admin'; groupId: string; targetId: string; enabled: boolean }
  | { action: 'set-card'; groupId: string; targetId: string; card: string }
  | { action: 'set-title'; groupId: string; targetId: string; title: string }
  | { action: 'set-name'; groupId: string; name: string }
  | { action: 'poke'; groupId: string; targetId: string }
  | { action: 'leave'; groupId: string }

export interface WebQQForwardSendInput {
  type: WebQQChatType
  peerId: string
  messageIds: string[]
}

export interface WebQQProfileQuery {
  userId: string
  groupId?: string
}

export interface WebQQProfileField {
  group: string
  label: string
  value: string
}

/** 资料真实能力模式：只承载协议已返回字段，不伪造默认值。 */
export interface WebQQProfile {
  kind: 'user' | 'bot'
  id: string
  name: string
  avatar: string
  nickname?: string
  remark?: string
  personalNote?: string
  sex?: string
  age?: number
  qid?: string
  level?: string
  groupId?: string
  groupCard?: string
  groupTitle?: string
  groupRole?: string
  rawRole?: 'owner' | 'admin' | 'member'
  fields: WebQQProfileField[]
  /** 仅当前 selected bot 自身，且协议支持 set_qq_profile 时为 true。 */
  canEditSelf?: boolean
  /** 仅当前 selected bot 自身，且协议支持 set_qq_avatar 时为 true。 */
  canEditAvatar?: boolean
}

export interface WebQQSelfProfileUpdate {
  nickname?: string
  personalNote?: string
  sex?: string
  avatar?: string
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
  /** 菜单权限判断使用协议原始角色，避免依赖本地化展示文本。 */
  rawRole?: 'owner' | 'admin' | 'member'
  title?: string
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
  hiddenRecentKeys: string[]
}

export interface WebQQContacts {
  friends: WebQQFriend[]
  groups: WebQQGroup[]
  friendCategories?: WebQQFriendCategory[]
  recent?: WebQQRecentContact[]
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
