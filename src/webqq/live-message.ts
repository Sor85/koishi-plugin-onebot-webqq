import type { Session } from 'koishi'
import type { WebQQLiveMessage, WebQQMessage } from '../onebot'
import { isRecord, readRecordText } from '../shared/structured-text'
import {
  normalizeLiveElements,
  summarizeWebQQElements,
  type WebQQForwardResolver,
  type WebQQImageResolver,
  type WebQQQuoteResolver,
} from './live-elements'
import {
  getWebQQUserAvatar,
  readBotProfile,
  readMemberName,
  readUserName,
  readWebQQPeer,
  readWebQQLiveSenderMetadata,
} from './session'

function readRawMessageData(session: Session) {
  const data = (session.event as { _data?: unknown })._data
  return isRecord(data) ? data : {}
}

export async function createWebQQLiveMessage(
  session: Session,
  direction: WebQQMessage['direction'],
  resolveImage?: WebQQImageResolver,
  resolveQuote?: WebQQQuoteResolver,
  resolveForward?: WebQQForwardResolver,
): Promise<WebQQLiveMessage | undefined> {
  if ((session.bot.platform || session.platform) !== 'onebot') return
  const peer = readWebQQPeer(session)
  if (!peer) return
  if (!(session.elements ?? session.event.message?.elements)?.length && !session.quote && !session.event.message?.quote && !session.content?.trim()) return
  const bot = readBotProfile(session)
  const elements = await normalizeLiveElements(session, resolveImage, resolveQuote, resolveForward)
  const senderId = direction === 'outgoing'
    ? bot.selfId
    : session.userId || session.event.user?.id || 'unknown'
  const senderName = direction === 'outgoing'
    ? readMemberName(session) || bot.name || '机器人'
    : readUserName(session) || senderId
  // Koishi 的 session.messageId 可能是适配器二次包装后的 ID；WebQQ 和贴表情事件需要
  // OneBot 原始 message_id / message_seq 才能和历史消息、reaction 事件对齐。
  const rawData = readRawMessageData(session)
  const rawMessageId = readRecordText(rawData, ['message_id', 'messageId', 'msg_id', 'msgId'])
  const rawMessageSeq = readRecordText(rawData, ['message_seq', 'messageSeq', 'msg_seq', 'msgSeq', 'seq'])
  const id = rawMessageId || session.messageId || session.event.message?.id || `${direction}:${peer.type}:${peer.peerId}:${session.timestamp}`
  return {
    ...peer,
    message: {
      id,
      sequence: rawMessageSeq || session.messageId || session.event.message?.id || String(session.timestamp),
      time: session.timestamp,
      senderId,
      senderName,
      senderAvatar: getWebQQUserAvatar(senderId),
      ...readWebQQLiveSenderMetadata(session),
      direction,
      summary: summarizeWebQQElements(elements),
      elements,
    },
  }
}
