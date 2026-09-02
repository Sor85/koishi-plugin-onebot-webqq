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
  hidden?: boolean
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

/**
 * 按顺序尝试同一件事在各 OneBot 实现下的不同 action 名，返回第一个成功的结果。
 *
 * NapCat 与 LLBot 对同一能力常用不同 action 名（语音转文字就是 `fetch_ptt_text` 与
 * `voice_msg_to_text`）。调用方按当前协议把更可能命中的名字排在前面，配置与实际实现不符时
 * 仍能靠后续别名兜住。
 */
export async function callSupportedAction(
  bot: OneBotBot,
  actions: string[],
  params: Record<string, unknown>,
) {
  let lastError: unknown
  for (const action of actions) {
    // 有 _request 时 supportsOneBotAction 对任意 action 都为 true，这里仍按顺序尝试，
    // 直到真实实现接受其中一个别名，避免 NapCat/LLBot 命名差异导致直接失败。
    if (!supportsOneBotAction(bot, action) && typeof bot.internal._request !== 'function') {
      continue
    }
    try {
      return await callAction(bot, action, params)
    } catch (error) {
      lastError = error
    }
  }
  if (lastError instanceof Error) throw lastError
  throw new Error(`当前 OneBot 实现不支持 ${actions.join(' / ')}`)
}
