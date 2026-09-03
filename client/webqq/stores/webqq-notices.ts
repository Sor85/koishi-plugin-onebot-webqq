import { computed, ref } from 'vue'
import type { WebQQNotice } from '../types'
import { hasNoticeFlag, sortPendingNotices, type HandleableWebQQNotice } from '../utils/webqq-notice-view'
import { readWebQQErrorMessage } from '../utils/webqq-error'

export function useWebQQNotices(options: {
  requestNotices: () => Promise<WebQQNotice[]>
  approveNotice: (notice: HandleableWebQQNotice, approve: boolean) => Promise<void>
}) {
  const notices = ref<WebQQNotice[]>([])
  const noticeOpen = ref(false)
  const noticeMenuTab = ref<'friends' | 'groups'>('friends')
  const noticeLoading = ref(false)
  const handlingNoticeId = ref('')
  const noticeErrorText = ref('')

  const filteredNotices = computed(() => {
    return sortPendingNotices(notices.value.filter((notice) => {
      return noticeMenuTab.value === 'friends'
        ? notice.type === 'friend-request'
        : notice.type === 'group-notice'
    }))
  })

  async function loadNotices() {
    noticeLoading.value = true
    noticeErrorText.value = ''
    try {
      notices.value = await options.requestNotices()
    } catch (error) {
      noticeErrorText.value = readWebQQErrorMessage(error, '加载通知失败')
    } finally {
      noticeLoading.value = false
    }
  }

  function openNotices() {
    noticeOpen.value = !noticeOpen.value
    if (noticeOpen.value) loadNotices()
  }

  async function handleNotice(notice: WebQQNotice, approve: boolean) {
    if (!hasNoticeFlag(notice)) return
    handlingNoticeId.value = notice.id
    noticeErrorText.value = ''
    try {
      await options.approveNotice(notice, approve)
      await loadNotices()
    } catch (error) {
      noticeErrorText.value = readWebQQErrorMessage(error, '处理通知失败')
    } finally {
      handlingNoticeId.value = ''
    }
  }

  return {
    notices,
    noticeOpen,
    noticeMenuTab,
    noticeLoading,
    handlingNoticeId,
    noticeErrorText,
    filteredNotices,
    loadNotices,
    openNotices,
    handleNotice,
  }
}
