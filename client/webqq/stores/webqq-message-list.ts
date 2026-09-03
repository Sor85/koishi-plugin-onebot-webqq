import { computed, ref, watch, type Ref } from 'vue'
import type { CapsuleSnapshot } from '../../entry-state'
import type { WebQQMessage } from '../types'
import type { WebQQChatSelection } from '../utils/webqq-contact-view'
import {
  createBotThinkingMessage,
  getLastOutgoingClusterThinkingMessage as getLastOutgoingClusterThinkingMessageFromView,
  getLastOutgoingClusterUsageMessage as getLastOutgoingClusterUsageMessageFromView,
  getMessageClusterClass as getMessageClusterClassFromView,
  hasOutgoingMessageAfter,
  isMergedMessage as isMergedMessageFromView,
  mergeMessages,
  type WebQQThinkingMessage,
  type WebQQUsageMessage,
} from '../utils/webqq-message-view'

export function useWebQQMessageList(options: {
  capsule: Ref<CapsuleSnapshot | undefined>
  currentChat: Ref<WebQQChatSelection | undefined>
  chatStyle: Readonly<Ref<string>>
  messageCacheLimit: Readonly<Ref<number>>
  applyMessageSenderMetadata: (message: WebQQMessage) => WebQQMessage
  shouldScrollToBottom: () => boolean
  scrollMessagesToBottom: () => unknown
}) {
  const messages = ref<WebQQMessage[]>([])
  const botThinkingMessages = ref<Record<string, WebQQMessage>>({})

  function getCurrentChatKey() {
    const currentChat = options.currentChat.value
    return currentChat ? `${currentChat.type}:${currentChat.peerId}` : ''
  }

  function getCapsuleChatKeyForCurrentChat() {
    const currentChat = options.currentChat.value
    const conversation = options.capsule.value?.conversation
    if (!currentChat || !conversation) return ''
    const peerId = currentChat.type === 'group'
      ? conversation.channelId
      : conversation.userId || conversation.channelId
    return `${currentChat.type}:${peerId}`
  }

  function forgetCurrentChatBotThinkingMessage() {
    const key = getCurrentChatKey()
    if (!key || !botThinkingMessages.value[key]) return
    const nextMessages = { ...botThinkingMessages.value }
    delete nextMessages[key]
    botThinkingMessages.value = nextMessages
  }

  function syncBotThinkingMessage() {
    const key = getCurrentChatKey()
    if (!key) return
    const next = createBotThinkingMessage(options.capsule.value, options.currentChat.value, messages.value)
    if (next) {
      botThinkingMessages.value = {
        ...botThinkingMessages.value,
        [key]: next,
      }
      return
    }
    // 造不出气泡时只在两种情况下清理：capsule 指向当前会话（本会话确已空闲），
    // 或当前会话已有更晚的 outgoing（本会话已回复）。其他群/私聊抢占 capsule 时保留等待气泡。
    const cached = botThinkingMessages.value[key]
    if (getCapsuleChatKeyForCurrentChat() === key || (cached && hasOutgoingMessageAfter(messages.value, cached.time))) {
      forgetCurrentChatBotThinkingMessage()
    }
  }

  watch([
    () => options.capsule.value,
    () => options.currentChat.value,
    () => messages.value,
  ], syncBotThinkingMessage, { immediate: true, flush: 'sync' })

  const botThinkingMessage = computed<WebQQMessage | undefined>(() => {
    const key = getCurrentChatKey()
    return key ? botThinkingMessages.value[key] : undefined
  })
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

  function getLastOutgoingClusterUsageMessage(index: number): WebQQUsageMessage | undefined {
    return getLastOutgoingClusterUsageMessageFromView(visibleMessages.value, index)
  }

  function isMergedMessage(index: number) {
    return isMergedMessageFromView(messages.value, index, options.chatStyle.value)
  }

  function getMessageClusterClass(index: number) {
    return getMessageClusterClassFromView(messages.value, index, options.chatStyle.value)
  }

  function limitMessages(nextMessages: WebQQMessage[]) {
    return nextMessages.slice(-options.messageCacheLimit.value)
  }

  function appendMessage(message: WebQQMessage) {
    messages.value = limitMessages(mergeMessages(messages.value, [message]))
    if (options.shouldScrollToBottom()) options.scrollMessagesToBottom()
  }

  return {
    messages,
    botThinkingMessage,
    visibleMessages,
    isBotThinkingMessage,
    getLastOutgoingClusterThinkingMessage,
    getLastOutgoingClusterUsageMessage,
    isMergedMessage,
    getMessageClusterClass,
    appendMessage,
  }
}
