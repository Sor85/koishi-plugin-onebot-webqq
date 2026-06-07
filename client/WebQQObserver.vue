<template>
  <div :class="['chat-capsule-webqq', `is-theme-${webQQTheme}`, `is-chat-style-${webQQChatStyle}`, `is-color-${webQQColorMode}`]" :style="webQQAccentStyle" role="dialog" aria-label="WebQQ 观察窗" @click="closeNoticeMenu">
    <WebQQSidebar
      v-model:search-query="searchQuery"
      v-model:notice-menu-tab="noticeMenuTab"
      :active-tab="activeTab"
      :recent-items="recentItems"
      :visible-friend-categories="visibleFriendCategories"
      :visible-friends="visibleFriends"
      :visible-groups="visibleGroups"
      :current-peer-id="currentPeerId"
      :notice-open="noticeOpen"
      :notice-loading="noticeLoading"
      :notice-error-text="noticeErrorText"
      :filtered-notices="filteredNotices"
      :handling-notice-id="handlingNoticeId"
      :with-proxy="withProxy"
      :get-unread-count="getUnreadCount"
      :get-unread-text="getUnreadText"
      :get-contact-subtitle="getContactSubtitle"
      :get-contact-time="getContactTime"
      :format-list-time="formatListTime"
      :format-notice-time="formatNoticeTime"
      :get-group-subtitle="getGroupSubtitle"
      @select-tab="selectTab"
      @select-recent="selectRecent"
      @select-friend="selectFriend"
      @select-group="selectGroup"
      @open-notices="openNotices"
      @handle-notice="handleNotice"
    />
    <section class="chat-capsule-webqq__chat">
      <div class="chat-capsule-webqq__chat-main">
        <header class="chat-capsule-webqq__chat-header">
          <div class="chat-capsule-webqq__chat-title">
            <img v-if="currentAvatar" class="chat-capsule-webqq__chat-avatar" :src="withProxy(currentAvatar)" :alt="currentTitle">
            <div>
              <strong>{{ currentTitle }}</strong>
              <span>{{ currentSubtitle }}</span>
            </div>
          </div>
          <button v-if="currentChat?.type === 'group'" :class="{ 'is-active': groupInfoOpen }" type="button" aria-label="更多群信息" @click="toggleGroupInfo">
            <svg class="chat-capsule-webqq__header-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </header>
        <div class="chat-capsule-webqq__chat-body">
          <div ref="messagePane" class="chat-capsule-webqq__messages" @scroll="updateMessageTracking">
            <WebQQMessageList
              :loading="loading"
              :error-text="errorText"
              :has-current-chat="!!currentChat"
              :visible-messages="visibleMessages"
              :show-web-q-q-affinity="showWebQQAffinity"
              :show-web-q-q-relationship="showWebQQRelationship"
              :hide-web-q-q-group-level="hideWebQQGroupLevel"
              :with-proxy="withProxy"
              :is-bot-thinking-message="isBotThinkingMessage"
              :get-message-cluster-class="getMessageClusterClass"
              :is-merged-message="isMergedMessage"
              :get-sender-authority-text="getSenderAuthorityText"
              :get-sender-authority-class="getSenderAuthorityClass"
              :format-sender-level="formatSenderLevel"
              :is-image-only-message="isImageOnlyMessage"
              :get-web-q-q-element-runs="getWebQQElementRuns"
              :get-forward-preview-items="getForwardPreviewItems"
              :get-forward-item-name="getForwardItemName"
              :get-forward-preview-text="getForwardPreviewText"
              :format-time="formatTime"
              :get-last-outgoing-cluster-thinking-message="getLastOutgoingClusterThinkingMessage"
              :is-thinking-expanded="isThinkingExpanded"
              :format-thinking-duration="formatThinkingDuration"
              @open-image="openImagePreview"
              @image-load="handleMessageImageLoad"
              @open-forward="openForwardDialog"
              @toggle-thinking="toggleThinking"
            />
          </div>
          <Transition name="webqq-scroll-bottom">
            <button
              v-if="!trackingMessages && visibleMessages.length"
              class="chat-capsule-webqq__scroll-bottom"
              type="button"
              aria-label="返回底部"
              @click="returnMessagesToBottom"
            >
              <svg class="chat-capsule-webqq__scroll-bottom-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14"></path>
                <path d="m7 14 5 5 5-5"></path>
              </svg>
            </button>
          </Transition>
        </div>
      </div>
      <WebQQGroupInfoPanel
        v-if="groupInfoOpen && currentChat?.type === 'group'"
        v-model:search-query="groupInfoSearchQuery"
        :loading="groupInfoLoading"
        :error-text="groupInfoErrorText"
        :group-info="groupInfo"
        :visible-members="visibleGroupMembers"
        :with-proxy="withProxy"
        :format-notice-time="formatNoticeTime"
        :get-group-member-name="getGroupMemberName"
      />
    </section>
    <WebQQForwardModal
      v-if="forwardDialog"
      :dialog="forwardDialog"
      :items="forwardDialogItems"
      :with-proxy="withProxy"
      :get-forward-item-avatar="getForwardItemAvatar"
      :get-forward-item-cluster-class="getForwardItemClusterClass"
      :is-merged-forward-item="isMergedForwardItem"
      @close="closeForwardDialog"
      @open-forward="openForwardDialog"
      @open-image="openImagePreview"
      @image-load="handleMessageImageLoad"
    />
    <WebQQImagePreview
      v-if="imagePreviewUrl"
      :url="imagePreviewUrl"
      @close="closeImagePreview"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { withProxy } from '@koishijs/client'
import WebQQMessageList from './components/WebQQMessageList.vue'
import WebQQSidebar from './components/WebQQSidebar.vue'
import WebQQForwardModal from './components/WebQQForwardModal.vue'
import WebQQGroupInfoPanel from './components/WebQQGroupInfoPanel.vue'
import WebQQImagePreview from './components/WebQQImagePreview.vue'
import { approveWebQQNotice, requestWebQQContacts, requestWebQQGroupInfo, requestWebQQMessages, requestWebQQNotices } from './api/webqq'
import { capsule, hideWebQQGroupLevel, showWebQQAffinity, showWebQQRelationship, useBotAvatarThemeColor, webQQAccentColor, webQQAvatarAccentColor, webQQChatStyle, webQQColorMode, webQQMessageCacheLimit, webQQStorageBackend, webQQTheme, webQQTotalUnread } from './state'
import type { WebQQFriend, WebQQGroup, WebQQMessage } from './state'
import { requestWebQQContactsWithRetry } from './stores/webqq-contact-loader'
import { useWebQQContacts } from './stores/webqq-contacts'
import { useWebQQConversationState } from './stores/webqq-conversation-state'
import { useWebQQGroupInfo } from './stores/webqq-group-info'
import { useWebQQImagePreview } from './stores/webqq-image-preview'
import { useWebQQLiveMessages } from './stores/webqq-live-messages'
import { useWebQQMessageCache } from './stores/webqq-message-cache'
import { useWebQQMessageHistory } from './stores/webqq-message-history'
import { useWebQQForwardDialog } from './stores/webqq-forward-dialog'
import { useWebQQMessageList } from './stores/webqq-message-list'
import { useWebQQMessageScroll } from './stores/webqq-message-scroll'
import { useWebQQNotices } from './stores/webqq-notices'
import { useWebQQSenderMetadata } from './stores/webqq-sender-metadata'
import { useWebQQThinkingExpansion } from './stores/webqq-thinking-expansion'
import {
  formatListTime,
  formatNoticeTime,
  formatSenderLevel,
  formatThinkingDuration,
  formatTime,
  getForwardItemName,
  getForwardPreviewText,
  getGroupMemberName,
  getSenderAuthorityClass,
  getSenderAuthorityText,
  getUnreadText,
  getWebQQElementRuns,
  isImageOnlyMessage,
  type WebQQMessageElement,
} from './utils/webqq-message-view'
import { getGroupSubtitle, type WebQQRecentItem } from './utils/webqq-contact-view'
import { getWebQQAccentStyle, getWebQQEffectiveAccentColor } from './utils/webqq-theme-view'

type RecentItem = WebQQRecentItem

const props = defineProps<{ visible: boolean }>()

const {
  conversationSummaries,
  totalUnreadCount,
  loadRemoteWebQQStoredState,
  updateConversationSummary,
  getContactSubtitle,
  getContactTime,
  getUnreadCount,
  increaseUnreadCount,
  clearUnreadCount,
} = useWebQQConversationState(webQQStorageBackend)
const {
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
  selectTab: selectWebQQTab,
  selectFriend: selectWebQQFriend,
  selectGroup: selectWebQQGroup,
  selectRecent: selectWebQQRecent,
} = useWebQQContacts(conversationSummaries)
const { rememberMessageSenderMetadata, applyMessageSenderMetadata } = useWebQQSenderMetadata(currentChat)
const { loadCachedWebQQMessages, saveCachedWebQQMessages } = useWebQQMessageCache(webQQStorageBackend, webQQMessageCacheLimit)
const { imagePreviewUrl, openImagePreview, closeImagePreview } = useWebQQImagePreview(withProxy)
const { isThinkingExpanded, toggleThinking } = useWebQQThinkingExpansion()
const loading = ref(false)
const errorText = ref('')

const {
  noticeOpen,
  noticeMenuTab,
  noticeLoading,
  handlingNoticeId,
  noticeErrorText,
  filteredNotices,
  openNotices,
  handleNotice,
} = useWebQQNotices({ requestNotices: requestWebQQNotices, approveNotice: approveWebQQNotice })

async function requestCurrentGroupInfo() {
  if (currentChat.value?.type !== 'group') return { announcements: [], members: [] }
  return requestWebQQGroupInfo(currentChat.value.peerId)
}

const {
  groupInfoOpen,
  groupInfoLoading,
  groupInfoErrorText,
  groupInfoSearchQuery,
  groupInfo,
  visibleGroupMembers,
  loadGroupInfo,
  toggleGroupInfo,
} = useWebQQGroupInfo(currentChat, { requestGroupInfo: requestCurrentGroupInfo })

const webQQEffectiveAccentColor = computed(() => getWebQQEffectiveAccentColor(
  useBotAvatarThemeColor.value,
  webQQAvatarAccentColor.value,
  webQQAccentColor.value,
))
const webQQAccentStyle = computed(() => getWebQQAccentStyle(webQQEffectiveAccentColor.value))

const {
  forwardDialog,
  forwardDialogItems,
  getForwardItemAvatar,
  getForwardPreviewItems,
  isMergedForwardItem,
  getForwardItemClusterClass,
  openForwardDialog: openWebQQForwardDialog,
  closeForwardDialog,
} = useWebQQForwardDialog(webQQChatStyle)

function selectTab(tab: 'recent' | 'friends' | 'groups') {
  selectWebQQTab(tab)
  noticeOpen.value = false
}

function clearCurrentUnreadCount() {
  if (!currentChat.value) return
  clearUnreadCount(currentChat.value.type, currentChat.value.peerId)
}

let messageHistory: ReturnType<typeof useWebQQMessageHistory>
const {
  messagePane,
  trackingMessages,
  updateMessageTracking,
  handleMessageImageLoad,
  scrollMessagesToBottom,
  returnMessagesToBottom,
} = useWebQQMessageScroll({
  clearCurrentUnreadCount,
  shouldLoadOlderMessages: () => messageHistory.shouldLoadOlderMessages(),
  loadOlderMessages: () => { messageHistory.loadOlderMessages() },
})

const {
  messages,
  botThinkingMessage,
  visibleMessages,
  isBotThinkingMessage,
  getLastOutgoingClusterThinkingMessage,
  isMergedMessage,
  getMessageClusterClass,
  appendMessage,
} = useWebQQMessageList({
  capsule,
  currentChat,
  chatStyle: webQQChatStyle,
  applyMessageSenderMetadata,
  shouldScrollToBottom: () => trackingMessages.value,
  scrollMessagesToBottom,
})

messageHistory = useWebQQMessageHistory({
  currentChat,
  messages,
  loading,
  errorText,
  trackingMessages,
  messagePane,
  requestMessages: requestWebQQMessages,
  loadCachedMessages: loadCachedWebQQMessages,
  saveCachedMessages: saveCachedWebQQMessages,
  rememberMessageSenderMetadata,
  updateConversationSummary,
  scrollMessagesToBottom,
})
const { loadMessages } = messageHistory

// 打开结构化合并转发浮层，按 LLBot 的 modal 方式展示详情。
function openForwardDialog(element: WebQQMessageElement) {
  if (!openWebQQForwardDialog(element)) return
  noticeOpen.value = false
}

async function loadContacts() {
  loading.value = true
  errorText.value = ''
  try {
    contacts.value = await requestWebQQContactsWithRetry(requestWebQQContacts)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载联系人失败'
  } finally {
    loading.value = false
  }
}

function closeNoticeMenu() {
  noticeOpen.value = false
  closeForwardDialog()
}

function selectFriend(friend: WebQQFriend) {
  noticeOpen.value = false
  groupInfoOpen.value = false
  selectWebQQFriend(friend)
  clearCurrentUnreadCount()
  loadMessages()
}

function selectGroup(group: WebQQGroup) {
  noticeOpen.value = false
  selectWebQQGroup(group)
  clearCurrentUnreadCount()
  loadMessages()
}

function selectRecent(item: RecentItem) {
  noticeOpen.value = false
  if (item.type !== 'group') groupInfoOpen.value = false
  selectWebQQRecent(item)
  clearCurrentUnreadCount()
  loadMessages()
}

useWebQQLiveMessages({
  isVisible: () => props.visible,
  currentChat,
  trackingMessages,
  messages,
  rememberMessageSenderMetadata,
  updateConversationSummary,
  increaseUnreadCount,
  appendMessage,
  loadCachedMessages: loadCachedWebQQMessages,
  saveCachedMessages: saveCachedWebQQMessages,
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  clearCurrentUnreadCount()
  if (trackingMessages.value) scrollMessagesToBottom()
})

watch(totalUnreadCount, (count) => {
  webQQTotalUnread.value = count
}, { immediate: true })

watch(() => botThinkingMessage.value, (message) => {
  if (message && currentChat.value) rememberMessageSenderMetadata(currentChat.value.type, currentChat.value.peerId, [message])
  if (trackingMessages.value) scrollMessagesToBottom()
})

watch(() => currentChat.value?.peerId, () => {
  groupInfoSearchQuery.value = ''
  if (currentChat.value?.type !== 'group') {
    groupInfoOpen.value = false
    return
  }
  if (groupInfoOpen.value) loadGroupInfo()
})

onMounted(async () => {
  await loadRemoteWebQQStoredState()
  await loadContacts()
})
</script>
