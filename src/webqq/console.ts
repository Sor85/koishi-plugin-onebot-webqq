import type { Config as PluginConfig } from '../config'
import { readConfigValue } from '../config/spec'
import type {
  WebQQChatType,
  WebQQForwardSendInput,
  WebQQFriendAction,
  WebQQGroupAction,
  WebQQGroupInfoQuery,
  WebQQMessage,
  WebQQMessageQuery,
  WebQQMessageSearchQuery,
  WebQQMessageReactionInput,
  WebQQMessageRecallInput,
  WebQQNotice,
  WebQQNoticeAction,
  WebQQProfileQuery,
  WebQQRecordTranscriptionQuery,
  WebQQSelfProfileUpdate,
  WebQQSendPayload,
} from './types'
import type { WebQQService } from './adapters/types'
import type { ChatCapsuleContext, ConsoleService, DebugLogger } from '../plugin-context'
import { attachWebQQAffinityBadges } from './affinity'
import { searchWebQQMessageHistory } from './message-search'
import { getWebQQLiveMessageKey, mergeWebQQLiveMessages } from './message-flow/live-cache'
import {
  loadKoishiWebQQMessageCache,
  saveKoishiWebQQMessageCache,
  type WebQQMessageCachePayload,
  type WebQQMessageCacheQuery,
} from './storage/message-cache'
import {
  loadKoishiWebQQRecalledMessageCache,
} from './storage/recall-cache'
import {
  loadWebQQStorage,
  saveWebQQStorage,
  type WebQQStoredState,
} from './storage/state'

export function registerWebQQConsoleListeners(
  console: ConsoleService,
  inner: ChatCapsuleContext,
  options: {
    config: PluginConfig
    webqq: WebQQService
    historyLimit: number
    liveMessages: Map<string, WebQQMessage[]>
    friendRequestNotices: Map<string, WebQQNotice>
    groupLeaveNotices: Map<string, WebQQNotice>
    consoleAuthOptions: { authority: number }
    getStorageScope: () => string | undefined
    recordSentMessage: (peer: { type: WebQQChatType; peerId: string }, messageId: string | undefined) => Promise<void>
    logger?: DebugLogger
  },
) {
  const {
    config,
    webqq,
    historyLimit,
    liveMessages,
    friendRequestNotices,
    groupLeaveNotices,
    consoleAuthOptions,
    getStorageScope,
    recordSentMessage,
    logger,
  } = options

  console.addListener('onebot-webqq/webqq/contacts', async () => {
    try {
      return await webqq.loadContacts()
    } catch (error) {
      const botState = webqq.reconcileBotState()
      logger?.info('contacts-load-failed %s', JSON.stringify({
        selectedSelfId: botState.selectedSelfId,
        bots: botState.bots.map((bot) => ({ selfId: bot.selfId, status: bot.status })),
        service: webqq.getBotStatusDiagnostics(),
        error: error instanceof Error ? error.message : String(error),
      }))
      throw error
    }
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/messages', async (query: WebQQMessageQuery) => {
    const nextQuery = {
      ...query,
      limit: query.limit ?? historyLimit,
    }
    const history = await webqq.loadMessages(nextQuery)
    const messages = mergeWebQQLiveMessages(history, liveMessages.get(getWebQQLiveMessageKey(nextQuery)), nextQuery.limit)
    const recalledMessages = readConfigValue(config, 'webQQMarkRecalledMessages')
      ? await loadKoishiWebQQRecalledMessageCache(inner, nextQuery, getStorageScope())
      : []
    const mergedMessages = mergeWebQQLiveMessages(messages, recalledMessages)
    return attachWebQQAffinityBadges(inner, config, mergedMessages, logger)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/messages/search', async (query: WebQQMessageSearchQuery) => {
    return searchWebQQMessageHistory(query, {
      pageSize: Math.min(historyLimit, 100),
      maxPages: 10,
      loadMessages: (messageQuery) => webqq.loadMessages(messageQuery),
      loadCachedMessages: query.beforeSequence
        ? undefined
        : async () => {
          const live = liveMessages.get(getWebQQLiveMessageKey(query)) ?? []
          try {
            const cached = await loadKoishiWebQQMessageCache(inner, config, {
              type: query.type,
              peerId: query.peerId,
            }, getStorageScope())
            return mergeWebQQLiveMessages(cached, live)
          } catch {
            return live
          }
        },
    })
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/group-info', (query: WebQQGroupInfoQuery) => {
    return webqq.loadGroupInfo(query)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/record/transcribe', (query: WebQQRecordTranscriptionQuery) => {
    return webqq.transcribeRecord(query.messageId)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/notices', () => {
    return webqq.loadNotices([...friendRequestNotices.values(), ...groupLeaveNotices.values()])
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/notice-action', async (action: WebQQNoticeAction) => {
    await webqq.handleNotice(action)
    if (action.type !== 'friend-request') return
    const notice = friendRequestNotices.get(action.id)
    if (!notice) return
    friendRequestNotices.set(action.id, {
      ...notice,
      status: action.approve ? 'approved' : 'rejected',
    })
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/send', async (payload: WebQQSendPayload) => {
    const messageId = await webqq.sendMessage(payload)
    // 发完立刻回显，不依赖实现是否回报自发消息；回显失败不影响这次发送成功。
    await recordSentMessage({ type: payload.type, peerId: payload.peerId }, messageId)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/message-recall', (input: WebQQMessageRecallInput) => {
    return webqq.recallMessage(input)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/message-reaction', (input: WebQQMessageReactionInput) => {
    return webqq.setMessageReaction(input)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/profile', (query: WebQQProfileQuery) => {
    return webqq.loadProfile(query)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/self-profile', (input: WebQQSelfProfileUpdate) => {
    return webqq.updateSelfProfile(input)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/friend-action', (input: WebQQFriendAction) => {
    return webqq.performFriendAction(input)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/group-action', (input: WebQQGroupAction) => {
    return webqq.performGroupAction(input)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/forward-send', async (input: WebQQForwardSendInput) => {
    const messageId = await webqq.sendForward(input)
    await recordSentMessage({ type: input.type, peerId: input.peerId }, messageId)
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/storage/load', () => {
    return loadWebQQStorage(inner, config, getStorageScope())
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/storage/save', (state: WebQQStoredState) => {
    return saveWebQQStorage(inner, config, state, getStorageScope())
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/messages/cache/load', (query: WebQQMessageCacheQuery) => {
    return loadKoishiWebQQMessageCache(inner, config, query, getStorageScope())
  }, consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/messages/cache/save', (payload: WebQQMessageCachePayload) => {
    return saveKoishiWebQQMessageCache(inner, config, payload, getStorageScope())
  }, consoleAuthOptions)
}
