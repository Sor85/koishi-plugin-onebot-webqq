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
        :class="['onebot-webqq-webqq__message', `is-${message.direction}`, getMessageClusterClass(index), { 'is-merged': isMergedMessage(index), 'is-thinking': isBotThinkingMessage(message), 'is-recalled': message.recalled }]"
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
            <div v-if="isImageOnlyMessage(message)" class="onebot-webqq-webqq__message-media">
              <button class="onebot-webqq-webqq__message-image" type="button" aria-label="查看大图" @click="emit('open-image', message.elements[0].url)">
                <img :src="withProxy(message.elements[0].url)" alt="图片" @load="emit('image-load')">
              </button>
            </div>
            <div v-else class="onebot-webqq-webqq__bubble">
              <span v-if="isBotThinkingMessage(message)" class="onebot-webqq-webqq__thinking-dots" aria-label="机器人正在思考">
                <span v-for="dot in 3" :key="dot" class="onebot-webqq-webqq__thinking-dot"></span>
              </span>
              <template v-else v-for="(run, runIndex) in getWebQQElementRuns(message.elements)" :key="`${message.id}:run:${runIndex}`">
                <span v-if="run.type === 'inline'" class="onebot-webqq-webqq__inline-run">
                  <template v-for="element in run.elements" :key="`${message.id}:inline:${runIndex}:${element.type}:${element.text || element.url || element.title || ''}`">
                    <span v-if="element.type === 'text'">{{ element.text }}</span>
                    <span v-else>{{ element.text || message.summary }}</span>
                  </template>
                </span>
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
                <span v-else>{{ run.element.text || message.summary }}</span>
              </template>
              <div v-if="message.reactions?.length && chatStyle === 'telegram'" class="onebot-webqq-webqq__message-reactions">
                <span v-for="reaction in message.reactions" :key="reaction.emojiId" class="onebot-webqq-webqq__message-reaction">
                  <img v-if="reaction.emojiUrl" class="onebot-webqq-webqq__message-reaction-emoji" :src="withProxy(reaction.emojiUrl)" :alt="reaction.label">
                  <template v-else>{{ reaction.label }}</template>
                  <span v-if="shouldShowReactionUsers(reaction, chatStyle)" class="onebot-webqq-webqq__message-reaction-users">
                    <span v-for="(user, userIndex) in getReactionUsers(reaction)" :key="user.userId" class="onebot-webqq-webqq__message-reaction-avatar" :title="user.userName || user.userId" :style="{ zIndex: getReactionUserZIndex(reaction, userIndex) }">
                      <img class="onebot-webqq-webqq__message-reaction-avatar-image" :src="withProxy(user.userAvatar)" :alt="user.userName || user.userId">
                    </span>
                  </span>
                  <span v-if="shouldShowReactionCount(reaction, chatStyle)" class="onebot-webqq-webqq__message-reaction-count">{{ reaction.count }}</span>
                </span>
              </div>
            </div>
            <div v-if="message.reactions?.length && (chatStyle !== 'telegram' || isImageOnlyMessage(message))" class="onebot-webqq-webqq__message-reactions">
              <span v-for="reaction in message.reactions" :key="reaction.emojiId" class="onebot-webqq-webqq__message-reaction">
                <img v-if="reaction.emojiUrl" class="onebot-webqq-webqq__message-reaction-emoji" :src="withProxy(reaction.emojiUrl)" :alt="reaction.label">
                <template v-else>{{ reaction.label }}</template>
                <span v-if="shouldShowReactionUsers(reaction, chatStyle)" class="onebot-webqq-webqq__message-reaction-users">
                  <span v-for="(user, userIndex) in getReactionUsers(reaction)" :key="user.userId" class="onebot-webqq-webqq__message-reaction-avatar" :title="user.userName || user.userId" :style="{ zIndex: getReactionUserZIndex(reaction, userIndex) }">
                    <img class="onebot-webqq-webqq__message-reaction-avatar-image" :src="withProxy(user.userAvatar)" :alt="user.userName || user.userId">
                  </span>
                </span>
                <span v-if="shouldShowReactionCount(reaction, chatStyle)" class="onebot-webqq-webqq__message-reaction-count">{{ reaction.count }}</span>
              </span>
            </div>
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
          <svg class="onebot-webqq-webqq__thinking-chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5"></path>
          </svg>
        </button>
        <div
          v-if="isThinkingMessageExpanded(index)"
          class="onebot-webqq-webqq__thinking-content"
        >{{ getThinkingMessage(index)?.thinking.content }}</div>
      </div>
    </template>
  </template>
</template>

<script lang="ts" setup>
import type { WebQQForwardItem, WebQQMessage, WebQQMessageReactionUser } from '../state'
import type { WebQQElementRun, WebQQMessageElement, WebQQThinkingMessage } from '../utils/webqq-message-view'

const props = defineProps<{
  loading: boolean
  errorText: string
  hasCurrentChat: boolean
  visibleMessages: WebQQMessage[]
  chatStyle: string
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

type WebQQMessageReaction = NonNullable<WebQQMessage['reactions']>[number]

function getReactionUsers(reaction: WebQQMessageReaction): WebQQMessageReactionUser[] {
  if (reaction.users?.length) return reaction.users
  return reaction.userId && reaction.userAvatar
    ? [{ userId: reaction.userId, userAvatar: reaction.userAvatar }]
    : []
}

function shouldShowReactionUsers(reaction: WebQQMessageReaction, chatStyle: string) {
  return chatStyle === 'telegram' && getReactionUsers(reaction).length > 0
}

function shouldShowReactionCount(reaction: WebQQMessageReaction, chatStyle: string) {
  if (chatStyle !== 'telegram') return reaction.count > 1
  return reaction.count > Math.max(getReactionUsers(reaction).length, 1)
}

function getReactionUserZIndex(reaction: WebQQMessageReaction, userIndex: number) {
  return getReactionUsers(reaction).length - userIndex
}

function toggleThinking(index: number) {
  const message = getThinkingMessage(index)
  if (message) emit('toggle-thinking', message)
}
</script>
