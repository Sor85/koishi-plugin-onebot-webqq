import { computed, ref, type Ref } from 'vue'
import type { WebQQMessage, WebQQStorageBackend } from '../state'
import {
  getContactSubtitle as getContactSubtitleFromView,
  getContactTime as getContactTimeFromView,
  getUnreadCount as getUnreadCountFromView,
} from '../utils/webqq-contact-view'
import {
  loadBrowserWebQQStoredState,
  loadRemoteWebQQStoredState as loadRemoteWebQQStoredStateFromBackend,
  persistWebQQStoredState,
} from './webqq-storage'
import {
  clearConversationUnreadCount,
  increaseConversationUnreadCount,
  setConversationSummary,
  type WebQQStoredState,
} from './webqq-state'

export function useWebQQConversationState(storageBackend: Ref<WebQQStorageBackend>) {
  const stored = loadBrowserWebQQStoredState(storageBackend.value)
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
    persistWebQQStoredState(storageBackend.value, createWebQQStoredState())
  }

  async function loadRemoteWebQQStoredState() {
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
  }
}
