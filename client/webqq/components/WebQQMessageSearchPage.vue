<template>
  <Teleport to="body">
    <section
      ref="panelRef"
      :class="['webqq-secondary-page onebot-webqq-webqq__portal-page webqq-message-search-page', `is-color-${resolvedWebQQColorMode}`]"
      :style="panelStyle"
      aria-label="查找聊天记录"
    >
      <header
        class="webqq-secondary-page-header"
        :class="{ 'is-dragging': dragging }"
        @pointerdown="startDrag"
      >
        <strong>查找聊天记录</strong>
      </header>
      <div class="webqq-message-search-page-content">
        <form class="onebot-webqq-webqq__message-search-form" @submit.prevent="emit('search')">
          <span class="onebot-webqq-webqq__message-search-input-wrap">
            <IconSearch :size="17" aria-hidden="true" />
            <input
              ref="searchInput"
              :value="query"
              type="search"
              placeholder="输入关键词"
              autocomplete="off"
              aria-label="聊天记录关键词"
              @input="emit('update:query', ($event.target as HTMLInputElement).value)"
            >
          </span>
          <button type="submit" :disabled="loading || !query.trim()">查找</button>
        </form>
        <div class="onebot-webqq-webqq__message-search-status" aria-live="polite">
          <span v-if="loading">正在查找历史消息…</span>
          <span v-else-if="errorText" class="is-error">{{ errorText }}</span>
          <span v-else-if="searched">找到 {{ results.length }} 条，已扫描 {{ scannedCount }} 条消息</span>
          <span v-else>搜索当前会话的历史聊天记录</span>
        </div>
        <div class="onebot-webqq-webqq__message-search-results">
          <button
            v-for="message in results"
            :key="message.id || message.sequence"
            type="button"
            class="onebot-webqq-webqq__message-search-result"
            @click="emit('select', message)"
          >
            <span class="onebot-webqq-webqq__message-search-result-meta">
              <strong>{{ message.senderName }}</strong>
              <time>{{ formatSearchTime(message.time) }}</time>
            </span>
            <span class="onebot-webqq-webqq__message-search-result-summary">{{ message.summary || '[消息]' }}</span>
          </button>
          <div v-if="searched && !loading && !results.length" class="onebot-webqq-webqq__message-search-empty">未找到相关聊天记录</div>
        </div>
        <footer v-if="searched && !exhausted" class="onebot-webqq-webqq__message-search-footer">
          <button type="button" :disabled="loading" @click="emit('more')">继续搜索更早记录</button>
        </footer>
      </div>
    </section>
  </Teleport>
</template>

<script lang="ts" setup>
import { IconSearch } from '@tabler/icons-vue'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { resolvedWebQQColorMode } from '../settings'
import type { WebQQMessage } from '../types'
import { clampFloatingPanelPosition, getFloatingPanelStyle, isFloatingPanelInteractiveTarget } from '../utils/floating-panel'

const props = defineProps<{
  query: string
  results: WebQQMessage[]
  loading: boolean
  errorText: string
  searched: boolean
  scannedCount: number
  exhausted: boolean
}>()

const emit = defineEmits<{
  close: []
  search: []
  more: []
  select: [message: WebQQMessage]
  'update:query': [value: string]
}>()

const panelRef = ref<HTMLElement>()
const searchInput = ref<HTMLInputElement>()
const panelStyle = ref<Record<string, string>>(getFloatingPanelStyle({ width: 460, height: 520 }))
const dragging = ref(false)
let dragState: { pointerId: number, startX: number, startY: number, left: number, top: number } | undefined

function closeOnOutsidePointer(event: PointerEvent) {
  if (panelRef.value?.contains(event.target as Node)) return
  emit('close')
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || isFloatingPanelInteractiveTarget(event.target) || !panelRef.value) return
  const rect = panelRef.value.getBoundingClientRect()
  dragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top }
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (!dragState || event.pointerId !== dragState.pointerId || !panelRef.value) return
  const position = clampFloatingPanelPosition({
    x: dragState.left + event.clientX - dragState.startX,
    y: dragState.top + event.clientY - dragState.startY,
  }, { width: window.innerWidth, height: window.innerHeight }, {
    width: panelRef.value.offsetWidth,
    height: panelRef.value.offsetHeight,
  })
  panelStyle.value = { left: `${position.x}px`, top: `${position.y}px` }
}

function stopDrag(event: PointerEvent) {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  dragState = undefined
  dragging.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePointer)
  document.addEventListener('pointermove', moveDrag)
  document.addEventListener('pointerup', stopDrag)
  document.addEventListener('pointercancel', stopDrag)
  nextTick(() => searchInput.value?.focus())
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointer)
  document.removeEventListener('pointermove', moveDrag)
  document.removeEventListener('pointerup', stopDrag)
  document.removeEventListener('pointercancel', stopDrag)
})

function formatSearchTime(time: number) {
  return new Date(time).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
