import type { Config as PluginConfig } from '../config'
import type { OneBotRobotState } from '../onebot/types'
import type {
  ChatCapsuleContext,
  ChatLunaCharacterAfterChatPayload,
  DebugLogger,
} from '../plugin-context'
import { readWebQQBotGroupSenderMetadata } from '../webqq/adapters/onebot/group-sender-metadata'
import type { createOneBotWebQQService } from '../webqq/adapters/onebot/service'
import type { WebQQImageUrlResolver } from '../webqq/media/image-url-resolver'
import { registerWebQQ } from '../webqq/register'
import { registerCapsuleChatLunaActivity } from './chatluna-activity'
import { registerChatLunaCharacterLockSync } from './character-lock'
import { registerConsoleEntry } from './console-entry'
import { createMessageInput } from './message-input'
import {
  createCapsuleState,
  getCurrentThinkingDurationMs,
  recordIncomingMessage,
  recordOutgoingMessage,
  setAvailableBots,
} from './state'

type OneBotWebQQService = ReturnType<typeof createOneBotWebQQService>

export function registerCapsule(options: {
  ctx: ChatCapsuleContext
  config: PluginConfig
  historyLimit: number
  debug: boolean
  webqq: OneBotWebQQService
  imageUrlResolver: WebQQImageUrlResolver
  consoleAuthOptions: { authority: number }
  logger?: DebugLogger
}) {
  const {
    ctx,
    config,
    historyLimit,
    debug,
    webqq,
    imageUrlResolver,
    consoleAuthOptions,
    logger,
  } = options
  const state = createCapsuleState()
  const logSnapshot = (source: string) => logger?.info(`${source} %s`, JSON.stringify(state.snapshot() ?? null))
  const broadcast = () => {
    readBotState()
    ctx.console?.broadcast('onebot-webqq/update', state.snapshot(), consoleAuthOptions)
  }
  const readBotState = (): OneBotRobotState => {
    const bots = webqq.listBots()
    const currentSelfId = webqq.getSelectedSelfId()
    const selectedSelfId = currentSelfId && bots.some((bot) => bot.selfId === currentSelfId)
      ? currentSelfId
      : bots[0]?.selfId
    if (selectedSelfId && selectedSelfId !== currentSelfId) {
      try {
        webqq.selectSelfId(selectedSelfId)
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
    readBotSenderMetadata: readWebQQBotGroupSenderMetadata,
  })
  const liveRuntime = registerWebQQ({
    ctx,
    config,
    webqq,
    imageUrlResolver,
    consoleAuthOptions,
    historyLimit,
    logger,
    getThinkingDurationMs: () => getCurrentThinkingDurationMs(state),
    getThinkingUsage: () => state.snapshot()?.conversation.usage,
    getStorageScope,
    readBotState,
    broadcastBotState,
  })

  ctx.on('message', async (session) => {
    recordIncomingMessage(state, createMessageInput(session))
    logSnapshot('message')
    broadcast()
    await liveRuntime.recordWebQQLiveMessage(session)
    await chatLunaActivity.refreshIdleScheduleActivity('message-schedule', session)
  })

  ctx.setInterval(() => {
    void chatLunaActivity.refreshIdleScheduleActivity('schedule-activity')
  }, 60 * 1000)

  ctx.on('chatluna_character/after-chat', (payload: ChatLunaCharacterAfterChatPayload) => {
    liveRuntime.updateLastOutgoingWebQQThinking(payload)
  })

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
}
