import { describe, expect, it } from 'vitest'
import { applyCachedWebQQSenderMetadata, rememberWebQQSenderMetadata } from '../client/webqq/sender-metadata'
import type { WebQQMessage } from '../client/webqq/types'

function createMessage(message: Partial<WebQQMessage>): WebQQMessage {
  return {
    id: message.id || '1',
    sequence: message.sequence || '1',
    time: message.time || 1710000000000,
    senderId: message.senderId || '30000',
    senderName: message.senderName || 'Alice',
    senderAvatar: message.senderAvatar || 'https://example.com/avatar.png',
    direction: message.direction || 'incoming',
    summary: message.summary || 'hello',
    elements: message.elements || [{ type: 'text', text: 'hello' }],
    ...message,
  }
}

describe('webqq sender metadata cache', () => {
  it('fills live messages from cached history metadata in the same conversation', () => {
    const cache = rememberWebQQSenderMetadata({}, 'group', '20000', [createMessage({
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })])

    const message = applyCachedWebQQSenderMetadata(cache, 'group', '20000', createMessage({
      id: 'live-1',
      sequence: 'live-1',
      time: 1710000001000,
      summary: 'live',
      elements: [{ type: 'text', text: 'live' }],
    }))

    expect(message).toMatchObject({
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('keeps sender metadata scoped by conversation and sender', () => {
    const cache = rememberWebQQSenderMetadata({}, 'group', '20000', [createMessage({
      senderId: '30000',
      senderRole: '管理员',
      senderLevel: '100',
    })])

    expect(applyCachedWebQQSenderMetadata(cache, 'group', '30000', createMessage({ senderId: '30000' }))).not.toHaveProperty('senderRole')
    expect(applyCachedWebQQSenderMetadata(cache, 'group', '20000', createMessage({ senderId: '40000' }))).not.toHaveProperty('senderRole')
  })

  it('updates the cache only when sender metadata changes', () => {
    const first = rememberWebQQSenderMetadata({}, 'group', '20000', [createMessage({
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '旧头衔',
    })])
    const unchanged = rememberWebQQSenderMetadata(first, 'group', '20000', [createMessage({
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '旧头衔',
    })])
    const changed = rememberWebQQSenderMetadata(unchanged, 'group', '20000', [createMessage({
      senderRole: '群主',
      senderLevel: '101',
      senderTitle: '新头衔',
    })])

    expect(unchanged).toBe(first)
    expect(changed).not.toBe(unchanged)
    expect(applyCachedWebQQSenderMetadata(changed, 'group', '20000', createMessage({ id: 'live-2' }))).toMatchObject({
      senderRole: '群主',
      senderLevel: '101',
      senderTitle: '新头衔',
    })
  })

  it('does not overwrite metadata already present on a message', () => {
    const cache = rememberWebQQSenderMetadata({}, 'group', '20000', [createMessage({
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '缓存头衔',
    })])

    expect(applyCachedWebQQSenderMetadata(cache, 'group', '20000', createMessage({
      senderRole: '群主',
      senderLevel: '101',
      senderTitle: '消息头衔',
    }))).toMatchObject({
      senderRole: '群主',
      senderLevel: '101',
      senderTitle: '消息头衔',
    })
  })
})
