import { computed, ref, type Ref } from 'vue'
import type { WebQQGroupInfo } from '../state'
import { getVisibleGroupMembers, type WebQQChatSelection } from '../utils/webqq-contact-view'

export function useWebQQGroupInfo(currentChat: Ref<WebQQChatSelection | undefined>, options: {
  requestGroupInfo: () => Promise<WebQQGroupInfo>
}) {
  const groupInfoOpen = ref(false)
  const groupInfoLoading = ref(false)
  const groupInfoErrorText = ref('')
  const groupInfoSearchQuery = ref('')
  const groupInfo = ref<WebQQGroupInfo>({ announcements: [], members: [] })
  const visibleGroupMembers = computed(() => getVisibleGroupMembers(groupInfo.value.members, groupInfoSearchQuery.value))

  async function loadGroupInfo() {
    if (currentChat.value?.type !== 'group') return
    groupInfoLoading.value = true
    groupInfoErrorText.value = ''
    try {
      groupInfo.value = await options.requestGroupInfo()
    } catch (error) {
      groupInfoErrorText.value = error instanceof Error ? error.message : '加载群信息失败'
    } finally {
      groupInfoLoading.value = false
    }
  }

  function toggleGroupInfo() {
    groupInfoOpen.value = !groupInfoOpen.value
    if (groupInfoOpen.value) loadGroupInfo()
  }

  return {
    groupInfoOpen,
    groupInfoLoading,
    groupInfoErrorText,
    groupInfoSearchQuery,
    groupInfo,
    visibleGroupMembers,
    loadGroupInfo,
    toggleGroupInfo,
  }
}
