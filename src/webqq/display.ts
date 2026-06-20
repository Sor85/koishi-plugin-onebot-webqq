export function getWebQQUserAvatar(userId: string) {
  return userId ? `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640` : ''
}

export function getWebQQGroupAvatar(groupId: string) {
  return groupId ? `https://p.qlogo.cn/gh/${groupId}/${groupId}/640/` : ''
}

export function normalizeWebQQGroupRole(role: string) {
  if (role === 'owner') return '群主'
  if (role === 'admin' || role === 'administrator') return '管理员'
  return ''
}

export function getWebQQGroupSubtitle(group: { groupId: string; memberCount: number }) {
  return `群聊 ${group.groupId} · ${group.memberCount} 人`
}
