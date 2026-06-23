<template>
  <div ref="webQQRoot" :class="['onebot-webqq-webqq', `is-theme-${webQQTheme}`, `is-chat-style-${webQQChatStyle}`, { 'has-tim-bubble-tail': webQQTimBubbleTail, 'is-resizable': allowWebQQResize }, `is-color-${webQQColorMode}`]" :style="webQQAccentStyle" role="dialog" aria-label="WebQQ 观察窗" @click="closeNoticeMenu">
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
      :format-notice-time="formatNoticeTime"
      :get-group-subtitle="getGroupSubtitle"
      @select-tab="selectTab"
      @select-recent="selectRecent"
      @select-friend="selectFriend"
      @select-group="selectGroup"
      @open-notices="openNotices"
      @handle-notice="handleNotice"
    />
    <section class="onebot-webqq-webqq__chat">
      <div :class="['onebot-webqq-webqq__chat-content', { 'is-mobile-notice-open': noticeOpen }]">
        <div v-if="noticeOpen" class="onebot-webqq-webqq__mobile-notice-page" @click.stop>
          <WebQQNoticeMenu
            v-model:tab="noticeMenuTab"
            class="onebot-webqq-webqq__mobile-notice-content"
            :loading="noticeLoading"
            :error-text="noticeErrorText"
            :notices="filteredNotices"
            :handling-notice-id="handlingNoticeId"
            :with-proxy="withProxy"
            :format-notice-time="formatNoticeTime"
            @handle="handleNotice"
          />
        </div>
        <div class="onebot-webqq-webqq__chat-main">
        <header class="onebot-webqq-webqq__chat-header">
          <div class="onebot-webqq-webqq__chat-title">
            <img v-if="currentAvatar" class="onebot-webqq-webqq__chat-avatar" :src="withProxy(currentAvatar)" :alt="currentTitle">
            <div>
              <strong>{{ currentTitle }}</strong>
              <span>{{ currentSubtitle }}</span>
            </div>
          </div>
          <button v-if="currentChat?.type === 'group'" :class="{ 'is-active': groupInfoOpen }" type="button" aria-label="更多群信息" @click="toggleGroupInfo">
            <svg class="onebot-webqq-webqq__header-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </header>
        <div class="onebot-webqq-webqq__chat-body">
          <div ref="messagePane" v-webqq-scrollbar class="onebot-webqq-webqq__messages" @scroll="updateMessageTracking">
            <WebQQMessageList
              :loading="loading"
              :error-text="errorText"
              :has-current-chat="!!currentChat"
              :visible-messages="visibleMessages"
              :chat-style="webQQChatStyle"
              :show-web-q-q-affinity="showWebQQAffinity"
              :show-web-q-q-relationship="showWebQQRelationship"
              :hide-web-q-q-group-level="hideWebQQGroupLevel"
              :show-web-q-q-thinking-tokens="showWebQQThinkingTokens"
              :show-web-q-q-thinking-timing="showWebQQThinkingTiming"
              :is-bot-thinking-message="isBotThinkingMessage"
              :get-message-cluster-class="getMessageClusterClass"
              :is-merged-message="isMergedMessage"
              :transcribe-record="requestWebQQRecordTranscription"
              :get-last-outgoing-cluster-thinking-message="getLastOutgoingClusterThinkingMessage"
              :get-last-outgoing-cluster-usage-message="getLastOutgoingClusterUsageMessage"
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
              class="onebot-webqq-webqq__scroll-bottom"
              type="button"
              aria-label="返回底部"
              @click="returnMessagesToBottom"
            >
              <svg class="onebot-webqq-webqq__scroll-bottom-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14"></path>
                <path d="m7 14 5 5 5-5"></path>
              </svg>
            </button>
          </Transition>
        </div>
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
    <span v-if="allowWebQQResize" class="onebot-webqq-webqq__resize-zone is-left" aria-hidden="true" @pointerdown.stop.prevent="startWebQQResize('left', $event)"></span>
    <span v-if="allowWebQQResize" class="onebot-webqq-webqq__resize-zone is-top" aria-hidden="true" @pointerdown.stop.prevent="startWebQQResize('top', $event)"></span>
    <span v-if="allowWebQQResize" class="onebot-webqq-webqq__resize-zone is-top-left" aria-hidden="true" @pointerdown.stop.prevent="startWebQQResize('top-left', $event)"></span>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { withProxy } from '@koishijs/client'
import WebQQMessageList from './components/WebQQMessageList.vue'
import WebQQSidebar from './components/WebQQSidebar.vue'
import WebQQNoticeMenu from './components/WebQQNoticeMenu.vue'
import WebQQForwardModal from './components/WebQQForwardModal.vue'
import WebQQGroupInfoPanel from './components/WebQQGroupInfoPanel.vue'
import WebQQImagePreview from './components/WebQQImagePreview.vue'
import { approveWebQQNotice, requestWebQQContacts, requestWebQQContactsWithRetry, requestWebQQGroupInfo, requestWebQQMessages, requestWebQQNotices, requestWebQQRecordTranscription } from './api/webqq'
import { webQQCapsule as capsule } from '../entry-state'
import { availableBots, selectedBotSelfId } from '../onebot/bots'
import { allowWebQQResize, hideWebQQGroupLevel, showWebQQAffinity, showWebQQRelationship, showWebQQThinkingTiming, showWebQQThinkingTokens, webQQAccentColor, webQQChatStyle, webQQColorMode, webQQMessageCacheLimit, webQQStorageBackend, webQQTheme, webQQTimBubbleTail, webQQTotalUnread } from './settings'
import type { WebQQFriend, WebQQGroup, WebQQMessage } from './types'
import { useWebQQContacts } from './stores/webqq-contacts'
import { useWebQQConversationState } from './stores/webqq-conversation-state'
import { useWebQQGroupInfo } from './stores/webqq-group-info'
import { useWebQQLiveMessages } from './stores/webqq-live-messages'
import { useWebQQMessageHistory } from './stores/webqq-message-history'
import { useWebQQForwardDialog } from './stores/webqq-forward-dialog'
import { useWebQQMessageList } from './stores/webqq-message-list'
import { useWebQQMessageScroll } from './stores/webqq-message-scroll'
import { useWebQQNotices } from './stores/webqq-notices'
import { useWebQQSenderMetadata } from './stores/webqq-sender-metadata'
import { useWebQQThinkingExpansion } from './stores/webqq-thinking-expansion'
import { loadCachedWebQQMessages as loadStoredWebQQMessages, saveCachedWebQQMessages as saveStoredWebQQMessages } from './storage/webqq-storage'
import {
  formatNoticeTime,
  formatThinkingDuration,
  getGroupMemberName,
  getUnreadText,
  type WebQQMessageElement,
} from './utils/webqq-message-view'
import { getGroupSubtitle, type WebQQRecentItem } from './utils/webqq-contact-view'
import { getWebQQAccentStyle } from './utils/webqq-theme-view'
import { vWebqqScrollbar } from './utils/webqq-scrollbar'

type RecentItem = WebQQRecentItem
type WebQQResizeEdge = 'left' | 'top' | 'top-left'

interface WebQQShellSize {
  width: number
  height: number
}

interface WebQQResizeState {
  edge: WebQQResizeEdge
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

const props = defineProps<{ visible: boolean }>()
const webQQRoot = ref<HTMLElement>()
const webQQShellSize = ref<WebQQShellSize>()
const webQQStorageScope = computed(() => availableBots.value.length > 1 ? selectedBotSelfId.value : '')

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
  resetConversationState,
} = useWebQQConversationState(webQQStorageBackend, webQQStorageScope)
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
  resetContacts,
} = useWebQQContacts(conversationSummaries)
const { rememberMessageSenderMetadata, applyMessageSenderMetadata } = useWebQQSenderMetadata(currentChat)
const { isThinkingExpanded, toggleThinking } = useWebQQThinkingExpansion()
const loading = ref(false)
const errorText = ref('')
const imagePreviewUrl = ref('')

async function loadCachedWebQQMessages(type: 'friend' | 'group', peerId: string) {
  return loadStoredWebQQMessages(type, peerId, webQQStorageBackend.value, webQQStorageScope.value)
}

async function saveCachedWebQQMessages(type: 'friend' | 'group', peerId: string, messages: WebQQMessage[]) {
  await saveStoredWebQQMessages(type, peerId, messages, webQQStorageBackend.value, webQQMessageCacheLimit.value, webQQStorageScope.value)
}

function openImagePreview(url: string) {
  imagePreviewUrl.value = withProxy(url)
}

function closeImagePreview() {
  imagePreviewUrl.value = ''
}

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

const webQQResizeStorageKey = 'onebot-webqq:webqq:resize:v1'
const webQQResizeMinWidth = 640
const webQQResizeMinHeight = 420
const webQQResizeViewportWidthGap = 32
const webQQResizeViewportHeightGap = 6
const webQQResizeDefaultBottomGap = 116
let webQQResizeState: WebQQResizeState | undefined
let previousBodyCursor = ''
let previousBodyUserSelect = ''

function normalizeWebQQShellSize(value: unknown): WebQQShellSize | undefined {
  if (!value || typeof value !== 'object') return
  const width = Reflect.get(value, 'width')
  const height = Reflect.get(value, 'height')
  if (typeof width !== 'number' || typeof height !== 'number') return
  if (!Number.isFinite(width) || !Number.isFinite(height)) return
  return { width, height }
}

function getWebQQResizeBounds() {
  if (typeof window === 'undefined') {
    return {
      minWidth: webQQResizeMinWidth,
      minHeight: webQQResizeMinHeight,
      maxWidth: webQQResizeMinWidth,
      maxHeight: webQQResizeMinHeight,
    }
  }
  const maxWidth = Math.max(0, window.innerWidth - webQQResizeViewportWidthGap)
  const bottomGap = webQQRoot.value ? Math.max(0, window.innerHeight - webQQRoot.value.getBoundingClientRect().bottom) : webQQResizeDefaultBottomGap
  const maxHeight = Math.max(0, window.innerHeight - bottomGap - webQQResizeViewportHeightGap)
  return {
    minWidth: Math.min(webQQResizeMinWidth, maxWidth),
    minHeight: Math.min(webQQResizeMinHeight, maxHeight),
    maxWidth,
    maxHeight,
  }
}

function clampWebQQShellSize(size: WebQQShellSize): WebQQShellSize {
  const bounds = getWebQQResizeBounds()
  return {
    width: Math.round(Math.min(Math.max(size.width, bounds.minWidth), bounds.maxWidth)),
    height: Math.round(Math.min(Math.max(size.height, bounds.minHeight), bounds.maxHeight)),
  }
}

function readStoredWebQQShellSize() {
  if (typeof localStorage === 'undefined') return
  try {
    return normalizeWebQQShellSize(JSON.parse(localStorage.getItem(webQQResizeStorageKey) || 'null'))
  } catch {
    return
  }
}

function persistWebQQShellSize(size: WebQQShellSize) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(webQQResizeStorageKey, JSON.stringify(size))
  } catch {}
}

function loadStoredWebQQShellSize() {
  const stored = readStoredWebQQShellSize()
  if (!stored) return
  webQQShellSize.value = clampWebQQShellSize(stored)
}

const webQQAccentStyle = computed(() => {
  const style = getWebQQAccentStyle(webQQAccentColor.value)
  if (!allowWebQQResize.value || !webQQShellSize.value) return style
  return {
    ...style,
    width: `${webQQShellSize.value.width}px`,
    height: `${webQQShellSize.value.height}px`,
  }
})

const {
  forwardDialog,
  forwardDialogItems,
  getForwardItemAvatar,
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
  getLastOutgoingClusterUsageMessage,
  isMergedMessage,
  getMessageClusterClass,
  appendMessage,
} = useWebQQMessageList({
  capsule,
  currentChat,
  chatStyle: webQQChatStyle,
  messageCacheLimit: webQQMessageCacheLimit,
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
  messageCacheLimit: webQQMessageCacheLimit,
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

async function reloadWebQQForSelectedBot() {
  resetContacts()
  resetConversationState()
  messages.value = []
  groupInfoOpen.value = false
  groupInfo.value = { announcements: [], members: [] }
  await loadRemoteWebQQStoredState()
  await loadContacts()
}

function closeNoticeMenu() {
  noticeOpen.value = false
  closeForwardDialog()
}

function getWebQQResizeCursor(edge: WebQQResizeEdge) {
  if (edge === 'left') return 'ew-resize'
  if (edge === 'top') return 'ns-resize'
  return 'nwse-resize'
}

function updateStoredWebQQShellSize(size: WebQQShellSize) {
  webQQShellSize.value = clampWebQQShellSize(size)
}

function handleWebQQResizeMove(event: PointerEvent) {
  if (!webQQResizeState) return
  event.preventDefault()
  const width = webQQResizeState.edge === 'top'
    ? webQQResizeState.startWidth
    : webQQResizeState.startWidth + webQQResizeState.startX - event.clientX
  const height = webQQResizeState.edge === 'left'
    ? webQQResizeState.startHeight
    : webQQResizeState.startHeight + webQQResizeState.startY - event.clientY
  updateStoredWebQQShellSize({ width, height })
}

function stopWebQQResize() {
  if (!webQQResizeState) return
  window.removeEventListener('pointermove', handleWebQQResizeMove)
  window.removeEventListener('pointerup', stopWebQQResize)
  window.removeEventListener('pointercancel', stopWebQQResize)
  document.body.style.cursor = previousBodyCursor
  document.body.style.userSelect = previousBodyUserSelect
  webQQResizeState = undefined
  if (webQQShellSize.value) persistWebQQShellSize(webQQShellSize.value)
}

function startWebQQResize(edge: WebQQResizeEdge, event: PointerEvent) {
  if (!allowWebQQResize.value || event.button !== 0 || !webQQRoot.value) return
  const rect = webQQRoot.value.getBoundingClientRect()
  webQQResizeState = {
    edge,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: rect.width,
    startHeight: rect.height,
  }
  updateStoredWebQQShellSize({ width: rect.width, height: rect.height })
  previousBodyCursor = document.body.style.cursor
  previousBodyUserSelect = document.body.style.userSelect
  document.body.style.cursor = getWebQQResizeCursor(edge)
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', handleWebQQResizeMove)
  window.addEventListener('pointerup', stopWebQQResize)
  window.addEventListener('pointercancel', stopWebQQResize)
}

function clampCurrentWebQQShellSize() {
  if (!allowWebQQResize.value || !webQQShellSize.value) return
  const next = clampWebQQShellSize(webQQShellSize.value)
  if (next.width === webQQShellSize.value.width && next.height === webQQShellSize.value.height) return
  webQQShellSize.value = next
  persistWebQQShellSize(next)
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

const disposeWebQQLiveMessages = useWebQQLiveMessages({
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

onBeforeUnmount(() => {
  disposeWebQQLiveMessages()
  stopWebQQResize()
  window.removeEventListener('resize', clampCurrentWebQQShellSize)
})

watch(allowWebQQResize, (enabled) => {
  if (enabled) loadStoredWebQQShellSize()
  else stopWebQQResize()
}, { immediate: true })

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

watch(selectedBotSelfId, (selfId, oldSelfId) => {
  if (!selfId || selfId === oldSelfId) return
  void reloadWebQQForSelectedBot()
})

onMounted(async () => {
  window.addEventListener('resize', clampCurrentWebQQShellSize)
  await loadRemoteWebQQStoredState()
  await loadContacts()
})
</script>
