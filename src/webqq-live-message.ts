import type { Session } from 'koishi'
import type { WebQQLiveMessage, WebQQMessage } from './onebot'
import {
  normalizeLiveElements,
  summarizeWebQQElements,
  type WebQQForwardResolver,
  type WebQQImageResolver,
  type WebQQQuoteResolver,
} from './webqq-live-elements'
import {
  getWebQQUserAvatar,
  readBotProfile,
  readMemberName,
  readUserName,
  readWebQQPeer,
  readWebQQLiveSenderMetadata,
} from './webqq-session'

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
  const id = session.messageId || session.event.message?.id || `${direction}:${peer.type}:${peer.peerId}:${session.timestamp}`
  return {
    ...peer,
    message: {
      id,
      sequence: session.messageId || session.event.message?.id || String(session.timestamp),
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
