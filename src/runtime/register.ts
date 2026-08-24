import type { Config as PluginConfig } from '../config'
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
    debug,
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
    debug,
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
    if (config.showWebQQCharacterThinking ?? true) liveRuntime.updateLastOutgoingWebQQThinking(payload)
  })
}
