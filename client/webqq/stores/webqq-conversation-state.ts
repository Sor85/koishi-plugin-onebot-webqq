import { computed, ref, type Ref } from 'vue'
import type { WebQQStorageBackend } from '../settings'
import type { ConversationSummary, WebQQChatType, WebQQMessage, WebQQStoredState } from '../types'
import {
  getContactSubtitle as getContactSubtitleFromView,
  getContactTime as getContactTimeFromView,
  getChatKey,
  getUnreadCount as getUnreadCountFromView,
  hideRecentConversation as hideRecentConversationFromView,
  revealRecentConversation as revealRecentConversationFromView,
} from '../utils/webqq-contact-view'
import {
  loadBrowserWebQQStoredState,
  loadRemoteWebQQStoredState as loadRemoteWebQQStoredStateFromBackend,
  persistWebQQStoredState,
} from '../storage/webqq-storage'

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
  const hiddenRecentKeys = ref(stored.hiddenRecentKeys)
  const totalUnreadCount = computed(() => Object.values(conversationUnreadCounts.value).reduce((sum, count) => sum + count, 0))

  function createWebQQStoredState(): WebQQStoredState {
    return {
      conversationSummaries: conversationSummaries.value,
      conversationUnreadCounts: conversationUnreadCounts.value,
      hiddenRecentKeys: hiddenRecentKeys.value,
    }
  }

  function applyWebQQStoredState(stored: WebQQStoredState) {
    conversationSummaries.value = stored.conversationSummaries
    conversationUnreadCounts.value = stored.conversationUnreadCounts
    hiddenRecentKeys.value = stored.hiddenRecentKeys
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

  function revealRecentConversation(type: 'friend' | 'group', peerId: string) {
    const next = revealRecentConversationFromView(hiddenRecentKeys.value, type, peerId)
    if (next === hiddenRecentKeys.value) return
    hiddenRecentKeys.value = next
    persistWebQQState()
  }

  function hideRecentConversation(type: 'friend' | 'group', peerId: string) {
    const next = hideRecentConversationFromView(hiddenRecentKeys.value, type, peerId)
    if (next === hiddenRecentKeys.value) return
    hiddenRecentKeys.value = next
    persistWebQQState()
  }

  function updateConversationSummary(type: 'friend' | 'group', peerId: string, message?: WebQQMessage) {
    const next = setConversationSummary(conversationSummaries.value, type, peerId, message)
    if (next === conversationSummaries.value) return
    conversationSummaries.value = next
    hiddenRecentKeys.value = revealRecentConversationFromView(hiddenRecentKeys.value, type, peerId)
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
    hiddenRecentKeys.value = revealRecentConversationFromView(hiddenRecentKeys.value, type, peerId)
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
    hiddenRecentKeys.value = []
  }

  return {
    conversationSummaries,
    conversationUnreadCounts,
    hiddenRecentKeys,
    totalUnreadCount,
    hideRecentConversation,
    revealRecentConversation,
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
