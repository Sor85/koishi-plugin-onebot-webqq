<template>
  <div :class="['chat-capsule-webqq', `is-theme-${webQQTheme}`, `is-chat-style-${webQQChatStyle}`, `is-color-${webQQColorMode}`]" :style="webQQAccentStyle" role="dialog" aria-label="WebQQ 观察窗" @click="closeNoticeMenu">
    <aside class="chat-capsule-webqq__sidebar">
      <div class="chat-capsule-webqq__tabs-row">
        <div class="chat-capsule-webqq__tabs">
          <button :class="{ 'is-active': activeTab === 'recent' }" type="button" @click="selectTab('recent')">
            <svg class="chat-capsule-webqq__tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>
            最近
          </button>
          <button :class="{ 'is-active': activeTab === 'friends' }" type="button" @click="selectTab('friends')">
            <svg class="chat-capsule-webqq__tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M5 21a7 7 0 0 1 14 0"></path>
            </svg>
            好友
          </button>
          <button :class="{ 'is-active': activeTab === 'groups' }" type="button" @click="selectTab('groups')">
            <svg class="chat-capsule-webqq__tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="8" r="3.5"></circle>
              <circle cx="17" cy="9" r="3"></circle>
              <path d="M2.5 21a6.5 6.5 0 0 1 13 0"></path>
              <path d="M14 16.5A5 5 0 0 1 21.5 21"></path>
            </svg>
            群组
          </button>
        </div>
        <span class="chat-capsule-webqq__notify-wrap" @click.stop>
          <button :class="['chat-capsule-webqq__notify', { 'is-active': noticeOpen }]" type="button" aria-label="通知" @click="openNotices">
            <svg class="chat-capsule-webqq__notify-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18a3 3 0 0 1-6 0"></path>
              <path d="M19 16H5c1.4-1.4 2-3.2 2-5.5a5 5 0 0 1 10 0c0 2.3.6 4.1 2 5.5Z"></path>
            </svg>
          </button>
          <WebQQNoticeMenu
            v-if="noticeOpen"
            v-model:tab="noticeMenuTab"
            :loading="noticeLoading"
            :error-text="noticeErrorText"
            :notices="filteredNotices"
            :handling-notice-id="handlingNoticeId"
            :with-proxy="withProxy"
            :format-notice-time="formatNoticeTime"
            @handle="handleNotice"
          />
        </span>
      </div>
      <div v-if="activeTab !== 'recent'" class="chat-capsule-webqq__search">
        <svg class="chat-capsule-webqq__search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="m16 16 4 4"></path>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="activeTab === 'friends' ? '搜索好友...' : '搜索群组...'"
        >
      </div>
      <WebQQContactList
        :active-tab="activeTab"
        :recent-items="recentItems"
        :visible-friend-categories="visibleFriendCategories"
        :visible-friends="visibleFriends"
        :visible-groups="visibleGroups"
        :current-peer-id="currentPeerId"
        :with-proxy="withProxy"
        :get-unread-count="getUnreadCount"
        :get-unread-text="getUnreadText"
        :get-contact-subtitle="getContactSubtitle"
        :get-contact-time="getContactTime"
        :format-list-time="formatListTime"
        :get-group-subtitle="getGroupSubtitle"
        @select-recent="selectRecent"
        @select-friend="selectFriend"
        @select-group="selectGroup"
      />
    </aside>
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
            <template v-if="loading">
              <div class="chat-capsule-webqq__placeholder">加载中</div>
            </template>
            <template v-else-if="errorText">
              <div class="chat-capsule-webqq__placeholder is-error">{{ errorText }}</div>
            </template>
            <template v-else-if="!currentChat">
              <div class="chat-capsule-webqq__placeholder">选择一个会话</div>
            </template>
            <template v-else-if="!visibleMessages.length">
              <div class="chat-capsule-webqq__placeholder">暂无消息</div>
            </template>
            <template v-else>
              <template v-for="(message, index) in visibleMessages" :key="message.id || message.sequence">
                <div
                  :class="['chat-capsule-webqq__message', `is-${message.direction}`, getMessageClusterClass(index), { 'is-merged': isMergedMessage(index), 'is-thinking': isBotThinkingMessage(message) }]"
                >
                  <span class="chat-capsule-webqq__message-avatar-wrap">
                    <img class="chat-capsule-webqq__message-avatar" :src="withProxy(message.senderAvatar)" :alt="message.senderName">
                    <span v-if="message.senderAffinity != null && showWebQQAffinity" class="chat-capsule-webqq__message-affinity">
                      <svg class="chat-capsule-webqq__message-affinity-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                      </svg>
                      {{ message.senderAffinity }}
                    </span>
                  </span>
                  <div class="chat-capsule-webqq__message-content">
                    <div v-if="!isMergedMessage(index)" class="chat-capsule-webqq__sender-line">
                      <template v-if="message.direction === 'outgoing'">
                        <span v-if="getSenderAuthorityText(message)" :class="['chat-capsule-webqq__sender-badge', getSenderAuthorityClass(message)]">{{ getSenderAuthorityText(message) }}</span>
                        <span v-if="message.senderLevel && !hideWebQQGroupLevel" class="chat-capsule-webqq__sender-badge is-level">{{ formatSenderLevel(message.senderLevel) }}</span>
                        <span class="chat-capsule-webqq__message-name">{{ message.senderName }}</span>
                        <span v-if="message.senderRelationship && showWebQQRelationship" class="chat-capsule-webqq__sender-badge is-relationship">{{ message.senderRelationship }}</span>
                      </template>
                      <template v-if="message.direction === 'incoming'">
                        <span class="chat-capsule-webqq__message-name">{{ message.senderName }}</span>
                        <span v-if="message.senderRelationship && showWebQQRelationship" class="chat-capsule-webqq__sender-badge is-relationship">{{ message.senderRelationship }}</span>
                        <span v-if="message.senderLevel && !hideWebQQGroupLevel" class="chat-capsule-webqq__sender-badge is-level">{{ formatSenderLevel(message.senderLevel) }}</span>
                        <span v-if="getSenderAuthorityText(message)" :class="['chat-capsule-webqq__sender-badge', getSenderAuthorityClass(message)]">{{ getSenderAuthorityText(message) }}</span>
                      </template>
                    </div>
                    <div class="chat-capsule-webqq__message-body">
                      <div v-if="isImageOnlyMessage(message)" class="chat-capsule-webqq__message-media">
                        <button class="chat-capsule-webqq__message-image" type="button" aria-label="查看大图" @click="openImagePreview(message.elements[0].url)">
                          <img :src="withProxy(message.elements[0].url)" alt="图片" @load="handleMessageImageLoad">
                        </button>
                      </div>
                      <div v-else class="chat-capsule-webqq__bubble">
                        <span v-if="isBotThinkingMessage(message)" class="chat-capsule-webqq__thinking-dots" aria-label="机器人正在思考">
                          <span v-for="dot in 3" :key="dot" class="chat-capsule-webqq__thinking-dot"></span>
                        </span>
                        <template v-else v-for="(run, runIndex) in getWebQQElementRuns(message.elements)" :key="`${message.id}:run:${runIndex}`">
                          <span v-if="run.type === 'inline'" class="chat-capsule-webqq__inline-run">
                            <template v-for="element in run.elements" :key="`${message.id}:inline:${runIndex}:${element.type}:${element.text || element.url || element.title || ''}`">
                              <span v-if="element.type === 'text'">{{ element.text }}</span>
                              <span v-else>{{ element.text || message.summary }}</span>
                            </template>
                          </span>
                          <div v-else-if="run.element.type === 'quote'" class="chat-capsule-webqq__quote">
                            <strong v-if="run.element.title" class="chat-capsule-webqq__quote-title">{{ run.element.title }}</strong>
                            <span>{{ run.element.text || '[引用消息]' }}</span>
                          </div>
                          <button
                            v-else-if="run.element.type === 'forward'"
                            class="chat-capsule-webqq__quote chat-capsule-webqq__forward"
                            type="button"
                            :disabled="!run.element.items?.length"
                            aria-label="查看合并转发消息"
                            @click.stop="openForwardDialog(run.element)"
                          >
                            <strong class="chat-capsule-webqq__quote-title">{{ run.element.title || '合并转发' }}</strong>
                            <template v-if="run.element.items?.length">
                              <span v-for="(item, itemIndex) in getForwardPreviewItems(run.element)" :key="`${message.id}:forward:${runIndex}:${itemIndex}`">
                                {{ getForwardItemName(item) }}：{{ getForwardPreviewText(item) }}
                              </span>
                              <span class="chat-capsule-webqq__forward-entry">查看{{ run.element.items.length }}条转发消息</span>
                            </template>
                            <span v-else>{{ run.element.text || '[合并转发]' }}</span>
                          </button>
                          <div
                            v-else-if="run.element.type === 'card'"
                            class="chat-capsule-webqq__card"
                          >
                            <img v-if="run.element.imageUrl" class="chat-capsule-webqq__card-cover" :src="withProxy(run.element.imageUrl)" alt="">
                            <span class="chat-capsule-webqq__card-content">
                              <strong class="chat-capsule-webqq__card-title">{{ run.element.title || '卡片消息' }}</strong>
                              <span v-if="run.element.text" class="chat-capsule-webqq__card-desc">{{ run.element.text }}</span>
                              <span v-if="run.element.source" class="chat-capsule-webqq__card-source">{{ run.element.source }}</span>
                            </span>
                          </div>
                          <button v-else-if="run.element.type === 'image' && run.element.url" class="chat-capsule-webqq__message-image" type="button" aria-label="查看大图" @click="openImagePreview(run.element.url)">
                            <img :src="withProxy(run.element.url)" alt="图片" @load="handleMessageImageLoad">
                          </button>
                          <span v-else>{{ run.element.text || message.summary }}</span>
                        </template>
                      </div>
                      <div class="chat-capsule-webqq__message-time">{{ formatTime(message.time) }}</div>
                    </div>
                  </div>
                </div>
                <div
                  v-if="getLastOutgoingClusterThinkingMessage(index)"
                  class="chat-capsule-webqq__thinking-row"
                >
                  <button
                    class="chat-capsule-webqq__thinking-toggle"
                    type="button"
                    :aria-expanded="isThinkingExpanded(getLastOutgoingClusterThinkingMessage(index))"
                    @click="toggleThinking(getLastOutgoingClusterThinkingMessage(index))"
                  >
                    <span
                      v-if="getLastOutgoingClusterThinkingMessage(index).thinking.usage"
                      class="chat-capsule-webqq__thinking-usage"
                      aria-label="本次 token 用量"
                    >
                      <svg class="chat-capsule-webqq__thinking-usage-icon is-input" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20V8"></path>
                        <path d="m7 13 5-5 5 5"></path>
                        <path d="M5 4h14"></path>
                      </svg>
                      <span>{{ getLastOutgoingClusterThinkingMessage(index).thinking.usage.inputTokens }}</span>
                      <svg class="chat-capsule-webqq__thinking-usage-icon is-output" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 4v12"></path>
                        <path d="m7 11 5 5 5-5"></path>
                        <path d="M5 20h14"></path>
                      </svg>
                      <span>{{ getLastOutgoingClusterThinkingMessage(index).thinking.usage.outputTokens }}</span>
                    </span>
                    <span>{{ formatThinkingDuration(getLastOutgoingClusterThinkingMessage(index).thinking.durationMs) }}</span>
                    <svg class="chat-capsule-webqq__thinking-chevron" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5"></path>
                    </svg>
                  </button>
                  <div
                    v-if="isThinkingExpanded(getLastOutgoingClusterThinkingMessage(index))"
                    class="chat-capsule-webqq__thinking-content"
                  >{{ getLastOutgoingClusterThinkingMessage(index).thinking.content }}</div>
                </div>
              </template>
            </template>
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { receive, send, withProxy } from '@koishijs/client'
import WebQQContactList from './WebQQContactList.vue'
import WebQQForwardModal from './WebQQForwardModal.vue'
import WebQQGroupInfoPanel from './WebQQGroupInfoPanel.vue'
import WebQQImagePreview from './WebQQImagePreview.vue'
import WebQQNoticeMenu from './WebQQNoticeMenu.vue'
import { capsule, hideWebQQGroupLevel, showWebQQAffinity, showWebQQRelationship, useBotAvatarThemeColor, webQQAccentColor, webQQAvatarAccentColor, webQQChatStyle, webQQColorMode, webQQStorageBackend, webQQTheme, webQQTotalUnread } from './state'
import type { WebQQContacts, WebQQFriend, WebQQGroup, WebQQGroupInfo, WebQQGroupMember, WebQQLiveMessage, WebQQMessage, WebQQNotice } from './state'
import { requestWebQQContactsWithRetry } from './stores/webqq-contact-loader'
import { useWebQQContacts } from './stores/webqq-contacts'
import { useWebQQConversationState } from './stores/webqq-conversation-state'
import { useWebQQGroupInfo } from './stores/webqq-group-info'
import { useWebQQImagePreview } from './stores/webqq-image-preview'
import { useWebQQMessageCache } from './stores/webqq-message-cache'
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
  mergeMessages,
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
const { loadCachedWebQQMessages, saveCachedWebQQMessages } = useWebQQMessageCache(webQQStorageBackend)
const { imagePreviewUrl, openImagePreview, closeImagePreview } = useWebQQImagePreview(withProxy)
const { isThinkingExpanded, toggleThinking } = useWebQQThinkingExpansion()
const historyLoading = ref(false)
const historyExhausted = ref(false)
const loading = ref(false)
const errorText = ref('')

async function requestNotices() {
  return await send('chat-capsule/webqq/notices') as WebQQNotice[] || []
}

async function approveNotice(notice: WebQQNotice, approve: boolean) {
  await send('chat-capsule/webqq/notice-action', {
    id: notice.id,
    type: notice.type,
    flag: notice.flag,
    subType: notice.subType,
    approve,
  })
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
} = useWebQQNotices({ requestNotices, approveNotice })

async function requestGroupInfo() {
  if (currentChat.value?.type !== 'group') return { announcements: [], members: [] }
  return await send('chat-capsule/webqq/group-info', {
    groupId: currentChat.value.peerId,
  }) as WebQQGroupInfo || { announcements: [], members: [] }
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
} = useWebQQGroupInfo(currentChat, { requestGroupInfo })

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

const {
  messagePane,
  trackingMessages,
  updateMessageTracking,
  handleMessageImageLoad,
  scrollMessagesToBottom,
  returnMessagesToBottom,
} = useWebQQMessageScroll({
  clearCurrentUnreadCount,
  shouldLoadOlderMessages,
  loadOlderMessages,
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

// 打开结构化合并转发浮层，按 LLBot 的 modal 方式展示详情。
function openForwardDialog(element: WebQQMessageElement) {
  if (!openWebQQForwardDialog(element)) return
  noticeOpen.value = false
}

async function requestWebQQContacts() {
  return await send('chat-capsule/webqq/contacts') as WebQQContacts || { friends: [], groups: [] }
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

async function loadMessages() {
  if (!currentChat.value) return
  trackingMessages.value = true
  historyExhausted.value = false
  loading.value = true
  errorText.value = ''
  try {
    const cachedMessages = await loadCachedWebQQMessages(currentChat.value.type, currentChat.value.peerId)
    messages.value = cachedMessages
    messages.value = await send('chat-capsule/webqq/messages', {
      type: currentChat.value.type,
      peerId: currentChat.value.peerId,
    }) as WebQQMessage[] || []
    messages.value = mergeMessages(cachedMessages, messages.value)
    rememberMessageSenderMetadata(currentChat.value.type, currentChat.value.peerId, messages.value)
    updateConversationSummary(currentChat.value.type, currentChat.value.peerId, messages.value[messages.value.length - 1])
    await saveCachedWebQQMessages(currentChat.value.type, currentChat.value.peerId, messages.value)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载聊天历史失败'
  } finally {
    loading.value = false
  }
  if (!errorText.value && trackingMessages.value) await scrollMessagesToBottom()
}

function shouldLoadOlderMessages() {
  const pane = messagePane.value
  return !!currentChat.value &&
    !!pane &&
    pane.scrollTop <= 8 &&
    messages.value.length > 0 &&
    !historyLoading.value &&
    !historyExhausted.value
}

async function loadOlderMessages() {
  if (!currentChat.value || historyLoading.value || historyExhausted.value) return
  const pane = messagePane.value
  const previousScrollHeight = pane?.scrollHeight ?? 0
  const previousCount = messages.value.length
  historyLoading.value = true
  try {
    const olderMessages = await send('chat-capsule/webqq/messages', {
      type: currentChat.value.type,
      peerId: currentChat.value.peerId,
      beforeSequence: messages.value[0]?.sequence,
    }) as WebQQMessage[] || []
    rememberMessageSenderMetadata(currentChat.value.type, currentChat.value.peerId, olderMessages)
    messages.value = mergeMessages(olderMessages, messages.value)
    updateConversationSummary(currentChat.value.type, currentChat.value.peerId, messages.value[messages.value.length - 1])
    await saveCachedWebQQMessages(currentChat.value.type, currentChat.value.peerId, messages.value)
    historyExhausted.value = messages.value.length === previousCount
    await nextTick()
    if (pane) pane.scrollTop = pane.scrollHeight - previousScrollHeight
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载更早聊天历史失败'
  } finally {
    historyLoading.value = false
  }
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

async function saveLiveWebQQMessage(payload: WebQQLiveMessage) {
  const cachedMessages = await loadCachedWebQQMessages(payload.type, payload.peerId)
  await saveCachedWebQQMessages(payload.type, payload.peerId, mergeMessages(cachedMessages, [payload.message]))
}

receive('chat-capsule/webqq/message', (payload: WebQQLiveMessage) => {
  rememberMessageSenderMetadata(payload.type, payload.peerId, [payload.message])
  updateConversationSummary(payload.type, payload.peerId, payload.message)
  if (
    currentChat.value?.type !== payload.type ||
    currentChat.value.peerId !== payload.peerId
  ) {
    if (payload.message.direction === 'incoming') increaseUnreadCount(payload.type, payload.peerId)
    saveLiveWebQQMessage(payload).catch(() => {})
    return
  }
  if (
    payload.message.direction === 'incoming' &&
    (!props.visible || !trackingMessages.value)
  ) increaseUnreadCount(payload.type, payload.peerId)
  appendMessage(payload.message)
  saveCachedWebQQMessages(payload.type, payload.peerId, messages.value).catch(() => {})
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
