import { nextTick, ref, type Ref } from 'vue'
import type { WebQQMessage } from '../state'
import type { WebQQMessageQuery } from '../api/webqq'
import type { WebQQChatSelection } from '../utils/webqq-contact-view'
import { mergeMessages } from '../utils/webqq-message-view'

export function useWebQQMessageHistory(options: {
  currentChat: Ref<WebQQChatSelection | undefined>
  messages: Ref<WebQQMessage[]>
  loading: Ref<boolean>
  errorText: Ref<string>
  trackingMessages: Ref<boolean>
  messagePane: Ref<HTMLElement | undefined>
  requestMessages: (query: WebQQMessageQuery) => Promise<WebQQMessage[]>
  loadCachedMessages: (type: WebQQMessageQuery['type'], peerId: string) => Promise<WebQQMessage[]>
  saveCachedMessages: (type: WebQQMessageQuery['type'], peerId: string, messages: WebQQMessage[]) => Promise<void>
  messageCacheLimit: Readonly<Ref<number>>
  rememberMessageSenderMetadata: (type: WebQQMessageQuery['type'], peerId: string, messages: WebQQMessage[]) => void
  updateConversationSummary: (type: WebQQMessageQuery['type'], peerId: string, message?: WebQQMessage) => void
  scrollMessagesToBottom: () => Promise<void>
}) {
  const historyLoading = ref(false)
  const historyExhausted = ref(false)

  function isCurrentChat(chat: WebQQChatSelection) {
    const currentChat = options.currentChat.value
    return currentChat?.type === chat.type && currentChat.peerId === chat.peerId
  }

  async function scrollLoadedMessagesToBottom() {
    if (!options.errorText.value && options.trackingMessages.value) await options.scrollMessagesToBottom()
  }

  function limitMessages(messages: WebQQMessage[]) {
    return messages.slice(-options.messageCacheLimit.value)
  }

  async function loadMessages() {
    const currentChat = options.currentChat.value
    if (!currentChat) return
    options.trackingMessages.value = true
    historyExhausted.value = false
    options.loading.value = true
    options.errorText.value = ''
    options.messages.value = []
    try {
      try {
        const cachedMessages = await options.loadCachedMessages(currentChat.type, currentChat.peerId)
        if (!isCurrentChat(currentChat)) return
        options.messages.value = limitMessages(cachedMessages)
      } catch (error) {
        if (!isCurrentChat(currentChat)) return
        options.errorText.value = error instanceof Error ? error.message : '加载聊天历史失败'
        return
      }
      await scrollLoadedMessagesToBottom()
      try {
        const remoteMessages = await options.requestMessages({
          type: currentChat.type,
          peerId: currentChat.peerId,
        })
        if (!isCurrentChat(currentChat)) return
        options.messages.value = limitMessages(mergeMessages(options.messages.value, remoteMessages))
        options.rememberMessageSenderMetadata(currentChat.type, currentChat.peerId, options.messages.value)
        options.updateConversationSummary(currentChat.type, currentChat.peerId, options.messages.value[options.messages.value.length - 1])
        await options.saveCachedMessages(currentChat.type, currentChat.peerId, options.messages.value)
      } catch (error) {
        if (!isCurrentChat(currentChat) || options.messages.value.length) return
        options.errorText.value = error instanceof Error ? error.message : '加载聊天历史失败'
      }
      await scrollLoadedMessagesToBottom()
    } finally {
      if (isCurrentChat(currentChat)) options.loading.value = false
    }
  }

  function shouldLoadOlderMessages() {
    const currentChat = options.currentChat.value
    const pane = options.messagePane.value
    return !!currentChat &&
      !!pane &&
      pane.scrollTop <= 8 &&
      options.messages.value.length > 0 &&
      !historyLoading.value &&
      !historyExhausted.value
  }

  async function loadOlderMessages() {
    const currentChat = options.currentChat.value
    if (!currentChat || historyLoading.value || historyExhausted.value) return
    const pane = options.messagePane.value
    const previousScrollHeight = pane?.scrollHeight ?? 0
    historyLoading.value = true
    try {
      const olderMessages = await options.requestMessages({
        type: currentChat.type,
        peerId: currentChat.peerId,
        beforeSequence: options.messages.value[0]?.sequence,
      })
      options.rememberMessageSenderMetadata(currentChat.type, currentChat.peerId, olderMessages)
      options.messages.value = limitMessages(mergeMessages(olderMessages, options.messages.value))
      options.updateConversationSummary(currentChat.type, currentChat.peerId, options.messages.value[options.messages.value.length - 1])
      await options.saveCachedMessages(currentChat.type, currentChat.peerId, options.messages.value)
      historyExhausted.value = olderMessages.length === 0
      await nextTick()
      if (pane) pane.scrollTop = pane.scrollHeight - previousScrollHeight
    } catch (error) {
      options.errorText.value = error instanceof Error ? error.message : '加载更早聊天历史失败'
    } finally {
      historyLoading.value = false
    }
  }

  return {
    historyLoading,
    historyExhausted,
    loadMessages,
    shouldLoadOlderMessages,
    loadOlderMessages,
  }
}
