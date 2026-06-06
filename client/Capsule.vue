<template>
  <div v-if="shouldShowCapsule" ref="capsuleHost" class="chat-capsule-host">
    <div :class="['chat-capsule', `is-color-${webQQColorMode}`]" aria-live="polite">
      <button
        class="chat-capsule__avatar-button"
        type="button"
        :aria-label="capsuleButtonLabel"
        :aria-expanded="webqqOpen"
        @click="toggleWebQQ"
      >
        <span class="chat-capsule__avatar">
          <img v-if="displayBotAvatar" :src="withProxy(displayBotAvatar)" :alt="displayBotName">
          <k-icon v-else name="robot" />
          <span :class="['chat-capsule__status', statusClass]"></span>
          <span v-if="showWebQQCapsuleUnread && webQQTotalUnread" class="chat-capsule__avatar-unread">{{ capsuleUnreadText }}</span>
        </span>
      </button>
      <Transition name="chat-capsule-avatar-guide">
        <span
          v-if="webQQAvatarGuideVisible && !webqqOpen"
          class="chat-capsule__avatar-guide"
          aria-hidden="true"
        >
          <span class="chat-capsule__avatar-guide-ring"></span>
        </span>
      </Transition>
      <div class="chat-capsule__body" @click="showWebQQAvatarGuide()">
        <div class="chat-capsule__title-line">
          <div class="chat-capsule__title" :title="displayBotName">
            {{ displayBotName }}
          </div>
          <span v-if="titleStatusText" class="chat-capsule__title-status is-thinking">{{ titleStatusText }}</span>
        </div>
        <div class="chat-capsule__meta" :title="metaTitle">
          <span v-if="displayActivityText" class="chat-capsule__activity">{{ displayActivityText }}</span>
        </div>
      </div>
    </div>
    <WebQQObserver v-show="webqqOpen" :visible="webqqOpen" />
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Universal, activities, router, store, withProxy } from '@koishijs/client'
import { capsule, showWebQQCapsuleUnread, webQQColorMode, webQQTotalUnread } from './state'
import WebQQObserver from './WebQQObserver.vue'

const capsuleProfileStorageKey = 'chat-capsule:bot-profile:v1'
const webQQAvatarGuideStorageKey = 'chat-capsule:webqq-avatar-guide:v1'
const webqqOpen = ref(false)
const webQQAvatarGuideVisible = ref(false)
const capsuleHost = ref<HTMLElement>()
const cachedBotProfile = ref(loadCachedBotProfile())
let webQQAvatarGuideTimer: ReturnType<typeof setTimeout> | undefined
const isLoggerRoute = computed(() => router.currentRoute.value.path === '/logs')
const isLoggedIn = computed(() => !activities.login || ('user' in store && !!store.user))
const shouldShowCapsule = computed(() => isLoggedIn.value && !isLoggerRoute.value)
const displayBotName = computed(() => capsule.value?.bot.name || cachedBotProfile.value.name || '空闲')
const displayBotAvatar = computed(() => capsule.value?.bot.avatar || cachedBotProfile.value.avatar || '')
const capsuleUnreadText = computed(() => getCapsuleUnreadText(webQQTotalUnread.value))
const capsuleButtonLabel = computed(() => {
  return showWebQQCapsuleUnread.value && webQQTotalUnread.value
    ? `打开 WebQQ 观察窗，${capsuleUnreadText.value} 条未读消息`
    : '打开 WebQQ 观察窗'
})
const activityText = computed(() => capsule.value?.conversation.activityText || '')
const isThinking = computed(() => activityText.value === '正在思考')
const titleStatusText = computed(() => isThinking.value ? activityText.value : '')
const userName = computed(() => capsule.value?.conversation.userName || '')
const userActivityText = computed(() => userName.value ? `正在与 ${userName.value} 对话` : '')
const displayActivityText = computed(() => {
  if (userActivityText.value) return userActivityText.value
  return '空闲中'
})

const metaTitle = computed(() => displayActivityText.value)

const statusClass = computed(() => {
  switch (capsule.value?.bot.status) {
    case Universal.Status.ONLINE:
      return 'is-online'
    case Universal.Status.CONNECT:
    case Universal.Status.RECONNECT:
      return 'is-pending'
    default:
      return 'is-offline'
  }
})

function getCapsuleUnreadText(count: number) {
  return count > 99999 ? '99999+' : String(count)
}

function loadCachedBotProfile() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const data = JSON.parse(localStorage.getItem(capsuleProfileStorageKey) || '{}')
    return data && typeof data === 'object'
      ? {
          name: typeof data.name === 'string' ? data.name : '',
          avatar: typeof data.avatar === 'string' ? data.avatar : '',
        }
      : {}
  } catch {
    return {}
  }
}

function cacheBotProfile(name: string, avatar?: string) {
  if (typeof localStorage === 'undefined' || !name) return
  cachedBotProfile.value = { name, avatar: avatar || '' }
  try {
    localStorage.setItem(capsuleProfileStorageKey, JSON.stringify(cachedBotProfile.value))
  } catch {}
}

function hasSeenWebQQAvatarGuide() {
  if (typeof localStorage === 'undefined') return true
  try {
    return localStorage.getItem(webQQAvatarGuideStorageKey) === 'seen'
  } catch {
    return true
  }
}

function rememberWebQQAvatarGuide() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(webQQAvatarGuideStorageKey, 'seen')
  } catch {}
}

function hideWebQQAvatarGuide() {
  webQQAvatarGuideVisible.value = false
  if (!webQQAvatarGuideTimer) return
  clearTimeout(webQQAvatarGuideTimer)
  webQQAvatarGuideTimer = undefined
}

function showWebQQAvatarGuide(remember = false) {
  if (webqqOpen.value) return
  if (remember) rememberWebQQAvatarGuide()
  webQQAvatarGuideVisible.value = true
  if (webQQAvatarGuideTimer) clearTimeout(webQQAvatarGuideTimer)
  webQQAvatarGuideTimer = setTimeout(() => {
    webQQAvatarGuideVisible.value = false
    webQQAvatarGuideTimer = undefined
  }, 3600)
}

function closeWebQQOnOutsideClick(event: PointerEvent) {
  if (!webqqOpen.value) return
  const target = event.target
  if (target instanceof Node && capsuleHost.value?.contains(target)) return
  webqqOpen.value = false
}

function toggleWebQQ() {
  webqqOpen.value = !webqqOpen.value
  if (webqqOpen.value) {
    rememberWebQQAvatarGuide()
    hideWebQQAvatarGuide()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', closeWebQQOnOutsideClick)
  if (!hasSeenWebQQAvatarGuide()) showWebQQAvatarGuide(true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeWebQQOnOutsideClick)
  hideWebQQAvatarGuide()
})

watch(() => capsule.value?.bot, (bot) => {
  if (!bot) return
  cacheBotProfile(bot.name, bot.avatar)
}, { immediate: true })

</script>
