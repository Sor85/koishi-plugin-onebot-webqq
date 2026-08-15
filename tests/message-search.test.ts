import { describe, expect, it, vi } from 'vitest'
import type { WebQQMessage } from '../src/webqq/types'
import { searchWebQQMessageHistory } from '../src/webqq/message-search'

function createMessage(sequence: number, summary: string, elements: WebQQMessage['elements'] = [{ type: 'text', text: summary }]): WebQQMessage {
  return {
    id: `message-${sequence}`,
    sequence: String(sequence),
    time: sequence,
    senderId: '10000',
    senderName: sequence % 2 ? 'Alice' : 'Bob',
    senderAvatar: '',
    direction: 'incoming',
    summary,
    elements,
  }
}

describe('WebQQ message search', () => {
  it('scans paginated history and matches message text fields', async () => {
    const pages = [
      [createMessage(3, '普通消息'), createMessage(4, '包含关键词')],
      [createMessage(1, '语音消息', [{ type: 'record', transcript: '关键词转写' }]), createMessage(2, '另一条消息')],
      [],
    ]
    const loadMessages = vi.fn(async () => pages.shift() ?? [])

    await expect(searchWebQQMessageHistory({
      type: 'group',
      peerId: '20000',
      keyword: '关键词',
    }, {
      pageSize: 2,
      maxPages: 10,
      loadMessages,
    })).resolves.toEqual({
      messages: [createMessage(4, '包含关键词'), createMessage(1, '语音消息', [{ type: 'record', transcript: '关键词转写' }])],
      scannedCount: 4,
      exhausted: true,
    })
    expect(loadMessages).toHaveBeenNthCalledWith(1, {
      type: 'group',
      peerId: '20000',
      limit: 2,
    })
    expect(loadMessages).toHaveBeenNthCalledWith(2, {
      type: 'group',
      peerId: '20000',
      limit: 2,
      beforeSequence: '3',
    })
  })

  it('filters by a local-day range with or without a keyword', async () => {
    const target = createMessage(3, '目标消息')
    target.time = new Date('2026-08-14T12:00:00+08:00').getTime()
    const outside = createMessage(2, '目标消息')
    outside.time = new Date('2026-08-13T23:59:59+08:00').getTime()
    const start = new Date('2026-08-14T00:00:00+08:00').toISOString()
    const end = new Date('2026-08-15T00:00:00+08:00').toISOString()

    await expect(searchWebQQMessageHistory({
      type: 'friend',
      peerId: '30000',
      keyword: '',
      createdAtStart: start,
      createdAtEnd: end,
    }, {
      pageSize: 2,
      maxPages: 10,
      loadMessages: vi.fn()
        .mockResolvedValueOnce([outside, target])
        .mockResolvedValueOnce([]),
    })).resolves.toEqual({
      messages: [target],
      scannedCount: 2,
      exhausted: true,
    })
  })

  it('returns a continuation cursor when the scan reaches its page budget', async () => {
    const loadMessages = vi.fn(async ({ beforeSequence }: { beforeSequence?: string }) => (
      beforeSequence ? [createMessage(1, '目标'), createMessage(2, '普通')] : [createMessage(3, '普通'), createMessage(4, '普通')]
    ))

    await expect(searchWebQQMessageHistory({
      type: 'friend',
      peerId: '30000',
      keyword: '目标',
    }, {
      pageSize: 2,
      maxPages: 2,
      loadMessages,
    })).resolves.toEqual({
      messages: [createMessage(1, '目标')],
      scannedCount: 4,
      exhausted: false,
      nextBeforeSequence: '1',
    })
  })

  it('stops when an adapter repeats the same page boundary', async () => {
    const page = [createMessage(3, '普通'), createMessage(4, '普通')]
    const loadMessages = vi.fn(async () => page)

    const result = await searchWebQQMessageHistory({
      type: 'group',
      peerId: '20000',
      keyword: '不存在',
    }, {
      pageSize: 2,
      maxPages: 10,
      loadMessages,
    })

    expect(result).toEqual({ messages: [], scannedCount: 2, exhausted: true })
    expect(loadMessages).toHaveBeenCalledTimes(2)
  })

  it('searches persisted cache first and then continues OneBot pages without duplicating hits', async () => {
    const cachedHit = createMessage(5, '缓存关键词')
    const remoteHit = createMessage(8, '接口关键词')
    const loadCachedMessages = vi.fn(async () => [cachedHit, createMessage(6, '缓存普通')])
    const loadMessages = vi.fn()
      .mockResolvedValueOnce([remoteHit, cachedHit])
      .mockResolvedValueOnce([])

    await expect(searchWebQQMessageHistory({
      type: 'group',
      peerId: '20000',
      keyword: '关键词',
    }, {
      pageSize: 2,
      maxPages: 10,
      loadCachedMessages,
      loadMessages,
    })).resolves.toEqual({
      messages: [cachedHit, remoteHit],
      scannedCount: 3,
      exhausted: true,
    })
    expect(loadCachedMessages).toHaveBeenCalledTimes(1)
    expect(loadMessages).toHaveBeenNthCalledWith(1, {
      type: 'group',
      peerId: '20000',
      limit: 2,
    })
  })

  it('does not reload the cache when continuing from a history cursor', async () => {
    const loadCachedMessages = vi.fn(async () => [createMessage(9, '关键词')])
    const loadMessages = vi.fn(async () => [createMessage(2, '普通'), createMessage(1, '关键词')])

    await expect(searchWebQQMessageHistory({
      type: 'friend',
      peerId: '30000',
      keyword: '关键词',
      beforeSequence: '3',
    }, {
      pageSize: 2,
      maxPages: 1,
      loadCachedMessages,
      loadMessages,
    })).resolves.toEqual({
      messages: [createMessage(1, '关键词')],
      scannedCount: 2,
      exhausted: false,
      nextBeforeSequence: '2',
    })
    expect(loadCachedMessages).not.toHaveBeenCalled()
  })

  it('returns cached hits when OneBot history never responds', async () => {
    const cachedHit = createMessage(5, '缓存关键词')
    const result = await searchWebQQMessageHistory({
      type: 'group',
      peerId: '20000',
      keyword: '关键词',
    }, {
      pageSize: 2,
      maxPages: 10,
      pageTimeoutMs: 20,
      searchTimeoutMs: 40,
      loadCachedMessages: async () => [cachedHit],
      loadMessages: () => new Promise(() => {}),
    })

    expect(result.messages).toEqual([cachedHit])
    expect(result.scannedCount).toBe(1)
    expect(result.exhausted).toBe(true)
  })
})
