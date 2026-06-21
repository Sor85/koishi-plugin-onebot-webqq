import { receive } from '@koishijs/client'
import type { Ref } from 'vue'
import type { WebQQLiveMessage, WebQQMessage, WebQQRecallPayload } from '../types'
import type { WebQQChatSelection } from '../utils/webqq-contact-view'
import { mergeMessages } from '../utils/webqq-message-view'
import { applyWebQQRecallToMessages } from '../utils/webqq-recall-view'

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
  const cacheWriteQueue = new Map<string, Promise<void>>()

  function enqueueCachedMessagesUpdate(type: WebQQLiveMessage['type'], peerId: string, update: (messages: WebQQMessage[]) => WebQQMessage[]) {
    const key = `${type}:${peerId}`
    const previous = cacheWriteQueue.get(key)
    const run = async () => {
      const cachedMessages = await options.loadCachedMessages(type, peerId)
      await options.saveCachedMessages(type, peerId, update(cachedMessages))
    }
    const next = previous ? previous.catch(() => {}).then(run) : run()
    cacheWriteQueue.set(key, next)
    const clear = () => {
      if (cacheWriteQueue.get(key) === next) cacheWriteQueue.delete(key)
    }
    next.then(clear, clear)
    return next
  }

  async function saveLiveWebQQMessage(payload: WebQQLiveMessage) {
    await enqueueCachedMessagesUpdate(payload.type, payload.peerId, (cachedMessages) => mergeMessages(cachedMessages, [payload.message]))
  }

  async function saveWebQQRecall(payload: WebQQRecallPayload) {
    await enqueueCachedMessagesUpdate(payload.type, payload.peerId, (cachedMessages) => applyWebQQRecallToMessages(cachedMessages, payload))
  }

  function isCurrentChat(payload: Pick<WebQQRecallPayload, 'type' | 'peerId'>) {
    return options.currentChat.value?.type === payload.type &&
      options.currentChat.value.peerId === payload.peerId
  }

  function shouldIncreaseRecallUnread(payload: WebQQRecallPayload) {
    return payload.mode === 'remove' &&
      payload.eventMessage?.direction === 'incoming' &&
      (!options.isVisible() || !options.trackingMessages.value)
  }

  const disposeMessageReceive = receive('onebot-webqq/webqq/message', (payload: WebQQLiveMessage) => {
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

  const disposeRecallReceive = receive('onebot-webqq/webqq/recall', (payload: WebQQRecallPayload) => {
    if (!isCurrentChat(payload)) {
      if (shouldIncreaseRecallUnread(payload)) options.increaseUnreadCount(payload.type, payload.peerId)
      saveWebQQRecall(payload).catch(() => {})
      return
    }
    if (shouldIncreaseRecallUnread(payload)) options.increaseUnreadCount(payload.type, payload.peerId)
    options.messages.value = applyWebQQRecallToMessages(options.messages.value, payload)
    const latestMessage = options.messages.value[options.messages.value.length - 1]
    if (latestMessage) options.updateConversationSummary(payload.type, payload.peerId, latestMessage)
    options.saveCachedMessages(payload.type, payload.peerId, options.messages.value).catch(() => {})
  })

  return () => {
    cacheWriteQueue.clear()
    // Koishi client 的 receive 旧实现只保存单个事件回调且不返回 disposer；卸载时覆盖为空回调，避免残留闭包继续持有当前会话状态。
    if (typeof disposeMessageReceive === 'function') disposeMessageReceive()
    else receive('onebot-webqq/webqq/message', () => {})
    if (typeof disposeRecallReceive === 'function') disposeRecallReceive()
    else receive('onebot-webqq/webqq/recall', () => {})
  }
}
