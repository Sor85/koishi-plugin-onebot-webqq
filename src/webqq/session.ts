import type { Session } from 'koishi'
import type { WebQQMessage } from '../onebot'
import { getGroupAvatar, getUserAvatar } from '../onebot/data'
import { readWebQQSenderMetadata } from './sender-metadata'

export function readBotProfile(session: Session) {
  const user = session.bot.toJSON?.().user
  return {
    platform: session.bot.platform || session.platform || 'unknown',
    selfId: session.bot.selfId,
    status: session.bot.status,
    name: user?.name,
    avatar: user?.avatar,
  }
}

export function readChannelName(session: Session) {
  return session.event.guild?.name || session.event.channel?.name
}

export function readMemberName(session: Session) {
  return session.event.member?.name || session.event.member?.nick
}

export function readUserName(session: Session) {
  return readMemberName(session) || session.event.user?.name || session.username
}

export function getWebQQUserAvatar(userId: string) {
  return getUserAvatar(userId)
}

export function getWebQQGroupAvatar(groupId: string) {
  return getGroupAvatar(groupId)
}

export function readWebQQPeer(session: Session) {
  const isGroup = !!(session.guildId || session.event.guild)
  const peerId = isGroup
    ? session.channelId || session.guildId || session.event.channel?.id || session.event.guild?.id
    : session.userId || session.event.user?.id || session.channelId || session.event.channel?.id
  if (!peerId) return
  return {
    type: isGroup ? 'group' as const : 'friend' as const,
    peerId,
  }
}

export function readWebQQLiveDirection(session: Session): WebQQMessage['direction'] {
  const senderId = session.userId || session.event.user?.id
  return senderId && senderId === session.bot.selfId ? 'outgoing' : 'incoming'
}

export function readWebQQLiveSenderMetadata(session: Session) {
  return readWebQQSenderMetadata(session.event.member)
}
