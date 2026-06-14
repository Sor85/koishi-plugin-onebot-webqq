<template>
  <div v-if="shouldShowCapsule" ref="capsuleHost" class="onebot-webqq-host">
    <div
      :class="['onebot-webqq', `is-color-${webQQColorMode}`, { 'has-bot-stack': hasMultipleBots }]"
      :style="capsuleStyle"
      aria-live="polite"
    >
      <div
        v-if="hasMultipleBots"
        class="onebot-webqq__bot-stack"
        :style="botStackStyle"
      >
        <button
          v-for="(bot, index) in botStackBots"
          :key="bot.selfId"
          :class="['onebot-webqq__bot-switch', {
            'is-active': bot.selfId === activeBotSelfId,
            'is-collapsed-extra': isBotCollapsedExtra(index),
          }]"
          type="button"
          :aria-label="getBotSwitchLabel(bot)"
          :aria-pressed="bot.selfId === activeBotSelfId"
          :style="getBotSwitchStyle(index)"
          @click.stop="selectBot(bot.selfId)"
        >
          <span class="onebot-webqq__avatar">
            <img v-if="bot.avatar" :src="withProxy(bot.avatar)" :alt="getBotName(bot)">
            <k-icon v-else name="robot" />
            <span :class="['onebot-webqq__status', getBotStatusClass(bot)]"></span>
            <span v-if="showWebQQCapsuleUnread && webQQTotalUnread && bot.selfId === activeBotSelfId" class="onebot-webqq__avatar-unread">{{ capsuleUnreadText }}</span>
          </span>
        </button>
        <span
          v-if="collapsedBotOverflowCount"
          class="onebot-webqq__bot-overflow"
          :style="botOverflowStyle"
          aria-hidden="true"
        >+{{ collapsedBotOverflowCount }}</span>
      </div>
      <button
        v-else
        class="onebot-webqq__avatar-button"
        type="button"
        :aria-label="capsuleButtonLabel"
        :aria-expanded="webqqOpen"
        @click="toggleWebQQ"
      >
        <span class="onebot-webqq__avatar">
          <img v-if="displayBotAvatar" :src="withProxy(displayBotAvatar)" :alt="displayBotName">
          <k-icon v-else name="robot" />
          <span :class="['onebot-webqq__status', statusClass]"></span>
          <span v-if="showWebQQCapsuleUnread && webQQTotalUnread" class="onebot-webqq__avatar-unread">{{ capsuleUnreadText }}</span>
        </span>
      </button>
      <Transition name="onebot-webqq-avatar-guide">
        <span
          v-if="webQQAvatarGuideVisible && !webqqOpen"
          class="onebot-webqq__avatar-guide"
          aria-hidden="true"
        >
          <span class="onebot-webqq__avatar-guide-ring"></span>
        </span>
      </Transition>
      <div class="onebot-webqq__body" @click="showWebQQAvatarGuide()">
        <div class="onebot-webqq__title-line">
          <div class="onebot-webqq__title" :title="displayBotName">
            {{ displayBotName }}
          </div>
          <span v-if="titleStatusText" class="onebot-webqq__title-status is-thinking">{{ titleStatusText }}</span>
        </div>
        <div class="onebot-webqq__meta" :title="metaTitle">
          <span v-if="displayActivityText" class="onebot-webqq__activity">{{ displayActivityText }}</span>
        </div>
      </div>
    </div>
    <WebQQObserver v-show="webqqOpen" :visible="webqqOpen" />
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Universal, activities, router, store, withProxy } from '@koishijs/client'
import { availableBots as runtimeBots, capsule, selectedBotSelfId, showWebQQCapsuleUnread, webQQColorMode, webQQTotalUnread, type OneBotRobotProfile } from './state'
import { selectWebQQBot } from './api/webqq'
import WebQQObserver from './WebQQObserver.vue'

const capsuleProfileStorageKey = 'onebot-webqq:bot-profile:v1'
const webQQAvatarGuideStorageKey = 'onebot-webqq:webqq-avatar-guide:v1'
const webqqOpen = ref(false)
const webQQAvatarGuideVisible = ref(false)
const capsuleHost = ref<HTMLElement>()
const cachedBotProfile = ref(loadCachedBotProfile())
let webQQAvatarGuideTimer: ReturnType<typeof setTimeout> | undefined
const isLoggerRoute = computed(() => router.currentRoute.value.path === '/logs')
const isLoggedIn = computed(() => !activities.login || ('user' in store && !!store.user))
const shouldShowCapsule = computed(() => isLoggedIn.value && !isLoggerRoute.value)
const availableBots = computed(() => capsule.value?.bots?.length ? capsule.value.bots : runtimeBots.value)
const hasMultipleBots = computed(() => availableBots.value.length > 1)
const selectedBot = computed(() => availableBots.value.find((bot) => bot.selfId === selectedBotSelfId.value))
const displayBotProfile = computed(() => selectedBot.value ?? capsule.value?.bot)
const activeBotSelfId = computed(() => displayBotProfile.value?.selfId || selectedBotSelfId.value)
const botStackBots = computed(() => {
  const bots = availableBots.value
  const activeIndex = bots.findIndex((bot) => bot.selfId === activeBotSelfId.value)
  return activeIndex > 0
    ? [bots[activeIndex], ...bots.slice(0, activeIndex), ...bots.slice(activeIndex + 1)]
    : bots
})
const collapsedBotVisibleCount = computed(() => Math.min(botStackBots.value.length, 3))
const collapsedBotOverflowCount = computed(() => Math.max(0, botStackBots.value.length - collapsedBotVisibleCount.value))
const collapsedBotStackWidth = computed(() => 42 + Math.max(0, collapsedBotVisibleCount.value - 1) * 24 + (collapsedBotOverflowCount.value ? 18 : 0))
const expandedBotStackWidth = computed(() => 42 + Math.max(0, botStackBots.value.length - 1) * 31)
const displayBotName = computed(() => displayBotProfile.value?.name || cachedBotProfile.value.name || '空闲')
const displayBotAvatar = computed(() => displayBotProfile.value?.avatar || cachedBotProfile.value.avatar || '')
const capsuleStyle = computed(() => {
  if (!hasMultipleBots.value) return {}
  return {
    '--onebot-webqq-capsule-collapsed-width': `${220 + collapsedBotStackWidth.value - 42}px`,
    '--onebot-webqq-capsule-expanded-width': `${220 + expandedBotStackWidth.value - 42}px`,
  }
})
const botStackStyle = computed(() => {
  return {
    '--onebot-webqq-stack-collapsed-width': `${collapsedBotStackWidth.value}px`,
    '--onebot-webqq-stack-expanded-width': `${expandedBotStackWidth.value}px`,
  }
})
const botOverflowStyle = computed(() => {
  return {
    '--onebot-webqq-bot-overflow-right': `${Math.max(0, collapsedBotVisibleCount.value - 1) * 24 + 18}px`,
    zIndex: '0',
  }
})
const capsuleUnreadText = computed(() => getCapsuleUnreadText(webQQTotalUnread.value))
const capsuleButtonLabel = computed(() => {
  return showWebQQCapsuleUnread.value && webQQTotalUnread.value
    ? `打开 WebQQ 观察窗，${capsuleUnreadText.value} 条未读消息`
    : '打开 WebQQ 观察窗'
})
const titleStatusText = computed(() => capsule.value?.conversation.activityText === '正在思考' ? '正在思考' : '')
const displayActivityText = computed(() => {
  const conversation = capsule.value?.conversation
  if (!conversation) return '空闲中'
  if (conversation.userName) return `正在与 ${conversation.userName} 对话`
  return conversation.activityText && conversation.activityText !== '正在思考'
    ? conversation.activityText
    : '空闲中'
})

const metaTitle = computed(() => displayActivityText.value)

const statusClass = computed(() => getBotStatusClass(displayBotProfile.value))

function getBotName(bot?: Pick<OneBotRobotProfile, 'name' | 'selfId'>) {
  if (!bot) return '机器人'
  const name = bot.name?.trim()
  return name && name !== bot.selfId ? name : '机器人'
}

function getBotStatusClass(bot?: Pick<OneBotRobotProfile, 'status'>) {
  switch (bot?.status) {
    case Universal.Status.ONLINE:
      return 'is-online'
    case Universal.Status.CONNECT:
    case Universal.Status.RECONNECT:
      return 'is-pending'
    default:
      return 'is-offline'
  }
}

function getBotSwitchLabel(bot: OneBotRobotProfile) {
  const name = getBotName(bot)
  return bot.selfId === activeBotSelfId.value ? `打开 ${name} 的 WebQQ 观察窗` : `切换到 ${name} 的 WebQQ`
}

function getBotSwitchStyle(index: number) {
  return {
    '--onebot-webqq-bot-collapsed-right': `${index * 24}px`,
    '--onebot-webqq-bot-expanded-right': `${index * 31}px`,
    zIndex: String(botStackBots.value.length - index),
  }
}

function isBotCollapsedExtra(index: number) {
  return collapsedBotOverflowCount.value > 0 && index >= collapsedBotVisibleCount.value
}

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

async function selectBot(selfId: string) {
  if (selfId === activeBotSelfId.value) {
    toggleWebQQ()
    return
  }
  try {
    const botState = await selectWebQQBot(selfId)
    runtimeBots.value = botState.bots
    selectedBotSelfId.value = botState.selectedSelfId || selfId
    webqqOpen.value = true
    rememberWebQQAvatarGuide()
    hideWebQQAvatarGuide()
  } catch {}
}

onMounted(() => {
  document.addEventListener('pointerdown', closeWebQQOnOutsideClick)
  if (!hasSeenWebQQAvatarGuide()) showWebQQAvatarGuide(true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeWebQQOnOutsideClick)
  hideWebQQAvatarGuide()
})

watch(displayBotProfile, (bot) => {
  if (!bot) return
  cacheBotProfile(bot.name, bot.avatar)
}, { immediate: true })

</script>
