import { computed, ref, type Ref } from 'vue'
import type { ConversationSummary, WebQQChatType, WebQQMessage, WebQQStorageBackend, WebQQStoredState } from '../state'
import {
  getContactSubtitle as getContactSubtitleFromView,
  getContactTime as getContactTimeFromView,
  getChatKey,
  getUnreadCount as getUnreadCountFromView,
} from '../utils/webqq-contact-view'
import {
  loadBrowserWebQQStoredState,
  loadRemoteWebQQStoredState as loadRemoteWebQQStoredStateFromBackend,
  persistWebQQStoredState,
} from './webqq-storage'

export function setConversationSummary(conversationSummaries: Record<string, ConversationSummary>, type: WebQQChatType, peerId: string, message: WebQQMessage | undefined) {
  if (!message) return conversationSummaries
  return {
    ...conversationSummaries,
    [getChatKey(type, peerId)]: {
      summary: message.summary,
      time: message.time,
    },
  }
}

export function increaseConversationUnreadCount(conversationUnreadCounts: Record<string, number>, type: WebQQChatType, peerId: string) {
  const key = getChatKey(type, peerId)
  return {
    ...conversationUnreadCounts,
    [key]: (conversationUnreadCounts[key] || 0) + 1,
  }
}

export function clearConversationUnreadCount(conversationUnreadCounts: Record<string, number>, type: WebQQChatType, peerId: string) {
  const key = getChatKey(type, peerId)
  if (!conversationUnreadCounts[key]) return conversationUnreadCounts
  const next = { ...conversationUnreadCounts }
  delete next[key]
  return next
}

export function useWebQQConversationState(storageBackend: Ref<WebQQStorageBackend>, storageScope: Ref<string>) {
  const stored = loadBrowserWebQQStoredState(storageBackend.value, storageScope.value)
  const conversationSummaries = ref(stored.conversationSummaries)
  const conversationUnreadCounts = ref(stored.conversationUnreadCounts)
  const totalUnreadCount = computed(() => Object.values(conversationUnreadCounts.value).reduce((sum, count) => sum + count, 0))

  function createWebQQStoredState(): WebQQStoredState {
    return {
      conversationSummaries: conversationSummaries.value,
      conversationUnreadCounts: conversationUnreadCounts.value,
    }
  }

  function applyWebQQStoredState(stored: WebQQStoredState) {
    conversationSummaries.value = stored.conversationSummaries
    conversationUnreadCounts.value = stored.conversationUnreadCounts
  }

  function persistWebQQState() {
    persistWebQQStoredState(storageBackend.value, createWebQQStoredState(), storageScope.value)
  }

  async function loadRemoteWebQQStoredState() {
    if (storageBackend.value === 'browser') {
      applyWebQQStoredState(loadBrowserWebQQStoredState(storageBackend.value, storageScope.value))
      return
    }
    const stored = await loadRemoteWebQQStoredStateFromBackend(storageBackend.value)
    if (stored) applyWebQQStoredState(stored)
  }

  function updateConversationSummary(type: 'friend' | 'group', peerId: string, message?: WebQQMessage) {
    const next = setConversationSummary(conversationSummaries.value, type, peerId, message)
    if (next === conversationSummaries.value) return
    conversationSummaries.value = next
    persistWebQQState()
  }

  function getContactSubtitle(type: 'friend' | 'group', peerId: string, fallback: string) {
    return getContactSubtitleFromView(conversationSummaries.value, type, peerId, fallback)
  }

  function getContactTime(type: 'friend' | 'group', peerId: string, fallback = 0) {
    return getContactTimeFromView(conversationSummaries.value, type, peerId, fallback)
  }

  function getUnreadCount(type: 'friend' | 'group', peerId: string) {
    return getUnreadCountFromView(conversationUnreadCounts.value, type, peerId)
  }

  function increaseUnreadCount(type: 'friend' | 'group', peerId: string) {
    conversationUnreadCounts.value = increaseConversationUnreadCount(conversationUnreadCounts.value, type, peerId)
    persistWebQQState()
  }

  function clearUnreadCount(type: 'friend' | 'group', peerId: string) {
    const next = clearConversationUnreadCount(conversationUnreadCounts.value, type, peerId)
    if (next === conversationUnreadCounts.value) return
    conversationUnreadCounts.value = next
    persistWebQQState()
  }

  function resetConversationState() {
    conversationSummaries.value = {}
    conversationUnreadCounts.value = {}
  }

  return {
    conversationSummaries,
    conversationUnreadCounts,
    totalUnreadCount,
    createWebQQStoredState,
    applyWebQQStoredState,
    persistWebQQState,
    loadRemoteWebQQStoredState,
    updateConversationSummary,
    getContactSubtitle,
    getContactTime,
    getUnreadCount,
    increaseUnreadCount,
    clearUnreadCount,
    resetConversationState,
  }
}
