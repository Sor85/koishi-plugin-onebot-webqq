<template>
  <div v-webqq-scrollbar="{ hideOnNarrow: true }" class="onebot-webqq-webqq__list">
    <template v-if="activeTab === 'recent'">
      <ContextMenu v-for="item in recentItems" :key="`recent:${item.type}:${item.peerId}`">
        <ContextMenuTrigger as-child>
          <button
            :class="['onebot-webqq-webqq__contact', { 'is-active': currentPeerId === item.peerId }]"
            type="button"
            @click="emit('select-recent', item)"
          >
            <span class="onebot-webqq-webqq__contact-avatar">
              <img :src="withProxy(item.avatar)" :alt="item.name">
              <span v-if="getUnreadCount(item.type, item.peerId)" class="onebot-webqq-webqq__contact-unread">{{ getUnreadText(getUnreadCount(item.type, item.peerId)) }}</span>
            </span>
            <span class="onebot-webqq-webqq__contact-info">
              <strong>{{ item.name }}</strong>
              <small>{{ getContactSubtitle(item.type, item.peerId, item.summary || item.subtitle) }}</small>
            </span>
            <time v-if="getContactTime(item.type, item.peerId, item.time)" class="onebot-webqq-webqq__contact-time">{{ formatTime(getContactTime(item.type, item.peerId, item.time)) }}</time>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent style="z-index: 10140">
          <ContextMenuItem @select="emit('open-contact-profile', item.type, item.peerId)"><IconId :size="16" aria-hidden="true" /> 查看资料</ContextMenuItem>
          <ContextMenuItem v-if="item.type === 'friend'" @select="emit('set-remark', item.peerId)"><IconTag :size="16" aria-hidden="true" /> 设置好友备注</ContextMenuItem>
          <ContextMenuItem v-if="item.type === 'friend'" class="is-danger" @select="emit('delete-friend', item.peerId)"><IconUserMinus :size="16" aria-hidden="true" /> 删除好友</ContextMenuItem>
          <ContextMenuItem v-else class="is-danger" @select="emit('leave-group', item.peerId)"><IconLogout :size="16" aria-hidden="true" /> 退出群组</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div v-if="!recentItems.length" class="onebot-webqq-webqq__empty-list">
        暂无最近会话
      </div>
    </template>
    <template v-else-if="activeTab === 'friends'">
      <section v-for="category in visibleFriendCategories" :key="category.id" class="onebot-webqq-webqq__friend-category">
        <h4 class="onebot-webqq-webqq__friend-category-title">{{ category.name }}</h4>
        <ContextMenu v-for="friend in category.friends" :key="friend.userId">
          <ContextMenuTrigger as-child>
            <button
              :class="['onebot-webqq-webqq__contact', { 'is-active': currentPeerId === friend.userId }]"
              type="button"
              @click="emit('select-friend', friend)"
            >
              <span class="onebot-webqq-webqq__contact-avatar">
                <img :src="withProxy(friend.avatar)" :alt="friend.name">
                <span v-if="getUnreadCount('friend', friend.userId)" class="onebot-webqq-webqq__contact-unread">{{ getUnreadText(getUnreadCount('friend', friend.userId)) }}</span>
              </span>
              <span class="onebot-webqq-webqq__contact-info">
                <strong>{{ friend.name }}</strong>
                <small>{{ getContactSubtitle('friend', friend.userId, friend.nickname) }}</small>
              </span>
              <time v-if="getContactTime('friend', friend.userId)" class="onebot-webqq-webqq__contact-time">{{ formatTime(getContactTime('friend', friend.userId)) }}</time>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent style="z-index: 10140">
            <ContextMenuItem @select="emit('open-contact-profile', 'friend', friend.userId)"><IconId :size="16" aria-hidden="true" /> 查看资料</ContextMenuItem>
            <ContextMenuItem @select="emit('set-remark', friend.userId)"><IconTag :size="16" aria-hidden="true" /> 设置好友备注</ContextMenuItem>
            <ContextMenuItem class="is-danger" @select="emit('delete-friend', friend.userId)"><IconUserMinus :size="16" aria-hidden="true" /> 删除好友</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </section>
      <div v-if="!visibleFriends.length" class="onebot-webqq-webqq__empty-list">
        暂无好友
      </div>
    </template>
    <template v-else>
      <ContextMenu v-for="group in visibleGroups" :key="group.groupId">
        <ContextMenuTrigger as-child>
          <button
            :class="['onebot-webqq-webqq__contact', { 'is-active': currentPeerId === group.groupId }]"
            type="button"
            @click="emit('select-group', group)"
          >
            <span class="onebot-webqq-webqq__contact-avatar">
              <img :src="withProxy(group.avatar)" :alt="group.name">
              <span v-if="getUnreadCount('group', group.groupId)" class="onebot-webqq-webqq__contact-unread">{{ getUnreadText(getUnreadCount('group', group.groupId)) }}</span>
            </span>
            <span class="onebot-webqq-webqq__contact-info">
              <strong>{{ group.name }}</strong>
              <small>{{ getContactSubtitle('group', group.groupId, getGroupSubtitle(group)) }}</small>
            </span>
            <time v-if="getContactTime('group', group.groupId)" class="onebot-webqq-webqq__contact-time">{{ formatTime(getContactTime('group', group.groupId)) }}</time>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent style="z-index: 10140">
          <ContextMenuItem @select="emit('open-contact-profile', 'group', group.groupId)"><IconId :size="16" aria-hidden="true" /> 查看资料</ContextMenuItem>
          <ContextMenuItem class="is-danger" @select="emit('leave-group', group.groupId)"><IconLogout :size="16" aria-hidden="true" /> 退出群组</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div v-if="!visibleGroups.length" class="onebot-webqq-webqq__empty-list">
        暂无群组
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { IconId, IconLogout, IconTag, IconUserMinus } from '@tabler/icons-vue'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '../../components/ui/context-menu'
import type { WebQQFriend, WebQQGroup } from '../types'
import type { WebQQFriendCategoryView, WebQQRecentItem } from '../utils/webqq-contact-view'
import { formatTime } from '../utils/webqq-message-view'
import { vWebqqScrollbar } from '../utils/webqq-scrollbar'

type WebQQContactType = 'friend' | 'group'
type WebQQTab = 'recent' | 'friends' | 'groups'

defineProps<{
  activeTab: WebQQTab
  recentItems: WebQQRecentItem[]
  visibleFriendCategories: WebQQFriendCategoryView[]
  visibleFriends: WebQQFriend[]
  visibleGroups: WebQQGroup[]
  currentPeerId?: string
  withProxy: (url: string) => string
  getUnreadCount: (type: WebQQContactType, peerId: string) => number
  getUnreadText: (count: number) => string
  getContactSubtitle: (type: WebQQContactType, peerId: string, fallback: string) => string
  getContactTime: (type: WebQQContactType, peerId: string, fallback?: number) => number
  getGroupSubtitle: (group: WebQQGroup) => string
}>()

const emit = defineEmits<{
  'select-recent': [item: WebQQRecentItem]
  'select-friend': [friend: WebQQFriend]
  'select-group': [group: WebQQGroup]
  'open-contact-profile': [type: WebQQContactType, peerId: string]
  'set-remark': [userId: string]
  'delete-friend': [userId: string]
  'leave-group': [groupId: string]
}>()
</script>
