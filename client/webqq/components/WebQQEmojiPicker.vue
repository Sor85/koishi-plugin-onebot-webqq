<template>
  <Teleport to="body">
    <section ref="panelRef" v-if="open" :class="['onebot-webqq-webqq__secondary-page onebot-webqq-webqq__portal-page onebot-webqq-webqq__emoji-picker-page', `is-color-${resolvedWebQQColorMode}`]" :style="panelStyle" aria-label="贴表情">
      <header
        class="onebot-webqq-webqq__secondary-page-header"
        :class="{ 'is-dragging': dragging }"
        @pointerdown="startDrag"
      >
        <strong>贴表情</strong>
      </header>
      <div class="onebot-webqq-webqq__emoji-picker">
        <Input
          v-model="query"
          class="onebot-webqq-webqq__emoji-picker-search"
          type="search"
          placeholder="搜索表情名称、拼音或 ID"
          aria-label="搜索表情"
        />
        <section v-if="!query.trim() && recentFaces.length" class="onebot-webqq-webqq__emoji-picker-section">
          <header>常用</header>
          <div class="onebot-webqq-webqq__emoji-picker-grid">
            <button
              v-for="face in recentFaces"
              :key="`recent:${face.id}`"
              type="button"
              class="onebot-webqq-webqq__emoji-picker-item"
              :title="face.label"
              @click="select(face.id)"
            >
              <img v-if="face.url" :src="face.url" :alt="face.label">
              <span v-else>{{ face.label }}</span>
            </button>
          </div>
        </section>
        <section v-if="!query.trim()" class="onebot-webqq-webqq__emoji-picker-section">
          <header>推荐</header>
          <div class="onebot-webqq-webqq__emoji-picker-grid">
            <button
              v-for="face in commonFaces"
              :key="`common:${face.id}`"
              type="button"
              class="onebot-webqq-webqq__emoji-picker-item"
              :title="face.label"
              @click="select(face.id)"
            >
              <img v-if="face.url" :src="face.url" :alt="face.label">
              <span v-else>{{ face.label }}</span>
            </button>
          </div>
        </section>
        <section class="onebot-webqq-webqq__emoji-picker-section">
          <header>{{ query.trim() ? '搜索结果' : '全部表情' }}</header>
          <div class="onebot-webqq-webqq__emoji-picker-grid">
            <button
              v-for="face in visibleFaces"
              :key="face.id"
              type="button"
              class="onebot-webqq-webqq__emoji-picker-item"
              :title="face.label"
              @click="select(face.id)"
            >
              <img v-if="face.url" :src="face.url" :alt="face.label">
              <span v-else>{{ face.label }}</span>
            </button>
            <p v-if="!visibleFaces.length" class="onebot-webqq-webqq__emoji-picker-empty">没有匹配的表情</p>
          </div>
        </section>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Input } from '../../components/ui/input'
import { resolvedWebQQColorMode } from '../settings'
import {
  getCommonWebQQEmojiFaces,
  getWebQQEmojiFace,
  loadRecentWebQQEmojiIds,
  rememberWebQQEmojiId,
  searchWebQQEmojiFaces,
  type WebQQEmojiFace,
} from '../utils/emoji-catalog'
import { getFloatingPanelStyle, clampFloatingPanelPosition, isFloatingPanelInteractiveTarget } from '../utils/floating-panel'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  select: [emojiId: string]
}>()

const query = ref('')
const panelRef = ref<HTMLElement>()
const panelStyle = ref<Record<string, string>>({})
const dragging = ref(false)
let dragState: { pointerId: number, startX: number, startY: number, left: number, top: number } | undefined
const recentIds = ref(typeof localStorage === 'undefined' ? [] : loadRecentWebQQEmojiIds())
const commonFaces = getCommonWebQQEmojiFaces()

const recentFaces = computed(() => recentIds.value
  .map((id) => getWebQQEmojiFace(id))
  .filter((face): face is WebQQEmojiFace => !!face))

const visibleFaces = computed(() => searchWebQQEmojiFaces(query.value))

watch(() => props.open, (open) => {
  if (open) {
    query.value = ''
    panelStyle.value = getFloatingPanelStyle({ height: 520 })
    recentIds.value = typeof localStorage === 'undefined' ? [] : loadRecentWebQQEmojiIds()
  }
})

function closeOnOutsidePointer(event: PointerEvent) {
  if (!props.open || panelRef.value?.contains(event.target as Node)) return
  emit('update:open', false)
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
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointer)
  document.removeEventListener('pointermove', moveDrag)
  document.removeEventListener('pointerup', stopDrag)
  document.removeEventListener('pointercancel', stopDrag)
})

function select(emojiId: string) {
  recentIds.value = typeof localStorage === 'undefined' ? [emojiId] : rememberWebQQEmojiId(emojiId)
  emit('select', emojiId)
  emit('update:open', false)
}
</script>
