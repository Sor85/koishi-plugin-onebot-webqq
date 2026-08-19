<template>
  <aside class="onebot-webqq-webqq__sidebar">
    <div class="onebot-webqq-webqq__tabs-row">
      <div class="onebot-webqq-webqq__tabs">
        <button :class="{ 'is-active': activeTab === 'recent' }" type="button" @click="emit('select-tab', 'recent')">
          <svg class="onebot-webqq-webqq__tab-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v5l3 2"></path>
          </svg>
          最近
        </button>
        <button :class="{ 'is-active': activeTab === 'friends' }" type="button" @click="emit('select-tab', 'friends')">
          <svg class="onebot-webqq-webqq__tab-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M5 21a7 7 0 0 1 14 0"></path>
          </svg>
          好友
        </button>
        <button :class="{ 'is-active': activeTab === 'groups' }" type="button" @click="emit('select-tab', 'groups')">
          <svg class="onebot-webqq-webqq__tab-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5"></circle>
            <circle cx="17" cy="9" r="3"></circle>
            <path d="M2.5 21a6.5 6.5 0 0 1 13 0"></path>
            <path d="M14 16.5A5 5 0 0 1 21.5 21"></path>
          </svg>
          群组
        </button>
      </div>
      <span class="onebot-webqq-webqq__notify-wrap" @click.stop>
        <button ref="notifyButton" :class="['onebot-webqq-webqq__notify', { 'is-active': noticeOpen }]" type="button" aria-label="通知" @click="emit('open-notices')">
          <svg class="onebot-webqq-webqq__notify-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18a3 3 0 0 1-6 0"></path>
            <path d="M19 16H5c1.4-1.4 2-3.2 2-5.5a5 5 0 0 1 10 0c0 2.3.6 4.1 2 5.5Z"></path>
          </svg>
        </button>
        <Teleport to="body">
          <WebQQNoticeMenu
            v-if="noticeOpen"
            popover="manual"
            :class="desktopNoticeMenuClass"
            :style="desktopNoticeMenuStyle"
            v-model:tab="noticeMenuTabModel"
            :loading="noticeLoading"
            :error-text="noticeErrorText"
            :notices="filteredNotices"
            :handling-notice-id="handlingNoticeId"
            :with-proxy="withProxy"
            :format-notice-time="formatNoticeTime"
            @click.stop
            @handle="(notice, approve) => emit('handle-notice', notice, approve)"
          />
        </Teleport>
      </span>
    </div>
    <div v-if="activeTab !== 'recent'" class="onebot-webqq-webqq__search">
      <svg class="onebot-webqq-webqq__search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7"></circle>
        <path d="m16 16 4 4"></path>
      </svg>
      <input
        v-model="searchQueryModel"
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
      :get-group-subtitle="getGroupSubtitle"
      @select-recent="emit('select-recent', $event)"
      @select-friend="emit('select-friend', $event)"
      @select-group="emit('select-group', $event)"
      @open-contact-profile="(type, peerId) => emit('open-contact-profile', type, peerId)"
      @set-remark="emit('set-remark', $event)"
      @delete-recent="emit('delete-recent', $event)"
      @delete-friend="emit('delete-friend', $event)"
      @leave-group="emit('leave-group', $event)"
    />
  </aside>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import WebQQContactList from './WebQQContactList.vue'
import WebQQNoticeMenu from './WebQQNoticeMenu.vue'
import { enableWebQQFrostedGlass, resolvedWebQQColorMode, webQQAccentColor } from '../settings'
import type { WebQQFriend, WebQQGroup, WebQQNotice } from '../types'
import type { WebQQFriendCategoryView, WebQQRecentItem } from '../utils/webqq-contact-view'
import { getDesktopNoticeMenuPosition } from '../utils/notice-menu-position'
import { getWebQQAccentStyle } from '../utils/webqq-theme-view'

type WebQQContactType = 'friend' | 'group'
type WebQQTab = 'recent' | 'friends' | 'groups'
type WebQQNoticeTab = 'friends' | 'groups'

const props = defineProps<{
  activeTab: WebQQTab
  searchQuery: string
  recentItems: WebQQRecentItem[]
  visibleFriendCategories: WebQQFriendCategoryView[]
  visibleFriends: WebQQFriend[]
  visibleGroups: WebQQGroup[]
  currentPeerId?: string
  noticeOpen: boolean
  noticeMenuTab: WebQQNoticeTab
  noticeLoading: boolean
  noticeErrorText: string
  filteredNotices: WebQQNotice[]
  handlingNoticeId: string
  withProxy: (url: string) => string
  getUnreadCount: (type: WebQQContactType, peerId: string) => number
  getUnreadText: (count: number) => string
  getContactSubtitle: (type: WebQQContactType, peerId: string, fallback: string) => string
  getContactTime: (type: WebQQContactType, peerId: string, fallback?: number) => number
  formatNoticeTime: (timestamp: number) => string
  getGroupSubtitle: (group: WebQQGroup) => string
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:noticeMenuTab': [value: WebQQNoticeTab]
  'select-tab': [tab: WebQQTab]
  'select-recent': [item: WebQQRecentItem]
  'select-friend': [friend: WebQQFriend]
  'select-group': [group: WebQQGroup]
  'open-contact-profile': [type: WebQQContactType, peerId: string]
  'set-remark': [userId: string]
  'delete-recent': [item: WebQQRecentItem]
  'delete-friend': [userId: string]
  'leave-group': [groupId: string]
  'open-notices': []
  'handle-notice': [notice: WebQQNotice, approve: boolean]
}>()

const searchQueryModel = computed({
  get: () => props.searchQuery,
  set: (value) => emit('update:searchQuery', value),
})

const noticeMenuTabModel = computed({
  get: () => props.noticeMenuTab,
  set: (value) => emit('update:noticeMenuTab', value),
})

const notifyButton = ref<HTMLButtonElement>()
const noticeMenuPosition = ref({ top: 0, left: 0 })
let noticeMenuResizeObserver: ResizeObserver | undefined

const desktopNoticeMenuClass = computed(() => [
  'onebot-webqq-webqq__notice-menu--desktop',
  enableWebQQFrostedGlass.value ? 'is-frosted' : 'is-plain',
  `is-color-${resolvedWebQQColorMode.value}`,
])

const desktopNoticeMenuStyle = computed(() => ({
  ...getWebQQAccentStyle(webQQAccentColor.value),
  top: `${noticeMenuPosition.value.top}px`,
  left: `${noticeMenuPosition.value.left}px`,
}))

function updateDesktopNoticeMenuPosition() {
  const button = notifyButton.value
  if (!button) return
  noticeMenuPosition.value = getDesktopNoticeMenuPosition(button.getBoundingClientRect())
}

function stopDesktopNoticeMenuPosition() {
  noticeMenuResizeObserver?.disconnect()
  noticeMenuResizeObserver = undefined
  window.removeEventListener('resize', updateDesktopNoticeMenuPosition)
}

watch(() => props.noticeOpen, async (open) => {
  stopDesktopNoticeMenuPosition()
  if (!open) return
  await nextTick()
  updateDesktopNoticeMenuPosition()
  window.addEventListener('resize', updateDesktopNoticeMenuPosition)
  const root = notifyButton.value?.closest('.onebot-webqq-webqq')
  if (root && typeof ResizeObserver !== 'undefined') {
    noticeMenuResizeObserver = new ResizeObserver(updateDesktopNoticeMenuPosition)
    noticeMenuResizeObserver.observe(root)
  }
})

onBeforeUnmount(() => {
  stopDesktopNoticeMenuPosition()
})
</script>
