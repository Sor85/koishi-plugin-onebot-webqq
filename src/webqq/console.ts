import type { Config as PluginConfig } from '../config'
import type {
  WebQQGroupInfoQuery,
  WebQQMessage,
  WebQQMessageQuery,
  WebQQNotice,
  WebQQNoticeAction,
  WebQQRecordTranscriptionQuery,
} from '../onebot'
import type { createOneBotWebQQService } from '../onebot'
import type { ChatCapsuleContext, ConsoleService, DebugLogger } from '../plugin-context'
import { attachWebQQAffinityBadges } from './affinity'
import { getWebQQLiveMessageKey, mergeWebQQLiveMessages } from './live-cache'
import {
  loadKoishiWebQQMessageCache,
  loadKoishiWebQQRecalledMessageCache,
  loadWebQQStorage,
  saveKoishiWebQQMessageCache,
  saveWebQQStorage,
  type WebQQMessageCachePayload,
  type WebQQMessageCacheQuery,
  type WebQQStoredState,
} from './storage'

type OneBotWebQQService = ReturnType<typeof createOneBotWebQQService>

export function registerWebQQConsoleListeners(
  console: ConsoleService,
  inner: ChatCapsuleContext,
  options: {
    config: PluginConfig
    webqq: OneBotWebQQService
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
