<template>
  <div ref="webQQRoot" :class="['onebot-webqq-webqq', enableWebQQFrostedGlass ? 'is-frosted' : 'is-plain', `is-chat-style-${webQQChatStyle}`, { 'has-tim-bubble-tail': webQQTimBubbleTail, 'is-resizable': allowWebQQResize, 'is-resizing': webQQResizing }, `is-color-${resolvedWebQQColorMode}`]" :style="webQQAccentStyle" role="dialog" aria-label="WebQQ 观察窗" @click="closeNoticeMenu">
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
      @open-contact-profile="openContactProfile"
      @set-remark="openRemarkDialog"
      @delete-recent="handleDeleteRecent"
      @delete-friend="confirmDeleteFriend"
      @leave-group="confirmLeaveGroup"
      @open-notices="openNotices"
      @handle-notice="handleNotice"
    />
    <section :class="['onebot-webqq-webqq__chat', { 'is-mobile-group-info-open': groupInfoOpen && currentChat?.type === 'group' }]">
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
        <header class="onebot-webqq-webqq__chat-header" :class="{ 'is-searching': messageSearchOpen }">
          <div class="onebot-webqq-webqq__chat-title">
            <ContextMenu v-if="currentChat">
              <ContextMenuTrigger as-child>
                <button
                  type="button"
                  class="onebot-webqq-webqq__chat-avatar-trigger"
                  :aria-label="`查看 ${currentTitle} 的资料`"
                  @click="openCurrentChatProfile($event)"
                  @pointerdown="(event) => { if (event.button === 2) rememberFloatingPanelAnchor(event) }"
                  @contextmenu="rememberFloatingPanelAnchor($event)"
                >
                  <img v-if="currentAvatar" class="onebot-webqq-webqq__chat-avatar" :src="withProxy(currentAvatar)" :alt="currentTitle">
                  <span v-else class="onebot-webqq-webqq__chat-avatar is-fallback" aria-hidden="true">{{ currentTitle.slice(0, 1) }}</span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent style="z-index: 10140">
                <ContextMenuItem @select="openCurrentChatProfile()">
                  <IconId :size="16" aria-hidden="true" /> 查看资料
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            <div>
              <strong>{{ currentTitle }}</strong>
              <span>{{ currentSubtitle }}</span>
            </div>
          </div>
          <div class="onebot-webqq-webqq__chat-header-actions">
            <div v-if="currentChat" class="onebot-webqq-webqq__chat-search-shell" :class="{ 'is-expanded': messageSearchOpen }">
              <button v-if="!messageSearchOpen" ref="messageSearchTrigger" class="onebot-webqq-webqq__chat-search-trigger" type="button" aria-label="查找聊天记录" @click="openMessageSearch">
                <IconSearch class="onebot-webqq-webqq__header-icon" :size="20" aria-hidden="true" />
              </button>
              <WebQQMessageSearchPage
                v-else
                v-model:query="messageSearchQuery"
                v-model:local-date="messageSearchLocalDate"
                :results="messageSearchResults"
                :loading="messageSearchLoading"
                :error-text="messageSearchErrorText"
                :searched="messageSearchSearched"
                :scanned-count="messageSearchScannedCount"
                :exhausted="messageSearchExhausted"
                @close="closeMessageSearch"
                @search="searchMessages"
                @more="searchMoreMessages"
                @select="selectSearchResult"
              />
            </div>
            <button v-if="currentChat?.type === 'group'" :class="{ 'is-active': groupInfoOpen }" type="button" :aria-label="groupInfoOpen ? '关闭群信息' : '更多群信息'" @click="toggleGroupInfo">
              <svg class="onebot-webqq-webqq__header-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </button>
          </div>
        </header>
        <div :class="['onebot-webqq-webqq__chat-body', { 'has-send-input': enableWebQQSend && currentChat }]">
          <div ref="messagePane" v-webqq-scrollbar class="onebot-webqq-webqq__messages" :class="{ 'is-selecting': selectionMode }" @scroll="updateMessageTracking">
            <WebQQMessageList
              ref="messageList"
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
              :chat-type="currentChat?.type || ''"
              :current-operator-id="currentOperatorId"
              :group-members="groupInfo.members"
              :friend-menu-states="friendMenuStates"
              :selection-mode="selectionMode"
              :selected-message-ids="selectedMessageIds"
              @open-image="openImagePreview"
              @image-load="handleMessageImageLoad"
              @open-forward="openForwardDialog"
              @toggle-thinking="toggleThinking"
              @reply="setReplyTarget"
              @recall-message="handleRecallMessage"
              @enter-selection="enterSelection"
              @toggle-selection="toggleSelection"
              @open-reaction-picker="openReactionPicker"
              @set-message-reaction="handleSetMessageReaction"
              @open-profile="openUserProfile"
              @poke-friend="handlePokeFriend"
              @set-remark="openRemarkDialog"
              @delete-friend="handleDeleteFriend"
              @mention-group-member="handleMentionGroupMember"
              @poke-group-member="handlePokeGroupMember"
              @set-group-card="openGroupCardDialog"
              @set-group-title="openGroupTitleDialog"
              @set-group-admin="handleSetGroupAdmin"
              @kick-group-member="handleKickGroupMember"
            />
          </div>
          <div v-if="selectionMode" class="onebot-webqq-webqq__selection-bar" role="toolbar" aria-label="消息多选操作">
            <strong class="onebot-webqq-webqq__selection-bar-count">已选 {{ selectedMessageIds.length }} 条</strong>
            <div class="onebot-webqq-webqq__selection-bar-actions">
              <Button variant="outline" class="onebot-webqq-webqq__selection-bar-button" @click="exitSelection">取消</Button>
              <Button class="onebot-webqq-webqq__selection-bar-button" :disabled="!selectedMessageIds.length" @click="handleSelectionForward">
                <IconShare3 :size="16" aria-hidden="true" />
                合并转发
              </Button>
            </div>
          </div>
          <form v-if="enableWebQQSend && currentChat && !selectionMode" ref="sendForm" class="onebot-webqq-webqq__send" @submit.prevent="sendCurrentWebQQMessage">
            <div v-if="replyingToMessage || sendFiles.length" ref="sendContext" class="onebot-webqq-webqq__send-context">
              <div v-if="replyingToMessage" class="onebot-webqq-webqq__reply-draft">
                <span>回复 {{ replyingToMessage.senderName }}：{{ replyingToMessage.summary }}</span>
                <button type="button" class="onebot-webqq-webqq__reply-draft-close" aria-label="清除回复" @click="clearReplyTarget">
                  <IconX :size="15" aria-hidden="true" />
                </button>
              </div>
              <template v-for="file in sendFiles" :key="file.id">
                <span v-if="file.kind === 'file' || !file.previewUrl" class="onebot-webqq-webqq__send-file">
                  <svg class="onebot-webqq-webqq__send-file-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"></path>
                    <path d="M14 2v5h5"></path>
                  </svg>
                  <span class="onebot-webqq-webqq__send-file-name">
                    <span class="onebot-webqq-webqq__send-file-base">{{ file.baseName }}</span><span>{{ file.extension }}</span>
                  </span>
                  <button type="button" :aria-label="`移除 ${file.file.name}`" @click="removeSendFile(file.id)">
                    <svg class="onebot-webqq-webqq__send-remove-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                  </button>
                </span>
                <span v-else-if="file.kind === 'video'" class="onebot-webqq-webqq__send-image">
                  <span class="onebot-webqq-webqq__send-image-preview" role="img" :aria-label="`视频 ${file.file.name}`">
                    <video :src="file.previewUrl" muted playsinline preload="metadata" aria-hidden="true"></video>
                  </span>
                  <button type="button" class="onebot-webqq-webqq__send-image-remove" :aria-label="`移除 ${file.file.name}`" @click="removeSendFile(file.id)">
                    <svg class="onebot-webqq-webqq__send-remove-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                  </button>
                </span>
                <span v-else class="onebot-webqq-webqq__send-image">
                  <button class="onebot-webqq-webqq__send-image-preview" type="button" :aria-label="`预览 ${file.file.name}`" @click="openLocalImagePreview(file.previewUrl)"><img :src="file.previewUrl" :alt="file.file.name"></button>
                  <button type="button" class="onebot-webqq-webqq__send-image-remove" :aria-label="`移除 ${file.file.name}`" @click="removeSendFile(file.id)">
                    <svg class="onebot-webqq-webqq__send-remove-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                  </button>
                </span>
              </template>
            </div>
            <img v-if="selectedBotAvatar" class="onebot-webqq-webqq__send-avatar" :src="withProxy(selectedBotAvatar)" alt="">
            <span v-else class="onebot-webqq-webqq__send-avatar" aria-hidden="true"></span>
            <div class="onebot-webqq-webqq__send-main">
              <span v-if="isComposerDraftEmpty" class="onebot-webqq-webqq__send-placeholder" aria-hidden="true">发送消息</span>
              <div
                ref="sendTextInput"
                v-webqq-scrollbar="{ tone: 'accent' }"
                class="onebot-webqq-webqq__send-text"
                role="textbox"
                aria-multiline="true"
                :aria-disabled="sendingWebQQMessage ? 'true' : undefined"
                :contenteditable="sendingWebQQMessage ? 'false' : 'true'"
                @keydown="handleComposerKeydown"
                @input="handleComposerInput"
                @compositionstart="composerIsComposing = true"
                @compositionend="handleComposerCompositionEnd"
                @paste="handleSendPaste"
                @mouseup="syncComposerCaretFromDom"
                @keyup="syncComposerCaretFromDom"
              ></div>
              <WebQQMentionMenu v-if="mentionMenuOpen" :candidates="filteredMentionCandidates" :active-index="mentionMenuIndex" @select="selectMentionCandidate" @hover="mentionMenuIndex = $event" />
            </div>
            <input ref="sendFileInput" class="onebot-webqq-webqq__send-file-input" type="file" multiple @change="handleSendFileSelect">
            <button class="onebot-webqq-webqq__send-action" type="button" aria-label="选择文件" :disabled="sendingWebQQMessage" @click="openSendFilePicker">
              <svg class="onebot-webqq-webqq__send-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.5 12.5 21a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5"></path></svg>
            </button>
            <button class="onebot-webqq-webqq__send-action is-primary" type="submit" aria-label="发送" :disabled="sendingWebQQMessage || !canSendWebQQMessage">
              <svg class="onebot-webqq-webqq__send-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"></path><path d="m22 2-7 20-4-9-9-4Z"></path></svg>
            </button>
          </form>
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
        :current-operator-id="currentOperatorId"
        @open-profile="openUserProfile"
        @mention-group-member="handleMentionGroupMember"
        @poke-group-member="handlePokeGroupMember"
        @set-group-card="openGroupCardDialog"
        @set-group-title="openGroupTitleDialog"
        @set-group-admin="handleSetGroupAdmin"
        @kick-group-member="handleKickGroupMember"
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
    <WebQQEmojiPicker v-model:open="reactionPickerOpen" @select="selectReaction" />
    <WebQQForwardTargetDialog v-model:open="forwardTargetOpen" :model="forwardTargets" @confirm="confirmSelectionForward" />
    <WebQQProfileCard v-model:open="profileCardOpen" :model="profileCardModel" @save-self-profile="handleSaveSelfProfile" />
    <WebQQConfirmDialog
      v-model:open="confirmDialogOpen"
      :title="confirmDialogTitle"
      :description="confirmDialogDescription"
      :confirm-text="confirmDialogConfirmText"
      @confirm="confirmDestructiveAction"
    />
    <WebQQActionDialog
      v-model:open="actionDialogOpen"
      :title="actionDialogTitle"
      :description="actionDialogDescription"
      :placeholder="actionDialogPlaceholder"
      :value="actionDialogValue"
      :confirm-text="actionDialogConfirmText"
      @confirm="confirmActionDialog"
    />
    <span v-if="allowWebQQResize" class="onebot-webqq-webqq__resize-zone is-left" aria-hidden="true" @pointerdown.stop.prevent="startWebQQResize('left', $event)"></span>
    <span v-if="allowWebQQResize" class="onebot-webqq-webqq__resize-zone is-top" aria-hidden="true" @pointerdown.stop.prevent="startWebQQResize('top', $event)"></span>
    <span v-if="allowWebQQResize" class="onebot-webqq-webqq__resize-zone is-top-left" aria-hidden="true" @pointerdown.stop.prevent="startWebQQResize('top-left', $event)"></span>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Binary, withProxy } from '@koishijs/client'
import { IconId, IconSearch, IconShare3, IconX } from '@tabler/icons-vue'
import { Button } from '../components/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '../components/ui/context-menu'
import WebQQActionDialog from './components/WebQQActionDialog.vue'
import WebQQConfirmDialog from './components/WebQQConfirmDialog.vue'
import WebQQEmojiPicker from './components/WebQQEmojiPicker.vue'
import WebQQMessageList from './components/WebQQMessageList.vue'
import WebQQMentionMenu from './components/WebQQMentionMenu.vue'
import WebQQSidebar from './components/WebQQSidebar.vue'
import WebQQNoticeMenu from './components/WebQQNoticeMenu.vue'
import WebQQForwardModal from './components/WebQQForwardModal.vue'
import WebQQMessageSearchPage from './components/WebQQMessageSearchPage.vue'
import WebQQForwardTargetDialog, { type WebQQForwardTargetModel, type WebQQForwardTargetOption } from './components/WebQQForwardTargetDialog.vue'
import WebQQGroupInfoPanel from './components/WebQQGroupInfoPanel.vue'
import WebQQImagePreview from './components/WebQQImagePreview.vue'
import WebQQProfileCard from './components/WebQQProfileCard.vue'
import {
  approveWebQQNotice,
  performWebQQFriendAction,
  performWebQQGroupAction,
  recallWebQQMessage,
  requestWebQQContacts,
  requestWebQQContactsWithRetry,
  requestWebQQGroupInfo,
  requestWebQQMessages,
  requestWebQQNotices,
  requestWebQQProfile,
  requestWebQQRecordTranscription,
  searchWebQQMessages,
  sendWebQQForward,
  sendWebQQMessage,
  setWebQQMessageReaction,
  updateWebQQSelfProfile,
} from './api/webqq'
import { webQQCapsule as capsule } from '../entry-state'
import { availableBots, selectedBotSelfId } from '../onebot/bots'
import { allowWebQQResize, enableWebQQFrostedGlass, enableWebQQSend, hideWebQQGroupLevel, resolvedWebQQColorMode, showWebQQAffinity, showWebQQRelationship, showWebQQThinkingTiming, showWebQQThinkingTokens, webQQAccentColor, webQQChatStyle, webQQMessageCacheLimit, webQQStorageBackend, webQQTimBubbleTail } from './settings'
import { webQQTotalUnread } from './runtime-state'
import type { WebQQFriend, WebQQGroup, WebQQGroupMember, WebQQMessage, WebQQMessageSearchResult, WebQQSendElement } from './types'
import type { FriendMenuState } from './utils/friend-menu'
import { rememberFloatingPanelAnchor } from './utils/floating-panel'
import { readWebQQErrorMessage } from './utils/webqq-error'
import { useWebQQFrostedSurfaceFlag } from './utils/webqq-frosted-surface'
import { localDateToMessageSearchRange } from './utils/message-search-date'
import { filterWebQQSearchMessages } from '../../src/webqq/message-search'
import {
  createEmptyWebQQComposerDraft,
  detectWebQQMentionTrigger,
  filterWebQQMentionCandidates,
  insertWebQQComposerMention,
  isWebQQComposerDraftEmpty,
  normalizeWebQQComposerTokens,
  replaceWebQQComposerTextRange,
  serializeWebQQComposerDraft,
  type WebQQComposerDraft,
  type WebQQComposerDraftToken,
  type WebQQMentionCandidate,
} from './utils/webqq-composer-draft'
import { applyLocalWebQQReaction, applyLocalWebQQRecall } from './utils/webqq-interaction-state'
import { buildGroupProfileCardModel, buildProfileCardModelFromProfile, buildUserProfileCardModel, type ProfileCardModel } from './utils/profile-card'
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
  mergeMessages,
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

type WebQQSendFileKind = 'image' | 'video' | 'file'

interface WebQQSendFile {
  id: string
  file: File
  kind: WebQQSendFileKind
  previewUrl?: string
  baseName: string
  extension: string
}

const webQQVideoFileExtensions = new Set(['mp4', 'webm', 'mov', 'm4v', '3gp'])

const props = defineProps<{ visible: boolean }>()

// 把毛玻璃开关同步到 body[data-onebot-webqq-frosted]，
// 供 Teleport 到 body 的右键菜单、Dialog 和二级页切换实体/雾化双态。
useWebQQFrostedSurfaceFlag()
const webQQRoot = ref<HTMLElement>()
const messageSearchTrigger = ref<HTMLButtonElement>()
const messageList = ref<{ scrollToMessage: (messageId: string) => boolean }>()
const webQQShellSize = ref<WebQQShellSize>()
const webQQStorageScope = computed(() => availableBots.value.length > 1 ? selectedBotSelfId.value : '')
const capsuleProfileStorageKey = 'onebot-webqq:bot-profile:v1'
const webQQSendAvatarStorageKey = 'onebot-webqq:webqq-send-avatars:v1'

function loadCachedCapsuleBotAvatar() {
  if (typeof localStorage === 'undefined') return ''
  try {
    const data = JSON.parse(localStorage.getItem(capsuleProfileStorageKey) || '{}')
    return data && typeof data === 'object' && typeof data.avatar === 'string' ? data.avatar : ''
  } catch {
    return ''
  }
}

function loadWebQQSendAvatarCache() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const data = JSON.parse(localStorage.getItem(webQQSendAvatarStorageKey) || '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return Object.fromEntries(Object.entries(data).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}

const cachedSendBotAvatars = ref<Record<string, string>>(loadWebQQSendAvatarCache())
const cachedCapsuleBotAvatar = ref(loadCachedCapsuleBotAvatar())

function rememberSendBotAvatar(selfId?: string, avatar?: string) {
  if (!selfId || !avatar || cachedSendBotAvatars.value[selfId] === avatar) return
  cachedSendBotAvatars.value = { ...cachedSendBotAvatars.value, [selfId]: avatar }
  try {
    localStorage.setItem(webQQSendAvatarStorageKey, JSON.stringify(cachedSendBotAvatars.value))
  } catch {}
}

const {
  conversationSummaries,
  hiddenRecentKeys,
  totalUnreadCount,
  loadRemoteWebQQStoredState,
  updateConversationSummary,
  getContactSubtitle,
  getContactTime,
  getUnreadCount,
  increaseUnreadCount,
  clearUnreadCount,
  hideRecentConversation,
  revealRecentConversation,
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
} = useWebQQContacts(conversationSummaries, hiddenRecentKeys)
const isWebQQMockEnvironment = computed(() => !!contacts.value.mockEnvironment)
const { rememberMessageSenderMetadata, applyMessageSenderMetadata } = useWebQQSenderMetadata(currentChat)
const { isThinkingExpanded, toggleThinking } = useWebQQThinkingExpansion()
const loading = ref(false)
const errorText = ref('')
const contactsLoadFailed = ref(false)
const contactsRecoverySignal = computed(() => JSON.stringify({
  selectedSelfId: selectedBotSelfId.value,
  bots: availableBots.value.map((bot) => [bot.selfId, bot.status]),
  conversationTimestamp: capsule.value?.conversation?.timestamp,
}))
const imagePreviewUrl = ref('')
const composerDraft = ref<WebQQComposerDraft>(createEmptyWebQQComposerDraft())
const sendFiles = ref<WebQQSendFile[]>([])
const sendingWebQQMessage = ref(false)
const sendTextInput = ref<HTMLElement>()
const sendFileInput = ref<HTMLInputElement>()
const sendForm = ref<HTMLElement>()
const sendContext = ref<HTMLElement>()
const webQQSendSpace = ref(80)
const webQQSendHeight = ref(44)
const composerIsComposing = ref(false)
const mentionMenu = ref<{ tokenIndex: number, start: number, query: string }>()
const mentionMenuIndex = ref(0)
let suppressComposerInput = false
let contactsLoadVersion = 0
const selectedBotAvatar = computed(() => {
  const selected = availableBots.value.find((bot) => bot.selfId === selectedBotSelfId.value)
  const selectedSelfId = selected?.selfId || selectedBotSelfId.value
  const capsuleBot = capsule.value?.bot
  const fallback = availableBots.value[0]
  const displayBotAvatar = selected?.avatar || (!selectedSelfId || capsuleBot?.selfId === selectedSelfId ? capsuleBot?.avatar : '')
  return displayBotAvatar ||
    cachedCapsuleBotAvatar.value ||
    (selectedSelfId ? cachedSendBotAvatars.value[selectedSelfId] : '') ||
    fallback?.avatar ||
    (fallback?.selfId ? cachedSendBotAvatars.value[fallback.selfId] : '') ||
    ''
})
const isComposerDraftEmpty = computed(() => isWebQQComposerDraftEmpty(composerDraft.value.tokens))
const canSendWebQQMessage = computed(() => !isComposerDraftEmpty.value || !!sendFiles.value.length)

async function loadCachedWebQQMessages(type: 'friend' | 'group', peerId: string) {
  // 模拟场景必须以服务端预设为唯一真相，避免旧浏览器缓存继续展示已经修正过的角色和测试消息。
  if (isWebQQMockEnvironment.value) return []
  return loadStoredWebQQMessages(type, peerId, webQQStorageBackend.value, webQQStorageScope.value)
}

async function saveCachedWebQQMessages(type: 'friend' | 'group', peerId: string, messages: WebQQMessage[]) {
  if (isWebQQMockEnvironment.value) return
  await saveStoredWebQQMessages(type, peerId, messages, webQQStorageBackend.value, webQQMessageCacheLimit.value, webQQStorageScope.value)
}

function openImagePreview(url: string) {
  imagePreviewUrl.value = withProxy(url)
}

function closeImagePreview() {
  imagePreviewUrl.value = ''
}

function openLocalImagePreview(url: string) {
  imagePreviewUrl.value = url
}

function getSendFileNameParts(name: string) {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0) return { baseName: name, extension: '' }
  return {
    baseName: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  }
}

function getSendFileKind(file: File): WebQQSendFileKind {
  const mime = file.type.toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  // Firefox 与部分系统文件选择器可能不提供 MIME；仅对 QQ 常见可播放格式回退，
  // 避免把不受支持的视频容器误发为原生视频消息。
  return webQQVideoFileExtensions.has(extension) ? 'video' : 'file'
}

function addSendFiles(files: Iterable<File>) {
  for (const file of files) {
    const kind = getSendFileKind(file)
    sendFiles.value.push({
      id: `${file.name}:${file.size}:${file.lastModified}:${sendFiles.value.length}`,
      file,
      kind,
      previewUrl: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : undefined,
      ...getSendFileNameParts(file.name),
    })
  }
}

function removeSendFile(id: string) {
  const file = sendFiles.value.find((file) => file.id === id)
  if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
  sendFiles.value = sendFiles.value.filter((file) => file.id !== id)
}

function clearSendFiles() {
  for (const file of sendFiles.value) {
    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
  }
  sendFiles.value = []
}

function openSendFilePicker() {
  sendFileInput.value?.click()
}

function handleSendFileSelect(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  if (input.files) addSendFiles(input.files)
  input.value = ''
}

function handleSendPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? [])
  if (!files.length) return
  event.preventDefault()
  addSendFiles(files)
}

function resetComposerDraft(options: { focus?: boolean } = {}) {
  applyComposerDraft(createEmptyWebQQComposerDraft(), options)
}

function closeMentionMenu() {
  mentionMenu.value = undefined
  mentionMenuIndex.value = 0
}

function renderComposerDraft(current: WebQQComposerDraft) {
  const editor = sendTextInput.value
  if (!editor) return
  suppressComposerInput = true
  editor.replaceChildren()
  for (const token of current.tokens) {
    if (token.type === 'text') {
      // 空文本 token 用零宽字符提供可点击的光标锚点；读回草稿时会统一移除。
      editor.appendChild(document.createTextNode(token.text || '​'))
      continue
    }
    const mention = document.createElement('span')
    mention.className = 'onebot-webqq-webqq__composer-mention'
    mention.contentEditable = 'false'
    mention.dataset.mentionId = token.id
    mention.dataset.mentionName = token.name
    mention.textContent = `@${token.name}`
    editor.appendChild(mention)
  }
  if (!editor.childNodes.length) editor.appendChild(document.createTextNode(''))
  suppressComposerInput = false
}

function applyComposerDraft(next: WebQQComposerDraft, options: { focus?: boolean } = {}) {
  composerDraft.value = {
    tokens: normalizeWebQQComposerTokens(next.tokens),
    tokenIndex: next.tokenIndex,
    offset: next.offset,
  }
  renderComposerDraft(composerDraft.value)
  if (options.focus === false) return
  void nextTick(() => {
    sendTextInput.value?.focus()
    setComposerCaret(composerDraft.value.tokenIndex, composerDraft.value.offset)
  })
}

function readComposerDraftFromDom(): WebQQComposerDraft {
  const editor = sendTextInput.value
  if (!editor) return createEmptyWebQQComposerDraft()
  const tokens: WebQQComposerDraftToken[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      tokens.push({ type: 'text', text: node.textContent ?? '' })
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.dataset.mentionId) {
      tokens.push({
        type: 'mention',
        id: node.dataset.mentionId,
        name: node.dataset.mentionName || node.textContent?.replace(/^@/, '') || node.dataset.mentionId,
      })
      return
    }
    if (node.tagName === 'BR') {
      tokens.push({ type: 'text', text: '\n' })
      return
    }
    node.childNodes.forEach(walk)
  }
  editor.childNodes.forEach(walk)
  return {
    tokens: normalizeWebQQComposerTokens(tokens),
    tokenIndex: composerDraft.value.tokenIndex,
    offset: composerDraft.value.offset,
  }
}

function getComposerCaret(tokens = composerDraft.value.tokens) {
  const editor = sendTextInput.value
  const selection = window.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.startContainer)) return

  const mapNodeToToken = (node: Node) => {
    let index = 0
    for (const child of Array.from(editor.childNodes)) {
      if (child === node || child.contains(node)) return index
      if (child.nodeType === Node.TEXT_NODE || (child instanceof HTMLElement && child.dataset.mentionId)) index += 1
    }
    return Math.max(0, tokens.length - 1)
  }

  if (range.startContainer === editor) {
    let tokenIndex = 0
    for (let childIndex = 0; childIndex < editor.childNodes.length; childIndex += 1) {
      const child = editor.childNodes[childIndex]
      if (childIndex === range.startOffset) {
        if (child.nodeType === Node.TEXT_NODE) return { tokenIndex, offset: 0 }
        return { tokenIndex: Math.max(0, tokenIndex - 1), offset: Number.MAX_SAFE_INTEGER }
      }
      if (child.nodeType === Node.TEXT_NODE || (child instanceof HTMLElement && child.dataset.mentionId)) tokenIndex += 1
    }
    return { tokenIndex: Math.max(0, tokens.length - 1), offset: Number.MAX_SAFE_INTEGER }
  }

  let tokenIndex = mapNodeToToken(range.startContainer)
  let offset = range.startContainer.nodeType === Node.TEXT_NODE ? range.startOffset : 0
  const token = tokens[tokenIndex]
  if (token?.type === 'text') {
    offset = Math.min(Math.max(offset, 0), token.text.length)
  } else {
    tokenIndex = Math.min(tokenIndex + 1, tokens.length - 1)
    offset = 0
  }
  return { tokenIndex, offset }
}

function setComposerCaret(tokenIndex: number, offset: number) {
  const editor = sendTextInput.value
  const selection = window.getSelection()
  if (!editor || !selection) return
  let index = 0
  let targetNode: Node | undefined
  let targetOffset = 0
  for (const child of Array.from(editor.childNodes)) {
    const isToken = child.nodeType === Node.TEXT_NODE || (child instanceof HTMLElement && !!child.dataset.mentionId)
    if (!isToken) continue
    if (index === tokenIndex) {
      if (child.nodeType === Node.TEXT_NODE) {
        targetNode = child
        targetOffset = Math.min(Math.max(offset, 0), child.textContent?.length ?? 0)
      } else {
        const next = child.nextSibling
        targetNode = next?.nodeType === Node.TEXT_NODE ? next : child
      }
      break
    }
    index += 1
  }
  if (!targetNode) {
    targetNode = editor
    targetOffset = editor.childNodes.length
  }
  const range = document.createRange()
  try {
    range.setStart(targetNode, targetOffset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  } catch {
    // Chrome 与 Firefox 在节点刚替换时都可能暂时拒绝 setStart；下次输入会重新同步光标。
  }
}

function syncComposerCaretFromDom() {
  const caret = getComposerCaret()
  if (!caret) return
  const token = composerDraft.value.tokens[caret.tokenIndex]
  composerDraft.value = {
    ...composerDraft.value,
    tokenIndex: caret.tokenIndex,
    offset: token?.type === 'text' ? Math.min(caret.offset, token.text.length) : 0,
  }
}

function updateMentionMenuFromDraft(current: WebQQComposerDraft) {
  if (!mentionCandidates.value.length || composerIsComposing.value) {
    closeMentionMenu()
    return
  }
  const token = current.tokens[current.tokenIndex]
  if (token?.type !== 'text') {
    closeMentionMenu()
    return
  }
  const trigger = detectWebQQMentionTrigger(token.text, current.offset)
  if (!trigger) {
    closeMentionMenu()
    return
  }
  mentionMenu.value = { tokenIndex: current.tokenIndex, start: trigger.start, query: trigger.query }
  mentionMenuIndex.value = 0
}

function handleComposerInput() {
  if (suppressComposerInput) return
  const next = readComposerDraftFromDom()
  // 当前 DOM 已经包含新输入，光标必须按 next.tokens 限制；若仍按旧草稿长度钳制，中途键入的 @ 会被截到光标之后。
  const caret = getComposerCaret(next.tokens)
  composerDraft.value = {
    tokens: next.tokens,
    tokenIndex: caret?.tokenIndex ?? next.tokenIndex,
    offset: caret?.offset ?? next.offset,
  }
  updateMentionMenuFromDraft(composerDraft.value)
  // 与 sandbox 一致：contenteditable 的 input 可能早于 Selection 更新，下一微任务必须重新读取真实光标。
  void nextTick(() => {
    const currentCaret = getComposerCaret()
    if (!currentCaret) return
    const currentToken = composerDraft.value.tokens[currentCaret.tokenIndex]
    composerDraft.value = {
      ...composerDraft.value,
      tokenIndex: currentCaret.tokenIndex,
      offset: currentToken?.type === 'text'
        ? Math.min(currentCaret.offset, currentToken.text.length)
        : 0,
    }
    updateMentionMenuFromDraft(composerDraft.value)
  })
}

function handleComposerCompositionEnd() {
  composerIsComposing.value = false
  handleComposerInput()
}

function insertExternalMention(candidate: Pick<WebQQMentionCandidate, 'id' | 'name'>) {
  syncComposerCaretFromDom()
  const current = composerDraft.value
  const token = current.tokens[current.tokenIndex]
  const offset = token?.type === 'text' ? current.offset : 0
  applyComposerDraft(insertWebQQComposerMention(current.tokens, current.tokenIndex, offset, candidate))
  closeMentionMenu()
}

function selectMentionCandidate(candidate: WebQQMentionCandidate) {
  const menu = mentionMenu.value
  if (!menu) return
  const token = composerDraft.value.tokens[menu.tokenIndex]
  const end = token?.type === 'text' ? composerDraft.value.offset : menu.start
  applyComposerDraft(replaceWebQQComposerTextRange(
    composerDraft.value.tokens,
    menu.tokenIndex,
    menu.start,
    Math.max(menu.start, end),
    candidate,
  ))
  closeMentionMenu()
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (sendingWebQQMessage.value) {
    event.preventDefault()
    return
  }
  if (mentionMenuOpen.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!filteredMentionCandidates.value.length) return
      const direction = event.key === 'ArrowDown' ? 1 : -1
      mentionMenuIndex.value = (mentionMenuIndex.value + direction + filteredMentionCandidates.value.length) % filteredMentionCandidates.value.length
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      const candidate = filteredMentionCandidates.value[mentionMenuIndex.value]
      if (candidate) selectMentionCandidate(candidate)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMentionMenu()
      return
    }
  }
  if (event.key === 'Enter' && !event.shiftKey && !composerIsComposing.value) {
    event.preventDefault()
    void sendCurrentWebQQMessage()
  }
}

async function toSendElement(file: File): Promise<WebQQSendElement> {
  return {
    type: getSendFileKind(file),
    data: `data:${file.type || 'application/octet-stream'};base64,${Binary.toBase64(await file.arrayBuffer())}`,
    name: file.name,
  }
}

async function sendCurrentWebQQMessage() {
  const chat = currentChat.value
  if (!chat || sendingWebQQMessage.value || !canSendWebQQMessage.value) return
  // 捕获发送发起时的 textarea 和会话；异步期间切换会话时，不能把焦点错误地抢到新会话输入框。
  const requestInput = sendTextInput.value
  const requestChatKey = `${chat.type}:${chat.peerId}`
  sendingWebQQMessage.value = true
  errorText.value = ''
  try {
    const elements: WebQQSendElement[] = [
      ...serializeWebQQComposerDraft(composerDraft.value.tokens),
      ...await Promise.all(sendFiles.value.map(({ file }) => toSendElement(file))),
    ]
    await sendWebQQMessage({
      type: chat.type,
      peerId: chat.peerId,
      elements,
      ...(replyingToMessageId.value ? { replyToMessageId: replyingToMessageId.value } : {}),
    })
    resetComposerDraft({ focus: false })
    closeMentionMenu()
    clearSendFiles()
    clearReplyTarget()
  } catch (error) {
    errorText.value = readWebQQErrorMessage(error, '发送消息失败')
  } finally {
    sendingWebQQMessage.value = false
    // 与 chatluna-sandbox 保持一致：必须等 disabled 解除后再恢复焦点，否则浏览器会忽略 focus。
    await nextTick()
    const activeChat = currentChat.value
    if (activeChat && `${activeChat.type}:${activeChat.peerId}` === requestChatKey && sendTextInput.value === requestInput) {
      requestInput?.focus()
    }
  }
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
  patchGroupMember,
  toggleGroupInfo,
} = useWebQQGroupInfo(currentChat, { requestGroupInfo: requestCurrentGroupInfo })

function applyCurrentGroupMemberMetadata(message: WebQQMessage) {
  const hydratedMessage = applyMessageSenderMetadata(message)
  if (currentChat.value?.type !== 'group') return hydratedMessage
  const member = groupInfo.value.members.find((item) => item.userId === message.senderId)
  if (!member) return hydratedMessage
  return {
    ...hydratedMessage,
    senderName: getGroupMemberName(member),
    senderRole: member.role,
    senderTitle: member.title || undefined,
  }
}

const mentionCandidates = computed<WebQQMentionCandidate[]>(() => {
  if (currentChat.value?.type !== 'group') return []
  return groupInfo.value.members.map((member) => {
    const displayName = getGroupMemberName(member)
    const keywords = [member.nickname, member.card].filter((value): value is string => !!value && value !== displayName)
    return {
      id: member.userId,
      name: displayName,
      avatar: member.avatar,
      ...(keywords.length ? { keywords } : {}),
    }
  })
})
const mentionMenuOpen = computed(() => !!mentionMenu.value && !!mentionCandidates.value.length)
const filteredMentionCandidates = computed(() => (
  mentionMenu.value
    ? filterWebQQMentionCandidates(mentionCandidates.value, mentionMenu.value.query)
    : []
))

watch(filteredMentionCandidates, (candidates) => {
  if (!mentionMenu.value) return
  mentionMenuIndex.value = candidates.length
    ? Math.min(mentionMenuIndex.value, candidates.length - 1)
    : 0
})

const webQQResizeStorageKey = 'onebot-webqq:webqq:resize:v1'
const webQQResizeMinWidth = 640
const webQQResizeMinHeight = 420
const webQQResizeViewportWidthGap = 32
const webQQResizeViewportHeightGap = 6
const webQQResizeDefaultBottomGap = 116
let webQQResizeState: WebQQResizeState | undefined
const webQQResizing = ref(false)

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
  const sendSpaceStyle = {
    '--onebot-webqq-webqq-send-space': `${selectionMode.value ? 64 : webQQSendSpace.value}px`,
    '--onebot-webqq-webqq-send-height': `${webQQSendHeight.value}px`,
  }
  if (!allowWebQQResize.value || !webQQShellSize.value) return { ...style, ...sendSpaceStyle }
  return {
    ...style,
    ...sendSpaceStyle,
    width: `${webQQShellSize.value.width}px`,
    height: `${webQQShellSize.value.height}px`,
  }
})

let sendFormResizeObserver: ResizeObserver | undefined
let sendContextResizeObserver: ResizeObserver | undefined

function updateWebQQSendSpace() {
  const form = sendForm.value
  const context = sendContext.value
  const contextHeight = context ? Math.ceil(context.getBoundingClientRect().height) + 8 : 0
  webQQSendHeight.value = form ? Math.ceil(form.getBoundingClientRect().height) : 44
  // 回复和附件共用同一个 wrap 包络，只计一次真实高度，避免两者同时存在时重复撑大消息区留白。
  webQQSendSpace.value = webQQSendHeight.value + contextHeight + 28
}

async function observeWebQQSendForm() {
  sendFormResizeObserver?.disconnect()
  sendContextResizeObserver?.disconnect()
  await nextTick()
  updateWebQQSendSpace()
  if (typeof ResizeObserver === 'undefined' || !sendForm.value) return
  sendFormResizeObserver = new ResizeObserver(updateWebQQSendSpace)
  sendFormResizeObserver.observe(sendForm.value)
  if (!sendContext.value) return
  sendContextResizeObserver = new ResizeObserver(updateWebQQSendSpace)
  sendContextResizeObserver.observe(sendContext.value)
}

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

watch(webQQSendSpace, () => {
  if (trackingMessages.value) scrollMessagesToBottom()
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
  applyMessageSenderMetadata: applyCurrentGroupMemberMetadata,
  shouldScrollToBottom: () => trackingMessages.value,
  scrollMessagesToBottom,
})

const selectionMode = ref(false)
const selectedMessageIds = ref<string[]>([])
const messageSearchOpen = ref(false)
const messageSearchQuery = ref('')
const messageSearchLocalDate = ref('')
const messageSearchResults = ref<WebQQMessage[]>([])
const messageSearchLoading = ref(false)
const messageSearchErrorText = ref('')
const messageSearchSearched = ref(false)
const messageSearchScannedCount = ref(0)
const messageSearchExhausted = ref(true)
const messageSearchNextBeforeSequence = ref('')
const forwardTargetOpen = ref(false)
const replyingToMessageId = ref('')
const reactionPickerMessageId = ref('')
const profileCardOpen = ref(false)
const profileCardModel = ref<ProfileCardModel>()
const actionDialogOpen = ref(false)
const actionDialogTitle = ref('')
const actionDialogDescription = ref('')
const actionDialogPlaceholder = ref('')
const actionDialogValue = ref('')
const actionDialogConfirmText = ref('保存')
let actionDialogSubmit: ((value: string) => void) | undefined
const confirmDialogOpen = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogDescription = ref('')
const confirmDialogConfirmText = ref('确认')
let confirmDialogSubmit: (() => Promise<void>) | undefined

const currentOperatorId = computed(() => selectedBotSelfId.value || availableBots.value[0]?.selfId || '')
const friendMenuStates = computed<Record<string, FriendMenuState>>(() => {
  const states: Record<string, FriendMenuState> = {}
  for (const friend of contacts.value.friends) {
    states[friend.userId] = { isFriend: true, pendingOutgoing: false, pendingIncoming: false }
  }
  return states
})
function toForwardTarget(type: 'friend' | 'group', peerId: string, title: string, subtitle?: string, avatar?: string): WebQQForwardTargetOption {
  return { id: `${type}:${peerId}`, type, peerId, title, subtitle, avatar }
}
const forwardTargets = computed<WebQQForwardTargetModel>(() => ({
  recent: recentItems.value.map((item) => toForwardTarget(item.type, item.peerId, item.name, item.subtitle, item.avatar)),
  friends: contacts.value.friends.map((friend) => toForwardTarget('friend', friend.userId, friend.name, friend.nickname, friend.avatar)),
  groups: contacts.value.groups.map((group) => toForwardTarget('group', group.groupId, group.name, getGroupSubtitle(group), group.avatar)),
}))
const reactionPickerOpen = computed({
  get: () => !!reactionPickerMessageId.value,
  set: (open: boolean) => {
    if (!open) reactionPickerMessageId.value = ''
  },
})
const replyingToMessage = computed(() => visibleMessages.value.find((message) => message.id === replyingToMessageId.value))

async function runInteraction(action: () => Promise<unknown>, fallback: string) {
  errorText.value = ''
  try {
    await action()
    return true
  } catch (error) {
    errorText.value = readWebQQErrorMessage(error, fallback)
    return false
  }
}

function isSelectableMessageId(messageId: string) {
  const message = visibleMessages.value.find((item) => item.id === messageId)
  return !!message && !message.event && !message.recalled
}

function enterSelection(messageId: string) {
  if (!isSelectableMessageId(messageId)) return
  selectionMode.value = true
  selectedMessageIds.value = [messageId]
  replyingToMessageId.value = ''
  reactionPickerMessageId.value = ''
}

function toggleSelection(messageId: string) {
  if (!selectionMode.value || !isSelectableMessageId(messageId)) return
  if (selectedMessageIds.value.includes(messageId)) {
    selectedMessageIds.value = selectedMessageIds.value.filter((id) => id !== messageId)
    return
  }
  selectedMessageIds.value = [...selectedMessageIds.value, messageId]
}

function exitSelection() {
  selectionMode.value = false
  selectedMessageIds.value = []
  forwardTargetOpen.value = false
}

function setReplyTarget(messageId: string) {
  if (selectionMode.value) return
  replyingToMessageId.value = messageId
}

function clearReplyTarget() {
  replyingToMessageId.value = ''
}

function openReactionPicker(messageId: string) {
  if (selectionMode.value) return
  reactionPickerMessageId.value = messageId
}

function selectReaction(emojiId: string) {
  const messageId = reactionPickerMessageId.value
  if (!messageId) return
  handleSetMessageReaction(messageId, emojiId, true)
  reactionPickerMessageId.value = ''
}

function handleSetMessageReaction(messageId: string, emojiId: string, enabled: boolean) {
  const chat = currentChat.value
  if (!chat) return
  void runInteraction(async () => {
    await setWebQQMessageReaction({
      type: chat.type,
      peerId: chat.peerId,
      messageId,
      emojiId,
      enabled,
    })
    // 部分 OneBot 实现执行成功却不回推自身 reaction notice；先本地提交，后续事件仍可按消息键合并校正。
    messages.value = applyLocalWebQQReaction(messages.value, messageId, emojiId, currentOperatorId.value, enabled)
    await saveCachedWebQQMessages(chat.type, chat.peerId, messages.value)
  }, enabled ? '贴表情失败' : '取消表情失败')
}

function handleRecallMessage(messageId: string) {
  const chat = currentChat.value
  if (!chat) return
  void runInteraction(async () => {
    await recallWebQQMessage({
      type: chat.type,
      peerId: chat.peerId,
      messageId,
    })
    // delete_msg 成功也不保证实现回推自身撤回事件；立即标记，避免 UI 长时间保留可操作的旧消息。
    messages.value = applyLocalWebQQRecall(messages.value, chat.type, chat.peerId, messageId)
    await saveCachedWebQQMessages(chat.type, chat.peerId, messages.value)
  }, '撤回消息失败')
}

function handleSelectionForward() {
  if (!currentChat.value || !selectedMessageIds.value.length) return
  forwardTargetOpen.value = true
}

let messageSearchSerial = 0

function resetMessageSearchResults() {
  messageSearchResults.value = []
  messageSearchErrorText.value = ''
  messageSearchSearched.value = false
  messageSearchScannedCount.value = 0
  messageSearchExhausted.value = true
  messageSearchNextBeforeSequence.value = ''
}

function openMessageSearch() {
  if (!currentChat.value) return
  messageSearchOpen.value = true
  resetMessageSearchResults()
}

function closeMessageSearch() {
  if (!messageSearchOpen.value) return
  messageSearchOpen.value = false
  messageSearchLoading.value = false
  messageSearchQuery.value = ''
  messageSearchLocalDate.value = ''
  resetMessageSearchResults()
  messageSearchSerial++
  // 搜索框由显式 v-if 卸载；外部 pointerdown 关闭时还会继续派发 mouseup/click，
  // 必须等 DOM 更新和整条指针事件链结束后再恢复焦点，否则 Chrome 与 Firefox 最终仍会把焦点落到 body。
  void nextTick(() => window.setTimeout(() => {
    if (!props.visible || !messageSearchTrigger.value?.isConnected) return
    messageSearchTrigger.value.focus({ preventScroll: true })
  }, 50))
}

async function requestMessageSearch(
  more: boolean,
  criteria?: { query: string, localDate?: string },
) {
  const chat = currentChat.value
  if (!chat) return
  if (!more && criteria) {
    messageSearchQuery.value = criteria.query
    messageSearchLocalDate.value = criteria.localDate || ''
  }
  const keyword = messageSearchQuery.value.trim()
  const dateRange = localDateToMessageSearchRange(messageSearchLocalDate.value)
  if (!keyword && !dateRange) {
    resetMessageSearchResults()
    return
  }

  const expectedChatKey = `${chat.type}:${chat.peerId}`
  const serial = ++messageSearchSerial
  messageSearchLoading.value = true
  messageSearchErrorText.value = ''
  if (!more) resetMessageSearchResults()
  let localMatches: WebQQMessage[] = []
  try {
    // 浏览器后端的持久化缓存只在前端；当前会话内存里的消息也可能比上次落盘更新。
    // 首搜先并入这些本地命中，再让服务端继续翻 OneBot / Koishi 缓存。
    let localScanned = 0
    if (!more) {
      const cached = await loadCachedWebQQMessages(chat.type, chat.peerId)
      const localPool = mergeMessages(cached, messages.value)
      localMatches = filterWebQQSearchMessages(localPool, { keyword, ...dateRange })
      localScanned = localPool.length
      // 有本地命中就先上屏，避免 OneBot 历史接口卡住时界面一直停在「搜索中...」。
      if (localMatches.length) {
        messageSearchResults.value = localMatches
        messageSearchScannedCount.value = localScanned
        messageSearchSearched.value = true
      }
    }
    const result: WebQQMessageSearchResult = await Promise.race([
      searchWebQQMessages({
        type: chat.type,
        peerId: chat.peerId,
        keyword,
        ...dateRange,
        ...(more && messageSearchNextBeforeSequence.value ? { beforeSequence: messageSearchNextBeforeSequence.value } : {}),
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('查找聊天记录超时')), 12000)
      }),
    ])
    if (serial !== messageSearchSerial || `${currentChat.value?.type}:${currentChat.value?.peerId}` !== expectedChatKey) return
    const mergedMessages = more
      ? mergeMessages(result.messages, messageSearchResults.value)
      : mergeMessages(localMatches, result.messages)
    messageSearchResults.value = mergedMessages
    messageSearchScannedCount.value = more
      ? messageSearchScannedCount.value + result.scannedCount
      : result.scannedCount + localScanned
    messageSearchExhausted.value = result.exhausted
    messageSearchNextBeforeSequence.value = result.nextBeforeSequence || ''
    messageSearchSearched.value = true
  } catch (error) {
    if (serial !== messageSearchSerial) return
    if (localMatches.length) {
      messageSearchSearched.value = true
    } else {
      messageSearchErrorText.value = readWebQQErrorMessage(error, '查找聊天记录失败')
      messageSearchSearched.value = true
    }
  } finally {
    if (serial === messageSearchSerial) messageSearchLoading.value = false
  }
}

function searchMessages(criteria: { query: string, localDate?: string }) {
  void requestMessageSearch(false, criteria)
}

function searchMoreMessages() {
  void requestMessageSearch(true)
}

async function selectSearchResult(message: WebQQMessage) {
  const chat = currentChat.value
  if (!chat) return
  messages.value = mergeMessages(messages.value, [message])
  rememberMessageSenderMetadata(chat.type, chat.peerId, [message])
  await nextTick()
  messageList.value?.scrollToMessage(message.id || message.sequence)
}

function confirmSelectionForward(target: WebQQForwardTargetOption, resolve: () => void, reject: (error: unknown) => void) {
  const messageIds = [...selectedMessageIds.value]
  void sendWebQQForward({
    type: target.type,
    peerId: target.peerId,
    messageIds,
  }).then(() => {
    exitSelection()
    resolve()
  }, reject)
}

async function openCurrentChatProfile(event?: MouseEvent) {
  const chat = currentChat.value
  if (!chat) return
  if (event) rememberFloatingPanelAnchor(event)
  if (chat.type === 'group') {
    const group = contacts.value.groups.find((item) => item.groupId === chat.peerId)
    if (!group) return
    profileCardModel.value = buildGroupProfileCardModel(group, groupInfo.value.members.length || undefined)
    profileCardOpen.value = true
    return
  }
  await openUserProfile(chat.peerId, event)
}

async function openUserProfile(userId: string, event?: MouseEvent) {
  if (event) rememberFloatingPanelAnchor(event)
  const chat = currentChat.value
  const friend = contacts.value.friends.find((item) => item.userId === userId)
  const member = groupInfo.value.members.find((item) => item.userId === userId)
  const group = chat?.type === 'group'
    ? contacts.value.groups.find((item) => item.groupId === chat.peerId)
    : undefined
  const message = visibleMessages.value.find((item) => item.senderId === userId)
  // 先展示本地可拼装资料，再覆盖真实 RPC 结果；失败时保留本地卡并显示真实错误。
  profileCardModel.value = buildUserProfileCardModel({
    userId,
    name: member ? getGroupMemberName(member) : friend?.name || message?.senderName || userId,
    avatar: member?.avatar || friend?.avatar || message?.senderAvatar,
    isFriend: !!friend,
    remark: friend && friend.name !== friend.nickname ? friend.name : undefined,
    friend,
    group,
    member,
  })
  profileCardOpen.value = true
  errorText.value = ''
  try {
    const profile = await requestWebQQProfile({
      userId,
      ...(chat?.type === 'group' ? { groupId: chat.peerId } : {}),
    })
    profileCardModel.value = buildProfileCardModelFromProfile(profile)
  } catch (error) {
    errorText.value = readWebQQErrorMessage(error, '加载资料失败')
  }
}

async function handleSaveSelfProfile(input: { nickname?: string; personalNote?: string; sex?: string; avatar?: string }, complete: (success: boolean) => void) {
  try {
    const success = await runInteraction(async () => {
      await updateWebQQSelfProfile(input)
      if (!profileCardModel.value?.participantId) return
      const profile = await requestWebQQProfile({ userId: profileCardModel.value.participantId })
      profileCardModel.value = buildProfileCardModelFromProfile(profile)
    }, '更新资料失败')
    complete(success)
  } catch {
    // runInteraction 当前会收敛异常；这里兜底保证未来实现变更后资料卡也不会永久停留在保存状态。
    complete(false)
  }
}

function openActionDialog(input: {
  title: string
  description?: string
  placeholder?: string
  value?: string
  confirmText?: string
  onConfirm: (value: string) => void | Promise<void>
}) {
  actionDialogTitle.value = input.title
  actionDialogDescription.value = input.description || ''
  actionDialogPlaceholder.value = input.placeholder || ''
  actionDialogValue.value = input.value || ''
  actionDialogConfirmText.value = input.confirmText || '保存'
  actionDialogSubmit = (value: string) => {
    void Promise.resolve(input.onConfirm(value)).catch((error) => {
      errorText.value = readWebQQErrorMessage(error, '操作失败')
    })
  }
  actionDialogOpen.value = true
}

function confirmActionDialog(value: string) {
  const submit = actionDialogSubmit
  actionDialogOpen.value = false
  actionDialogSubmit = undefined
  submit?.(value)
}

function openContactProfile(type: 'friend' | 'group', peerId: string) {
  if (type === 'friend') {
    void openUserProfile(peerId)
    return
  }
  const group = contacts.value.groups.find((item) => item.groupId === peerId)
  if (!group) return
  profileCardModel.value = buildGroupProfileCardModel(group)
  profileCardOpen.value = true
}

function handlePokeFriend(userId: string) {
  const targetId = currentChat.value?.type === 'friend' ? currentChat.value.peerId : userId
  if (!targetId || targetId === currentOperatorId.value) return
  void runInteraction(() => performWebQQFriendAction({ action: 'poke', targetId }), '好友戳一戳失败')
}

function openRemarkDialog(userId: string) {
  const friend = contacts.value.friends.find((item) => item.userId === userId)
  openActionDialog({
    title: '设置好友备注',
    description: '备注只对当前 Bot 视角生效，不会修改对方资料昵称。',
    placeholder: '留空可删除备注',
    value: friend && friend.name !== friend.nickname ? friend.name : '',
    onConfirm: async (remark) => {
      await performWebQQFriendAction({ action: 'set-remark', targetId: userId, remark })
      await loadContacts()
    },
  })
}

function openConfirmDialog(input: { title: string, description: string, confirmText: string, onConfirm: () => Promise<void> }) {
  confirmDialogTitle.value = input.title
  confirmDialogDescription.value = input.description
  confirmDialogConfirmText.value = input.confirmText
  confirmDialogSubmit = input.onConfirm
  confirmDialogOpen.value = true
}

function confirmDestructiveAction(resolve: () => void, reject: (error: unknown) => void) {
  const submit = confirmDialogSubmit
  if (!submit) {
    reject(new Error('操作已失效'))
    return
  }
  void submit().then(() => {
    confirmDialogSubmit = undefined
    resolve()
  }, (error) => {
    errorText.value = readWebQQErrorMessage(error, '操作失败')
    reject(error)
  })
}

function confirmDeleteFriend(userId: string) {
  const friend = contacts.value.friends.find((item) => item.userId === userId)
  openConfirmDialog({
    title: '删除好友',
    description: `确定删除好友「${friend?.name || userId}」？`,
    confirmText: '删除好友',
    onConfirm: async () => {
      await performWebQQFriendAction({ action: 'delete', targetId: userId })
      await loadContacts()
    },
  })
}

function confirmLeaveGroup(groupId: string) {
  const group = contacts.value.groups.find((item) => item.groupId === groupId)
  openConfirmDialog({
    title: '退出群组',
    description: `确定退出群「${group?.name || groupId}」？`,
    confirmText: '退出群组',
    onConfirm: async () => {
      await performWebQQGroupAction({ action: 'leave', groupId })
      await loadContacts()
    },
  })
}

function handleDeleteFriend(userId: string) {
  confirmDeleteFriend(userId)
}

function handleMentionGroupMember(userId: string) {
  if (!enableWebQQSend.value) {
    errorText.value = '发送功能未开启'
    return
  }
  if (currentChat.value?.type !== 'group') {
    errorText.value = '当前不是群聊'
    return
  }
  const member = groupInfo.value.members.find((item) => item.userId === userId)
  // 右键提及与键入 @ 必须进入同一 token 草稿；否则两条入口会产生不同的顺序、删除和序列化行为。
  insertExternalMention({ id: userId, name: member ? getGroupMemberName(member) : userId })
}

async function refreshCurrentGroupInfo(groupId: string) {
  if (currentChat.value?.type === 'group' && currentChat.value.peerId === groupId) await loadGroupInfo()
}

async function refreshCurrentGroupMember(
  groupId: string,
  userId: string,
  patch: Partial<Pick<WebQQGroupMember, 'card' | 'role' | 'rawRole' | 'title'>>,
) {
  patchGroupMember(groupId, userId, patch)
  if (currentChat.value?.type !== 'group' || currentChat.value.peerId !== groupId) return
  await refreshCurrentGroupInfo(groupId)
}

function handlePokeGroupMember(userId: string) {
  const chat = currentChat.value
  if (!chat || chat.type !== 'group') {
    errorText.value = '当前不是群聊'
    return
  }
  void runInteraction(() => performWebQQGroupAction({ action: 'poke', groupId: chat.peerId, targetId: userId }), '群成员戳一戳失败')
}

function openGroupCardDialog(userId: string) {
  const member = groupInfo.value.members.find((item) => item.userId === userId)
  openActionDialog({
    title: '修改群名片',
    description: '留空可以清除当前群名片。',
    placeholder: '输入群名片',
    value: member?.card || '',
    onConfirm: async (card) => {
      const chat = currentChat.value
      if (!chat || chat.type !== 'group') throw new Error('当前不是群聊')
      await performWebQQGroupAction({ action: 'set-card', groupId: chat.peerId, targetId: userId, card })
      await refreshCurrentGroupMember(chat.peerId, userId, { card })
    },
  })
}

function openGroupTitleDialog(userId: string) {
  const member = groupInfo.value.members.find((item) => item.userId === userId)
  openActionDialog({
    title: '设置专属头衔',
    description: '专属头衔只能由群主授予，留空可以清除当前头衔。',
    placeholder: '输入专属头衔',
    value: member?.title || '',
    onConfirm: async (title) => {
      const chat = currentChat.value
      if (!chat || chat.type !== 'group') throw new Error('当前不是群聊')
      await performWebQQGroupAction({ action: 'set-title', groupId: chat.peerId, targetId: userId, title })
      await refreshCurrentGroupMember(chat.peerId, userId, { title })
    },
  })
}

function handleSetGroupAdmin(userId: string, enabled: boolean) {
  const chat = currentChat.value
  if (!chat || chat.type !== 'group') {
    errorText.value = '当前不是群聊'
    return
  }
  void runInteraction(async () => {
    await performWebQQGroupAction({
      action: 'set-admin',
      groupId: chat.peerId,
      targetId: userId,
      enabled,
    })
    await refreshCurrentGroupMember(chat.peerId, userId, {
      role: enabled ? '管理员' : '成员',
      rawRole: enabled ? 'admin' : 'member',
    })
  }, enabled ? '设为管理员失败' : '取消管理员失败')
}

function handleKickGroupMember(userId: string) {
  const chat = currentChat.value
  if (!chat || chat.type !== 'group') {
    errorText.value = '当前不是群聊'
    return
  }
  const member = groupInfo.value.members.find((item) => item.userId === userId)
  openConfirmDialog({
    title: '踢出群组',
    description: `确定将「${member ? getGroupMemberName(member) : userId}」移出本群？`,
    confirmText: '踢出群组',
    onConfirm: async () => {
      await performWebQQGroupAction({
        action: 'kick',
        groupId: chat.peerId,
        targetId: userId,
      })
      await refreshCurrentGroupInfo(chat.peerId)
    },
  })
}

function handleSelectionKeydown(event: KeyboardEvent) {
  if (!props.visible || event.key !== 'Escape') return
  if (messageSearchOpen.value) {
    event.preventDefault()
    closeMessageSearch()
    return
  }
  if (forwardTargetOpen.value) {
    event.preventDefault()
    forwardTargetOpen.value = false
    return
  }
  if (selectionMode.value) {
    event.preventDefault()
    exitSelection()
    return
  }
  if (replyingToMessageId.value) {
    event.preventDefault()
    clearReplyTarget()
  }
}

watch(currentChat, () => {
  exitSelection()
  closeMessageSearch()
  resetMessageSearchResults()
  messageSearchQuery.value = ''
  messageSearchLocalDate.value = ''
  clearReplyTarget()
  resetComposerDraft({ focus: false })
  closeMentionMenu()
  reactionPickerMessageId.value = ''
  profileCardOpen.value = false
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
  const loadVersion = ++contactsLoadVersion
  const recoverySignal = contactsRecoverySignal.value
  loading.value = true
  errorText.value = ''
  try {
    const nextContacts = await requestWebQQContactsWithRetry(requestWebQQContacts)
    if (loadVersion !== contactsLoadVersion) return
    contacts.value = nextContacts
    contactsLoadFailed.value = false
  } catch (error) {
    if (loadVersion !== contactsLoadVersion) return
    contactsLoadFailed.value = true
    errorText.value = readWebQQErrorMessage(error, '加载联系人失败')

    // 首次 RPC 重试期间 Bot 可能已经恢复或收到消息；该变化早于 catch 时，普通 watch 会错过。
    // 这里补一次版本后的重载，避免固定重试窗口结束后联系人页永久停在失败状态。
    if (recoverySignal !== contactsRecoverySignal.value) {
      void nextTick(() => loadContacts())
    }
  } finally {
    if (loadVersion === contactsLoadVersion) loading.value = false
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
  webQQResizing.value = false
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
  webQQResizing.value = true
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
  revealRecentConversation('friend', friend.userId)
  selectWebQQFriend(friend)
  clearCurrentUnreadCount()
  loadMessages()
}

function selectGroup(group: WebQQGroup) {
  noticeOpen.value = false
  revealRecentConversation('group', group.groupId)
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

function handleDeleteRecent(item: RecentItem) {
  hideRecentConversation(item.type, item.peerId)
  clearUnreadCount(item.type, item.peerId)
  if (currentChat.value?.type !== item.type || currentChat.value.peerId !== item.peerId) return
  currentChat.value = undefined
  messages.value = []
  groupInfoOpen.value = false
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
  window.removeEventListener('keydown', handleSelectionKeydown)
  disposeWebQQLiveMessages()
  clearSendFiles()
  sendFormResizeObserver?.disconnect()
  sendContextResizeObserver?.disconnect()
  stopWebQQResize()
  window.removeEventListener('resize', clampCurrentWebQQShellSize)
})

watch(allowWebQQResize, (enabled) => {
  if (enabled) loadStoredWebQQShellSize()
  else stopWebQQResize()
}, { immediate: true })

watch(() => props.visible, (visible) => {
  if (!visible) return
  observeWebQQSendForm()
  clearCurrentUnreadCount()
  if (trackingMessages.value) scrollMessagesToBottom()
})

watch(() => enableWebQQSend.value && !!currentChat.value, () => {
  observeWebQQSendForm()
}, { immediate: true })

watch(sendTextInput, (editor) => {
  if (editor) renderComposerDraft(composerDraft.value)
})

watch(() => sendFiles.value.length, () => {
  observeWebQQSendForm()
})

watch(replyingToMessage, () => {
  observeWebQQSendForm()
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
    groupInfo.value = { announcements: [], members: [] }
    return
  }
  // 消息头像菜单和管理员撤回权限都依赖成员角色，不能要求用户先手动打开群资料侧栏。
  void loadGroupInfo()
})

watch(selectedBotSelfId, (selfId, oldSelfId) => {
  if (!selfId || selfId === oldSelfId) return
  void reloadWebQQForSelectedBot()
})

watch(contactsRecoverySignal, () => {
  if (!contactsLoadFailed.value || loading.value) return
  void loadContacts()
})

watch(availableBots, (bots) => {
  for (const bot of bots) rememberSendBotAvatar(bot.selfId, bot.avatar)
}, { immediate: true, deep: true })

watch(() => capsule.value?.bot, (bot) => {
  if (bot?.avatar) cachedCapsuleBotAvatar.value = bot.avatar
  rememberSendBotAvatar(bot?.selfId, bot?.avatar)
}, { immediate: true })

onMounted(async () => {
  window.addEventListener('keydown', handleSelectionKeydown)
  window.addEventListener('resize', clampCurrentWebQQShellSize)
  await loadRemoteWebQQStoredState()
  await loadContacts()
})
</script>
