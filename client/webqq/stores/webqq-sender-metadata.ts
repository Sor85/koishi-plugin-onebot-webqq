import { ref, type Ref } from 'vue'
import type { WebQQMessage } from '../types'
import { applyCachedWebQQSenderMetadata, rememberWebQQSenderMetadata, type WebQQSenderMetadataCache } from '../sender-metadata'
import type { WebQQChatSelection } from '../utils/webqq-contact-view'

export function useWebQQSenderMetadata(currentChat: Ref<WebQQChatSelection | undefined>) {
  const senderMetadataCache = ref<WebQQSenderMetadataCache>({})

  function rememberMessageSenderMetadata(type: WebQQChatSelection['type'], peerId: string, nextMessages: WebQQMessage[]) {
    senderMetadataCache.value = rememberWebQQSenderMetadata(senderMetadataCache.value, type, peerId, nextMessages)
  }

  function applyMessageSenderMetadata(message: WebQQMessage) {
    if (!currentChat.value) return message
    return applyCachedWebQQSenderMetadata(senderMetadataCache.value, currentChat.value.type, currentChat.value.peerId, message)
  }

  return {
    senderMetadataCache,
    rememberMessageSenderMetadata,
    applyMessageSenderMetadata,
  }
}
