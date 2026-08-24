import type { Config as PluginConfig } from '../config'
import type { OneBotRobotState } from '../onebot/types'
import type { ChatCapsuleContext, DebugLogger } from '../plugin-context'
import type { WebQQImageUrlResolver } from './media/image-url-resolver'
import { registerWebQQReactionInterceptor } from './adapters/onebot/reactions'
import type { WebQQService } from './adapters/types'
import { registerWebQQConsoleListeners } from './console'
import { createManagedConsole } from '../shared/console-listeners'
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
import type { WebQQNotice } from './types'

export function registerWebQQ(options: {
  ctx: ChatCapsuleContext
  config: PluginConfig
  webqq: WebQQService
  imageUrlResolver: WebQQImageUrlResolver
  consoleAuthOptions: { authority: number }
  historyLimit: number
  logger?: DebugLogger
  errorLogger?: DebugLogger
  consoleOwner: object
  getThinkingDurationMs: () => number
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
    errorLogger,
    consoleOwner,
    getThinkingDurationMs,
    getStorageScope,
    readBotState,
    broadcastBotState,
  } = options
  const reactionErrorLogger = errorLogger ?? ctx.logger?.('onebot-webqq') ?? logger
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
    getStorageScope,
  })

  ctx.on('message-deleted', async (session) => {
    await liveRuntime.recordWebQQRecall(session)
  })

  ctx.on('internal/session', async (session) => {
    await liveRuntime.recordWebQQNotice(session)
  })

  registerWebQQReactionInterceptor(ctx, (reaction) => {
    // 原始 WS listener 不会等待 Promise，这里必须兜住未预期异常，避免升级为 Koishi 全局 unhandled rejection。
    void liveRuntime.recordWebQQReaction(reaction).catch((error) => {
      reactionErrorLogger?.info(
        'webqq raw reaction handling failed selfId=%s groupId=%s messageId=%s emojiId=%s error=%s',
        reaction.selfId || '',
        reaction.groupId,
        reaction.messageId,
        reaction.emojiId,
        error instanceof Error ? error.message : String(error),
      )
    })
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
    if (!inner.console) return
    // 停用或修改插件时必须把这些 RPC 一起摘掉，否则旧回调会继续服务控制台请求并落到已 dispose 的 ctx。
    const console = createManagedConsole(inner.console, inner, consoleOwner, reactionErrorLogger)
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
