import { computed, ref, type Ref } from 'vue'
import type { WebQQContacts, WebQQConversationSummary, WebQQFriend, WebQQGroup } from '../types'
import {
  createFriendChatSelection,
  createGroupChatSelection,
  createRecentChatSelection,
  getCurrentChatAvatar,
  getCurrentChatSubtitle,
  getCurrentChatTitle,
  getRecentItems,
  getVisibleFriendCategories,
  getVisibleFriends,
  getVisibleGroups,
  type WebQQChatSelection,
} from '../utils/webqq-contact-view'

export function useWebQQContacts(
  conversationSummaries: Ref<Record<string, WebQQConversationSummary>>,
  hiddenRecentKeys: Ref<string[]>,
) {
  const activeTab = ref<'recent' | 'friends' | 'groups'>('recent')
  const searchQuery = ref('')
  const contacts = ref<WebQQContacts>({ friends: [], groups: [] })
  const currentChat = ref<WebQQChatSelection>()

  const visibleFriends = computed(() => getVisibleFriends(contacts.value, searchQuery.value))
  const visibleGroups = computed(() => getVisibleGroups(contacts.value, searchQuery.value))
  const visibleFriendCategories = computed(() => getVisibleFriendCategories(contacts.value, searchQuery.value))
  const recentItems = computed(() => getRecentItems(contacts.value, conversationSummaries.value, hiddenRecentKeys.value))
  const currentPeerId = computed(() => currentChat.value?.peerId)
  const currentTitle = computed(() => getCurrentChatTitle(currentChat.value))
  const currentSubtitle = computed(() => getCurrentChatSubtitle(currentChat.value, contacts.value))
  const currentAvatar = computed(() => getCurrentChatAvatar(currentChat.value))

  function selectTab(tab: 'recent' | 'friends' | 'groups') {
    activeTab.value = tab
  }

  function selectFriend(friend: WebQQFriend) {
    currentChat.value = createFriendChatSelection(friend)
  }

  function selectGroup(group: WebQQGroup) {
    currentChat.value = createGroupChatSelection(group)
  }

  function selectRecent(item: ReturnType<typeof getRecentItems>[number]) {
    currentChat.value = createRecentChatSelection(item)
  }

  function resetContacts() {
    activeTab.value = 'recent'
    searchQuery.value = ''
    contacts.value = { friends: [], groups: [] }
    currentChat.value = undefined
  }

  return {
    activeTab,
    searchQuery,
    contacts,
    currentChat,
    visibleFriends,
    visibleGroups,
    visibleFriendCategories,
    recentItems,
    currentPeerId,
    currentTitle,
    currentSubtitle,
    currentAvatar,
    selectTab,
    selectFriend,
    selectGroup,
    selectRecent,
    resetContacts,
  }
}
