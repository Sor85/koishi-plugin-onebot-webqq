<template>
  <div class="chat-capsule-webqq" role="dialog" aria-label="WebQQ 观察窗">
    <aside class="chat-capsule-webqq__sidebar">
      <div class="chat-capsule-webqq__tabs-row">
        <div class="chat-capsule-webqq__tabs">
          <button :class="{ 'is-active': activeTab === 'recent' }" type="button" @click="activeTab = 'recent'">
            <span class="chat-capsule-webqq__tab-icon is-clock"></span>
            最近
          </button>
          <button :class="{ 'is-active': activeTab === 'friends' }" type="button" @click="activeTab = 'friends'">
            <span class="chat-capsule-webqq__tab-icon is-user"></span>
            好友
          </button>
          <button :class="{ 'is-active': activeTab === 'groups' }" type="button" @click="activeTab = 'groups'">
            <span class="chat-capsule-webqq__tab-icon is-group"></span>
            群组
          </button>
        </div>
        <button class="chat-capsule-webqq__notify" type="button" aria-label="通知">
          <span class="chat-capsule-webqq__tab-icon is-bell"></span>
        </button>
      </div>
      <div v-if="activeTab !== 'recent'" class="chat-capsule-webqq__search">
        <span class="chat-capsule-webqq__search-icon"></span>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="activeTab === 'friends' ? '搜索好友...' : '搜索群组...'"
        >
      </div>
      <div class="chat-capsule-webqq__list">
        <button
          v-for="item in recentItems"
          v-show="activeTab === 'recent'"
          :key="`recent:${item.type}:${item.peerId}`"
          :class="['chat-capsule-webqq__contact', { 'is-active': currentPeerId === item.peerId }]"
          type="button"
          @click="selectRecent(item)"
        >
          <img :src="withProxy(item.avatar)" :alt="item.name">
          <span>
            <strong>{{ item.name }}</strong>
            <small>{{ item.subtitle }}</small>
          </span>
        </button>
        <div v-if="activeTab === 'recent' && !recentItems.length" class="chat-capsule-webqq__empty-list">
          暂无最近会话
        </div>
        <button
          v-for="friend in visibleFriends"
          v-show="activeTab === 'friends'"
          :key="friend.userId"
          :class="['chat-capsule-webqq__contact', { 'is-active': currentPeerId === friend.userId }]"
          type="button"
          @click="selectFriend(friend)"
        >
          <img :src="withProxy(friend.avatar)" :alt="friend.name">
          <span>
            <strong>{{ friend.name }}</strong>
            <small>{{ friend.nickname }}</small>
          </span>
        </button>
        <div v-if="activeTab === 'friends' && !visibleFriends.length" class="chat-capsule-webqq__empty-list">
          暂无好友
        </div>
        <button
          v-for="group in visibleGroups"
          v-show="activeTab === 'groups'"
          :key="group.groupId"
          :class="['chat-capsule-webqq__contact', { 'is-active': currentPeerId === group.groupId }]"
          type="button"
          @click="selectGroup(group)"
        >
          <img :src="withProxy(group.avatar)" :alt="group.name">
          <span>
            <strong>{{ group.name }}</strong>
            <small>{{ group.memberCount }} 人</small>
          </span>
        </button>
        <div v-if="activeTab === 'groups' && !visibleGroups.length" class="chat-capsule-webqq__empty-list">
          暂无群组
        </div>
      </div>
    </aside>
    <section class="chat-capsule-webqq__chat">
      <header class="chat-capsule-webqq__chat-header">
        <div>
          <strong>{{ currentTitle }}</strong>
          <span>{{ currentSubtitle }}</span>
        </div>
        <button type="button" @click="loadContacts">刷新</button>
      </header>
      <div ref="messagePane" class="chat-capsule-webqq__messages" @scroll="updateMessageTracking">
        <div v-if="loading" class="chat-capsule-webqq__placeholder">加载中</div>
        <div v-else-if="errorText" class="chat-capsule-webqq__placeholder is-error">{{ errorText }}</div>
        <div v-else-if="!currentChat" class="chat-capsule-webqq__placeholder">选择一个会话</div>
        <div v-else-if="!messages.length" class="chat-capsule-webqq__placeholder">暂无消息</div>
        <template v-else>
          <div
            v-for="message in messages"
            :key="message.id || message.sequence"
            :class="['chat-capsule-webqq__message', `is-${message.direction}`]"
          >
            <img class="chat-capsule-webqq__message-avatar" :src="withProxy(message.senderAvatar)" :alt="message.senderName">
            <div class="chat-capsule-webqq__message-content">
              <div class="chat-capsule-webqq__message-name">{{ message.senderName }}</div>
              <div class="chat-capsule-webqq__bubble">
                <template v-for="(element, index) in message.elements" :key="`${message.id}:${index}`">
                  <span v-if="element.type === 'text'">{{ element.text }}</span>
                  <img v-else-if="element.type === 'image' && element.url" :src="withProxy(element.url)" alt="图片">
                  <span v-else>{{ element.text || message.summary }}</span>
                </template>
              </div>
              <div class="chat-capsule-webqq__message-time">{{ formatTime(message.time) }}</div>
            </div>
          </div>
        </template>
      </div>
      <footer class="chat-capsule-webqq__readonly-bar">
        <span>只读模式</span>
      </footer>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { receive, send, withProxy } from '@koishijs/client'
import type { WebQQContacts, WebQQFriend, WebQQGroup, WebQQLiveMessage, WebQQMessage } from './state'

type ChatSelection =
  | { type: 'friend'; peerId: string; name: string; subtitle: string }
  | { type: 'group'; peerId: string; name: string; subtitle: string }

type RecentItem = ChatSelection & { avatar: string }

const activeTab = ref<'recent' | 'friends' | 'groups'>('recent')
const searchQuery = ref('')
const contacts = ref<WebQQContacts>({ friends: [], groups: [] })
const currentChat = ref<ChatSelection>()
const messages = ref<WebQQMessage[]>([])
const messagePane = ref<HTMLElement>()
const trackingMessages = ref(true)
const historyLoading = ref(false)
const historyExhausted = ref(false)
const loading = ref(false)
const errorText = ref('')

const visibleFriends = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return contacts.value.friends
  return contacts.value.friends.filter((friend) => {
    return friend.name.toLowerCase().includes(query) ||
      friend.nickname.toLowerCase().includes(query) ||
      friend.userId.includes(searchQuery.value)
  })
})
const visibleGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return contacts.value.groups
  return contacts.value.groups.filter((group) => {
    return group.name.toLowerCase().includes(query) || group.groupId.includes(searchQuery.value)
  })
})
const recentItems = computed<RecentItem[]>(() => {
  const friends = contacts.value.friends.slice(0, 4).map((friend) => ({
    type: 'friend' as const,
    peerId: friend.userId,
    name: friend.name,
    subtitle: friend.nickname,
    avatar: friend.avatar,
  }))
  const groups = contacts.value.groups.slice(0, 4).map((group) => ({
    type: 'group' as const,
    peerId: group.groupId,
    name: group.name,
    subtitle: `${group.memberCount} 人`,
    avatar: group.avatar,
  }))
  return [...friends, ...groups]
})
const currentPeerId = computed(() => currentChat.value?.peerId)
const currentTitle = computed(() => currentChat.value?.name || 'WebQQ')
const currentSubtitle = computed(() => currentChat.value?.subtitle || '好友 / 群聊')

function getMessageKey(message: WebQQMessage) {
  return message.id || message.sequence || `${message.senderId}:${message.time}:${message.summary}`
}

function appendMessage(message: WebQQMessage) {
  messages.value = mergeMessages(messages.value, [message])
  if (trackingMessages.value) scrollMessagesToBottom()
}

function mergeMessages(currentMessages: WebQQMessage[], nextMessages: WebQQMessage[]) {
  const merged = new Map(currentMessages.map((item) => [getMessageKey(item), item]))
  for (const message of nextMessages) {
    merged.set(getMessageKey(message), message)
  }
  return [...merged.values()].sort((a, b) => a.time - b.time)
}

function isMessagePaneAtBottom() {
  const pane = messagePane.value
  if (!pane) return true
  return pane.scrollHeight - pane.scrollTop - pane.clientHeight <= 8
}

function updateMessageTracking() {
  trackingMessages.value = isMessagePaneAtBottom()
  if (shouldLoadOlderMessages()) loadOlderMessages()
}

async function scrollMessagesToBottom() {
  await nextTick()
  const pane = messagePane.value
  if (!pane) return
  pane.scrollTop = pane.scrollHeight
}

async function loadContacts() {
  loading.value = true
  errorText.value = ''
  try {
    contacts.value = await send('chat-capsule/webqq/contacts') as WebQQContacts || { friends: [], groups: [] }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载联系人失败'
  } finally {
    loading.value = false
  }
}

async function loadMessages() {
  if (!currentChat.value) return
  trackingMessages.value = true
  historyExhausted.value = false
  loading.value = true
  errorText.value = ''
  try {
    messages.value = await send('chat-capsule/webqq/messages', {
      type: currentChat.value.type,
      peerId: currentChat.value.peerId,
    }) as WebQQMessage[] || []
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
    messages.value = mergeMessages(olderMessages, messages.value)
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
  currentChat.value = {
    type: 'friend',
    peerId: friend.userId,
    name: friend.name,
    subtitle: friend.nickname,
  }
  loadMessages()
}

function selectGroup(group: WebQQGroup) {
  currentChat.value = {
    type: 'group',
    peerId: group.groupId,
    name: group.name,
    subtitle: `${group.memberCount} 人`,
  }
  loadMessages()
}

function selectRecent(item: RecentItem) {
  currentChat.value = {
    type: item.type,
    peerId: item.peerId,
    name: item.name,
    subtitle: item.subtitle,
  }
  loadMessages()
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

receive('chat-capsule/webqq/message', (payload: WebQQLiveMessage) => {
  if (
    currentChat.value?.type !== payload.type ||
    currentChat.value.peerId !== payload.peerId
  ) return
  appendMessage(payload.message)
})

onMounted(loadContacts)
</script>
