import { computed, ref, type Ref } from 'vue'
import type { WebQQForwardItem } from '../types'
import {
  getForwardItemAvatar as getForwardItemAvatarFromView,
  getForwardItemClusterClass as getForwardItemClusterClassFromView,
  getForwardPreviewItems as getForwardPreviewItemsFromView,
  isMergedForwardItem as isMergedForwardItemFromView,
  type WebQQMessageElement,
} from '../utils/webqq-message-view'

const defaultWebQQForwardAvatar = 'https://q1.qlogo.cn/g?b=qq&nk=0&s=640'
const webQQForwardPreviewLimit = 4

export function useWebQQForwardDialog(chatStyle: Ref<string>) {
  const forwardDialog = ref<WebQQMessageElement>()
  const forwardDialogItems = computed(() => forwardDialog.value?.items ?? [])

  function getForwardItemAvatar(item: WebQQForwardItem) {
    return getForwardItemAvatarFromView(item, defaultWebQQForwardAvatar)
  }

  function getForwardPreviewItems(element: WebQQMessageElement) {
    return getForwardPreviewItemsFromView(element, webQQForwardPreviewLimit)
  }

  function isMergedForwardItem(index: number) {
    return isMergedForwardItemFromView(forwardDialogItems.value, index, chatStyle.value)
  }

  function getForwardItemClusterClass(index: number) {
    return getForwardItemClusterClassFromView(forwardDialogItems.value, index, chatStyle.value)
  }

  function openForwardDialog(element: WebQQMessageElement) {
    if (!element.items?.length) return false
    forwardDialog.value = element
    return true
  }

  function closeForwardDialog() {
    forwardDialog.value = undefined
  }

  return {
    forwardDialog,
    forwardDialogItems,
    getForwardItemAvatar,
    getForwardPreviewItems,
    isMergedForwardItem,
    getForwardItemClusterClass,
    openForwardDialog,
    closeForwardDialog,
  }
}
