<template>
  <div
    ref="imagePreview"
    class="onebot-webqq-webqq__image-preview"
    role="dialog"
    aria-modal="true"
    aria-label="图片预览"
    tabindex="0"
    @click.stop.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <button class="onebot-webqq-webqq__image-preview-close" type="button" aria-label="关闭图片预览" @click="emit('close')">
      <svg class="onebot-webqq-webqq__header-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12"></path>
        <path d="M18 6L6 18"></path>
      </svg>
    </button>
    <img :src="url" alt="图片预览">
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'

defineProps<{
  url: string
}>()

const emit = defineEmits<{
  close: []
}>()

const imagePreview = ref<HTMLElement>()

onMounted(() => {
  imagePreview.value?.focus()
})
</script>
