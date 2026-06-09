import { isRecord } from './data'

export interface OneBotContext {
  bots?: unknown[]
}

export interface OneBotBot {
  platform?: string
  selfId?: string
  status?: number
  internal: OneBotInternal
}

interface OneBotInternal extends Record<string, unknown> {
  _request?: (action: string, params: Record<string, unknown>) => Promise<unknown>
}

const oneBotOnlineStatus = 1

function getOneBotBots(ctx: OneBotContext) {
  return (ctx.bots ?? []).filter((bot): bot is OneBotBot => {
    return isRecord(bot) && isRecord(bot.internal)
  })
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

function isOneBotReady(bot: OneBotBot) {
  return (typeof bot.status !== 'number' || bot.status === oneBotOnlineStatus) && supportsOneBotAction(bot)
}

export function selectBot(ctx: OneBotContext, options: { selfId?: string }) {
  const bots = getOneBotBots(ctx)
  const selected = options.selfId
    ? bots.find((bot) => bot.selfId === options.selfId && isOneBotReady(bot))
    : bots.find(isOneBotReady)
  if (!selected) throw new Error(options.selfId ? `未找到 selfId 为 ${options.selfId} 的 OneBot 机器人` : '未找到可用的 OneBot 机器人')
  return selected
}

export async function callAction(bot: OneBotBot, action: string, params?: Record<string, unknown>) {
  if (typeof bot.internal._request === 'function') {
    return bot.internal._request(action, params ?? {})
  }
  const method = bot.internal[action]
  if (typeof method !== 'function') throw new Error(`当前 OneBot 实现不支持 ${action}`)
  return method.call(bot.internal, params)
}
