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

export function getOneBotProfileStatus(bot: OneBotBot) {
  if (typeof bot.status === 'number') return bot.status
  // 部分 OneBot 实现 action 可用但未提供 Satori 数字状态；仅通过现有可用性检查后才推导在线，避免把未知 Bot 误标为在线。
  return isOneBotReady(bot) ? oneBotOnlineStatus : undefined
}

// 最廉价的通用 OneBot action，仅用来证明 action 通道确实可用。
export const oneBotProbeAction = 'get_login_info'

function createOneBotAllowList(selfIds?: string[]) {
  return new Set((selfIds ?? []).map((selfId) => selfId.trim()).filter(Boolean))
}

function isAllowedOneBotBot(bot: OneBotBot, allowList: ReadonlySet<string>) {
  if (!allowList.size) return true
  return !!bot.selfId && allowList.has(bot.selfId)
}

export function getAvailableOneBotBots(ctx: OneBotContext, selfIds?: string[], activeSelfIds?: ReadonlySet<string>) {
  const allowList = createOneBotAllowList(selfIds)
  if (selfIds && !allowList.size) return []
  return getOneBotBots(ctx).filter((bot) => {
    // 某些适配器已能收到该 Bot 的消息时仍短暂上报 OFFLINE；实际活动是比滞后状态更强的可用信号。
    const recentlyActive = !!bot.selfId && !!activeSelfIds?.has(bot.selfId) && supportsOneBotAction(bot)
    if (!isOneBotReady(bot) && !recentlyActive) return false
    return isAllowedOneBotBot(bot, allowList)
  })
}

// Koishi 重启后适配器可能长时间上报 OFFLINE/CONNECT，即使 action 通道早已可用。
// 这类 Bot 过去只能靠「等一条外部消息」触发 noteBotActivity 才会变可用，首屏因此加载失败。
// 这里挑出所有不自报就绪的 Bot 作为主动探测对象；已经如实上报在线的无需探测。
// 注意不能排除「当前靠活动覆盖才可用」的 Bot，否则覆盖会在 5 分钟后过期并造成可用性抖动。
export function getProbeableOneBotBots(ctx: OneBotContext, selfIds?: string[]) {
  const allowList = createOneBotAllowList(selfIds)
  if (selfIds && !allowList.size) return []
  return getOneBotBots(ctx).filter((bot) => {
    if (!bot.selfId) return false
    if (isOneBotReady(bot)) return false
    if (!supportsOneBotAction(bot, oneBotProbeAction)) return false
    return isAllowedOneBotBot(bot, allowList)
  })
}

export function selectBot(ctx: OneBotContext, options: { selfId?: string; selfIds?: string[]; activeSelfIds?: ReadonlySet<string> }) {
  const bots = getAvailableOneBotBots(ctx, options.selfIds, options.activeSelfIds)
  const selected = options.selfId
    ? bots.find((bot) => bot.selfId === options.selfId)
    : bots[0]
  if (!selected) {
    if (options.selfId) throw new Error(`未找到 selfId 为 ${options.selfId} 的 OneBot 机器人`)
    throw new Error(options.selfIds ? '未找到配置 selfId 集合中的可用 OneBot 机器人' : '未找到可用的 OneBot 机器人')
  }
  return selected
}
