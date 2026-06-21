<template>
  <template v-if="loading">
    <div class="onebot-webqq-webqq__placeholder">加载中</div>
  </template>
  <template v-else-if="errorText">
    <div class="onebot-webqq-webqq__placeholder is-error">{{ errorText }}</div>
  </template>
  <template v-else-if="!hasCurrentChat">
    <div class="onebot-webqq-webqq__placeholder">选择一个会话</div>
  </template>
  <template v-else-if="!visibleMessages.length">
    <div class="onebot-webqq-webqq__placeholder">暂无消息</div>
  </template>
  <template v-else>
    <template v-for="(message, index) in visibleMessages" :key="message.id || message.sequence">
      <div v-if="message.event" class="onebot-webqq-webqq__message-event">
        {{ message.summary }}
      </div>
      <div
        v-else
        :ref="(element) => setMessageElementRef(message, element)"
        :class="['onebot-webqq-webqq__message', `is-${message.direction}`, getMessageClusterClass(index), { 'is-merged': isMergedMessage(index), 'is-thinking': isBotThinkingMessage(message), 'is-recalled': message.recalled, 'is-quote-target': isHighlightedMessage(message) }]"
      >
        <span class="onebot-webqq-webqq__message-avatar-wrap">
          <img class="onebot-webqq-webqq__message-avatar" :src="withProxy(message.senderAvatar)" :alt="message.senderName">
          <span v-if="message.senderAffinity != null && showWebQQAffinity" class="onebot-webqq-webqq__message-affinity">
            <svg class="onebot-webqq-webqq__message-affinity-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
            </svg>
            {{ message.senderAffinity }}
          </span>
        </span>
        <div class="onebot-webqq-webqq__message-content">
          <div v-if="!isMergedMessage(index)" class="onebot-webqq-webqq__sender-line">
            <template v-if="message.direction === 'outgoing'">
              <span v-if="getSenderAuthorityText(message)" :class="['onebot-webqq-webqq__sender-badge', getSenderAuthorityClass(message)]">{{ getSenderAuthorityText(message) }}</span>
              <span v-if="message.senderLevel && !hideWebQQGroupLevel" class="onebot-webqq-webqq__sender-badge is-level">{{ formatSenderLevel(message.senderLevel) }}</span>
              <span class="onebot-webqq-webqq__message-name">{{ message.senderName }}</span>
              <span v-if="message.senderRelationship && showWebQQRelationship" class="onebot-webqq-webqq__sender-badge is-relationship">{{ message.senderRelationship }}</span>
            </template>
            <template v-if="message.direction === 'incoming'">
              <span class="onebot-webqq-webqq__message-name">{{ message.senderName }}</span>
              <span v-if="message.senderRelationship && showWebQQRelationship" class="onebot-webqq-webqq__sender-badge is-relationship">{{ message.senderRelationship }}</span>
              <span v-if="message.senderLevel && !hideWebQQGroupLevel" class="onebot-webqq-webqq__sender-badge is-level">{{ formatSenderLevel(message.senderLevel) }}</span>
              <span v-if="getSenderAuthorityText(message)" :class="['onebot-webqq-webqq__sender-badge', getSenderAuthorityClass(message)]">{{ getSenderAuthorityText(message) }}</span>
            </template>
          </div>
          <div class="onebot-webqq-webqq__message-body">
            <div v-if="isImageOnlyMessage(message)" class="onebot-webqq-webqq__message-media-stack">
              <div class="onebot-webqq-webqq__message-media">
                <button class="onebot-webqq-webqq__message-image" type="button" aria-label="查看大图" @click="openImage(getImageOnlyUrl(message))">
                  <img :src="withProxy(getImageOnlyUrl(message))" alt="图片" @load="emit('image-load')">
                </button>
              </div>
              <WebQQMessageReactions
                v-if="message.reactions?.length && chatStyle === 'telegram'"
                :reactions="message.reactions ?? []"
                :chat-style="chatStyle"
              />
            </div>
            <div
              v-else
              :ref="(element) => setBubbleElementRef(message, element)"
              :class="['onebot-webqq-webqq__bubble', { 'is-record-only': isRecordOnlyMessage(message) }]"
            >
              <span v-if="isBotThinkingMessage(message)" class="onebot-webqq-webqq__thinking-dots" aria-label="机器人正在思考">
                <span v-for="dot in 3" :key="dot" class="onebot-webqq-webqq__thinking-dot"></span>
              </span>
              <template v-else>
                <template v-for="(run, runIndex) in getWebQQElementRuns(message.elements)" :key="`${message.id}:run:${runIndex}`">
                  <span v-if="run.type === 'inline'" class="onebot-webqq-webqq__inline-run">
                    <template v-for="element in run.elements" :key="`${message.id}:inline:${runIndex}:${element.type}:${element.text || element.url || element.title || ''}`">
                      <span v-if="element.type === 'text'">{{ element.text }}</span>
                      <span v-else>{{ element.text || message.summary }}</span>
                    </template>
                  </span>
                  <button
                    v-else-if="run.element.type === 'quote' && run.element.targetMessageId"
                    class="onebot-webqq-webqq__quote is-clickable"
                    type="button"
                    aria-label="跳转到引用消息"
                    @click.stop="scrollToQuotedMessage(run.element.targetMessageId)"
                  >
                    <strong v-if="run.element.title" class="onebot-webqq-webqq__quote-title">{{ run.element.title }}</strong>
                    <span>{{ run.element.text || '[引用消息]' }}</span>
                  </button>
                  <div v-else-if="run.element.type === 'quote'" class="onebot-webqq-webqq__quote">
                    <strong v-if="run.element.title" class="onebot-webqq-webqq__quote-title">{{ run.element.title }}</strong>
                    <span>{{ run.element.text || '[引用消息]' }}</span>
                  </div>
                  <button
                    v-else-if="run.element.type === 'forward'"
                    class="onebot-webqq-webqq__quote onebot-webqq-webqq__forward"
                    type="button"
                    :disabled="!run.element.items?.length"
                    aria-label="查看合并转发消息"
                    @click.stop="emit('open-forward', run.element)"
                  >
                    <strong class="onebot-webqq-webqq__quote-title">{{ run.element.title || '合并转发' }}</strong>
                    <template v-if="run.element.items?.length">
                      <span v-for="(item, itemIndex) in getForwardPreviewItems(run.element)" :key="`${message.id}:forward:${runIndex}:${itemIndex}`">
                        {{ getForwardItemName(item) }}：{{ getForwardPreviewText(item) }}
                      </span>
                      <span class="onebot-webqq-webqq__forward-entry">查看{{ run.element.items.length }}条转发消息</span>
                    </template>
                    <span v-else>{{ run.element.text || '[合并转发]' }}</span>
                  </button>
                  <div
                    v-else-if="run.element.type === 'card'"
                    class="onebot-webqq-webqq__card"
                  >
                    <img v-if="run.element.imageUrl" class="onebot-webqq-webqq__card-cover" :src="withProxy(run.element.imageUrl)" alt="">
                    <span class="onebot-webqq-webqq__card-content">
                      <strong class="onebot-webqq-webqq__card-title">{{ run.element.title || '卡片消息' }}</strong>
                      <span v-if="run.element.text" class="onebot-webqq-webqq__card-desc">{{ run.element.text }}</span>
                      <span v-if="run.element.source" class="onebot-webqq-webqq__card-source">{{ run.element.source }}</span>
                    </span>
                  </div>
                  <button v-else-if="run.element.type === 'image' && run.element.url" class="onebot-webqq-webqq__message-image" type="button" aria-label="查看大图" @click="emit('open-image', run.element.url)">
                    <img :src="withProxy(run.element.url)" alt="图片" @load="emit('image-load')">
                  </button>
                  <div v-else-if="run.element.type === 'record'" class="onebot-webqq-webqq__record">
                    <div class="onebot-webqq-webqq__record-row">
                      <audio
                        v-if="run.element.url"
                        :ref="(element) => setRecordAudioRef(message, run.element, runIndex, element)"
                        class="onebot-webqq-webqq__record-audio"
                        :src="withProxy(run.element.url)"
                        preload="none"
                        @ended="handleRecordEnded(message, run.element, runIndex)"
                        @pause="handleRecordPause(message, run.element, runIndex)"
                        @play="handleRecordPlay(message, run.element, runIndex)"
                      ></audio>
                      <button
                        :class="['onebot-webqq-webqq__record-player', { 'is-playing': isRecordPlaying(message, run.element, runIndex), 'is-loading': isRecordLoading(message, run.element, runIndex) }]"
                        type="button"
                        :disabled="!run.element.url || isRecordLoading(message, run.element, runIndex)"
                        :style="getRecordPlayerStyle(run.element)"
                        aria-label="播放语音"
                        @click.stop="toggleRecordPlayback(message, run.element, runIndex)"
                      >
                        <svg v-if="isRecordLoading(message, run.element, runIndex)" class="onebot-webqq-webqq__record-play-icon is-loading" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 3a9 9 0 1 1-9 9"></path>
                        </svg>
                        <svg v-else-if="isRecordPlaying(message, run.element, runIndex)" class="onebot-webqq-webqq__record-play-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="7" y="5" width="3.5" height="14" rx="1"></rect>
                          <rect x="13.5" y="5" width="3.5" height="14" rx="1"></rect>
                        </svg>
                        <svg v-else class="onebot-webqq-webqq__record-play-icon is-play" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M8 5v14l11-7Z"></path>
                        </svg>
                        <svg class="onebot-webqq-webqq__record-wave" viewBox="0 0 24 18" aria-hidden="true">
                          <rect x="2" y="6" width="2.5" height="6" rx="1.25"></rect>
                          <rect x="7" y="3" width="2.5" height="12" rx="1.25"></rect>
                          <rect x="12" y="1" width="2.5" height="16" rx="1.25"></rect>
                          <rect x="17" y="4" width="2.5" height="10" rx="1.25"></rect>
                          <rect x="21" y="6" width="2.5" height="6" rx="1.25"></rect>
                        </svg>
                        <span class="onebot-webqq-webqq__record-duration">{{ formatRecordDuration(run.element.duration || 0) }}</span>
                      </button>
                      <button
                        v-if="message.id && !getRecordTranscript(message, run.element, runIndex)"
                        class="onebot-webqq-webqq__record-transcribe"
                        type="button"
                        :disabled="isRecordTranscribing(message, run.element, runIndex)"
                        aria-label="语音转文字"
                        @click.stop="transcribeRecordMessage(message, run.element, runIndex)"
                      >
                        <svg v-if="isRecordTranscribing(message, run.element, runIndex)" class="onebot-webqq-webqq__record-transcribe-icon is-loading" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 3a9 9 0 1 1-9 9"></path>
                        </svg>
                        <svg v-else class="onebot-webqq-webqq__record-transcribe-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 5h16"></path>
                          <path d="M8 5c0 6 1.5 10 4 13"></path>
                          <path d="M16 5c0 6-1.5 10-4 13"></path>
                          <path d="M7 14h10"></path>
                        </svg>
                      </button>
                    </div>
                    <div v-if="getRecordTranscript(message, run.element, runIndex)" class="onebot-webqq-webqq__record-transcript">
                      {{ getRecordTranscript(message, run.element, runIndex) }}
                    </div>
                  </div>
                  <span v-else>{{ run.element.text || message.summary }}</span>
                </template>
              </template>
              <WebQQMessageReactions
                v-if="message.reactions?.length && chatStyle === 'telegram'"
                :reactions="message.reactions ?? []"
                :chat-style="chatStyle"
              />
            </div>
            <WebQQMessageReactions
              v-if="message.reactions?.length && chatStyle !== 'telegram'"
              :reactions="message.reactions ?? []"
              :chat-style="chatStyle"
            />
            <div v-if="message.recalled" class="onebot-webqq-webqq__message-recall-status">已撤回</div>
            <div class="onebot-webqq-webqq__message-time">{{ formatTime(message.time) }}</div>
          </div>
        </div>
      </div>
      <div
        v-if="!message.event && getThinkingMessage(index)"
        class="onebot-webqq-webqq__thinking-row"
      >
        <button
          class="onebot-webqq-webqq__thinking-toggle"
          type="button"
          :aria-expanded="isThinkingMessageExpanded(index)"
          @click="toggleThinking(index)"
        >
          <span
            v-if="getThinkingMessage(index)?.thinking.usage"
            class="onebot-webqq-webqq__thinking-usage"
            aria-label="本次 token 用量"
          >
            <svg class="onebot-webqq-webqq__thinking-usage-icon is-input" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20V8"></path>
              <path d="m7 13 5-5 5 5"></path>
              <path d="M5 4h14"></path>
            </svg>
            <span>{{ getThinkingMessage(index)?.thinking.usage?.inputTokens }}</span>
            <svg class="onebot-webqq-webqq__thinking-usage-icon is-output" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v12"></path>
              <path d="m7 11 5 5 5-5"></path>
              <path d="M5 20h14"></path>
            </svg>
            <span>{{ getThinkingMessage(index)?.thinking.usage?.outputTokens }}</span>
          </span>
          <span>{{ getThinkingDurationText(index) }}</span>
          <svg :class="['onebot-webqq-webqq__thinking-chevron', { 'is-expanded': isThinkingMessageExpanded(index) }]" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5"></path>
          </svg>
        </button>
        <Transition name="onebot-webqq-webqq-thinking" @before-leave="prepareThinkingPanelLeave">
          <div
            v-if="isThinkingMessageExpanded(index)"
            class="onebot-webqq-webqq__thinking-panel"
          >
            <div class="onebot-webqq-webqq__thinking-content">{{ getThinkingMessage(index)?.thinking.content }}</div>
          </div>
        </Transition>
      </div>
    </template>
  </template>
</template>

<script lang="ts" setup>
import { withProxy } from '@koishijs/client'
import { nextTick, onBeforeUnmount, onBeforeUpdate, ref, type ComponentPublicInstance } from 'vue'
import WebQQMessageReactions from './WebQQMessageReactions.vue'
import type { WebQQChatStyle } from '../settings'
import type { WebQQMessage } from '../types'
import {
  formatSenderLevel,
  formatTime,
  getForwardItemName,
  getForwardPreviewItems as readForwardPreviewItems,
  getForwardPreviewText,
  getSenderAuthorityClass,
  getSenderAuthorityText,
  getWebQQElementRuns,
  isInlineWebQQElement,
  isImageOnlyMessage,
  type WebQQMessageElement,
  type WebQQThinkingMessage,
} from '../utils/webqq-message-view'
import { fitWebQQBubbleToInlineLines } from '../utils/webqq-bubble-width'

const props = defineProps<{
  loading: boolean
  errorText: string
  hasCurrentChat: boolean
  visibleMessages: WebQQMessage[]
  chatStyle: WebQQChatStyle
  showWebQQAffinity: boolean
  showWebQQRelationship: boolean
  hideWebQQGroupLevel: boolean
  isBotThinkingMessage: (message: WebQQMessage) => boolean
  getMessageClusterClass: (index: number) => string
  isMergedMessage: (index: number) => boolean
  transcribeRecord: (messageId: string) => Promise<string>
  getLastOutgoingClusterThinkingMessage: (index: number) => WebQQThinkingMessage | undefined
  isThinkingExpanded: (message: WebQQThinkingMessage) => boolean
  formatThinkingDuration: (durationMs: number) => string
}>()

const emit = defineEmits<{
  'open-image': [url: string]
  'image-load': []
  'open-forward': [element: WebQQMessageElement]
  'toggle-thinking': [message: WebQQThinkingMessage]
}>()

const messageElementRefs = new Map<string, HTMLElement>()
const bubbleElementRefs = new Map<string, HTMLElement>()
const recordAudioRefs = new Map<string, HTMLAudioElement>()
const highlightedMessageKey = ref('')
const playingRecordKey = ref('')
const loadingRecordKey = ref('')
const recordTranscripts = ref<Record<string, string>>({})
const transcribingRecordKeys = ref<Record<string, boolean>>({})
let highlightTimer: ReturnType<typeof setTimeout> | undefined
let textBubbleResizeObserver: ResizeObserver | undefined
let fitTextBubblesFrame: number | undefined
let thinkingMoveFrame: number | undefined
let thinkingMoveCleanupTimer: ReturnType<typeof setTimeout> | undefined
type TemplateRefValue = Element | ComponentPublicInstance | null
const webQQForwardPreviewLimit = 4

function getMessageDomKey(message: WebQQMessage) {
  return message.id || message.sequence
}

function getRecordKey(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  return `${getMessageDomKey(message)}:${runIndex}:${element.url || element.duration || element.text || ''}`
}

onBeforeUpdate(() => {
  messageElementRefs.clear()
  bubbleElementRefs.clear()
  textBubbleResizeObserver?.disconnect()
})

onBeforeUnmount(() => {
  if (highlightTimer) clearTimeout(highlightTimer)
  if (fitTextBubblesFrame != null) cancelAnimationFrame(fitTextBubblesFrame)
  if (thinkingMoveFrame != null) cancelAnimationFrame(thinkingMoveFrame)
  if (thinkingMoveCleanupTimer != null) clearTimeout(thinkingMoveCleanupTimer)
  for (const audio of recordAudioRefs.values()) audio.pause()
  bubbleElementRefs.clear()
  textBubbleResizeObserver?.disconnect()
  recordAudioRefs.clear()
})

function setMessageElementRef(message: WebQQMessage, element: TemplateRefValue) {
  if (!(element instanceof HTMLElement)) return
  const key = getMessageDomKey(message)
  if (key) messageElementRefs.set(key, element)
}

function shouldFitTextBubble(message: WebQQMessage) {
  return message.elements.length > 0 &&
    message.elements.every(isInlineWebQQElement)
}

function scheduleFitTextBubble(bubble: HTMLElement) {
  requestAnimationFrame(() => fitWebQQBubbleToInlineLines(bubble))
}

function scheduleFitTextBubbles() {
  if (fitTextBubblesFrame != null) return
  fitTextBubblesFrame = requestAnimationFrame(() => {
    fitTextBubblesFrame = undefined
    for (const bubble of bubbleElementRefs.values()) fitWebQQBubbleToInlineLines(bubble)
  })
}

function observeTextBubbleResizeTarget(bubble: HTMLElement) {
  if (typeof ResizeObserver === 'undefined') return
  textBubbleResizeObserver ||= new ResizeObserver(() => scheduleFitTextBubbles())
  const resizeTarget = bubble.closest<HTMLElement>('.onebot-webqq-webqq__message') || bubble.parentElement
  if (resizeTarget) textBubbleResizeObserver.observe(resizeTarget)
}

function setBubbleElementRef(message: WebQQMessage, element: TemplateRefValue) {
  const key = getMessageDomKey(message)
  if (!key) return
  if (!(element instanceof HTMLElement)) {
    bubbleElementRefs.delete(key)
    return
  }
  if (!shouldFitTextBubble(message)) {
    bubbleElementRefs.delete(key)
    element.style.width = ''
    return
  }
  // 浏览器先按可用宽度换行，气泡不会再按“最长实际行”回缩；渲染后读行矩形来消除纯文本气泡短末行造成的大空白。
  bubbleElementRefs.set(key, element)
  observeTextBubbleResizeTarget(element)
  scheduleFitTextBubble(element)
}

function setRecordAudioRef(message: WebQQMessage, element: WebQQMessageElement, runIndex: number, audio: TemplateRefValue) {
  const key = getRecordKey(message, element, runIndex)
  if (audio instanceof HTMLAudioElement) {
    recordAudioRefs.set(key, audio)
  } else {
    recordAudioRefs.delete(key)
  }
}

function getImageOnlyUrl(message: WebQQMessage) {
  const element = message.elements[0]
  return element?.type === 'image' ? element.url || '' : ''
}

function getForwardPreviewItems(element: WebQQMessageElement) {
  return readForwardPreviewItems(element, webQQForwardPreviewLimit)
}

function openImage(url: string | undefined) {
  if (url) emit('open-image', url)
}

function isHighlightedMessage(message: WebQQMessage) {
  return !!highlightedMessageKey.value && highlightedMessageKey.value === getMessageDomKey(message)
}

function scrollToQuotedMessage(targetMessageId: string) {
  const target = props.visibleMessages.find((message) => message.id === targetMessageId || message.sequence === targetMessageId)
  if (!target) return
  const targetKey = getMessageDomKey(target)
  const element = messageElementRefs.get(targetKey)
  if (!element) return
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightedMessageKey.value = getMessageDomKey(target)
  element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  highlightTimer = setTimeout(() => {
    if (highlightedMessageKey.value === targetKey) highlightedMessageKey.value = ''
  }, 1400)
}

function getThinkingMessage(index: number) {
  return props.getLastOutgoingClusterThinkingMessage(index)
}

function isThinkingMessageExpanded(index: number) {
  const message = getThinkingMessage(index)
  return message ? props.isThinkingExpanded(message) : false
}

function getThinkingDurationText(index: number) {
  const message = getThinkingMessage(index)
  return message ? props.formatThinkingDuration(message.thinking.durationMs) : ''
}

function readMessageRowRects() {
  const rects = new Map<string, DOMRect>()
  for (const [key, element] of messageElementRefs) rects.set(key, element.getBoundingClientRect())
  return rects
}

function animateMovedMessageRows(previousRects: Map<string, DOMRect>) {
  const movedElements: HTMLElement[] = []
  for (const [key, element] of messageElementRefs) {
    const previous = previousRects.get(key)
    if (!previous) continue
    const current = element.getBoundingClientRect()
    const deltaY = previous.top - current.top
    if (Math.abs(deltaY) < 0.5) continue
    element.style.transition = 'none'
    element.style.transform = `translateY(${deltaY}px)`
    element.style.willChange = 'transform'
    movedElements.push(element)
  }
  if (!movedElements.length) return
  if (thinkingMoveFrame != null) cancelAnimationFrame(thinkingMoveFrame)
  if (thinkingMoveCleanupTimer != null) clearTimeout(thinkingMoveCleanupTimer)
  // 已思考面板会一次性改变文档流高度；先把受影响消息钉回旧位置并强制一次布局，避免浏览器把位移和回弹合成同一帧而直接闪到终点。
  void movedElements[0].getBoundingClientRect()
  thinkingMoveFrame = requestAnimationFrame(() => {
    thinkingMoveFrame = undefined
    for (const element of movedElements) {
      element.style.transition = 'transform 0.16s ease'
      element.style.transform = ''
    }
    thinkingMoveCleanupTimer = setTimeout(() => {
      thinkingMoveCleanupTimer = undefined
      for (const element of movedElements) {
        element.style.transition = ''
        element.style.transform = ''
        element.style.willChange = ''
      }
    }, 200)
  })
}

function prepareThinkingPanelLeave(element: Element) {
  if (!(element instanceof HTMLElement) || !element.parentElement) return
  const parentRect = element.parentElement.getBoundingClientRect()
  const panelRect = element.getBoundingClientRect()
  // Vue 离场节点默认会继续占住文档流，导致后续消息只能等已思考淡出结束后才上移；这里把离场面板冻结在原视觉位置，让消息 FLIP 和面板离场同步开始。
  element.style.position = 'absolute'
  element.style.top = `${panelRect.top - parentRect.top}px`
  element.style.right = `${parentRect.right - panelRect.right}px`
  element.style.width = `${panelRect.width}px`
  element.style.marginTop = '0'
}

function formatRecordDuration(duration: number) {
  const totalSeconds = Math.max(0, Math.round(duration))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return minutes > 0 ? `${minutes}:${seconds}` : `${totalSeconds}"`
}

function getRecordPlayerStyle(element: WebQQMessageElement) {
  const duration = Math.max(0, Math.round(element.duration || 0))
  const width = Math.min(200, Math.max(102, 102 + duration * 3))
  return { width: `${width}px` }
}

function getRecordTranscript(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  return element.transcript || recordTranscripts.value[getRecordKey(message, element, runIndex)] || ''
}

function isRecordOnlyMessage(message: WebQQMessage) {
  return message.elements.length === 1 && message.elements[0].type === 'record'
}

function isRecordPlaying(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  return playingRecordKey.value === getRecordKey(message, element, runIndex)
}

function isRecordLoading(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  return loadingRecordKey.value === getRecordKey(message, element, runIndex)
}

function handleRecordPlay(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  playingRecordKey.value = getRecordKey(message, element, runIndex)
}

function handleRecordPause(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  const key = getRecordKey(message, element, runIndex)
  if (playingRecordKey.value === key) playingRecordKey.value = ''
}

function handleRecordEnded(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  handleRecordPause(message, element, runIndex)
}

async function toggleRecordPlayback(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  const key = getRecordKey(message, element, runIndex)
  const audio = recordAudioRefs.get(key)
  if (!audio || loadingRecordKey.value === key) return
  if (playingRecordKey.value === key) {
    audio.pause()
    playingRecordKey.value = ''
    return
  }
  if (playingRecordKey.value) recordAudioRefs.get(playingRecordKey.value)?.pause()
  loadingRecordKey.value = key
  try {
    await audio.play()
    playingRecordKey.value = key
  } catch {
    if (playingRecordKey.value === key) playingRecordKey.value = ''
  } finally {
    if (loadingRecordKey.value === key) loadingRecordKey.value = ''
  }
}

function isRecordTranscribing(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  return !!transcribingRecordKeys.value[getRecordKey(message, element, runIndex)]
}

async function transcribeRecordMessage(message: WebQQMessage, element: WebQQMessageElement, runIndex: number) {
  if (!message.id || getRecordTranscript(message, element, runIndex)) return
  const key = getRecordKey(message, element, runIndex)
  if (transcribingRecordKeys.value[key]) return
  transcribingRecordKeys.value = { ...transcribingRecordKeys.value, [key]: true }
  try {
    const text = await props.transcribeRecord(message.id)
    recordTranscripts.value = { ...recordTranscripts.value, [key]: text || '（无法识别）' }
  } catch {
    recordTranscripts.value = { ...recordTranscripts.value, [key]: '转换失败' }
  } finally {
    const nextTranscribingRecordKeys = { ...transcribingRecordKeys.value }
    delete nextTranscribingRecordKeys[key]
    transcribingRecordKeys.value = nextTranscribingRecordKeys
  }
}

async function toggleThinking(index: number) {
  const message = getThinkingMessage(index)
  if (!message) return
  const previousRects = readMessageRowRects()
  emit('toggle-thinking', message)
  await nextTick()
  animateMovedMessageRows(previousRects)
}
</script>
