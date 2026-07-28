import { isRecord } from './data'
import { supportsOneBotAction, type OneBotBot } from './actions'

export interface OneBotContext {
  bots?: unknown[]
}

const oneBotOnlineStatus = 1

export function getOneBotBots(ctx: OneBotContext) {
  return (ctx.bots ?? []).filter((bot): bot is OneBotBot => {
    // Satori 的 hidden 用于保留运行时能力但阻止 UI 发现，虚拟 Bot 仍需留在 ctx.bots 中接收事件。
    return isRecord(bot) && bot.hidden !== true && isRecord(bot.internal)
  })
}

function isOneBotReady(bot: OneBotBot) {
  return (typeof bot.status !== 'number' || bot.status === oneBotOnlineStatus) && supportsOneBotAction(bot)
}

export function getAvailableOneBotBots(ctx: OneBotContext, selfIds?: string[]) {
  const allowList = new Set((selfIds ?? []).map((selfId) => selfId.trim()).filter(Boolean))
  if (selfIds && !allowList.size) return []
  return getOneBotBots(ctx).filter((bot) => {
    if (!isOneBotReady(bot)) return false
    if (!allowList.size) return true
    return !!bot.selfId && allowList.has(bot.selfId)
  })
}

export function selectBot(ctx: OneBotContext, options: { selfId?: string; selfIds?: string[] }) {
  const bots = getAvailableOneBotBots(ctx, options.selfIds)
  const selected = options.selfId
    ? bots.find((bot) => bot.selfId === options.selfId && isOneBotReady(bot))
    : bots.find(isOneBotReady)
  if (!selected) {
    if (options.selfId) throw new Error(`未找到 selfId 为 ${options.selfId} 的 OneBot 机器人`)
    throw new Error(options.selfIds ? '未找到配置 selfId 集合中的可用 OneBot 机器人' : '未找到可用的 OneBot 机器人')
  }
  return selected
}
