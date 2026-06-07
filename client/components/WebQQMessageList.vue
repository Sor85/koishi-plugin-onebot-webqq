<template>
  <template v-if="loading">
    <div class="chat-capsule-webqq__placeholder">加载中</div>
  </template>
  <template v-else-if="errorText">
    <div class="chat-capsule-webqq__placeholder is-error">{{ errorText }}</div>
  </template>
  <template v-else-if="!hasCurrentChat">
    <div class="chat-capsule-webqq__placeholder">选择一个会话</div>
  </template>
  <template v-else-if="!visibleMessages.length">
    <div class="chat-capsule-webqq__placeholder">暂无消息</div>
  </template>
  <template v-else>
    <template v-for="(message, index) in visibleMessages" :key="message.id || message.sequence">
      <div v-if="message.event" class="chat-capsule-webqq__message-event">
        {{ message.summary }}
      </div>
      <div
        v-else
        :class="['chat-capsule-webqq__message', `is-${message.direction}`, getMessageClusterClass(index), { 'is-merged': isMergedMessage(index), 'is-thinking': isBotThinkingMessage(message), 'is-recalled': message.recalled }]"
      >
        <span class="chat-capsule-webqq__message-avatar-wrap">
          <img class="chat-capsule-webqq__message-avatar" :src="withProxy(message.senderAvatar)" :alt="message.senderName">
          <span v-if="message.senderAffinity != null && showWebQQAffinity" class="chat-capsule-webqq__message-affinity">
            <svg class="chat-capsule-webqq__message-affinity-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
            </svg>
            {{ message.senderAffinity }}
          </span>
        </span>
        <div class="chat-capsule-webqq__message-content">
          <div v-if="!isMergedMessage(index)" class="chat-capsule-webqq__sender-line">
            <template v-if="message.direction === 'outgoing'">
              <span v-if="getSenderAuthorityText(message)" :class="['chat-capsule-webqq__sender-badge', getSenderAuthorityClass(message)]">{{ getSenderAuthorityText(message) }}</span>
              <span v-if="message.senderLevel && !hideWebQQGroupLevel" class="chat-capsule-webqq__sender-badge is-level">{{ formatSenderLevel(message.senderLevel) }}</span>
              <span class="chat-capsule-webqq__message-name">{{ message.senderName }}</span>
              <span v-if="message.senderRelationship && showWebQQRelationship" class="chat-capsule-webqq__sender-badge is-relationship">{{ message.senderRelationship }}</span>
            </template>
            <template v-if="message.direction === 'incoming'">
              <span class="chat-capsule-webqq__message-name">{{ message.senderName }}</span>
              <span v-if="message.senderRelationship && showWebQQRelationship" class="chat-capsule-webqq__sender-badge is-relationship">{{ message.senderRelationship }}</span>
              <span v-if="message.senderLevel && !hideWebQQGroupLevel" class="chat-capsule-webqq__sender-badge is-level">{{ formatSenderLevel(message.senderLevel) }}</span>
              <span v-if="getSenderAuthorityText(message)" :class="['chat-capsule-webqq__sender-badge', getSenderAuthorityClass(message)]">{{ getSenderAuthorityText(message) }}</span>
            </template>
          </div>
          <div class="chat-capsule-webqq__message-body">
            <div v-if="isImageOnlyMessage(message)" class="chat-capsule-webqq__message-media">
              <button class="chat-capsule-webqq__message-image" type="button" aria-label="查看大图" @click="emit('open-image', message.elements[0].url)">
                <img :src="withProxy(message.elements[0].url)" alt="图片" @load="emit('image-load')">
              </button>
            </div>
            <div v-else class="chat-capsule-webqq__bubble">
              <span v-if="isBotThinkingMessage(message)" class="chat-capsule-webqq__thinking-dots" aria-label="机器人正在思考">
                <span v-for="dot in 3" :key="dot" class="chat-capsule-webqq__thinking-dot"></span>
              </span>
              <template v-else v-for="(run, runIndex) in getWebQQElementRuns(message.elements)" :key="`${message.id}:run:${runIndex}`">
                <span v-if="run.type === 'inline'" class="chat-capsule-webqq__inline-run">
                  <template v-for="element in run.elements" :key="`${message.id}:inline:${runIndex}:${element.type}:${element.text || element.url || element.title || ''}`">
                    <span v-if="element.type === 'text'">{{ element.text }}</span>
                    <span v-else>{{ element.text || message.summary }}</span>
                  </template>
                </span>
                <div v-else-if="run.element.type === 'quote'" class="chat-capsule-webqq__quote">
                  <strong v-if="run.element.title" class="chat-capsule-webqq__quote-title">{{ run.element.title }}</strong>
                  <span>{{ run.element.text || '[引用消息]' }}</span>
                </div>
                <button
                  v-else-if="run.element.type === 'forward'"
                  class="chat-capsule-webqq__quote chat-capsule-webqq__forward"
                  type="button"
                  :disabled="!run.element.items?.length"
                  aria-label="查看合并转发消息"
                  @click.stop="emit('open-forward', run.element)"
                >
                  <strong class="chat-capsule-webqq__quote-title">{{ run.element.title || '合并转发' }}</strong>
                  <template v-if="run.element.items?.length">
                    <span v-for="(item, itemIndex) in getForwardPreviewItems(run.element)" :key="`${message.id}:forward:${runIndex}:${itemIndex}`">
                      {{ getForwardItemName(item) }}：{{ getForwardPreviewText(item) }}
                    </span>
                    <span class="chat-capsule-webqq__forward-entry">查看{{ run.element.items.length }}条转发消息</span>
                  </template>
                  <span v-else>{{ run.element.text || '[合并转发]' }}</span>
                </button>
                <div
                  v-else-if="run.element.type === 'card'"
                  class="chat-capsule-webqq__card"
                >
                  <img v-if="run.element.imageUrl" class="chat-capsule-webqq__card-cover" :src="withProxy(run.element.imageUrl)" alt="">
                  <span class="chat-capsule-webqq__card-content">
                    <strong class="chat-capsule-webqq__card-title">{{ run.element.title || '卡片消息' }}</strong>
                    <span v-if="run.element.text" class="chat-capsule-webqq__card-desc">{{ run.element.text }}</span>
                    <span v-if="run.element.source" class="chat-capsule-webqq__card-source">{{ run.element.source }}</span>
                  </span>
                </div>
                <button v-else-if="run.element.type === 'image' && run.element.url" class="chat-capsule-webqq__message-image" type="button" aria-label="查看大图" @click="emit('open-image', run.element.url)">
                  <img :src="withProxy(run.element.url)" alt="图片" @load="emit('image-load')">
                </button>
                <span v-else>{{ run.element.text || message.summary }}</span>
              </template>
            </div>
            <div v-if="message.reactions?.length" class="chat-capsule-webqq__message-reactions">
              <span v-for="reaction in message.reactions" :key="reaction.emojiId" class="chat-capsule-webqq__message-reaction">
                <img v-if="reaction.userAvatar" class="chat-capsule-webqq__message-reaction-avatar" :src="withProxy(reaction.userAvatar)" :alt="reaction.userId || reaction.label">
                {{ reaction.label }}<span v-if="reaction.count > 1"> {{ reaction.count }}</span>
              </span>
            </div>
            <div v-if="message.recalled" class="chat-capsule-webqq__message-recall-status">已撤回</div>
            <div class="chat-capsule-webqq__message-time">{{ formatTime(message.time) }}</div>
          </div>
        </div>
      </div>
      <div
        v-if="!message.event && getThinkingMessage(index)"
        class="chat-capsule-webqq__thinking-row"
      >
        <button
          class="chat-capsule-webqq__thinking-toggle"
          type="button"
          :aria-expanded="isThinkingMessageExpanded(index)"
          @click="toggleThinking(index)"
        >
          <span
            v-if="getThinkingMessage(index)?.thinking.usage"
            class="chat-capsule-webqq__thinking-usage"
            aria-label="本次 token 用量"
          >
            <svg class="chat-capsule-webqq__thinking-usage-icon is-input" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20V8"></path>
              <path d="m7 13 5-5 5 5"></path>
              <path d="M5 4h14"></path>
            </svg>
            <span>{{ getThinkingMessage(index)?.thinking.usage?.inputTokens }}</span>
            <svg class="chat-capsule-webqq__thinking-usage-icon is-output" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v12"></path>
              <path d="m7 11 5 5 5-5"></path>
              <path d="M5 20h14"></path>
            </svg>
            <span>{{ getThinkingMessage(index)?.thinking.usage?.outputTokens }}</span>
          </span>
          <span>{{ getThinkingDurationText(index) }}</span>
          <svg class="chat-capsule-webqq__thinking-chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5"></path>
          </svg>
        </button>
        <div
          v-if="isThinkingMessageExpanded(index)"
          class="chat-capsule-webqq__thinking-content"
        >{{ getThinkingMessage(index)?.thinking.content }}</div>
      </div>
    </template>
  </template>
</template>

<script lang="ts" setup>
import type { WebQQForwardItem, WebQQMessage } from '../state'
import type { WebQQElementRun, WebQQMessageElement, WebQQThinkingMessage } from '../utils/webqq-message-view'

const props = defineProps<{
  loading: boolean
  errorText: string
  hasCurrentChat: boolean
  visibleMessages: WebQQMessage[]
  showWebQQAffinity: boolean
  showWebQQRelationship: boolean
  hideWebQQGroupLevel: boolean
  withProxy: (url: string) => string
  isBotThinkingMessage: (message: WebQQMessage) => boolean
  getMessageClusterClass: (index: number) => string
  isMergedMessage: (index: number) => boolean
  getSenderAuthorityText: (message: WebQQMessage) => string
  getSenderAuthorityClass: (message: WebQQMessage) => string
  formatSenderLevel: (level: string) => string
  isImageOnlyMessage: (message: WebQQMessage) => boolean
  getWebQQElementRuns: (elements: WebQQMessageElement[]) => WebQQElementRun[]
  getForwardPreviewItems: (element: WebQQMessageElement) => WebQQForwardItem[]
  getForwardItemName: (item: WebQQForwardItem) => string
  getForwardPreviewText: (item: WebQQForwardItem) => string
  formatTime: (timestamp: number) => string
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

function toggleThinking(index: number) {
  const message = getThinkingMessage(index)
  if (message) emit('toggle-thinking', message)
}
</script>
