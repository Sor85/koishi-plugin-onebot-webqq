import { computed, ref, type Ref } from 'vue'
import type { WebQQGroupInfo, WebQQGroupMember } from '../types'
import { getVisibleGroupMembers, type WebQQChatSelection } from '../utils/webqq-contact-view'
import { readWebQQErrorMessage } from '../utils/webqq-error'

type WebQQGroupMemberPatch = Partial<Pick<WebQQGroupMember, 'card' | 'role' | 'rawRole' | 'title'>>
const groupMemberPatchFields = ['card', 'role', 'rawRole', 'title'] as const

export function useWebQQGroupInfo(currentChat: Ref<WebQQChatSelection | undefined>, options: {
  requestGroupInfo: () => Promise<WebQQGroupInfo>
}) {
  const groupInfoCache: Record<string, WebQQGroupInfo> = {}
  const groupInfoRequestTokens: Record<string, number> = {}
  const groupMemberPatches: Record<string, Record<string, WebQQGroupMemberPatch>> = {}
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

  function applyPendingGroupMemberPatches(groupId: string, info: WebQQGroupInfo) {
    const patches = groupMemberPatches[groupId]
    if (!patches) return info
    let changed = false
    const members = info.members.map((member) => {
      const patch = patches[member.userId]
      if (!patch) return member
      const unresolved: WebQQGroupMemberPatch = {}
      for (const field of groupMemberPatchFields) {
        const value = patch[field]
        if (value !== undefined && member[field] !== value) Object.assign(unresolved, { [field]: value })
      }
      if (!Object.keys(unresolved).length) {
        delete patches[member.userId]
        return member
      }
      patches[member.userId] = unresolved
      changed = true
      return { ...member, ...unresolved }
    })
    if (!Object.keys(patches).length) delete groupMemberPatches[groupId]
    // OneBot 的写接口成功与成员列表缓存失效并不总是同步；保留尚未被读接口确认的字段，避免界面回退。
    return changed ? { ...info, members } : info
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
      const requestedGroupInfo = await options.requestGroupInfo()
      if (!isLatestGroupInfoRequest(groupId, requestToken)) return
      const nextGroupInfo = applyPendingGroupMemberPatches(groupId, requestedGroupInfo)
      groupInfoCache[groupId] = nextGroupInfo
      // 群信息刷新可能跨越快速切群，只有当前群仍匹配时才替换页面数据，避免旧请求把其他群的信息写回来。
      if (getCurrentGroupId() === groupId) groupInfo.value = nextGroupInfo
    } catch (error) {
      if (isLatestGroupInfoRequest(groupId, requestToken) && getCurrentGroupId() === groupId) {
        groupInfoErrorText.value = readWebQQErrorMessage(error, '加载群信息失败')
      }
    } finally {
      if (isLatestGroupInfoRequest(groupId, requestToken) && getCurrentGroupId() === groupId) {
        groupInfoLoading.value = false
      }
    }
  }

  function patchGroupMember(
    groupId: string,
    userId: string,
    patch: WebQQGroupMemberPatch,
  ) {
    const currentGroupId = getCurrentGroupId()
    const source = currentGroupId === groupId ? groupInfo.value : groupInfoCache[groupId]
    if (!source?.members.some((member) => member.userId === userId)) return
    groupMemberPatches[groupId] = {
      ...groupMemberPatches[groupId],
      [userId]: { ...groupMemberPatches[groupId]?.[userId], ...patch },
    }
    const nextGroupInfo = {
      ...source,
      members: source.members.map((member) => member.userId === userId ? { ...member, ...patch } : member),
    }
    groupInfoCache[groupId] = nextGroupInfo
    if (currentGroupId === groupId) groupInfo.value = nextGroupInfo
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
    patchGroupMember,
    toggleGroupInfo,
  }
}
