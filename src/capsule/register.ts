import type { Session } from 'koishi'
import type { Config as PluginConfig } from '../config'
import type { OneBotRobotState } from '../onebot/types'
import type { OneBotBotScope } from '../onebot/bots'
import { isVisibleBotSession } from '../onebot/session'
import type {
  ChatCapsuleContext,
  DebugLogger,
} from '../plugin-context'
import { registerCapsuleChatLunaActivity } from './chatluna-activity'
import { registerChatLunaCharacterLockSync } from './character-lock'
import { registerConsoleEntry } from './console-entry'
import { createManagedConsole } from '../shared/console-listeners'
import { createMessageInput } from './message-input'
import {
  createCapsuleState,
  getCurrentThinkingDurationMs,
  recordIncomingMessage,
  recordOutgoingMessage,
  setAvailableBots,
} from './state'

export interface CapsuleBotRuntime {
  reconcileBotState(): OneBotRobotState
  getBotStatusDiagnostics(): Record<string, unknown>
}

export function registerCapsule(options: {
  ctx: ChatCapsuleContext
  config: PluginConfig
  bots: CapsuleBotRuntime
  botScope?: OneBotBotScope
  consoleAuthOptions: { authority: number }
  readBotSenderMetadata: Parameters<typeof registerCapsuleChatLunaActivity>[0]['readBotSenderMetadata']
  logger?: DebugLogger
  errorLogger?: DebugLogger
  consoleOwner: object
}) {
  const {
    ctx,
    config,
    bots: botRuntime,
    botScope,
    consoleAuthOptions,
    readBotSenderMetadata,
    logger,
    errorLogger,
    consoleOwner,
  } = options
  const state = createCapsuleState()
  const logSnapshot = (source: string) => logger?.info(`${source} %s`, JSON.stringify(state.snapshot() ?? null))
  const broadcast = () => {
    readBotState()
    ctx.console?.broadcast('onebot-webqq/update', state.snapshot(), consoleAuthOptions)
  }
  const readBotState = (): OneBotRobotState => {
    // fallback 和闭包选择必须由 service 一次性收敛，避免对外状态已清空但 action 仍使用旧 selfId。
    const botState = botRuntime.reconcileBotState()
    setAvailableBots(state, botState.bots)
    return botState
  }
  const broadcastBotState = (botState = readBotState()) => {
    ctx.console?.broadcast('onebot-webqq/bots/update', botState, consoleAuthOptions)
    broadcast()
  }
  const getStorageScope = () => {
    const botState = readBotState()
    return botState.bots.length > 1 ? botState.selectedSelfId : undefined
  }
  const handleBotLifecycle = (source: 'login-added' | 'login-removed' | 'login-updated') => {
    const botState = readBotState()
    logger?.info('[bot-status-debug] %s %s', source, JSON.stringify({
      result: {
        selectedSelfId: botState.selectedSelfId,
        bots: botState.bots.map((bot) => ({ selfId: bot.selfId, status: bot.status })),
      },
      service: botRuntime.getBotStatusDiagnostics(),
    }))
    broadcastBotState(botState)
  }
  // Bot 在页面加载后上线时不会产生消息事件，必须由生命周期事件同步列表和 selectedSelfId，否则胶囊会永久使用初始离线状态。
  ctx.on('login-added', () => handleBotLifecycle('login-added'))
  ctx.on('login-removed', () => handleBotLifecycle('login-removed'))
  ctx.on('login-updated', () => handleBotLifecycle('login-updated'))
  const chatLunaActivity = registerCapsuleChatLunaActivity({
    ctx,
    state,
    botScope,
    logSnapshot,
    broadcast,
    logger,
    readBotSenderMetadata,
  })

  const recordIncomingCapsuleMessage = (session: Session) => {
    recordIncomingMessage(state, createMessageInput(session))
    logSnapshot('message')
    broadcast()
  }

  ctx.setInterval(() => {
    void chatLunaActivity.refreshIdleScheduleActivity('schedule-activity')
  }, 60 * 1000)

  ctx.before('send', async (session) => {
    if (!isVisibleBotSession(session, botScope)) return
    recordOutgoingMessage(state)
    logSnapshot('send')
    broadcast()
  })

  ctx.inject({
    console: { required: true },
    database: { required: false },
  }, (inner) => {
    if (!inner.console) return
    // 与 WebQQ 侧同理：入口数据回调必须随插件 dispose 一起摘除。
    const console = createManagedConsole(inner.console, inner, consoleOwner, errorLogger ?? logger)
    registerConsoleEntry(console, state, config, { logSnapshot, readBotState })
  })

  ctx.inject({
    chatluna_character: { required: true },
  }, (inner) => {
    const service = inner.chatluna_character
    if (!service) return
    registerChatLunaCharacterLockSync(ctx, service, {
      state,
      logSnapshot,
      broadcast,
      clearActivity: chatLunaActivity.clearActivity,
    })
  })

  return {
    getThinkingDurationMs: () => getCurrentThinkingDurationMs(state),
    getStorageScope,
    readBotState,
    broadcastBotState,
    recordIncomingMessage: recordIncomingCapsuleMessage,
    refreshIdleScheduleActivity: chatLunaActivity.refreshIdleScheduleActivity,
  }
}
