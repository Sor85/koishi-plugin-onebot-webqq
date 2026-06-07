import type { Config as PluginConfig } from './config'
import type {
  WebQQGroupInfoQuery,
  WebQQMessage,
  WebQQMessageQuery,
  WebQQNotice,
  WebQQNoticeAction,
} from './onebot'
import type { createOneBotWebQQService } from './onebot'
import type { ChatCapsuleContext, ConsoleService, DebugLogger } from './plugin-context'
import { attachWebQQAffinityBadges } from './webqq-affinity'
import { getWebQQLiveMessageKey, mergeWebQQLiveMessages } from './webqq-live-cache'
import {
  loadKoishiWebQQMessageCache,
  loadWebQQStorage,
  saveKoishiWebQQMessageCache,
  saveWebQQStorage,
  type WebQQMessageCachePayload,
  type WebQQMessageCacheQuery,
  type WebQQStoredState,
} from './webqq-storage'

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
    logger,
  } = options

  console.addListener('chat-capsule/webqq/contacts', () => webqq.loadContacts(), consoleAuthOptions)
  console.addListener('chat-capsule/webqq/messages', async (query: WebQQMessageQuery) => {
    const nextQuery = {
      ...query,
      limit: query.limit ?? historyLimit,
    }
    const history = await webqq.loadMessages(nextQuery)
    return attachWebQQAffinityBadges(inner, config, mergeWebQQLiveMessages(history, liveMessages.get(getWebQQLiveMessageKey(nextQuery)), nextQuery.limit), logger)
  }, consoleAuthOptions)
  console.addListener('chat-capsule/webqq/group-info', (query: WebQQGroupInfoQuery) => {
    return webqq.loadGroupInfo(query)
  }, consoleAuthOptions)
  console.addListener('chat-capsule/webqq/notices', () => {
    return webqq.loadNotices([...friendRequestNotices.values(), ...groupLeaveNotices.values()])
  }, consoleAuthOptions)
  console.addListener('chat-capsule/webqq/notice-action', async (action: WebQQNoticeAction) => {
    await webqq.handleNotice(action)
    if (action.type !== 'friend-request') return
    const notice = friendRequestNotices.get(action.id)
    if (!notice) return
    friendRequestNotices.set(action.id, {
      ...notice,
      status: action.approve ? 'approved' : 'rejected',
    })
  }, consoleAuthOptions)
  console.addListener('chat-capsule/webqq/storage/load', () => {
    return loadWebQQStorage(inner, config)
  }, consoleAuthOptions)
  console.addListener('chat-capsule/webqq/storage/save', (state: WebQQStoredState) => {
    return saveWebQQStorage(inner, config, state)
  }, consoleAuthOptions)
  console.addListener('chat-capsule/webqq/messages/cache/load', (query: WebQQMessageCacheQuery) => {
    return loadKoishiWebQQMessageCache(inner, config, query)
  }, consoleAuthOptions)
  console.addListener('chat-capsule/webqq/messages/cache/save', (payload: WebQQMessageCachePayload) => {
    return saveKoishiWebQQMessageCache(inner, config, payload)
  }, consoleAuthOptions)
}
