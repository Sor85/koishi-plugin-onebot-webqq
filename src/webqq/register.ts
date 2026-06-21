import type { Config as PluginConfig } from '../config'
import type { OneBotRobotState } from '../onebot/types'
import type { ChatCapsuleContext, DebugLogger } from '../plugin-context'
import type { WebQQImageUrlResolver } from './media/image-url-resolver'
import { registerWebQQReactionInterceptor } from './adapters/onebot/reactions'
import type { createOneBotWebQQService } from './adapters/onebot/service'
import { registerWebQQConsoleListeners } from './console'
import {
  createWebQQFriendRequestNotice,
  createWebQQGroupLeaveNotice,
} from './notices/event-notices'
import {
  createWebQQLiveRuntime,
  type WebQQLiveRuntime,
} from './message-flow/live-runtime'
import {
  chatCapsuleStorageTable,
} from './storage/schema'
import type { WebQQMessage, WebQQNotice } from './types'

type OneBotWebQQService = ReturnType<typeof createOneBotWebQQService>

export function registerWebQQ(options: {
  ctx: ChatCapsuleContext
  config: PluginConfig
  webqq: OneBotWebQQService
  imageUrlResolver: WebQQImageUrlResolver
  consoleAuthOptions: { authority: number }
  historyLimit: number
  logger?: DebugLogger
  getThinkingDurationMs: () => number
  getThinkingUsage: () => NonNullable<WebQQMessage['thinking']>['usage'] | undefined
  getStorageScope: () => string | undefined
  readBotState: () => OneBotRobotState
  broadcastBotState: (botState?: OneBotRobotState) => void
}) {
  const {
    ctx,
    config,
    webqq,
    imageUrlResolver,
    consoleAuthOptions,
    historyLimit,
    logger,
    getThinkingDurationMs,
    getThinkingUsage,
    getStorageScope,
    readBotState,
    broadcastBotState,
  } = options
  const friendRequestNotices = new Map<string, WebQQNotice>()
  const groupLeaveNotices = new Map<string, WebQQNotice>()

  ctx.model?.extend(chatCapsuleStorageTable, {
    id: 'string(128)',
    payload: 'object',
    updatedAt: 'timestamp',
  }, {
    primary: 'id',
  })

  const liveRuntime = createWebQQLiveRuntime({
    ctx,
    config,
    webqq,
    imageUrlResolver,
    consoleAuthOptions,
    logger,
    getThinkingDurationMs,
    getThinkingUsage,
    getStorageScope,
  })

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

  ctx.inject({
    console: { required: true },
    database: { required: false },
  }, (inner) => {
    const console = inner.console
    if (!console) return
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

  return liveRuntime
}
