import { receive } from '@koishijs/client'
import type { Ref } from 'vue'
import type { WebQQLiveMessage, WebQQMessage } from '../state'
import type { WebQQChatSelection } from '../utils/webqq-contact-view'
import { mergeMessages } from '../utils/webqq-message-view'

export function useWebQQLiveMessages(options: {
  isVisible: () => boolean
  currentChat: Ref<WebQQChatSelection | undefined>
  trackingMessages: Ref<boolean>
  messages: Ref<WebQQMessage[]>
  rememberMessageSenderMetadata: (type: WebQQLiveMessage['type'], peerId: string, messages: WebQQMessage[]) => void
  updateConversationSummary: (type: WebQQLiveMessage['type'], peerId: string, message: WebQQMessage) => void
  increaseUnreadCount: (type: WebQQLiveMessage['type'], peerId: string) => void
  appendMessage: (message: WebQQMessage) => void
  loadCachedMessages: (type: WebQQLiveMessage['type'], peerId: string) => Promise<WebQQMessage[]>
  saveCachedMessages: (type: WebQQLiveMessage['type'], peerId: string, messages: WebQQMessage[]) => Promise<void>
}) {
  async function saveLiveWebQQMessage(payload: WebQQLiveMessage) {
    const cachedMessages = await options.loadCachedMessages(payload.type, payload.peerId)
    await options.saveCachedMessages(payload.type, payload.peerId, mergeMessages(cachedMessages, [payload.message]))
  }

  receive('chat-capsule/webqq/message', (payload: WebQQLiveMessage) => {
    options.rememberMessageSenderMetadata(payload.type, payload.peerId, [payload.message])
    options.updateConversationSummary(payload.type, payload.peerId, payload.message)
    if (
      options.currentChat.value?.type !== payload.type ||
      options.currentChat.value.peerId !== payload.peerId
    ) {
      if (payload.message.direction === 'incoming') options.increaseUnreadCount(payload.type, payload.peerId)
      saveLiveWebQQMessage(payload).catch(() => {})
      return
    }
    if (
      payload.message.direction === 'incoming' &&
      (!options.isVisible() || !options.trackingMessages.value)
    ) options.increaseUnreadCount(payload.type, payload.peerId)
    options.appendMessage(payload.message)
    options.saveCachedMessages(payload.type, payload.peerId, options.messages.value).catch(() => {})
  })
}
