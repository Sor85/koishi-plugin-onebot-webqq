import type { Session } from 'koishi'
import type { Config as PluginConfig } from './config'
import { registerChatLunaCharacterLockSync } from './chatluna/character-lock'
import { registerConsoleEntry } from './console/entry'
import { registerWebQQConsoleListeners } from './webqq/console'
import {
  CapsuleSnapshot,
  clearConversationActivity,
  createCapsuleState,
  getCurrentThinkingDurationMs,
  recordIdleActivity,
  recordConversationActivity,
  recordIncomingMessage,
  recordModelUsage,
  recordOutgoingMessage,
  setAvailableBots,
} from './state'
import {
  createOneBotWebQQService,
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
} from './onebot'
import type { OneBotRobotState } from './onebot'
import { registerWebQQReactionInterceptor } from './onebot/raw-event'
import {
  chatCapsuleStorageTable,
} from './webqq/storage'
import type {
  ChatCapsuleStorageRow,
  WebQQMessageCachePayload,
  WebQQMessageCacheQuery,
  WebQQStoredState,
} from './webqq/storage'
import { createWebQQImageUrlResolver } from './webqq/image-url-resolver'
import { readMemberName } from './webqq/session'
import {
  createWebQQFriendRequestNotice,
  createWebQQGroupLeaveNotice,
} from './webqq/event-notices'
import { readWebQQBotGroupSenderMetadata } from './webqq/group-sender-metadata'
import {
  createWebQQLiveRuntime,
} from './webqq/live-runtime'
import { createMessageInput, type ChatLunaMessage } from './chatluna/message-input'
import type {
  ChatCapsuleContext,
  ChatLunaCharacterAfterChatPayload,
  ChatLunaModelUsage,
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

const visibleUsageSources = new Set(['chatluna', 'chatluna-character', 'character'])

function shouldDisplayModelUsage(usage: ChatLunaModelUsage) {
  return visibleUsageSources.has(usage.source || '')
}

function normalizeOneBotSelfId(value?: string) {
  const selfId = value?.trim()
  return selfId || undefined
}

function getConfiguredOneBotSelfIds(config: PluginConfig) {
  return Array.from(new Set([
    normalizeOneBotSelfId(config.onebotSelfId),
    ...(config.onebotSelfIds ?? []).map(normalizeOneBotSelfId),
  ].filter((selfId): selfId is string => !!selfId)))
}

// 注册聊天胶囊的状态监听和控制台前端入口。
export function apply(ctx: ChatCapsuleContext, config: PluginConfig = {}) {
  const state = createCapsuleState()
  const historyLimit = config.historyLimit ?? 100
  const debug = !!config.debug
  const logger = debug ? ctx.logger?.('onebot-webqq') : undefined
  const configuredOneBotSelfIds = getConfiguredOneBotSelfIds(config)
  const useRuntimeOneBotBots = config.onebotUseRuntimeBots ?? true
  const initialOneBotSelfId = normalizeOneBotSelfId(config.onebotSelfId) || (!useRuntimeOneBotBots ? configuredOneBotSelfIds[0] : undefined)
  const imageUrlResolver = createWebQQImageUrlResolver(ctx, logger, {
    cacheEnabled: config.webQQImageCacheEnabled ?? true,
    cacheLimitBytes: (config.webQQImageCacheLimitMB ?? 100) * 1024 * 1024,
    cacheItemLimitBytes: (config.webQQImageCacheItemLimitMB ?? 10) * 1024 * 1024,
  })
  const webqq = createOneBotWebQQService(ctx, {
    selfId: initialOneBotSelfId,
    selfIds: useRuntimeOneBotBots ? undefined : configuredOneBotSelfIds,
    protocol: config.onebotProtocol,
    imageUrlResolver,
  })
  const consoleAuthOptions = { authority: 1 }
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
  const friendRequestNotices = new Map<string, WebQQNotice>()
  const groupLeaveNotices = new Map<string, WebQQNotice>()
  const readScheduleActivity = async (session?: Session) => {
    const service = ctx.chatluna_schedule
    if (!service) return ''
    const activity = (await service.getCurrentActivity?.(session))?.trim()
    if (activity) return activity
    return (await service.getCurrentSummary?.(session))?.trim() || ''
  }
  const refreshIdleScheduleActivity = async (source: string, session?: Session) => {
    try {
      const activity = await readScheduleActivity(session)
      if (!activity || !recordIdleActivity(state, activity)) return
      logSnapshot(source)
      broadcast()
    } catch (error) {
      logger?.info(`${source}-error %s`, error instanceof Error ? error.message : String(error))
    }
  }

  ctx.model?.extend(chatCapsuleStorageTable, {
    id: 'string(128)',
    payload: 'object',
    updatedAt: 'timestamp',
  }, {
    primary: 'id',
  })

  const recordGenerating = async (session: Session, message?: ChatLunaMessage, conversationId?: string) => {
    const thinkingStartedAt = Date.now()
    const input = createMessageInput(session, message)
    input.user.name = readMemberName(session) || input.user.name
    recordConversationActivity(state, input, '正在思考', { conversationId, now: thinkingStartedAt })
    logSnapshot('generating')
    broadcast()
    const botSenderMetadata = await readWebQQBotGroupSenderMetadata(session)
    if (!botSenderMetadata) return
    recordConversationActivity(state, {
      ...input,
      user: {
        ...input.user,
        ...botSenderMetadata,
      },
    }, '正在思考', { conversationId, now: thinkingStartedAt })
    logSnapshot('generating-metadata')
    broadcast()
  }
  const clearActivity = (source: string) => {
    clearConversationActivity(state)
    logSnapshot(source)
    broadcast()
    void refreshIdleScheduleActivity(`${source}-schedule`)
  }
  const liveRuntime = createWebQQLiveRuntime({
    ctx,
    config,
    webqq,
    imageUrlResolver,
    consoleAuthOptions,
    logger,
    getThinkingDurationMs: () => getCurrentThinkingDurationMs(state),
    getThinkingUsage: () => state.snapshot()?.conversation.usage,
    getStorageScope,
  })

  ctx.on('message', async (session) => {
    recordIncomingMessage(state, createMessageInput(session))
    logSnapshot('message')
    broadcast()
    await liveRuntime.recordWebQQLiveMessage(session)
    await refreshIdleScheduleActivity('message-schedule', session)
  })

  ctx.setInterval(() => {
    void refreshIdleScheduleActivity('schedule-activity')
  }, 60 * 1000)

  ctx.on('message-deleted', async (session) => {
    await liveRuntime.recordWebQQRecall(session)
  })

  ctx.on('internal/session', async (session) => {
    await liveRuntime.recordWebQQNotice(session)
  })

  registerWebQQReactionInterceptor(ctx, (reaction) => {
    liveRuntime.recordWebQQReaction(reaction)
  })

  ctx.on('friend-request', (session) => {
    const notice = createWebQQFriendRequestNotice(session)
    if (!notice) return
    friendRequestNotices.set(notice.id, notice)
  })

  ctx.on('guild-member-removed', (session) => {
    const notice = createWebQQGroupLeaveNotice(session)
    if (!notice) return
    groupLeaveNotices.set(notice.id, notice)
  })

  ctx.on('chatluna/before-chat', async (conversationId, message, _variables, _chatInterface, session) => {
    if (!session) return
    await recordGenerating(session, message, conversationId)
  })

  ctx.on('chatluna/after-chat', () => {
    clearActivity('after-chat')
  })

  ctx.on('chatluna/after-chat-error', () => {
    clearActivity('after-chat-error')
  })

  ctx.on('chatluna_character/after-chat', (payload: ChatLunaCharacterAfterChatPayload) => {
    liveRuntime.updateLastOutgoingWebQQThinking(payload)
  })

  ctx.before('send', async (session) => {
    recordOutgoingMessage(state)
    logSnapshot('send')
    broadcast()
  })

  ctx.on('chatluna/model-usage', (usage: ChatLunaModelUsage) => {
    if (!shouldDisplayModelUsage(usage)) return
    const changed = recordModelUsage(state, {
      conversationId: usage.context?.conversationId,
      inputTokens: usage.usageMetadata?.input_tokens,
      outputTokens: usage.usageMetadata?.output_tokens,
    })
    if (!changed) return
    logSnapshot('model-usage')
    broadcast()
  })

  ctx.inject({
    console: { required: true },
    database: { required: false },
  }, (inner) => {
    const console = inner.console
    if (!console) return
    registerConsoleEntry(console, state, config, { debug, logSnapshot, readBotState })
    console.addListener('onebot-webqq/webqq/bot/select', async (input) => {
      webqq.selectSelfId(input.selfId)
      const botState = readBotState()
      broadcastBotState(botState)
      return botState
    }, consoleAuthOptions)
    registerWebQQConsoleListeners(console, inner, {
      config,
      webqq,
      historyLimit,
      liveMessages: liveRuntime.liveMessages,
      friendRequestNotices,
      groupLeaveNotices,
      consoleAuthOptions,
      getStorageScope,
      logger,
    })
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
      clearActivity,
    })
  })

  ctx.on('chatluna_character/message_collect', async (session, messages) => {
    if (!session) return
    await recordGenerating(session, messages?.at(-1))
  })
}
