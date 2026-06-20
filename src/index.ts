import type { Config as PluginConfig } from './config'
import { registerCapsuleChatLunaActivity } from './capsule/chatluna-activity'
import { registerChatLunaCharacterLockSync } from './capsule/character-lock'
import { registerConsoleEntry } from './capsule/console-entry'
import {
  CapsuleSnapshot,
  createCapsuleState,
  getCurrentThinkingDurationMs,
  recordIncomingMessage,
  recordOutgoingMessage,
  setAvailableBots,
} from './capsule/state'
import {
  WebQQContacts,
  WebQQGroupInfo,
  WebQQGroupInfoQuery,
  WebQQLiveMessage,
  WebQQMessage,
  WebQQMessageQuery,
  WebQQNotice,
  WebQQNoticeAction,
  WebQQRecallPayload,
  WebQQRecordTranscriptionQuery,
} from './webqq/types'
import type { OneBotRobotState } from './onebot/types'
import type {
  ChatCapsuleStorageRow,
  WebQQMessageCachePayload,
  WebQQMessageCacheQuery,
  WebQQStoredState,
} from './webqq/storage'
import { readWebQQBotGroupSenderMetadata } from './webqq/adapters/onebot/group-sender-metadata'
import { registerWebQQ } from './webqq/register'
import { createMessageInput } from './capsule/message-input'
import { createPluginRuntime } from './runtime/create-runtime'
import type {
  ChatCapsuleContext,
  ChatLunaCharacterAfterChatPayload,
} from './plugin-context'

export { Config } from './config'
export type { ChatCapsuleContext } from './plugin-context'

export const name = 'onebot-webqq'

// 声明控制台为可选服务，缺失时只保留后端状态监听。
export const inject = {
  optional: ['console', 'server', 'database', 'chatluna', 'chatluna_character', 'ffmpeg', 'chatluna_schedule'],
}

declare module '@koishijs/console' {
  interface Events {
    'onebot-webqq/update'(data: CapsuleSnapshot | undefined): void
    'onebot-webqq/bots/update'(data: OneBotRobotState): void
    'onebot-webqq/webqq/message'(data: WebQQLiveMessage): void
    'onebot-webqq/webqq/recall'(data: WebQQRecallPayload): void
    'onebot-webqq/webqq/contacts'(): Promise<WebQQContacts>
    'onebot-webqq/webqq/group-info'(query: WebQQGroupInfoQuery): Promise<WebQQGroupInfo>
    'onebot-webqq/webqq/messages'(query: WebQQMessageQuery): Promise<WebQQMessage[]>
    'onebot-webqq/webqq/record/transcribe'(query: WebQQRecordTranscriptionQuery): Promise<string>
    'onebot-webqq/webqq/notices'(): Promise<WebQQNotice[]>
    'onebot-webqq/webqq/notice-action'(action: WebQQNoticeAction): Promise<void>
    'onebot-webqq/webqq/bot/select'(input: { selfId: string }): Promise<OneBotRobotState>
    'onebot-webqq/webqq/storage/load'(): Promise<WebQQStoredState>
    'onebot-webqq/webqq/storage/save'(state: WebQQStoredState): Promise<void>
    'onebot-webqq/webqq/messages/cache/load'(query: WebQQMessageCacheQuery): Promise<WebQQMessage[]>
    'onebot-webqq/webqq/messages/cache/save'(payload: WebQQMessageCachePayload): Promise<void>
  }
}

declare module 'koishi' {
  interface Tables {
    onebot_webqq_storage: ChatCapsuleStorageRow
  }
}

// 注册聊天胶囊的状态监听和控制台前端入口。
export function apply(ctx: ChatCapsuleContext, config: PluginConfig = {}) {
  const state = createCapsuleState()
  const {
    historyLimit,
    debug,
    logger,
    imageUrlResolver,
    webqq,
    consoleAuthOptions,
  } = createPluginRuntime(ctx, config)
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

  ctx.before('send', async (session) => {
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
