import type { Session } from 'koishi'
import {
  readBotProfile,
  readChannelName,
  readUserName,
  readWebQQLiveSenderMetadata,
} from '../webqq/message-flow/session'

export interface ChatLunaMessage {
  id?: string
  name?: string
}

export function createMessageInput(session: Session, message?: ChatLunaMessage) {
  const senderMetadata = readWebQQLiveSenderMetadata(session)
  return {
    bot: readBotProfile(session),
    channel: {
      id: session.channelId || session.event.channel?.id || 'unknown',
      name: readChannelName(session),
    },
    user: {
      id: message?.id || session.userId || session.event.user?.id || 'unknown',
      name: message?.name || readUserName(session),
      ...senderMetadata,
    },
    timestamp: session.timestamp,
  }
}
