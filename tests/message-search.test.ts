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
})
