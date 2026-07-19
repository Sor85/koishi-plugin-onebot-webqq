<template>
  <div
    class="onebot-webqq-webqq__forward-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="合并转发消息"
    tabindex="0"
    @click.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <div class="onebot-webqq-webqq__forward-modal" @click.stop>
      <header class="onebot-webqq-webqq__forward-modal-header">
        <strong>{{ dialog.title || '合并转发' }}</strong>
        <button type="button" aria-label="关闭合并转发消息" @click="emit('close')">
          <svg class="onebot-webqq-webqq__header-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12"></path>
            <path d="M18 6L6 18"></path>
          </svg>
        </button>
      </header>
      <div v-webqq-scrollbar class="onebot-webqq-webqq__forward-modal-body">
        <article v-for="(item, itemIndex) in items" :key="`forward:${itemIndex}`" :class="['onebot-webqq-webqq__message', 'is-incoming', getForwardItemClusterClass(itemIndex), { 'is-merged': isMergedForwardItem(itemIndex) }]">
          <!-- TIM 合并项依赖 wrapper 保留头像占位并隐藏重复头像，弹窗需和普通消息保持同一结构。 -->
          <span class="onebot-webqq-webqq__message-avatar-wrap">
            <img class="onebot-webqq-webqq__message-avatar" :src="withProxy(getForwardItemAvatar(item))" :alt="getForwardItemName(item)">
          </span>
          <div class="onebot-webqq-webqq__message-content">
            <div v-if="!isMergedForwardItem(itemIndex)" class="onebot-webqq-webqq__sender-line">
              <span class="onebot-webqq-webqq__message-name">{{ getForwardItemName(item) }}</span>
            </div>
            <div class="onebot-webqq-webqq__message-body">
              <div class="onebot-webqq-webqq__bubble">
                <template v-for="(run, runIndex) in getWebQQElementRuns(item.elements)" :key="`forward:${itemIndex}:run:${runIndex}`">
                  <span v-if="run.type === 'inline'" class="onebot-webqq-webqq__inline-run">
                    <template v-for="element in run.elements" :key="`forward:${itemIndex}:inline:${runIndex}:${element.type}:${element.text || element.url || element.title || ''}`">
                      <span v-if="element.type === 'text'">{{ element.text }}</span>
                      <img v-else-if="element.type === 'face' && element.emojiUrl" class="onebot-webqq-webqq__message-face" :src="withProxy(element.emojiUrl)" :alt="element.text || '表情'" @load="emit('image-load')">
                      <span v-else>{{ element.text || '[消息]' }}</span>
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
                    <span>{{ run.element.text || '[合并转发]' }}</span>
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
                  <span v-else>{{ run.element.text || '[消息]' }}</span>
                </template>
              </div>
            </div>
          </div>
        </article>
        <div v-if="!items.length" class="onebot-webqq-webqq__forward-modal-empty">暂无消息</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { WebQQForwardItem } from '../types'
import {
  getForwardItemName,
  getWebQQElementRuns,
  type WebQQMessageElement,
} from '../utils/webqq-message-view'
import { vWebqqScrollbar } from '../utils/webqq-scrollbar'

defineProps<{
  dialog: WebQQMessageElement
  items: WebQQForwardItem[]
  withProxy: (url: string) => string
  getForwardItemAvatar: (item: WebQQForwardItem) => string
  getForwardItemClusterClass: (index: number) => string
  isMergedForwardItem: (index: number) => boolean
}>()

const emit = defineEmits<{
  close: []
  'open-forward': [element: WebQQMessageElement]
  'open-image': [url: string]
  'image-load': []
}>()
</script>
