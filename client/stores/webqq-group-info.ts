import { computed, ref, type Ref } from 'vue'
import type { WebQQGroupInfo } from '../state'
import { getVisibleGroupMembers, type WebQQChatSelection } from '../utils/webqq-contact-view'

export function useWebQQGroupInfo(currentChat: Ref<WebQQChatSelection | undefined>, options: {
  requestGroupInfo: () => Promise<WebQQGroupInfo>
}) {
  const groupInfoCache: Record<string, WebQQGroupInfo> = {}
  const groupInfoRequestTokens: Record<string, number> = {}
  const groupInfoOpen = ref(false)
  const groupInfoLoading = ref(false)
  const groupInfoErrorText = ref('')
  const groupInfoSearchQuery = ref('')
  const groupInfo = ref<WebQQGroupInfo>({ announcements: [], members: [] })
  const visibleGroupMembers = computed(() => getVisibleGroupMembers(groupInfo.value.members, groupInfoSearchQuery.value))

  function getCurrentGroupId() {
    return currentChat.value?.type === 'group' ? currentChat.value.peerId : ''
  }

  function createEmptyGroupInfo(): WebQQGroupInfo {
    return { announcements: [], members: [] }
  }

  function hasCachedGroupInfo(groupId: string) {
    return Object.prototype.hasOwnProperty.call(groupInfoCache, groupId)
  }

  function isLatestGroupInfoRequest(groupId: string, token: number) {
    return groupInfoRequestTokens[groupId] === token
  }

  async function loadGroupInfo() {
    const groupId = getCurrentGroupId()
    if (!groupId) return
    groupInfo.value = hasCachedGroupInfo(groupId) ? groupInfoCache[groupId] : createEmptyGroupInfo()
    const requestToken = (groupInfoRequestTokens[groupId] || 0) + 1
    groupInfoRequestTokens[groupId] = requestToken
    groupInfoLoading.value = true
    groupInfoErrorText.value = ''
    try {
      const nextGroupInfo = await options.requestGroupInfo()
      if (!isLatestGroupInfoRequest(groupId, requestToken)) return
      groupInfoCache[groupId] = nextGroupInfo
      // 群信息刷新可能跨越快速切群，只有当前群仍匹配时才替换页面数据，避免旧请求把其他群的信息写回来。
      if (getCurrentGroupId() === groupId) groupInfo.value = nextGroupInfo
    } catch (error) {
      if (isLatestGroupInfoRequest(groupId, requestToken) && getCurrentGroupId() === groupId) {
        groupInfoErrorText.value = error instanceof Error ? error.message : '加载群信息失败'
      }
    } finally {
      if (isLatestGroupInfoRequest(groupId, requestToken) && getCurrentGroupId() === groupId) {
        groupInfoLoading.value = false
      }
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
