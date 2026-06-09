import { describe, expect, it, vi } from 'vitest'
import type { WebQQMessage } from '../client/state'

const clientMock = vi.hoisted(() => ({
  send: vi.fn(async () => undefined),
}))

vi.mock('@koishijs/client', () => ({
  send: clientMock.send,
}))

const { saveCachedWebQQMessages } = await import('../client/stores/webqq-storage')

function createWebQQMessage(id: string): WebQQMessage {
  return {
    id,
    sequence: id,
    time: 1710000000000,
    senderId: '10000',
    senderName: 'Bot',
    senderAvatar: '',
    direction: 'incoming',
    summary: id,
    elements: [{ type: 'text', text: id }],
  }
}

describe('webqq client storage', () => {
  it('applies the message cache limit before saving to the Koishi backend', async () => {
    clientMock.send.mockClear()

    await saveCachedWebQQMessages('group', '20000', [
      createWebQQMessage('first'),
      createWebQQMessage('second'),
      createWebQQMessage('third'),
    ], 'koishi', 2)

    expect(clientMock.send).toHaveBeenCalledWith('onebot-webqq/webqq/messages/cache/save', {
      type: 'group',
      peerId: '20000',
      messages: [
        expect.objectContaining({ id: 'second' }),
        expect.objectContaining({ id: 'third' }),
      ],
    })
  })
})
