import { computed, ref, type Ref } from 'vue'
import type { CapsuleData, WebQQMessage } from '../state'
import type { WebQQChatSelection } from '../utils/webqq-contact-view'
import {
  createBotThinkingMessage,
  getLastOutgoingClusterThinkingMessage as getLastOutgoingClusterThinkingMessageFromView,
  getMessageClusterClass as getMessageClusterClassFromView,
  isMergedMessage as isMergedMessageFromView,
  mergeMessages,
  type WebQQThinkingMessage,
} from '../utils/webqq-message-view'

export function useWebQQMessageList(options: {
  capsule: Ref<CapsuleData | undefined>
  currentChat: Ref<WebQQChatSelection | undefined>
  chatStyle: Readonly<Ref<string>>
  applyMessageSenderMetadata: (message: WebQQMessage) => WebQQMessage
  shouldScrollToBottom: () => boolean
  scrollMessagesToBottom: () => unknown
}) {
  const messages = ref<WebQQMessage[]>([])
  const botThinkingMessage = computed<WebQQMessage | undefined>(() => createBotThinkingMessage(options.capsule.value, options.currentChat.value, messages.value))
  const visibleMessages = computed(() => {
    const cachedMessages = messages.value.map(options.applyMessageSenderMetadata)
    return botThinkingMessage.value ? [...cachedMessages, options.applyMessageSenderMetadata(botThinkingMessage.value)] : cachedMessages
  })

  function isBotThinkingMessage(message: WebQQMessage) {
    return message.id === botThinkingMessage.value?.id
  }

  function getLastOutgoingClusterThinkingMessage(index: number): WebQQThinkingMessage | undefined {
    return getLastOutgoingClusterThinkingMessageFromView(visibleMessages.value, index)
  }

  function isMergedMessage(index: number) {
    return isMergedMessageFromView(messages.value, index, options.chatStyle.value)
  }

  function getMessageClusterClass(index: number) {
    return getMessageClusterClassFromView(messages.value, index, options.chatStyle.value)
  }

  function appendMessage(message: WebQQMessage) {
    messages.value = mergeMessages(messages.value, [message])
    if (options.shouldScrollToBottom()) options.scrollMessagesToBottom()
  }

  return {
    messages,
    botThinkingMessage,
    visibleMessages,
    isBotThinkingMessage,
    getLastOutgoingClusterThinkingMessage,
    isMergedMessage,
    getMessageClusterClass,
    appendMessage,
  }
}
