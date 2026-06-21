export interface OneBotBot {
  platform?: string
  selfId?: string
  name?: string
  username?: string
  user?: {
    id?: string
    name?: string
    nick?: string
    username?: string
    nickname?: string
    avatar?: string
  }
  avatar?: string
  status?: number
  internal: OneBotInternal
}

export interface OneBotInternal extends Record<string, unknown> {
  _request?: (action: string, params: Record<string, unknown>) => Promise<unknown>
}

export function supportsOneBotAction(bot: OneBotBot, action?: string) {
  if (action) return typeof bot.internal._request === 'function' || typeof bot.internal[action] === 'function'
  return typeof bot.internal._request === 'function' ||
    typeof bot.internal.get_friend_list === 'function' ||
    typeof bot.internal.get_group_list === 'function' ||
    typeof bot.internal.get_group_member_list === 'function' ||
    typeof bot.internal.get_group_system_msg === 'function' ||
    typeof bot.internal.set_friend_add_request === 'function' ||
    typeof bot.internal.set_group_add_request === 'function'
}

export async function callAction(bot: OneBotBot, action: string, params?: Record<string, unknown>) {
  if (typeof bot.internal._request === 'function') {
    return bot.internal._request(action, params ?? {})
  }
  const method = bot.internal[action]
  if (typeof method !== 'function') throw new Error(`当前 OneBot 实现不支持 ${action}`)
  return method.call(bot.internal, params)
}
