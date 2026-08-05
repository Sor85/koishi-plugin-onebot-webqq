import type { WebQQGroupAnnouncement, WebQQGroupMember } from '../../types'
import {
  getStringField,
  isRecord,
  toTimestampMs,
} from '../../../onebot/data'
import {
  getWebQQUserAvatar,
  normalizeWebQQGroupRole,
} from '../../display'
import { getTextValue } from './text'

function normalizeRawGroupRole(role: string): WebQQGroupMember['rawRole'] | undefined {
  if (role === 'owner') return 'owner'
  if (role === 'admin' || role === 'administrator') return 'admin'
  if (role === 'member') return 'member'
}

export function normalizeGroupMember(raw: unknown): WebQQGroupMember {
  const item = isRecord(raw) ? raw : {}
  const userId = getStringField(item, ['user_id', 'userId', 'uin', 'uid'])
  const nickname = getStringField(item, ['nickname', 'nick', 'name']) || userId
  const card = getStringField(item, ['card', 'group_card', 'groupCard'])
  const rawRoleValue = getStringField(item, ['role'])
  const role = normalizeWebQQGroupRole(rawRoleValue)
  const rawRole = normalizeRawGroupRole(rawRoleValue)
  const title = getStringField(item, ['title', 'special_title', 'specialTitle'])
  return {
    userId,
    nickname,
    card,
    avatar: getWebQQUserAvatar(userId),
    ...(role ? { role } : {}),
    ...(rawRole ? { rawRole } : {}),
    ...(title ? { title } : {}),
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
