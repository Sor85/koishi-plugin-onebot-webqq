import type { Session } from 'koishi'
import { isRecord } from '../shared/structured-text'
import {
  hasWebQQSenderMetadata,
  readWebQQSenderMetadata,
  type WebQQSenderMetadata,
} from './sender-metadata'

function toOneBotId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value
}

function getActionData(result: unknown) {
  const item = isRecord(result) ? result : {}
  return isRecord(item.data) ? item.data : item
}

export async function readWebQQGroupSenderMetadata(session: Session, userId: string, noCache: boolean): Promise<WebQQSenderMetadata | undefined> {
  if ((session.bot.platform || session.platform) !== 'onebot') return
  const groupId = session.channelId || session.guildId || session.event.channel?.id || session.event.guild?.id
  if (!groupId || !userId || !isRecord(session.bot)) return
  const internal = isRecord(session.bot.internal) ? session.bot.internal : undefined
  if (!internal) return
  const params = {
    group_id: toOneBotId(groupId),
    user_id: toOneBotId(userId),
    no_cache: noCache,
  }
  let result: unknown
  if (typeof internal.get_group_member_info === 'function') {
    result = await internal.get_group_member_info(params)
  } else if (typeof internal._request === 'function') {
    result = await internal._request('get_group_member_info', params)
  } else {
    return
  }
  const metadata = readWebQQSenderMetadata(getActionData(result))
  return hasWebQQSenderMetadata(metadata) ? metadata : undefined
}

export async function readWebQQBotGroupSenderMetadata(session: Session): Promise<WebQQSenderMetadata | undefined> {
  const userId = session.bot.selfId || session.selfId
  if (!userId) return
  return readWebQQGroupSenderMetadata(session, userId, false)
}
