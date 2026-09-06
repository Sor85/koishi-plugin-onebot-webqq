<template>
  <div
    ref="imagePreview"
    class="onebot-webqq-webqq__image-preview"
    :class="{ 'is-zoomed': zoom.scale.value > IMAGE_PREVIEW_ZOOM_MIN }"
    role="dialog"
    aria-modal="true"
    aria-label="图片预览"
    tabindex="0"
    @click.stop.self="handleOverlayClick"
    @keydown.esc.stop="emit('close')"
    @wheel.prevent="zoom.handleWheel($event)"
  >
    <button class="onebot-webqq-webqq__image-preview-close" type="button" aria-label="关闭图片预览" @click="emit('close')">
      <svg class="onebot-webqq-webqq__header-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12"></path>
        <path d="M18 6L6 18"></path>
      </svg>
    </button>
    <img
      ref="imageRef"
      :src="url"
      alt="图片预览"
      :style="imageStyle"
      draggable="false"
      @load="zoom.reset()"
      @pointerdown="handlePointerDown"
      @pointermove="zoom.handlePointerMove($event)"
      @pointerup="zoom.finishDrag($event)"
      @pointercancel="zoom.finishDrag($event)"
    >
    <output v-if="zoom.scale.value > IMAGE_PREVIEW_ZOOM_MIN" class="onebot-webqq-webqq__image-preview-scale">{{ scaleLabel }}</output>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createImagePreviewZoom, IMAGE_PREVIEW_ZOOM_MIN } from '../utils/image-preview-zoom'

const props = defineProps<{
  url: string
}>()

const emit = defineEmits<{
  close: []
}>()

const imagePreview = ref<HTMLElement>()

const imageRef = ref<HTMLImageElement>()
let previousFocus: HTMLElement | undefined

// transform 不改图片布局盒，贴合尺寸始终以倍率 1 为基准。
const zoom = createImagePreviewZoom({
  metrics: () => {
    const image = imageRef.value
    const overlay = imagePreview.value
    if (!image || !overlay || !image.offsetWidth) return undefined
    return {
      baseWidth: image.offsetWidth,
      baseHeight: image.offsetHeight,
      viewportWidth: overlay.clientWidth,
      viewportHeight: overlay.clientHeight,
    }
  },
  center: () => {
    const overlay = imagePreview.value
    if (!overlay) return undefined
    const rect = overlay.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  },
  captureTarget: () => imageRef.value,
})

const imageStyle = computed(() => ({
  transform: `translate(${zoom.offset.value.x}px, ${zoom.offset.value.y}px) scale(${zoom.scale.value})`,
}))
const scaleLabel = computed(() => `${Math.round(zoom.scale.value * 100)}%`)

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
  imagePreview.value?.focus()
})

onBeforeUnmount(() => {
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
})

// 换图时不继承上一张的倍率与位移。
watch(() => props.url, () => zoom.reset())

function handleOverlayClick() {
  if (zoom.consumeSuppressedClick()) return
  emit('close')
}

function handlePointerDown(event: PointerEvent) {
  zoom.handlePointerDown(event)
  if (zoom.scale.value > IMAGE_PREVIEW_ZOOM_MIN) event.preventDefault()
}
</script>
