import type { Session } from 'koishi'
import type { WebQQLiveMessage } from '../onebot'
import { isRecord, readRecordText } from '../shared/structured-text'
import { readWebQQGroupMemberName } from './group-sender-metadata'
import { createWebQQEventMessage } from './live-message'
import { readWebQQPeer } from './session'

function readRawEventData(session: Session) {
  const data = (session.event as { _data?: unknown })._data
  return isRecord(data) ? data : {}
}

function readWebQQNoticePeer(session: Session) {
  const groupId = readRecordText(readRawEventData(session), ['group_id', 'groupId'])
  if (groupId) return { type: 'group' as const, peerId: groupId }
  return readWebQQPeer(session)
}

function readSessionUserName(session: Session, fallbackId = '') {
  return session.event.member?.name || session.event.operator?.name || session.event.user?.name || session.username || fallbackId || '有人'
}

async function readWebQQNoticeMemberName(session: Session, userId: string, fallbackName: string, genericName: string) {
  if (userId) {
    try {
      const name = await readWebQQGroupMemberName(session, userId, true)
      if (name) return name
    } catch {}
  }
  return fallbackName && fallbackName !== userId && !/^\d+$/.test(fallbackName) ? fallbackName : genericName
}

function formatMuteDuration(seconds: number) {
  if (!seconds) return ''
  if (seconds % 3600 === 0) return `${seconds / 3600} 小时`
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`
  return `${seconds} 秒`
}

export function createWebQQNoticeRuntime(options: {
  broadcastWebQQLivePayload: (payload: WebQQLiveMessage) => void
}) {
  const recordWebQQNotice = async (session: Session | undefined) => {
    if (!session || (session.bot.platform || session.platform) !== 'onebot') return
    const data = readRawEventData(session)
    const noticeType = readRecordText(data, ['notice_type', 'noticeType'])
    const subType = readRecordText(data, ['sub_type', 'subType'])
    if (noticeType !== 'group_ban' && !(noticeType === 'notify' && subType === 'poke')) return
    const peer = readWebQQNoticePeer(session)
    if (!peer) return
    if (noticeType === 'notify' && subType === 'poke') {
      const senderId = readRecordText(data, ['user_id', 'userId', 'sender_id', 'senderId']) || session.userId || session.event.user?.id || ''
      const targetId = readRecordText(data, ['target_id', 'targetId']) || session.event.operator?.id || ''
      const senderName = await readWebQQNoticeMemberName(
        session,
        senderId,
        readRecordText(data, ['sender_nickname', 'senderNickname', 'user_name', 'userName']) || readSessionUserName(session, senderId),
        '某成员',
      )
      const targetName = await readWebQQNoticeMemberName(
        session,
        targetId,
        readRecordText(data, ['target_nickname', 'targetNickname', 'target_name', 'targetName']),
        '对方',
      )
      options.broadcastWebQQLivePayload({
        ...peer,
        message: createWebQQEventMessage(peer, session.timestamp, 'poke', `${senderName} 戳了戳 ${targetName}`, senderId, readSessionUserName(session, senderId)),
      })
      return
    }
    if (noticeType === 'group_ban') {
      const operatorId = readRecordText(data, ['operator_id', 'operatorId']) || session.operatorId || session.event.operator?.id || ''
      const targetId = readRecordText(data, ['user_id', 'userId', 'target_id', 'targetId']) || session.userId || session.event.user?.id || ''
      const operatorName = await readWebQQNoticeMemberName(
        session,
        operatorId,
        readRecordText(data, ['operator_name', 'operatorName']) || session.event.operator?.name || '',
        '管理员',
      )
      const targetName = await readWebQQNoticeMemberName(
        session,
        targetId,
        readRecordText(data, ['user_name', 'userName', 'target_name', 'targetName']) || session.event.user?.name || '',
        '对方',
      )
      const duration = Number(data.duration) || 0
      const durationText = formatMuteDuration(duration)
      const summary = subType === 'lift_ban'
        ? `${operatorName} 解除了 ${targetName} 的禁言`
        : `${operatorName} 禁言了 ${targetName}${durationText ? ` ${durationText}` : ''}`
      options.broadcastWebQQLivePayload({
        ...peer,
        message: createWebQQEventMessage(peer, session.timestamp, 'mute', summary, operatorId, readSessionUserName(session, operatorId)),
      })
    }
  }

  return { recordWebQQNotice }
}
