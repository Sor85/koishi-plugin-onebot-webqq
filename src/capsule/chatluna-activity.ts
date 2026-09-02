import type { Session } from 'koishi'
import type { OneBotBotScope } from '../onebot/bots'
import { isVisibleBotSession } from '../onebot/session'
import type {
  ChatCapsuleContext,
  DebugLogger,
} from '../plugin-context'
import {
  clearConversationActivity,
  recordConversationActivity,
  recordIdleActivity,
  type CapsuleMessageInput,
  type CapsuleState,
} from './state'
import { createMessageInput, readCapsuleMemberName, type ChatLunaMessage } from './message-input'

type CapsuleSenderMetadata = Pick<CapsuleMessageInput['user'], 'senderRole' | 'senderLevel' | 'senderTitle'>

export function registerCapsuleChatLunaActivity(options: {
  ctx: ChatCapsuleContext
  state: CapsuleState
  botScope: OneBotBotScope
  logSnapshot: (source: string) => void
  broadcast: () => void
  logger?: DebugLogger
  readBotSenderMetadata?: (session: Session) => Promise<CapsuleSenderMetadata | undefined>
}) {
  const {
    ctx,
    state,
    botScope,
    logSnapshot,
    broadcast,
    logger,
    readBotSenderMetadata,
  } = options

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

  const recordGenerating = async (session: Session, message?: ChatLunaMessage, conversationId?: string) => {
    if (!isVisibleBotSession(session, botScope)) return
    const thinkingStartedAt = Date.now()
    const input = createMessageInput(session, message)
    input.user.name = readCapsuleMemberName(session) || input.user.name
    recordConversationActivity(state, input, '正在思考', { conversationId, now: thinkingStartedAt })
    logSnapshot('generating')
    broadcast()
    const botSenderMetadata = await readBotSenderMetadata?.(session)
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

  ctx.on('chatluna_character/message_collect', async (session, messages) => {
    if (!session) return
    await recordGenerating(session, messages?.at(-1))
  })

  return {
    clearActivity,
    refreshIdleScheduleActivity,
  }
}
