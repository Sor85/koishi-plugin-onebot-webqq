<template>
  <div v-if="shouldShowCapsule" ref="capsuleHost" class="chat-capsule-host">
    <div class="chat-capsule" aria-live="polite">
      <button
        class="chat-capsule__avatar-button"
        type="button"
        aria-label="打开 WebQQ 观察窗"
        :aria-expanded="webqqOpen"
        @click="toggleWebQQ"
      >
        <span class="chat-capsule__avatar">
          <img v-if="displayBotAvatar" :src="withProxy(displayBotAvatar)" :alt="displayBotName">
          <k-icon v-else name="robot" />
          <span :class="['chat-capsule__status', statusClass]"></span>
        </span>
      </button>
      <div class="chat-capsule__body">
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
      <span v-if="hasUsage" class="chat-capsule__usage" :title="usageTitle" aria-label="本次 token 用量">
        <span class="chat-capsule__usage-row is-input">
          <svg class="chat-capsule__usage-icon is-input" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 20V8" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
            <path d="m7 13 5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M5 4h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          </svg>
          <span>{{ usage!.inputTokens }}</span>
        </span>
        <span class="chat-capsule__usage-row is-output">
          <svg class="chat-capsule__usage-icon is-output" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
            <path d="m7 11 5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          </svg>
          <span>{{ usage!.outputTokens }}</span>
        </span>
      </span>
    </div>
    <WebQQObserver v-if="webqqMounted" v-show="webqqOpen" :visible="webqqOpen" />
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Universal, activities, router, store, withProxy } from '@koishijs/client'
import { capsule } from './state'
import WebQQObserver from './WebQQObserver.vue'

const capsuleProfileStorageKey = 'chat-capsule:bot-profile:v1'
const webqqOpen = ref(false)
const webqqMounted = ref(false)
const capsuleHost = ref<HTMLElement>()
const cachedBotProfile = ref(loadCachedBotProfile())
const isLoggerRoute = computed(() => router.currentRoute.value.path === '/logs')
const isLoggedIn = computed(() => !activities.login || ('user' in store && !!store.user))
const shouldShowCapsule = computed(() => isLoggedIn.value && !isLoggerRoute.value)
const displayBotName = computed(() => capsule.value?.bot.name || cachedBotProfile.value.name || '空闲')
const displayBotAvatar = computed(() => capsule.value?.bot.avatar || cachedBotProfile.value.avatar || '')
const activityText = computed(() => capsule.value?.conversation.activityText || '')
const isThinking = computed(() => activityText.value === '正在思考')
const titleStatusText = computed(() => isThinking.value ? activityText.value : '')
const userName = computed(() => capsule.value?.conversation.userName || '')
const userActivityText = computed(() => userName.value ? `正在与 ${userName.value} 对话` : '')
const usage = computed(() => capsule.value?.conversation.usage)
const hasUsage = computed(() => !!usage.value)
const usageTitle = computed(() => {
  const usage = capsule.value?.conversation.usage
  if (!usage) return ''
  return `输入 ${usage.inputTokens} / 输出 ${usage.outputTokens}`
})
const displayActivityText = computed(() => {
  if (userActivityText.value) return userActivityText.value
  return hasUsage.value ? '' : '空闲中'
})

const metaTitle = computed(() => {
  return [displayActivityText.value, usageTitle.value].filter(Boolean).join(' · ')
})

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

function closeWebQQOnOutsideClick(event: PointerEvent) {
  if (!webqqOpen.value) return
  const target = event.target
  if (target instanceof Node && capsuleHost.value?.contains(target)) return
  webqqOpen.value = false
}

function toggleWebQQ() {
  webqqOpen.value = !webqqOpen.value
  if (webqqOpen.value) webqqMounted.value = true
}

onMounted(() => {
  document.addEventListener('pointerdown', closeWebQQOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeWebQQOnOutsideClick)
})

watch(() => capsule.value?.bot, (bot) => {
  if (!bot) return
  cacheBotProfile(bot.name, bot.avatar)
}, { immediate: true })

</script>
