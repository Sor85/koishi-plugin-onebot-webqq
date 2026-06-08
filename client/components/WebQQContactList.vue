<template>
  <div class="onebot-webqq-webqq__list">
    <button
      v-for="item in recentItems"
      v-show="activeTab === 'recent'"
      :key="`recent:${item.type}:${item.peerId}`"
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
      <time v-if="getContactTime(item.type, item.peerId, item.time)" class="onebot-webqq-webqq__contact-time">{{ formatListTime(getContactTime(item.type, item.peerId, item.time)) }}</time>
    </button>
    <div v-if="activeTab === 'recent' && !recentItems.length" class="onebot-webqq-webqq__empty-list">
      暂无最近会话
    </div>
    <section v-for="category in visibleFriendCategories" v-show="activeTab === 'friends'" :key="category.id" class="onebot-webqq-webqq__friend-category">
      <h4 class="onebot-webqq-webqq__friend-category-title">{{ category.name }}</h4>
      <button
        v-for="friend in category.friends"
        :key="friend.userId"
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
        <time v-if="getContactTime('friend', friend.userId)" class="onebot-webqq-webqq__contact-time">{{ formatListTime(getContactTime('friend', friend.userId)) }}</time>
      </button>
    </section>
    <div v-if="activeTab === 'friends' && !visibleFriends.length" class="onebot-webqq-webqq__empty-list">
      暂无好友
    </div>
    <button
      v-for="group in visibleGroups"
      v-show="activeTab === 'groups'"
      :key="group.groupId"
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
      <time v-if="getContactTime('group', group.groupId)" class="onebot-webqq-webqq__contact-time">{{ formatListTime(getContactTime('group', group.groupId)) }}</time>
    </button>
    <div v-if="activeTab === 'groups' && !visibleGroups.length" class="onebot-webqq-webqq__empty-list">
      暂无群组
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { WebQQFriend, WebQQGroup } from '../state'
import type { WebQQFriendCategoryView, WebQQRecentItem } from '../utils/webqq-contact-view'

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
  formatListTime: (timestamp: number) => string
  getGroupSubtitle: (group: WebQQGroup) => string
}>()

const emit = defineEmits<{
  'select-recent': [item: WebQQRecentItem]
  'select-friend': [friend: WebQQFriend]
  'select-group': [group: WebQQGroup]
}>()
</script>
