export type GroupMemberRole = 'owner' | 'admin' | 'member'

export interface GroupMemberMenuTarget {
  userId: string
  role?: GroupMemberRole | string
}

// 协议不支持 transfer-owner；不暴露该入口。
export type GroupMemberMenuAction =
  | 'mention'
  | 'poke'
  | 'set-card'
  | 'set-title'
  | 'kick'
  | 'set-admin'
  | 'unset-admin'

function normalizeRole(role?: string): GroupMemberRole {
  if (role === 'owner' || role === '群主') return 'owner'
  if (role === 'admin' || role === '管理员') return 'admin'
  return 'member'
}

export function getGroupMemberMenuActions(
  actor: GroupMemberMenuTarget | undefined,
  target: GroupMemberMenuTarget,
): GroupMemberMenuAction[] {
  if (!actor) return []
  const actorRole = normalizeRole(actor.role)
  const targetRole = normalizeRole(target.role)
  const actions: GroupMemberMenuAction[] = []
  if (actor.userId !== target.userId) actions.push('mention', 'poke')
  if (actor.userId === target.userId
    || actorRole === 'owner'
    || (actorRole === 'admin' && targetRole === 'member')) actions.push('set-card')
  // 与真实 QQ 一致：专属头衔只有群主可以授予，且可以授予给自己。
  if (actorRole === 'owner') actions.push('set-title')
  if (actorRole === 'owner' && targetRole !== 'owner') {
    actions.push(targetRole === 'admin' ? 'unset-admin' : 'set-admin')
  }
  if (actor.userId !== target.userId
    && targetRole !== 'owner'
    && (actorRole === 'owner' || (actorRole === 'admin' && targetRole === 'member'))) actions.push('kick')
  return actions
}

export function getGroupMemberKickDisabledReason(
  actor: GroupMemberMenuTarget | undefined,
  target: GroupMemberMenuTarget,
): string {
  if (!actor || actor.userId === target.userId) return ''
  const actorRole = normalizeRole(actor.role)
  const targetRole = normalizeRole(target.role)
  if (actorRole === 'member') return '需要管理员权限才能踢人'
  if (actorRole === 'admin' && targetRole !== 'member') return '管理员不能管理群主或管理员'
  return ''
}
