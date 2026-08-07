import type { Config as PluginConfig } from '../config'
import type {
  WebQQForwardSendInput,
  WebQQFriendAction,
  WebQQGroupAction,
  WebQQGroupInfoQuery,
  WebQQMessage,
  WebQQMessageQuery,
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
    logger,
  } = options

  console.addListener('onebot-webqq/webqq/contacts', () => webqq.loadContacts(), consoleAuthOptions)
  console.addListener('onebot-webqq/webqq/messages', async (query: WebQQMessageQuery) => {
    const nextQuery = {
      ...query,
      limit: query.limit ?? historyLimit,
    }
    const history = await webqq.loadMessages(nextQuery)
    const messages = mergeWebQQLiveMessages(history, liveMessages.get(getWebQQLiveMessageKey(nextQuery)), nextQuery.limit)
    const recalledMessages = config.webQQMarkRecalledMessages ?? true
      ? await loadKoishiWebQQRecalledMessageCache(inner, nextQuery, getStorageScope())
      : []
    return attachWebQQAffinityBadges(inner, config, mergeWebQQLiveMessages(messages, recalledMessages), logger)
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
  console.addListener('onebot-webqq/webqq/send', (payload: WebQQSendPayload) => {
    return webqq.sendMessage(payload)
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
  console.addListener('onebot-webqq/webqq/forward-send', (input: WebQQForwardSendInput) => {
    return webqq.sendForward(input)
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
