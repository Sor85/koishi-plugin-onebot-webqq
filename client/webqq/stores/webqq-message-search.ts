import { nextTick, ref, type Ref } from 'vue'
import type { WebQQMessage, WebQQMessageSearchQuery, WebQQMessageSearchResult } from '../types'
import type { WebQQChatSelection } from '../utils/webqq-contact-view'
import { localDateToMessageSearchRange } from '../utils/message-search-date'
import { mergeMessages } from '../utils/webqq-message-view'
import { readWebQQErrorMessage } from '../utils/webqq-error'
// 本地筛选与服务端那半共用同一份判定。跨构建根 import 的判据见 ADR 0003：被引用的 src module
// 只有一行 import type，编译后运行时依赖为空，不会把 koishi 静默打进前端产物。
import { filterWebQQSearchMessages } from '../../../src/webqq/message-search'

export interface WebQQMessageSearchCriteria {
  query: string
  localDate?: string
}

// 客户端这层超时独立于服务端的每页 4 秒 / 每次 8 秒预算：控制台 RPC 断链或服务端进程卡死时，
// 服务端那两个预算一次都不会被触发。理由与替代方案见 ADR 0006。生产不传，测试注入小值。
const defaultSearchTimeoutMs = 12000

export function useWebQQMessageSearch(options: {
  currentChat: Ref<WebQQChatSelection | undefined>
  messages: Ref<WebQQMessage[]>
  requestMessageSearch: (query: WebQQMessageSearchQuery) => Promise<WebQQMessageSearchResult>
  loadCachedMessages: (type: WebQQChatSelection['type'], peerId: string) => Promise<WebQQMessage[]>
  rememberMessageSenderMetadata: (type: WebQQChatSelection['type'], peerId: string, messages: WebQQMessage[]) => void
  scrollToMessage: (messageKey: string) => void
  restoreTriggerFocus: () => void
  searchTimeoutMs?: number
}) {
  const messageSearchOpen = ref(false)
  const messageSearchQuery = ref('')
  const messageSearchLocalDate = ref('')
  const messageSearchResults = ref<WebQQMessage[]>([])
  const messageSearchLoading = ref(false)
  const messageSearchErrorText = ref('')
  const messageSearchSearched = ref(false)
  const messageSearchExhausted = ref(true)
  // 续查游标与竞态序号留在闭包里：界面不消费它们，暴露出去只会让调用点依赖实现细节。
  let nextBeforeSequence = ''
  let searchSerial = 0

  const searchTimeoutMs = options.searchTimeoutMs ?? defaultSearchTimeoutMs

  function resetMessageSearchResults() {
    messageSearchResults.value = []
    messageSearchErrorText.value = ''
    messageSearchSearched.value = false
    messageSearchExhausted.value = true
    nextBeforeSequence = ''
  }

  // 一次查找从头到尾要跨两个 await；两者之间既可能换了查找条件，也可能切走了会话。
  function isCurrentSearch(serial: number, expectedChatKey: string) {
    const chat = options.currentChat.value
    return serial === searchSerial && `${chat?.type}:${chat?.peerId}` === expectedChatKey
  }

  function openMessageSearch() {
    if (!options.currentChat.value) return
    messageSearchOpen.value = true
    resetMessageSearchResults()
  }

  function closeMessageSearch() {
    if (!messageSearchOpen.value) return
    messageSearchOpen.value = false
    messageSearchLoading.value = false
    messageSearchQuery.value = ''
    messageSearchLocalDate.value = ''
    resetMessageSearchResults()
    searchSerial++
    options.restoreTriggerFocus()
  }

  async function runMessageSearch(more: boolean, criteria?: WebQQMessageSearchCriteria) {
    const chat = options.currentChat.value
    if (!chat) return
    if (!more && criteria) {
      messageSearchQuery.value = criteria.query
      messageSearchLocalDate.value = criteria.localDate || ''
    }
    const keyword = messageSearchQuery.value.trim()
    const dateRange = localDateToMessageSearchRange(messageSearchLocalDate.value)
    if (!keyword && !dateRange) {
      resetMessageSearchResults()
      return
    }

    const expectedChatKey = `${chat.type}:${chat.peerId}`
    const serial = ++searchSerial
    messageSearchLoading.value = true
    messageSearchErrorText.value = ''
    if (!more) resetMessageSearchResults()
    let localMatches: WebQQMessage[] = []
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined
    try {
      // 浏览器后端的持久化缓存只在前端；当前会话内存里的消息也可能比上次落盘更新。
      // 首搜先并入这些本地命中，再让服务端继续翻 OneBot / Koishi 缓存。
      if (!more) {
        const cached = await options.loadCachedMessages(chat.type, chat.peerId)
        // 读缓存本身就是一次 await：期间切走会话时这批本地命中已经作废，既不能写进状态，
        // 也不该再发查询——服务端那边会真的向 OneBot 翻最多 10 页历史，结果 100% 会被丢弃。
        if (!isCurrentSearch(serial, expectedChatKey)) return
        const localPool = mergeMessages(cached, options.messages.value)
        localMatches = filterWebQQSearchMessages(localPool, { keyword, ...dateRange })
        // 有本地命中就先上屏，避免 OneBot 历史接口卡住时界面一直停在「搜索中...」。
        if (localMatches.length) {
          messageSearchResults.value = localMatches
          messageSearchSearched.value = true
        }
      }
      const result = await Promise.race([
        options.requestMessageSearch({
          type: chat.type,
          peerId: chat.peerId,
          keyword,
          ...dateRange,
          ...(more && nextBeforeSequence ? { beforeSequence: nextBeforeSequence } : {}),
        }),
        new Promise<never>((_, reject) => {
          timeoutTimer = setTimeout(() => reject(new Error('查找聊天记录超时')), searchTimeoutMs)
        }),
      ])
      if (!isCurrentSearch(serial, expectedChatKey)) return
      messageSearchResults.value = more
        ? mergeMessages(result.messages, messageSearchResults.value)
        : mergeMessages(localMatches, result.messages)
      messageSearchExhausted.value = result.exhausted
      nextBeforeSequence = result.nextBeforeSequence || ''
      messageSearchSearched.value = true
    } catch (error) {
      if (serial !== searchSerial) return
      // 本地命中已经上屏时，远端那半失败不该把它们换成一条错误文案。
      if (!localMatches.length) messageSearchErrorText.value = readWebQQErrorMessage(error, '查找聊天记录失败')
      messageSearchSearched.value = true
    } finally {
      // 不清计时器就每次查找泄一个；输入即搜时会成批堆积（ADR 0006）。
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (serial === searchSerial) messageSearchLoading.value = false
    }
  }

  function searchMessages(criteria: WebQQMessageSearchCriteria) {
    void runMessageSearch(false, criteria)
  }

  function searchMoreMessages() {
    void runMessageSearch(true)
  }

  async function selectSearchResult(message: WebQQMessage) {
    const chat = options.currentChat.value
    if (!chat) return
    options.messages.value = mergeMessages(options.messages.value, [message])
    options.rememberMessageSenderMetadata(chat.type, chat.peerId, [message])
    // 命中并进消息列表后必须先渲染出来才能滚过去，这个先后顺序是编排的职责。
    await nextTick()
    options.scrollToMessage(message.id || message.sequence)
  }

  return {
    messageSearchOpen,
    messageSearchQuery,
    messageSearchLocalDate,
    messageSearchResults,
    messageSearchLoading,
    messageSearchErrorText,
    messageSearchSearched,
    messageSearchExhausted,
    openMessageSearch,
    closeMessageSearch,
    searchMessages,
    searchMoreMessages,
    selectSearchResult,
  }
}
