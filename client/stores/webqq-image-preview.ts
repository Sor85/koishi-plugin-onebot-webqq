import { ref } from 'vue'

export function useWebQQImagePreview(withProxy: (url: string) => string) {
  const imagePreviewUrl = ref('')

  function openImagePreview(url: string) {
    imagePreviewUrl.value = withProxy(url)
  }

  function closeImagePreview() {
    imagePreviewUrl.value = ''
  }

  return {
    imagePreviewUrl,
    openImagePreview,
    closeImagePreview,
  }
}
