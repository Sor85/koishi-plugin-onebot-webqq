import type { Session } from 'koishi'
import type { Config as PluginConfig } from '../config'
import type { OneBotRobotProfile, OneBotRobotState } from '../onebot/types'
import type {
  ChatCapsuleContext,
  DebugLogger,
} from '../plugin-context'
import { registerCapsuleChatLunaActivity } from './chatluna-activity'
import { registerChatLunaCharacterLockSync } from './character-lock'
import { registerConsoleEntry } from './console-entry'
import { createMessageInput } from './message-input'
import {
  createCapsuleState,
  getCurrentModelUsageSource,
  getCurrentThinkingDurationMs,
  recordIncomingMessage,
  recordOutgoingMessage,
  setAvailableBots,
} from './state'

export interface CapsuleBotRuntime {
  listBots(): OneBotRobotProfile[]
  getSelectedSelfId(): string | undefined
  selectSelfId(selfId: string): void
}

export function registerCapsule(options: {
  ctx: ChatCapsuleContext
  config: PluginConfig
  debug: boolean
  bots: CapsuleBotRuntime
  consoleAuthOptions: { authority: number }
  readBotSenderMetadata: Parameters<typeof registerCapsuleChatLunaActivity>[0]['readBotSenderMetadata']
  logger?: DebugLogger
}) {
  const {
    ctx,
    config,
    debug,
    bots: botRuntime,
    consoleAuthOptions,
    readBotSenderMetadata,
    logger,
  } = options
  const state = createCapsuleState()
  const logSnapshot = (source: string) => logger?.info(`${source} %s`, JSON.stringify(state.snapshot() ?? null))
  const broadcast = () => {
    readBotState()
    ctx.console?.broadcast('onebot-webqq/update', state.snapshot(), consoleAuthOptions)
  }
  const readBotState = (): OneBotRobotState => {
    const bots = botRuntime.listBots()
    const currentSelfId = botRuntime.getSelectedSelfId()
    const selectedSelfId = currentSelfId && bots.some((bot) => bot.selfId === currentSelfId)
      ? currentSelfId
      : bots[0]?.selfId
    if (selectedSelfId && selectedSelfId !== currentSelfId) {
      try {
        botRuntime.selectSelfId(selectedSelfId)
      } catch (error) {
        logger?.info('select default onebot failed %s', error instanceof Error ? error.message : String(error))
      }
    }
    setAvailableBots(state, bots)
    return {
      bots,
      ...(selectedSelfId ? { selectedSelfId } : {}),
    }
  }
  const broadcastBotState = (botState = readBotState()) => {
    ctx.console?.broadcast('onebot-webqq/bots/update', botState, consoleAuthOptions)
    broadcast()
  }
  const getStorageScope = () => {
    const botState = readBotState()
    return botState.bots.length > 1 ? botState.selectedSelfId : undefined
  }
  const chatLunaActivity = registerCapsuleChatLunaActivity({
    ctx,
    state,
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

  ctx.before('send', async () => {
    recordOutgoingMessage(state)
    logSnapshot('send')
    broadcast()
  })

  ctx.inject({
    console: { required: true },
    database: { required: false },
  }, (inner) => {
    const console = inner.console
    if (!console) return
    registerConsoleEntry(console, state, config, { debug, logSnapshot, readBotState })
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
    getThinkingUsage: () => state.snapshot()?.conversation.usage,
    getThinkingUsageSource: () => getCurrentModelUsageSource(state),
    getStorageScope,
    readBotState,
    broadcastBotState,
    recordIncomingMessage: recordIncomingCapsuleMessage,
    refreshIdleScheduleActivity: chatLunaActivity.refreshIdleScheduleActivity,
  }
}
