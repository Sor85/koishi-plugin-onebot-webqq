<template>
  <div v-if="shouldShowCapsule" ref="capsuleHost" class="onebot-webqq-host">
    <div ref="capsuleLayoutRef" class="onebot-webqq-layout-root">
      <div
        :class="['onebot-webqq', `is-color-${webQQColorMode}`, {
          'is-bot-stack-expanded': botStackVisualExpanded,
          'is-capsule-shadow-wide': !useCompactCapsuleShadow,
        }]"
        :style="capsuleStyle"
        aria-live="polite"
      >
        <div
          :class="['onebot-webqq__avatar-capsule', { 'has-bot-stack': hasMultipleBots, 'is-expanded': botStackVisualExpanded }]"
          :style="avatarCapsuleStyle"
          @pointerenter="expandBotStack"
          @pointerleave="collapseBotStack"
          @focusin="focusBotStack"
          @focusout="blurBotStack"
        >
          <div
            v-if="hasMultipleBots"
            :class="['onebot-webqq__bot-stack', {
              'is-expanded': botStackVisualExpanded,
              'is-overflow-expanding': botStackOverflowMotion === 'expanding',
              'is-overflow-collapsing': botStackOverflowMotion === 'collapsing',
            }]"
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
              :aria-hidden="isBotCollapsedHidden(index) ? 'true' : undefined"
              :tabindex="isBotCollapsedHidden(index) ? -1 : undefined"
              :style="getBotSwitchStyle(index)"
              @click.stop="selectBot(bot.selfId)"
            >
              <span class="onebot-webqq__avatar">
                <img v-if="bot.avatar" :src="withProxy(bot.avatar)" :alt="getBotName(bot)">
                <k-icon v-else name="robot" />
                <span v-if="bot.selfId === activeBotSelfId" :class="['onebot-webqq__status', getBotStatusClass(bot)]"></span>
                <span v-if="showWebQQCapsuleUnread && webQQTotalUnread && bot.selfId === activeBotSelfId" class="onebot-webqq__avatar-unread">{{ capsuleUnreadText }}</span>
                <Transition name="onebot-webqq-avatar-guide">
                  <span
                    v-if="bot.selfId === activeBotSelfId && webQQAvatarGuideVisible && !webQQOpen"
                    class="onebot-webqq__avatar-guide"
                    aria-hidden="true"
                  >
                    <span class="onebot-webqq__avatar-guide-ring"></span>
                  </span>
                </Transition>
              </span>
            </button>
            <span
              v-if="collapsedBotOverflowCount"
              class="onebot-webqq__bot-overflow"
              :style="botOverflowStyle"
              aria-hidden="true"
            >
              <span v-if="botOverflowPreview" class="onebot-webqq__bot-overflow-avatar">
                <img v-if="botOverflowPreview.avatar" :src="withProxy(botOverflowPreview.avatar)" :alt="getBotName(botOverflowPreview)">
                <k-icon v-else name="robot" />
              </span>
              <span class="onebot-webqq__bot-overflow-label">
                <span class="onebot-webqq__bot-overflow-plus">+</span>
                <span class="onebot-webqq__bot-overflow-count">{{ collapsedBotOverflowCount }}</span>
              </span>
            </span>
          </div>
          <button
            v-else
            class="onebot-webqq__avatar-button"
            type="button"
            :aria-label="capsuleButtonLabel"
            :aria-expanded="webQQOpen"
            @click="toggleWebQQ"
          >
            <span class="onebot-webqq__avatar">
              <img v-if="displayBotAvatar" :src="withProxy(displayBotAvatar)" :alt="displayBotName">
              <k-icon v-else name="robot" />
              <span :class="['onebot-webqq__status', statusClass]"></span>
              <span v-if="showWebQQCapsuleUnread && webQQTotalUnread" class="onebot-webqq__avatar-unread">{{ capsuleUnreadText }}</span>
              <Transition name="onebot-webqq-avatar-guide">
                <span
                  v-if="webQQAvatarGuideVisible && !webQQOpen"
                  class="onebot-webqq__avatar-guide"
                  aria-hidden="true"
                >
                  <span class="onebot-webqq__avatar-guide-ring"></span>
                </span>
              </Transition>
            </span>
          </button>
        </div>
      </div>
    </div>
    <div :class="['onebot-webqq__body', `is-color-${webQQColorMode}`]" @click="showWebQQAvatarGuide()">
      <div class="onebot-webqq__title-line">
        <div
          ref="titleRef"
          class="onebot-webqq__title"
          @pointerenter="showCapsuleTextTooltip('title')"
          @pointerleave="hideCapsuleTextTooltip"
        >
          {{ displayBotName }}
        </div>
        <span v-if="titleStatusText" class="onebot-webqq__title-status is-thinking">{{ titleStatusText }}</span>
      </div>
      <div class="onebot-webqq__meta">
        <span
          v-if="displayActivityText"
          ref="activityRef"
          :class="['onebot-webqq__activity', { 'is-conversation': conversationUserName }]"
          @pointerenter="showCapsuleTextTooltip('activity')"
          @pointerleave="hideCapsuleTextTooltip"
        >
          <template v-if="conversationUserName">
            <span class="onebot-webqq__activity-prefix">正在与</span>
            <span ref="activityUserRef" class="onebot-webqq__activity-user">{{ conversationUserName }}</span>
            <span class="onebot-webqq__activity-suffix">对话</span>
          </template>
          <template v-else>{{ displayActivityText }}</template>
        </span>
      </div>
      <Transition name="onebot-webqq-tooltip">
        <div
          v-if="capsuleTooltipText"
          ref="tooltipRef"
          class="onebot-webqq__tooltip"
          :style="tooltipStyle"
          role="tooltip"
        >
          <span class="onebot-webqq__tooltip-content">{{ capsuleTooltipText }}</span>
        </div>
      </Transition>
    </div>
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Universal, activities, router, store, withProxy } from '@koishijs/client'
import { createLayout, type AutoLayout } from 'animejs'
import { webQQOpen } from '../entry-state'
import { availableBots as runtimeBots, selectedBotSelfId, selectWebQQBot, type OneBotRobotProfile } from '../onebot/bots'
import { showWebQQCapsuleUnread, useCompactCapsuleShadow, webQQColorMode, webQQTotalUnread } from '../webqq/settings'
import { capsule } from './state'

const capsuleProfileStorageKey = 'onebot-webqq:bot-profile:v1'
const webQQAvatarGuideStorageKey = 'onebot-webqq:webqq-avatar-guide:v1'
const webQQAvatarGuideVisible = ref(false)
const capsuleHost = ref<HTMLElement>()
const capsuleLayoutRef = ref<HTMLElement>()
const titleRef = ref<HTMLElement>()
const activityRef = ref<HTMLElement>()
const activityUserRef = ref<HTMLElement>()
const tooltipRef = ref<HTMLElement>()
const cachedBotProfile = ref(loadCachedBotProfile())
const botStackExpanded = ref(false)
const botStackHovered = ref(false)
const botStackFocused = ref(false)
type BotStackOverflowMotion = 'idle' | 'expanding' | 'collapsing'
const botStackOverflowMotion = ref<BotStackOverflowMotion>('idle')
// Chrome 会在 click 时聚焦 <button>，切换 bot 时 Vue 把这个聚焦节点移到最右会触发一次
// relatedTarget 为 null 的 focusout。切换期间挂起折叠，避免它取消正在进行的切换 FLIP。
let suppressStackCollapse = false
let suppressStackCollapseTimer: ReturnType<typeof setTimeout> | undefined
const titleOverflow = ref(false)
const activityOverflow = ref(false)
const capsuleTooltipTarget = ref<'title' | 'activity'>()
const tooltipLeft = ref(0)
let webQQAvatarGuideTimer: ReturnType<typeof setTimeout> | undefined
let botStackLayout: AutoLayout | undefined
let botStackOverflowMotionTimer: ReturnType<typeof setTimeout> | undefined
let capsuleTextResizeObserver: ResizeObserver | undefined
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
const hasBotStackOverflow = computed(() => collapsedBotOverflowCount.value > 0)
const botStackVisualExpanded = computed(() => botStackExpanded.value || !hasBotStackOverflow.value)
const botOverflowPreview = computed(() => botStackBots.value[collapsedBotVisibleCount.value])
const collapsedBotStackWidth = computed(() => 42 + Math.max(0, collapsedBotVisibleCount.value - 1) * 24 + (collapsedBotOverflowCount.value ? 24 : 0))
const expandedBotStackWidth = computed(() => 42 + Math.max(0, botStackBots.value.length - 1) * 31)
const displayBotName = computed(() => displayBotProfile.value?.name || cachedBotProfile.value.name || '空闲')
const displayBotAvatar = computed(() => displayBotProfile.value?.avatar || cachedBotProfile.value.avatar || '')
const capsuleStyle = computed(() => {
  if (!hasMultipleBots.value) return {}
  return {
    '--onebot-webqq-shell-collapsed-width': `${162 + collapsedBotStackWidth.value}px`,
    '--onebot-webqq-shell-width': `${162 + expandedBotStackWidth.value}px`,
  }
})
const avatarCapsuleStyle = computed(() => {
  if (!hasMultipleBots.value) return {}
  return {
    '--onebot-webqq-avatar-capsule-collapsed-width': `${collapsedBotStackWidth.value + 8}px`,
    '--onebot-webqq-avatar-capsule-expanded-width': `${expandedBotStackWidth.value + 8}px`,
  }
})
const botStackStyle = computed(() => {
  return {
    '--onebot-webqq-stack-collapsed-width': `${collapsedBotStackWidth.value}px`,
    '--onebot-webqq-stack-expanded-width': `${expandedBotStackWidth.value}px`,
  }
})
const botOverflowStyle = computed(() => {
  const collapsedRight = collapsedBotVisibleCount.value * 24
  const expandedRight = collapsedBotVisibleCount.value * 31
  const isCoveredByExpandedAvatar = botStackExpanded.value || botStackOverflowMotion.value === 'expanding'
  const overflowZIndex = botStackBots.value.length - collapsedBotVisibleCount.value - (isCoveredByExpandedAvatar ? 1 : 0)
  return {
    '--onebot-webqq-bot-overflow-right': `${collapsedRight}px`,
    '--onebot-webqq-bot-overflow-expanded-right': `${expandedRight}px`,
    '--onebot-webqq-bot-overflow-z-index': `${overflowZIndex}`,
  }
})
const capsuleUnreadText = computed(() => getCapsuleUnreadText(webQQTotalUnread.value))
const capsuleButtonLabel = computed(() => {
  return showWebQQCapsuleUnread.value && webQQTotalUnread.value
    ? `打开 WebQQ 观察窗，${capsuleUnreadText.value} 条未读消息`
    : '打开 WebQQ 观察窗'
})
const titleStatusText = computed(() => capsule.value?.conversation.activityText === '正在思考' ? '正在思考' : '')
const conversationUserName = computed(() => capsule.value?.conversation.userName || '')
const displayActivityText = computed(() => {
  const conversation = capsule.value?.conversation
  if (!conversation) return '空闲中'
  if (conversationUserName.value) return `正在与 ${conversationUserName.value} 对话`
  return conversation.activityText && conversation.activityText !== '正在思考'
    ? conversation.activityText
    : '空闲中'
})
const capsuleTooltipText = computed(() => {
  if (capsuleTooltipTarget.value === 'title' && titleOverflow.value) return displayBotName.value
  if (capsuleTooltipTarget.value === 'activity' && activityOverflow.value) return activityTooltipText.value
  return ''
})
const activityTooltipText = computed(() => conversationUserName.value || displayActivityText.value)
const tooltipStyle = computed(() => ({ '--onebot-webqq-tooltip-left': `${tooltipLeft.value}px` }))

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
  // 折叠态把余量头像收拢到头像余量徽标的位置，再由徽标承接数量显示。
  // 收拢位与展开位都落在当前 bot 头像左侧，FLIP 在两端之间线性插值，余量头像不会越过当前头像。
  const collapsedRight = isBotCollapsedExtra(index)
    ? collapsedBotVisibleCount.value * 24
    : index * 24
  return {
    '--onebot-webqq-bot-collapsed-right': `${collapsedRight}px`,
    '--onebot-webqq-bot-expanded-right': `${index * 31}px`,
    zIndex: String(botStackBots.value.length - index),
  }
}

function isBotCollapsedExtra(index: number) {
  return collapsedBotOverflowCount.value > 0 && index >= collapsedBotVisibleCount.value
}

// 余量头像折叠态改用 opacity 隐藏（不再 visibility:hidden）以保住 FLIP 位移补偿，
// 因此折叠态要手动把它们移出 Tab 序与读屏树，展开后再恢复，避免出现不可见可聚焦按钮。
function isBotCollapsedHidden(index: number) {
  return !botStackExpanded.value && isBotCollapsedExtra(index)
}

function ensureBotStackLayout() {
  if (botStackLayout || !capsuleLayoutRef.value) return botStackLayout
  // layout root 不能是 fixed 胶囊本体；用独立 wrapper 记录外层右锚定胶囊的左移，同时把右侧正文隔离在 wrapper 外，避免文字被 FLIP 位移。
  // bot 按钮必须一起进入 FLIP，才能抵消外层胶囊向左扩张时对子节点的位移，保证当前 bot 头像屏幕坐标不动。
  // 头像引导只属于单机器人路径；把它排除在 layout children 外，避免多机器人折叠态把波纹层带进头像组动画。
  botStackLayout = createLayout(capsuleLayoutRef.value, {
    children: ['.onebot-webqq', '.onebot-webqq__avatar-capsule', '.onebot-webqq__bot-stack', '.onebot-webqq__bot-switch', '.onebot-webqq__bot-overflow'],
  })
  return botStackLayout
}

function recordBotStackLayout() {
  const layout = ensureBotStackLayout()
  layout?.record()
  return layout
}

async function animateBotStackLayout(layout?: AutoLayout) {
  if (!layout) return
  await nextTick()
  layout.animate({ duration: 260, ease: 'out(3)' })
}

function setBotStackExpanded(expanded: boolean) {
  if (!hasMultipleBots.value || !hasBotStackOverflow.value) return
  if (botStackExpanded.value === expanded) return
  const layout = recordBotStackLayout()
  botStackOverflowMotion.value = expanded ? 'expanding' : 'collapsing'
  if (botStackOverflowMotionTimer) clearTimeout(botStackOverflowMotionTimer)
  botStackOverflowMotionTimer = setTimeout(() => {
    botStackOverflowMotion.value = 'idle'
    botStackOverflowMotionTimer = undefined
  }, 280)
  botStackExpanded.value = expanded
  void animateBotStackLayout(layout)
}

// 展开态由「指针悬停」或「焦点驻留」任一为真推导，而不是直接听 pointerleave/focusout。
// Chrome 点击 <button> 会聚焦它，随后 selectBot 把这枚已聚焦按钮在 keyed v-for 里挪到最右，
// 触发一次 relatedTarget 为 null 的 focusout——旧逻辑会据此立刻折叠，打断切换 FLIP 并卡死后续折叠。
// 改成显式跟踪 hover/focus，并在 selectBot 重排期间挂起折叠，避免这次伪 focusout 误触发。
function syncBotStackExpanded() {
  if (suppressStackCollapse) return
  setBotStackExpanded(botStackHovered.value || botStackFocused.value)
}

function expandBotStack() {
  botStackHovered.value = true
  syncBotStackExpanded()
}

function collapseBotStack() {
  botStackHovered.value = false
  syncBotStackExpanded()
}

function focusBotStack() {
  botStackFocused.value = true
  syncBotStackExpanded()
}

function blurBotStack(event?: FocusEvent) {
  const nextTarget = event?.relatedTarget
  const currentTarget = event?.currentTarget
  // 焦点仍落在胶囊内部（Tab 切换头像）时不算离开。
  botStackFocused.value = nextTarget instanceof Node && currentTarget instanceof Node && currentTarget.contains(nextTarget)
  syncBotStackExpanded()
}

function getCapsuleUnreadText(count: number) {
  return count > 99999 ? '99999+' : String(count)
}

function hasTextOverflow(element?: HTMLElement) {
  return !!element && element.scrollWidth > element.clientWidth + 1
}

function refreshCapsuleTextOverflow() {
  titleOverflow.value = hasTextOverflow(titleRef.value)
  activityOverflow.value = conversationUserName.value
    ? hasTextOverflow(activityUserRef.value)
    : hasTextOverflow(activityRef.value)
  if (capsuleTooltipTarget.value === 'title' && !titleOverflow.value) capsuleTooltipTarget.value = undefined
  if (capsuleTooltipTarget.value === 'activity' && !activityOverflow.value) capsuleTooltipTarget.value = undefined
  if (capsuleTooltipTarget.value) void nextTick(updateCapsuleTooltipPosition)
}

function showCapsuleTextTooltip(target: 'title' | 'activity') {
  refreshCapsuleTextOverflow()
  const overflow = target === 'title' ? titleOverflow.value : activityOverflow.value
  capsuleTooltipTarget.value = overflow ? target : undefined
  if (overflow) void nextTick(updateCapsuleTooltipPosition)
}

function hideCapsuleTextTooltip() {
  capsuleTooltipTarget.value = undefined
}

function updateCapsuleTooltipPosition() {
  const body = tooltipRef.value?.parentElement
  const tooltip = tooltipRef.value
  if (!body || !tooltip || typeof window === 'undefined') {
    tooltipLeft.value = 0
    return
  }
  const viewportMargin = 12
  const bodyRect = body.getBoundingClientRect()
  const tooltipWidth = Math.min(tooltip.offsetWidth, Math.max(0, window.innerWidth - viewportMargin * 2))
  const centeredLeft = bodyRect.width / 2 - tooltipWidth / 2
  const minLeft = viewportMargin - bodyRect.left
  const maxLeft = window.innerWidth - viewportMargin - bodyRect.left - tooltipWidth
  tooltipLeft.value = Math.min(Math.max(centeredLeft, minLeft), maxLeft)
}

function observeCapsuleTextOverflow() {
  if (typeof ResizeObserver === 'undefined') return
  capsuleTextResizeObserver = new ResizeObserver(refreshCapsuleTextOverflow)
  if (titleRef.value) capsuleTextResizeObserver.observe(titleRef.value)
  if (activityRef.value) capsuleTextResizeObserver.observe(activityRef.value)
  if (activityUserRef.value) capsuleTextResizeObserver.observe(activityUserRef.value)
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
  if (webQQOpen.value) return
  if (remember) rememberWebQQAvatarGuide()
  webQQAvatarGuideVisible.value = true
  if (webQQAvatarGuideTimer) clearTimeout(webQQAvatarGuideTimer)
  webQQAvatarGuideTimer = setTimeout(() => {
    webQQAvatarGuideVisible.value = false
    webQQAvatarGuideTimer = undefined
  }, 3600)
}

function closeWebQQOnOutsideClick(event: PointerEvent) {
  if (!webQQOpen.value) return
  const target = event.target
  if (target instanceof Node && capsuleHost.value?.contains(target)) return
  webQQOpen.value = false
}

function toggleWebQQ() {
  webQQOpen.value = !webQQOpen.value
  if (webQQOpen.value) {
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
    const layout = recordBotStackLayout()
    // 挂起折叠后再重排：Vue 移动这枚（Chrome 已聚焦的）按钮触发的伪 focusout 不会打断切换 FLIP。
    suppressStackCollapse = true
    if (suppressStackCollapseTimer) clearTimeout(suppressStackCollapseTimer)
    runtimeBots.value = botState.bots
    selectedBotSelfId.value = botState.selectedSelfId || selfId
    webQQOpen.value = true
    rememberWebQQAvatarGuide()
    hideWebQQAvatarGuide()
    await animateBotStackLayout(layout)
    // 切换 FLIP 跑完再解除挂起，并按真实 hover/focus 收敛——指针已离开则此时自然折叠。
    // 重排途中那次被挂起的 focusout 可能让 botStackFocused 留在过期的 false，这里按
    // document.activeElement 真实归属重新判定，避免键盘切换后焦点仍在胶囊内却误折叠。
    suppressStackCollapseTimer = setTimeout(() => {
      suppressStackCollapse = false
      suppressStackCollapseTimer = undefined
      botStackFocused.value = !!capsuleHost.value?.contains(document.activeElement)
      syncBotStackExpanded()
    }, 280)
  } catch {
    suppressStackCollapse = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', closeWebQQOnOutsideClick)
  window.addEventListener('resize', updateCapsuleTooltipPosition)
  if (!hasSeenWebQQAvatarGuide()) showWebQQAvatarGuide(true)
  observeCapsuleTextOverflow()
  void nextTick(refreshCapsuleTextOverflow)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeWebQQOnOutsideClick)
  window.removeEventListener('resize', updateCapsuleTooltipPosition)
  botStackLayout?.revert()
  botStackLayout = undefined
  if (botStackOverflowMotionTimer) clearTimeout(botStackOverflowMotionTimer)
  capsuleTextResizeObserver?.disconnect()
  capsuleTextResizeObserver = undefined
  if (suppressStackCollapseTimer) clearTimeout(suppressStackCollapseTimer)
  hideWebQQAvatarGuide()
})

watch(displayBotProfile, (bot) => {
  if (!bot) return
  cacheBotProfile(bot.name, bot.avatar)
}, { immediate: true })

watch([displayBotName, displayActivityText, conversationUserName, botStackExpanded], () => {
  void nextTick(refreshCapsuleTextOverflow)
}, { immediate: true })

</script>
