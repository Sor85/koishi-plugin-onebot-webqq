import { describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'
import { useWebQQMessageSearch } from '../client/webqq/stores/webqq-message-search'
import type { WebQQMessage, WebQQMessageSearchQuery, WebQQMessageSearchResult } from '../client/webqq/types'
import type { WebQQChatSelection } from '../client/webqq/utils/webqq-contact-view'

const groupChat: WebQQChatSelection = { type: 'group', peerId: '20000', name: '群聊', subtitle: '', avatar: '' }
const otherChat: WebQQChatSelection = { type: 'group', peerId: '20001', name: '另一个群', subtitle: '', avatar: '' }

function createMessage(id: string, summary: string, time: number, sequence = id): WebQQMessage {
  return {
    id,
    sequence,
    time,
    senderId: '30000',
    senderName: 'Alice',
    senderAvatar: '',
    direction: 'incoming',
    summary,
    elements: [],
  }
}

interface Deferred {
  promise: Promise<WebQQMessageSearchResult>
  resolve: (result: WebQQMessageSearchResult) => void
  reject: (error: unknown) => void
}

function createDeferred(): Deferred {
  let resolve!: (result: WebQQMessageSearchResult) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<WebQQMessageSearchResult>((resolveResult, rejectResult) => {
    resolve = resolveResult
    reject = rejectResult
  })
  return { promise, resolve, reject }
}

/** 编排里一次查找要跨两个 await；用微任务轮次推进，假计时器下同样有效。 */
async function settle(rounds = 8) {
  for (let round = 0; round < rounds; round++) await Promise.resolve()
}

function createSearchHarness(setup: {
  cached?: WebQQMessage[]
  cachedLoader?: () => Promise<WebQQMessage[]>
  messages?: WebQQMessage[]
  searchTimeoutMs?: number
} = {}) {
  const currentChat: Ref<WebQQChatSelection | undefined> = ref(groupChat)
  const messages = ref<WebQQMessage[]>(setup.messages ?? [])
  const queries: WebQQMessageSearchQuery[] = []
  const cacheReads: string[] = []
  const metadataCalls: { key: string; ids: string[] }[] = []
  const scrolledKeys: string[] = []
  const deferreds: Deferred[] = []
  let focusRestores = 0

  const store = useWebQQMessageSearch({
    currentChat,
    messages,
    requestMessageSearch: (query) => {
      queries.push(query)
      const deferred = createDeferred()
      deferreds.push(deferred)
      return deferred.promise
    },
    loadCachedMessages: async (type, peerId) => {
      cacheReads.push(`${type}:${peerId}`)
      return setup.cachedLoader ? setup.cachedLoader() : setup.cached ?? []
    },
    rememberMessageSenderMetadata: (type, peerId, nextMessages) => {
      metadataCalls.push({ key: `${type}:${peerId}`, ids: nextMessages.map((message) => message.id) })
    },
    scrollToMessage: (messageKey) => { scrolledKeys.push(messageKey) },
    restoreTriggerFocus: () => { focusRestores++ },
    ...(setup.searchTimeoutMs ? { searchTimeoutMs: setup.searchTimeoutMs } : {}),
  })

  store.openMessageSearch()

  return {
    store,
    currentChat,
    messages,
    queries,
    cacheReads,
    metadataCalls,
    scrolledKeys,
    deferreds,
    focusRestores: () => focusRestores,
    resultIds: () => store.messageSearchResults.value.map((message) => message.id),
  }
}

describe('会话内查找编排', () => {
  it('对外只暴露界面消费的 8 条状态与 5 个动作', () => {
    const { store } = createSearchHarness()
    expect(Object.keys(store)).toEqual([
      'messageSearchOpen',
      'messageSearchQuery',
      'messageSearchLocalDate',
      'messageSearchResults',
      'messageSearchLoading',
      'messageSearchErrorText',
      'messageSearchSearched',
      'messageSearchExhausted',
      'openMessageSearch',
      'closeMessageSearch',
      'searchMessages',
      'searchMoreMessages',
      'selectSearchResult',
    ])
  })

  it('查找条件为空时不发请求，并把结果重置回初始态', async () => {
    const harness = createSearchHarness()
    harness.store.messageSearchResults.value = [createMessage('m1', '早安', 1000)]
    harness.store.messageSearchSearched.value = true
    harness.store.messageSearchExhausted.value = false
    harness.store.messageSearchErrorText.value = '上一次的错误'

    harness.store.searchMessages({ query: '   ' })
    await settle()

    expect(harness.cacheReads).toEqual([])
    expect(harness.queries).toEqual([])
    expect(harness.store.messageSearchResults.value).toEqual([])
    expect(harness.store.messageSearchSearched.value).toBe(false)
    expect(harness.store.messageSearchExhausted.value).toBe(true)
    expect(harness.store.messageSearchErrorText.value).toBe('')
    expect(harness.store.messageSearchLoading.value).toBe(false)
  })

  it('本地命中在远端还没返回时先上屏', async () => {
    const harness = createSearchHarness({ cached: [createMessage('m1', '早安', 1000)] })

    harness.store.searchMessages({ query: '早安' })
    await settle()

    expect(harness.cacheReads).toEqual(['group:20000'])
    expect(harness.resultIds()).toEqual(['m1'])
    expect(harness.store.messageSearchSearched.value).toBe(true)
    // 远端那半还在跑，界面仍要知道查找没结束。
    expect(harness.store.messageSearchLoading.value).toBe(true)
    expect(harness.queries).toHaveLength(1)
  })

  it('远端返回后与本地命中按消息键合并去重', async () => {
    const harness = createSearchHarness({ cached: [createMessage('m1', '早安', 1000)] })

    harness.store.searchMessages({ query: '早安' })
    await settle()
    harness.deferreds[0].resolve({
      messages: [createMessage('m1', '早安', 1000), createMessage('m0', '早安啊', 500)],
      scannedCount: 9,
      exhausted: true,
    })
    await settle()

    expect(harness.resultIds()).toEqual(['m0', 'm1'])
    expect(harness.store.messageSearchExhausted.value).toBe(true)
    expect(harness.store.messageSearchLoading.value).toBe(false)
    expect(harness.store.messageSearchErrorText.value).toBe('')
  })

  it('本地池包含还没落盘的内存消息', async () => {
    const harness = createSearchHarness({
      cached: [createMessage('m1', '早安', 1000)],
      // 刚滑过、还没写回浏览器缓存的那条：前端这一遍本地扫描存在的理由就是它。
      messages: [createMessage('m2', '早安好', 2000)],
    })

    harness.store.searchMessages({ query: '早安' })
    await settle()

    expect(harness.resultIds()).toEqual(['m1', 'm2'])
  })

  it('后发的查找先回来时，先发的那次结果被丢弃', async () => {
    const harness = createSearchHarness()

    harness.store.searchMessages({ query: '慢' })
    await settle()
    harness.store.searchMessages({ query: '快' })
    await settle()
    expect(harness.queries.map((query) => query.keyword)).toEqual(['慢', '快'])

    harness.deferreds[1].resolve({ messages: [createMessage('fast', '快', 2000)], scannedCount: 1, exhausted: true })
    await settle()
    harness.deferreds[0].resolve({ messages: [createMessage('slow', '慢', 1000)], scannedCount: 1, exhausted: false })
    await settle()

    expect(harness.resultIds()).toEqual(['fast'])
    expect(harness.store.messageSearchExhausted.value).toBe(true)
    expect(harness.store.messageSearchLoading.value).toBe(false)
  })

  it('远端结果在途时切走会话，结果不落地', async () => {
    const harness = createSearchHarness()

    harness.store.searchMessages({ query: '早安' })
    await settle()
    harness.currentChat.value = otherChat
    harness.deferreds[0].resolve({ messages: [createMessage('m1', '早安', 1000)], scannedCount: 1, exhausted: true })
    await settle()

    expect(harness.store.messageSearchResults.value).toEqual([])
    expect(harness.store.messageSearchSearched.value).toBe(false)
  })

  it('远端结果在途时切走会话，远端失败也不写错误文案', async () => {
    const harness = createSearchHarness()

    harness.store.searchMessages({ query: '早安' })
    await settle()
    harness.currentChat.value = otherChat
    harness.deferreds[0].reject('Error: 群历史接口不可用')
    await settle()

    expect(harness.store.messageSearchErrorText.value).toBe('')
    expect(harness.store.messageSearchSearched.value).toBe(false)
    // 会话切走但没有更新的查找接手时，卡住的 loading 只能由这次查找自己放下。
    expect(harness.store.messageSearchLoading.value).toBe(false)
  })

  it('还在读缓存阶段就切走会话时，既不写状态也不发请求', async () => {
    let releaseCache: (messages: WebQQMessage[]) => void = () => {}
    const harness = createSearchHarness({
      cachedLoader: () => new Promise((resolve) => { releaseCache = resolve }),
    })

    harness.store.searchMessages({ query: '早安' })
    await settle()
    expect(harness.cacheReads).toEqual(['group:20000'])

    harness.currentChat.value = otherChat
    releaseCache([createMessage('m1', '早安', 1000)])
    await settle()

    expect(harness.store.messageSearchResults.value).toEqual([])
    expect(harness.store.messageSearchSearched.value).toBe(false)
    // 会话已经切走，这次查询的结果 100% 会被丢弃，不该让服务端真的去翻 OneBot 历史。
    expect(harness.queries).toEqual([])
  })

  it('客户端超时后报出「查找聊天记录超时」', async () => {
    const harness = createSearchHarness({ searchTimeoutMs: 5 })

    harness.store.searchMessages({ query: '早安' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    await settle()

    expect(harness.store.messageSearchErrorText.value).toBe('查找聊天记录超时')
    expect(harness.store.messageSearchSearched.value).toBe(true)
    expect(harness.store.messageSearchLoading.value).toBe(false)
    expect(harness.store.messageSearchResults.value).toEqual([])
  })

  it('查找结束后超时计时器归零', async () => {
    vi.useFakeTimers()
    try {
      const harness = createSearchHarness()

      harness.store.searchMessages({ query: '早安' })
      await settle()
      expect(vi.getTimerCount()).toBe(1)

      harness.deferreds[0].resolve({ messages: [], scannedCount: 0, exhausted: true })
      await settle()

      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('本地已有命中时，远端失败不报错', async () => {
    const harness = createSearchHarness({ cached: [createMessage('m1', '早安', 1000)] })

    harness.store.searchMessages({ query: '早安' })
    await settle()
    harness.deferreds[0].reject(new Error('OneBot 没有响应'))
    await settle()

    expect(harness.store.messageSearchErrorText.value).toBe('')
    expect(harness.resultIds()).toEqual(['m1'])
    expect(harness.store.messageSearchSearched.value).toBe(true)
    expect(harness.store.messageSearchLoading.value).toBe(false)
  })

  it('本地没有命中时，远端失败报出真实原因', async () => {
    const harness = createSearchHarness()

    harness.store.searchMessages({ query: '早安' })
    await settle()
    // 控制台 RPC 会把异常序列化成带堆栈的纯字符串。
    harness.deferreds[0].reject('Error: 群历史接口不可用\n    at foo')
    await settle()

    expect(harness.store.messageSearchErrorText.value).toBe('群历史接口不可用')
    expect(harness.store.messageSearchSearched.value).toBe(true)
    expect(harness.store.messageSearchLoading.value).toBe(false)
  })

  it('翻页带上续查游标，已有命中不消失也不重复', async () => {
    const harness = createSearchHarness()

    harness.store.searchMessages({ query: '早安' })
    await settle()
    harness.deferreds[0].resolve({
      messages: [createMessage('m2', '早安 2', 2000)],
      scannedCount: 4,
      exhausted: false,
      nextBeforeSequence: 'seq-2',
    })
    await settle()
    expect(harness.store.messageSearchExhausted.value).toBe(false)

    harness.store.searchMoreMessages()
    await settle()

    // 翻页不再读一遍浏览器缓存，也不清空已经看到的命中。
    expect(harness.cacheReads).toEqual(['group:20000'])
    expect(harness.queries[1].beforeSequence).toBe('seq-2')
    expect(harness.resultIds()).toEqual(['m2'])
    expect(harness.store.messageSearchLoading.value).toBe(true)

    harness.deferreds[1].resolve({
      messages: [createMessage('m1', '早安 1', 1000), createMessage('m2', '早安 2', 2000)],
      scannedCount: 4,
      exhausted: true,
    })
    await settle()

    expect(harness.resultIds()).toEqual(['m1', 'm2'])
    expect(harness.store.messageSearchExhausted.value).toBe(true)

    harness.store.searchMoreMessages()
    await settle()
    expect(harness.queries[2].beforeSequence).toBeUndefined()
  })

  it('命中落地后先并进消息列表，渲染完成才滚过去', async () => {
    const harness = createSearchHarness({ messages: [createMessage('m0', '旧消息', 500)] })

    const landing = harness.store.selectSearchResult(createMessage('m9', '命中', 9000))
    expect(harness.messages.value.map((message) => message.id)).toEqual(['m0', 'm9'])
    expect(harness.metadataCalls).toEqual([{ key: 'group:20000', ids: ['m9'] }])
    // 命中还没渲染出来，这时候滚过去会落空。
    expect(harness.scrolledKeys).toEqual([])

    await landing
    expect(harness.scrolledKeys).toEqual(['m9'])

    await harness.store.selectSearchResult(createMessage('', '没有 id 的命中', 8000, 'seq-8'))
    expect(harness.scrolledKeys).toEqual(['m9', 'seq-8'])
  })

  it('关闭时重置全部状态、丢弃在途结果并把焦点还回触发按钮', async () => {
    const harness = createSearchHarness()

    harness.store.searchMessages({ query: '早安', localDate: '2026-03-15' })
    await settle()
    expect(harness.store.messageSearchQuery.value).toBe('早安')
    expect(harness.store.messageSearchLocalDate.value).toBe('2026-03-15')

    harness.store.closeMessageSearch()

    expect(harness.store.messageSearchOpen.value).toBe(false)
    expect(harness.store.messageSearchQuery.value).toBe('')
    expect(harness.store.messageSearchLocalDate.value).toBe('')
    expect(harness.store.messageSearchResults.value).toEqual([])
    expect(harness.store.messageSearchSearched.value).toBe(false)
    expect(harness.store.messageSearchExhausted.value).toBe(true)
    expect(harness.store.messageSearchLoading.value).toBe(false)
    expect(harness.focusRestores()).toBe(1)

    harness.deferreds[0].resolve({ messages: [createMessage('m1', '早安', 1000)], scannedCount: 1, exhausted: true })
    await settle()
    expect(harness.store.messageSearchResults.value).toEqual([])

    // 已经关掉了就不该再抢一次焦点。
    harness.store.closeMessageSearch()
    expect(harness.focusRestores()).toBe(1)
  })

  it('打开时重置上一次的结果，没有当前会话则不打开', () => {
    const harness = createSearchHarness()
    harness.store.messageSearchResults.value = [createMessage('m1', '旧命中', 1000)]
    harness.store.messageSearchSearched.value = true
    harness.store.messageSearchErrorText.value = '上一次的错误'
    harness.store.messageSearchExhausted.value = false

    harness.store.openMessageSearch()

    expect(harness.store.messageSearchOpen.value).toBe(true)
    expect(harness.store.messageSearchResults.value).toEqual([])
    expect(harness.store.messageSearchSearched.value).toBe(false)
    expect(harness.store.messageSearchErrorText.value).toBe('')
    expect(harness.store.messageSearchExhausted.value).toBe(true)

    harness.store.closeMessageSearch()
    harness.currentChat.value = undefined
    harness.store.openMessageSearch()
    expect(harness.store.messageSearchOpen.value).toBe(false)
  })
})
