import { nextTick, ref } from 'vue'

export function useWebQQImagePreview(withProxy: (url: string) => string) {
  const imagePreview = ref<HTMLElement>()
  const imagePreviewUrl = ref('')

  async function openImagePreview(url: string) {
    imagePreviewUrl.value = withProxy(url)
    await nextTick()
    imagePreview.value?.focus()
  }

  function closeImagePreview() {
    imagePreviewUrl.value = ''
  }

  return {
    imagePreview,
    imagePreviewUrl,
    openImagePreview,
    closeImagePreview,
  }
}
