import type { WebQQFriend, WebQQFriendCategory, WebQQGroup } from './onebot'
import {
  getNumberField,
  getStringField,
  isRecord,
  toArrayResult,
} from './onebot-data'
import { getGroupAvatar, getUserAvatar } from './onebot-display'

export function normalizeFriend(raw: unknown, category?: { id: string; name: string }): WebQQFriend {
  const item = isRecord(raw) ? raw : {}
  const userId = getStringField(item, ['user_id', 'uin', 'uid'])
  const nickname = getStringField(item, ['nickname', 'nick', 'name']) || userId
  const remark = getStringField(item, ['remark', 'card'])
  return {
    userId,
    name: remark || nickname,
    nickname,
    avatar: getUserAvatar(userId),
    ...(category ? { categoryId: category.id, categoryName: category.name } : {}),
  }
}

export function normalizeFriendCategory(raw: unknown, index: number): WebQQFriendCategory {
  const item = isRecord(raw) ? raw : {}
  const id = getStringField(item, ['categoryId', 'category_id', 'id']) || String(index)
  const name = getStringField(item, ['categoryName', 'category_name', 'name']) || '未分组'
  const friends = toArrayResult(item, 'buddyList').map((friend) => normalizeFriend(friend, { id, name }))
  return { id, name, friends }
}

export function normalizeGroup(raw: unknown): WebQQGroup {
  const item = isRecord(raw) ? raw : {}
  const groupId = getStringField(item, ['group_id', 'groupCode', 'group_id_str'])
  return {
    groupId,
    name: getStringField(item, ['group_name', 'groupName', 'name']) || groupId,
    memberCount: getNumberField(item, ['member_count', 'memberCount']),
    avatar: getGroupAvatar(groupId),
  }
}
