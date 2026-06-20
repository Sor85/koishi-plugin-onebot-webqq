import {
  getActionData,
  getStringField,
  isRecord,
  toArrayResult,
  toOneBotId,
  toTimestampMs,
} from '../../../onebot/data'
import {
  callAction,
  getAvailableOneBotBots,
  selectBot,
  supportsOneBotAction,
  type OneBotBot,
  type OneBotContext,
} from '../../../onebot/actions'
import { getTextValue } from './text'
import { normalizeGroupNotices } from './notices'
import {
  normalizeGroupAnnouncement,
  normalizeGroupMember,
} from './group-info'
import {
  getRecentPeerType,
  normalizeFriend,
  normalizeFriendCategory,
  normalizeGroup,
} from './contacts'
import {
  resolveOneBotImage,
} from './images'
import {
  resolveOneBotRecord,
  transcribeOneBotRecord,
} from './records'
import {
  normalizeMessage,
  normalizeMessageElements,
  resolveOneBotForward,
  resolveOneBotQuote,
  summarizeElements,
} from './messages'
import type {
  OneBotWebQQOptions,
  OneBotRobotProfile,
  OneBotRobotState,
} from '../../../onebot/types'
import {
  getWebQQGroupAvatar,
  getWebQQGroupSubtitle,
  getWebQQUserAvatar,
} from '../../display'
import type {
  WebQQChatType,
  WebQQContacts,
  WebQQFriend,
  WebQQFriendCategory,
  WebQQGroup,
  WebQQGroupInfo,
  WebQQGroupInfoQuery,
  WebQQMessage,
  WebQQMessageQuery,
  WebQQRecordTranscriptionQuery,
  WebQQMessageReactionUser,
  WebQQNotice,
  WebQQNoticeAction,
  WebQQRecentContact,
} from '../../types'

function toStringId(value: unknown) {
  return value == null ? '' : String(value)
}

function getBotDisplayName(bot: OneBotBot) {
  const name = (bot.name || bot.username || bot.user?.name || bot.user?.nick || bot.user?.username || bot.user?.nickname || '').trim()
  if (name && name !== bot.selfId) return name
  return '机器人'
}

function toOneBotRobotProfile(bot: OneBotBot): OneBotRobotProfile | undefined {
  if (!bot.selfId) return
  return {
    platform: bot.platform || 'onebot',
    selfId: bot.selfId,
    status: bot.status,
    name: getBotDisplayName(bot),
    avatar: bot.avatar || bot.user?.avatar || getWebQQUserAvatar(bot.selfId),
  }
}

function getMockBotCount(value: number | undefined) {
  return Math.max(0, Math.min(20, Math.floor(value ?? 0)))
}

function getMockSelfId(sourceSelfId: string, index: number) {
  return `${sourceSelfId}:mock:${index + 1}`
}

function getMockBotSourceSelfId(selfId: string) {
  return selfId.match(/^(.*):mock:\d+$/)?.[1]
}

function createMockBotProfiles(bots: OneBotRobotProfile[], count: number): OneBotRobotProfile[] {
  const source = bots[0]
  if (!source || !count) return []
  return Array.from({ length: count }, (_, index) => ({
    ...source,
    selfId: getMockSelfId(source.selfId, index),
    name: `${source.name} 模拟 ${index + 1}`,
  }))
}

async function normalizeRecentContact(raw: unknown, bot: OneBotBot, friends: WebQQFriend[], groups: WebQQGroup[], imageUrlResolver?: (file: string) => string): Promise<WebQQRecentContact | undefined> {
  const item = isRecord(raw) ? raw : {}
  const peerId = getStringField(item, ['peerUin', 'peer_uin', 'uin', 'user_id', 'group_id'])
  if (!peerId) return
  const type = getRecentPeerType(item, peerId, friends, groups)
  const friend = type === 'friend' ? friends.find((value) => value.userId === peerId) : undefined
  const group = type === 'group' ? groups.find((value) => value.groupId === peerId) : undefined
  const rawName = getStringField(item, ['remark', 'peerName', 'peer_name', 'name', 'nick', 'nickname'])
  const message = isRecord(item.lastestMsg) ? item.lastestMsg : isRecord(item.latestMsg) ? item.latestMsg : undefined
  const elements = message ? await normalizeMessageElements(message.message, bot, imageUrlResolver) : []
  const summary = elements.length ? summarizeElements(elements) : getTextValue(item.lastestMsg) || getTextValue(item.latestMsg)
  const time = toTimestampMs(getStringField(item, ['msgTime', 'msg_time', 'time', 'timestamp']) || (message ? message.time : 0))
  return {
    type,
    peerId,
    name: friend?.name || group?.name || rawName || peerId,
    subtitle: friend?.nickname || (group ? getWebQQGroupSubtitle(group) : rawName || peerId),
    avatar: type === 'friend' ? getWebQQUserAvatar(peerId) : getWebQQGroupAvatar(peerId),
    summary,
    time,
  }
}

async function loadGroupAnnouncements(bot: OneBotBot, groupId: string) {
  for (const action of ['_get_group_notice', 'get_group_notice']) {
    try {
      const result = await callAction(bot, action, { group_id: toOneBotId(groupId) })
      return toArrayResult(result, 'notices').map(normalizeGroupAnnouncement)
    } catch {}
  }
  return []
}

async function loadFriendCategories(bot: OneBotBot) {
  try {
    return toArrayResult(await callAction(bot, 'get_friends_with_category'), 'categories').map(normalizeFriendCategory)
  } catch {
    return []
  }
}

async function loadRecentContacts(bot: OneBotBot, friends: WebQQFriend[], groups: WebQQGroup[], imageUrlResolver?: (file: string) => string) {
  try {
    const result = await callAction(bot, 'get_recent_contact', { count: 50 })
    const recent = await Promise.all(toArrayResult(result, 'contacts').map((item) => normalizeRecentContact(item, bot, friends, groups, imageUrlResolver)))
    return recent.filter((item): item is WebQQRecentContact => !!item)
  } catch {
    return []
  }
}

function normalizeEmojiLikeUser(raw: unknown): WebQQMessageReactionUser | undefined {
  const item = isRecord(raw) ? raw : {}
  const userId = getStringField(item, ['tinyId'])
  if (!userId) return
  const userName = getStringField(item, ['nickName', 'nickname', 'name'])
  return {
    userId,
    ...(userName ? { userName } : {}),
    userAvatar: getStringField(item, ['headUrl']) || getWebQQUserAvatar(userId),
  }
}

// 创建通过 OneBot action 读取 WebQQ 数据的只读服务。
export function createOneBotWebQQService(ctx: OneBotContext, options: OneBotWebQQOptions = {}) {
  let selectedSelfId = options.selfId
  const getRealSelfId = (selfId = selectedSelfId) => {
    const sourceSelfId = selfId ? getMockBotSourceSelfId(selfId) : undefined
    return sourceSelfId || selfId
  }
  const getBot = () => selectBot(ctx, { ...options, selfId: getRealSelfId() })
  const listBots = () => {
    const bots = getAvailableOneBotBots(ctx, options.selfIds).map(toOneBotRobotProfile).filter((bot): bot is OneBotRobotProfile => !!bot)
    return [
      ...bots,
      ...createMockBotProfiles(bots, getMockBotCount(options.mockBotCount)),
    ]
  }
  const protocol = options.protocol ?? 'napcat'
  const { imageUrlResolver } = options
  return {
    getSelectedSelfId() {
      return selectedSelfId
    },

    isSelectedSelfId(selfId?: string) {
      if (!selectedSelfId) return true
      return selfId === selectedSelfId || selfId === getRealSelfId()
    },

    selectSelfId(selfId: string) {
      const bots = listBots()
      const selected = bots.find((bot) => bot.selfId === selfId)
      if (!selected) throw new Error(`未找到 selfId 为 ${selfId} 的 OneBot 机器人`)
      // 模拟 bot 只用于无多 bot 环境验证 UI，真实 WebQQ action 仍要落到源机器人。
      selectBot(ctx, { ...options, selfId: getRealSelfId(selfId) })
      selectedSelfId = selected.selfId
      return selectedSelfId
    },

    listBots() {
      return listBots()
    },

    async resolveQuote(id: string) {
      return resolveOneBotQuote(getBot(), id, imageUrlResolver)
    },

    async resolveForward(id: string) {
      return resolveOneBotForward(getBot(), id, imageUrlResolver)
    },

    async resolveMessage(id: string) {
      const bot = getBot()
      return normalizeMessage(getActionData(await callAction(bot, 'get_msg', { message_id: toOneBotId(id) })), bot, imageUrlResolver)
    },

    supportsReactionUsers() {
      return supportsOneBotAction(getBot(), 'fetch_emoji_like')
    },

    async loadReactionUsers(messageId: string, emojiId: string, count: number): Promise<WebQQMessageReactionUser[]> {
      const bot = getBot()
      const result = await callAction(bot, 'fetch_emoji_like', {
        message_id: toOneBotId(messageId),
        emoji_id: emojiId,
        count,
      })
      return toArrayResult(result, 'emojiLikesList').map(normalizeEmojiLikeUser).filter((user): user is WebQQMessageReactionUser => !!user)
    },

    async resolveImage(file: string) {
      return resolveOneBotImage(getBot(), file, imageUrlResolver)
    },

    async resolveRecord(file: string) {
      return resolveOneBotRecord(getBot(), file, imageUrlResolver)
    },

    async transcribeRecord(messageId: WebQQRecordTranscriptionQuery['messageId']) {
      return transcribeOneBotRecord(getBot(), messageId)
    },

    async loadContacts(): Promise<WebQQContacts> {
      const bot = getBot()
      const [friendCategories, groupsResult] = await Promise.all([
        loadFriendCategories(bot),
        callAction(bot, 'get_group_list'),
      ])
      const friends = friendCategories.length
        ? friendCategories.flatMap((category) => category.friends)
        : toArrayResult(await callAction(bot, 'get_friend_list'), 'friends').map((friend) => normalizeFriend(friend))
      const groups = toArrayResult(groupsResult, 'groups').map(normalizeGroup)
      const recent = await loadRecentContacts(bot, friends, groups, imageUrlResolver)
      return {
        friends,
        groups,
        ...(friendCategories.length ? { friendCategories } : {}),
        ...(recent.length ? { recent } : {}),
      }
    },

    async loadMessages(query: WebQQMessageQuery): Promise<WebQQMessage[]> {
      const bot = getBot()
      const action = query.type === 'group' ? 'get_group_msg_history' : 'get_friend_msg_history'
      const baseParams = {
        message_seq: query.beforeSequence ? toOneBotId(query.beforeSequence) : 0,
        count: query.limit ?? 30,
        ...(protocol === 'llbot' ? { reverseOrder: false } : {}),
      }
      const params = query.type === 'group'
        ? { group_id: toOneBotId(query.peerId), ...baseParams }
        : { user_id: toOneBotId(query.peerId), ...baseParams }
      const result = await callAction(bot, action, params)
      return Promise.all(toArrayResult(result, 'messages').map((message) => normalizeMessage(message, bot, imageUrlResolver)))
    },

    async loadGroupInfo(query: WebQQGroupInfoQuery): Promise<WebQQGroupInfo> {
      const bot = getBot()
      const membersResult = await callAction(bot, 'get_group_member_list', { group_id: toOneBotId(query.groupId) })
      const announcements = await loadGroupAnnouncements(bot, query.groupId)
      return {
        announcements,
        members: toArrayResult(membersResult, 'members').map(normalizeGroupMember),
      }
    },

    async loadNotices(friendRequests: WebQQNotice[] = []): Promise<WebQQNotice[]> {
      try {
        const result = await callAction(getBot(), 'get_group_system_msg', {})
        return [...friendRequests, ...normalizeGroupNotices(result)]
      } catch {
        return friendRequests
      }
    },

    async handleNotice(action: WebQQNoticeAction) {
      if (action.type === 'friend-request') {
        await callAction(getBot(), 'set_friend_add_request', {
          flag: action.flag,
          approve: action.approve,
        })
        return
      }
      await callAction(getBot(), 'set_group_add_request', {
        flag: action.flag,
        sub_type: action.subType || 'add',
        approve: action.approve,
      })
    },
  }
}
