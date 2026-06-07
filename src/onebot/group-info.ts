import type { WebQQGroupAnnouncement, WebQQGroupMember } from './types'
import {
  getStringField,
  isRecord,
  toTimestampMs,
} from './data'
import { getTextValue } from './text'
import { getUserAvatar, normalizeGroupRole } from './display'

export function normalizeGroupMember(raw: unknown): WebQQGroupMember {
  const item = isRecord(raw) ? raw : {}
  const userId = getStringField(item, ['user_id', 'userId', 'uin', 'uid'])
  const nickname = getStringField(item, ['nickname', 'nick', 'name']) || userId
  const card = getStringField(item, ['card', 'group_card', 'groupCard'])
  const role = normalizeGroupRole(getStringField(item, ['role']))
  return {
    userId,
    nickname,
    card,
    avatar: getUserAvatar(userId),
    ...(role ? { role } : {}),
  }
}

export function normalizeGroupAnnouncement(raw: unknown, index: number): WebQQGroupAnnouncement {
  const item = isRecord(raw) ? raw : {}
  const id = getStringField(item, ['fid', 'id', 'notice_id', 'noticeId']) || String(index)
  const title = getStringField(item, ['title']) || '群公告'
  const content = getTextValue(item.text) || getTextValue(item.content) || getTextValue(item.message) || title
  const time = toTimestampMs(getStringField(item, ['publish_time', 'publishTime', 'time', 'timestamp']))
  return {
    id,
    title,
    content,
    ...(time ? { time } : {}),
  }
}
