import type { Config as PluginConfig } from '../config'
import { readConfigValue } from '../config/spec'
import { registerCapsule } from '../capsule/register'
import type {
  ChatCapsuleContext,
  ChatLunaCharacterAfterChatPayload,
} from '../plugin-context'
import { readWebQQBotGroupSenderMetadata } from '../webqq/adapters/onebot/group-sender-metadata'
import { getStringField, isRecord } from '../onebot/data'
import { isVisibleBotSession } from '../onebot/session'
import { registerWebQQ } from '../webqq/register'
import { createPluginRuntime } from './create-runtime'

export function registerPluginRuntime(ctx: ChatCapsuleContext, config: PluginConfig) {
  const {
    historyLimit,
    logger,
    errorLogger,
    consoleOwner,
    imageUrlResolver,
    webqq,
    consoleAuthOptions,
  } = createPluginRuntime(ctx, config)
  const capsuleRuntime = registerCapsule({
    ctx,
    config,
    bots: webqq,
    consoleAuthOptions,
    readBotSenderMetadata: readWebQQBotGroupSenderMetadata,
    logger,
    errorLogger,
    consoleOwner,
  })
  const liveRuntime = registerWebQQ({
    ctx,
    config,
    webqq,
    imageUrlResolver,
    consoleAuthOptions,
    historyLimit,
    logger,
    errorLogger,
    consoleOwner,
    getThinkingDurationMs: capsuleRuntime.getThinkingDurationMs,
    getStorageScope: capsuleRuntime.getStorageScope,
    readBotState: capsuleRuntime.readBotState,
    broadcastBotState: capsuleRuntime.broadcastBotState,
  })
  const logBotStatus = (source: string, data: Record<string, unknown>) => {
    logger?.info('[bot-status-debug] %s %s', source, JSON.stringify(data))
  }

  if (logger) {
    logBotStatus('runtime-start', {
      service: webqq.getBotStatusDiagnostics(),
    })
  }

  // 适配器重启后往往在一段时间内继续上报 OFFLINE/CONNECT，而 action 通道其实已经可用。
  // 过去只有 ctx.on('message') 里的 noteBotActivity 能解除这个状态，于是 WebQQ 首屏必须
  // 等一条外部消息才能加载联系人。这里主动探测 action 通道，让重启后无需外部消息即可正常显示。
  const probeBotAvailability = async (source: string) => {
    let changed = false
    try {
      changed = await webqq.probeBotAvailability()
    } catch {
      return
    }
    if (!changed) return
    if (logger) {
      logBotStatus(source, { service: webqq.getBotStatusDiagnostics() })
    }
    // 广播后前端的 contactsRecoverySignal 会变化，失败过的联系人列表随即自动重载。
    capsuleRuntime.broadcastBotState()
  }

  void probeBotAvailability('startup-probe')
  // Bot 刚被注册或状态变化时立刻补一次探测，避免等到下一个轮询周期。
  ctx.on('login-added', () => void probeBotAvailability('login-added-probe'))
  ctx.on('login-updated', () => void probeBotAvailability('login-updated-probe'))
  // 轮询兜底：覆盖「apply 时 Bot 还没进 ctx.bots，之后也不再发生命周期事件」的情况，
  // 同时在只靠活动覆盖才可用的适配器上持续刷新覆盖，防止 5 分钟过期后可用性抖动。
  // 所有 Bot 都如实上报在线时没有探测对象，这个定时器不会产生任何 OneBot 请求。
  ctx.setInterval(() => void probeBotAvailability('interval-probe'), 15 * 1000)

  ctx.on('message', async (session) => {
    // hidden Bot 仍会发出标准 Koishi 事件；在共享扇出边界阻断，避免胶囊状态和 WebQQ 未读一起被污染。
    if (!isVisibleBotSession(session)) return
    // 诊断数据要遍历全部 bot 并做 JSON 序列化；关闭 debug 时不能为每条消息都算一遍。
    if (logger) {
      const matchingContextBots = (ctx.bots ?? []).flatMap((candidate, index) => {
        if (!isRecord(candidate) || getStringField(candidate, ['selfId', 'self_id']) !== session.selfId) return []
        return [{
          index,
          sameReferenceAsSessionBot: (candidate as unknown) === session.bot,
          status: typeof candidate.status === 'number' ? candidate.status : undefined,
          hidden: candidate.hidden === true,
        }]
      })
      logBotStatus('message-observed', {
        sessionBot: {
          platform: session.bot.platform,
          selfId: session.bot.selfId,
          status: session.bot.status,
          hidden: session.bot.hidden === true,
        },
        matchingContextBots,
        serviceBeforeActivity: webqq.getBotStatusDiagnostics(),
      })
    }
    // 收到真实消息已证明 action 通道至少刚刚可用；先记录活动，再广播 Bot 状态，
    // 避免适配器仍上报 OFFLINE 时 WebQQ 永久排除该 Bot。
    webqq.noteBotActivity(session.selfId)
    capsuleRuntime.recordIncomingMessage(session)
    await liveRuntime.recordWebQQLiveMessage(session)
    await capsuleRuntime.refreshIdleScheduleActivity('message-schedule', session)
  })

  ctx.on('chatluna_character/after-chat', (payload: ChatLunaCharacterAfterChatPayload) => {
    if (readConfigValue(config, 'showWebQQCharacterThinking')) liveRuntime.updateLastOutgoingWebQQThinking(payload)
  })
}
