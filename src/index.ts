import type { Session } from 'koishi'
import type { Config as PluginConfig } from './config'
import { registerChatLunaCharacterLockSync } from './chatluna/character-lock'
import { registerConsoleEntry } from './console/entry'
import { registerWebQQConsoleListeners } from './webqq/console'
import {
  CapsuleSnapshot,
  clearConversationActivity,
  createCapsuleState,
  recordConversationActivity,
  recordIncomingMessage,
  recordModelUsage,
  recordOutgoingMessage,
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
} from './onebot'
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
  type ChatLunaCharacterAfterChatPayload,
} from './webqq/live-runtime'
import { createMessageInput, type ChatLunaMessage } from './chatluna/message-input'
import type {
  ChatCapsuleContext,
  ChatLunaModelUsage,
} from './plugin-context'

export { Config } from './config'
export type { ChatCapsuleContext } from './plugin-context'

export const name = 'onebot-webqq'

// 声明控制台为可选服务，缺失时只保留后端状态监听。
export const inject = {
  optional: ['console', 'server', 'database', 'chatluna', 'chatluna_character'],
}

declare module '@koishijs/console' {
  interface Events {
    'chat-capsule/update'(data: CapsuleSnapshot | undefined): void
    'chat-capsule/webqq/message'(data: WebQQLiveMessage): void
    'chat-capsule/webqq/recall'(data: WebQQRecallPayload): void
    'chat-capsule/webqq/contacts'(): Promise<WebQQContacts>
    'chat-capsule/webqq/group-info'(query: WebQQGroupInfoQuery): Promise<WebQQGroupInfo>
    'chat-capsule/webqq/messages'(query: WebQQMessageQuery): Promise<WebQQMessage[]>
    'chat-capsule/webqq/notices'(): Promise<WebQQNotice[]>
    'chat-capsule/webqq/notice-action'(action: WebQQNoticeAction): Promise<void>
    'chat-capsule/webqq/storage/load'(): Promise<WebQQStoredState>
    'chat-capsule/webqq/storage/save'(state: WebQQStoredState): Promise<void>
    'chat-capsule/webqq/messages/cache/load'(query: WebQQMessageCacheQuery): Promise<WebQQMessage[]>
    'chat-capsule/webqq/messages/cache/save'(payload: WebQQMessageCachePayload): Promise<void>
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

// 注册聊天胶囊的状态监听和控制台前端入口。
export function apply(ctx: ChatCapsuleContext, config: PluginConfig = {}) {
  const state = createCapsuleState()
  const historyLimit = config.historyLimit ?? 100
  const debug = !!config.debug
  const logger = debug ? ctx.logger?.('chat-capsule') : undefined
  const imageUrlResolver = createWebQQImageUrlResolver(ctx, logger, {
    cacheEnabled: config.webQQImageCacheEnabled ?? true,
    cacheLimitBytes: (config.webQQImageCacheLimitMB ?? 100) * 1024 * 1024,
    cacheItemLimitBytes: (config.webQQImageCacheItemLimitMB ?? 10) * 1024 * 1024,
  })
  const webqq = createOneBotWebQQService(ctx, {
    selfId: config.onebotSelfId,
    protocol: config.onebotProtocol,
    imageUrlResolver,
  })
  const consoleAuthOptions = { authority: 1 }
  const logSnapshot = (source: string) => logger?.info(`${source} %s`, JSON.stringify(state.snapshot() ?? null))
  const broadcast = () => ctx.console?.broadcast('chat-capsule/update', state.snapshot(), consoleAuthOptions)
  const friendRequestNotices = new Map<string, WebQQNotice>()
  const groupLeaveNotices = new Map<string, WebQQNotice>()
  let currentThinkingStartedAt: number | undefined

  ctx.model?.extend(chatCapsuleStorageTable, {
    id: 'string(128)',
    payload: 'object',
    updatedAt: 'timestamp',
  }, {
    primary: 'id',
  })

  const recordGenerating = async (session: Session, message?: ChatLunaMessage, conversationId?: string) => {
    const thinkingStartedAt = Date.now()
    currentThinkingStartedAt = thinkingStartedAt
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
    currentThinkingStartedAt = undefined
    logSnapshot(source)
    broadcast()
  }
  const getCurrentThinkingDurationMs = () => {
    return currentThinkingStartedAt == null ? 0 : Math.max(0, Date.now() - currentThinkingStartedAt)
  }
  const liveRuntime = createWebQQLiveRuntime({
    ctx,
    config,
    webqq,
    imageUrlResolver,
    consoleAuthOptions,
    logger,
    getThinkingDurationMs: getCurrentThinkingDurationMs,
    getThinkingUsage: () => state.snapshot()?.conversation.usage,
  })

  ctx.on('message', async (session) => {
    recordIncomingMessage(state, createMessageInput(session))
    logSnapshot('message')
    broadcast()
    await liveRuntime.recordWebQQLiveMessage(session)
  })

  ctx.on('message-deleted', (session) => {
    liveRuntime.recordWebQQRecall(session)
  })

  ctx.on('internal/session', async (session) => {
    await liveRuntime.recordWebQQNotice(session)
  })

  ctx.on('reaction-added', (session) => {
    liveRuntime.recordWebQQReaction(session)
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
    registerConsoleEntry(console, state, config, { debug, logSnapshot })
    registerWebQQConsoleListeners(console, inner, {
      config,
      webqq,
      historyLimit,
      liveMessages: liveRuntime.liveMessages,
      friendRequestNotices,
      groupLeaveNotices,
      consoleAuthOptions,
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
    await recordGenerating(session, messages?.at(-1))
  })
}
