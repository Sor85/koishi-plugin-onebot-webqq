import { computed, nextTick, ref, type Ref } from 'vue'
import type { WebQQMessage, WebQQMessageQuery } from '../types'
import type { WebQQChatSelection } from '../utils/webqq-contact-view'
import { mergeMessages } from '../utils/webqq-message-view'
import { readWebQQErrorMessage } from '../utils/webqq-error'

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
    options.errorText.value = ''
    options.messages.value = []
    // 本地缓存只是加速首屏，读失败不代表这个会话没有历史。
    // 早期实现在这里直接 return，于是一次数据库抖动就会让整个会话永久停在「加载聊天历史失败」，
    // 即使 OneBot 侧的实时历史本来可以取到。
    let cacheErrorText = ''
    try {
      const cachedMessages = await options.loadCachedMessages(currentChat.type, currentChat.peerId)
      if (!isCurrentChat(currentChat)) return
      options.messages.value = limitMessages(cachedMessages)
    } catch (error) {
      if (!isCurrentChat(currentChat)) return
      cacheErrorText = readWebQQErrorMessage(error, '加载聊天历史缓存失败')
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
      options.errorText.value = readWebQQErrorMessage(error, '加载聊天历史失败')
    }
    // 远端成功但缓存读失败时仍要让用户看到缓存故障，否则数据库问题会被静默掉。
    if (!options.errorText.value && cacheErrorText && !options.messages.value.length) {
      options.errorText.value = cacheErrorText
    }
    await scrollLoadedMessagesToBottom()
  }

  /**
   * 更早历史入口的显示判定。
   *
   * 判定里没有滚动位置：更早历史由用户点入口取回，不再由滚动到列表顶端自动发起。自动发起会在
   * 用户往上翻阅的过程里一页接一页地追加，翻得越久等得越久，而且没有停下的办法。
   *
   * 界面上没有消息时不显示入口：那时没有可用的更早边界，`beforeSequence` 会是 undefined，
   * 请求回来的是最新一页而不是更早一页。
   */
  const canLoadOlderMessages = computed(() => !!options.currentChat.value &&
    options.messages.value.length > 0 &&
    !historyExhausted.value)

  async function loadOlderMessages() {
    const currentChat = options.currentChat.value
    if (!currentChat || historyLoading.value || historyExhausted.value) return
    const pane = options.messagePane.value
    // 补偿基线要连滚动位置一起记下。入口在列表顶端，但用户点它时 scrollTop 通常不是 0；
    // 而且这一趟取空历史时入口本身会消失，高度变化量里含着入口那一行的高度。
    // 只写高度差会把用户拽到列表顶端，把差值加回原位置才让他正在读的那一行留在原处。
    const previousScrollHeight = pane?.scrollHeight ?? 0
    const previousScrollTop = pane?.scrollTop ?? 0
    historyLoading.value = true
    try {
      const olderMessages = await options.requestMessages({
        type: currentChat.type,
        peerId: currentChat.peerId,
        beforeSequence: options.messages.value[0]?.sequence,
      })
      options.rememberMessageSenderMetadata(currentChat.type, currentChat.peerId, olderMessages)
      const previousLength = options.messages.value.length
      const nextMessages = mergeMessages(olderMessages, options.messages.value)
      // 取回更早历史是在扩展当前历史窗口；这里不能套最近消息上限，否则满 100 条后更早页会被立刻裁掉并反复请求同一页。
      options.messages.value = nextMessages
      options.updateConversationSummary(currentChat.type, currentChat.peerId, options.messages.value[options.messages.value.length - 1])
      await options.saveCachedMessages(currentChat.type, currentChat.peerId, options.messages.value)
      historyExhausted.value = olderMessages.length === 0 || nextMessages.length === previousLength
      await nextTick()
      if (pane) pane.scrollTop = previousScrollTop + (pane.scrollHeight - previousScrollHeight)
    } catch (error) {
      options.errorText.value = readWebQQErrorMessage(error, '加载更早聊天历史失败')
    } finally {
      historyLoading.value = false
    }
  }

  return {
    historyLoading,
    historyExhausted,
    loadMessages,
    canLoadOlderMessages,
    loadOlderMessages,
  }
}
