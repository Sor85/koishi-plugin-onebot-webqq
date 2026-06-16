import { describe, expect, it, vi } from 'vitest'

const sendState = vi.hoisted((): { response: unknown } => ({
  response: undefined,
}))

vi.mock('@koishijs/client', () => ({
  send: vi.fn(async () => sendState.response),
}))

const { send } = await import('@koishijs/client')
const {
  selectWebQQBot,
  requestWebQQContacts,
  requestWebQQGroupInfo,
  requestWebQQMessages,
  requestWebQQNotices,
  requestWebQQRecordTranscription,
} = await import('../client/api/webqq')

describe('webqq client api', () => {
  it('normalizes invalid backend payloads to safe defaults', async () => {
    sendState.response = { friends: {}, groups: null }
    await expect(requestWebQQContacts()).resolves.toEqual({ friends: [], groups: [] })

    sendState.response = [
      {
        id: 'message-1',
        sequence: 'message-1',
        time: 1,
        senderId: '10000',
        senderName: 'Bot',
        senderAvatar: '',
        direction: 'incoming',
        summary: 'hello',
        elements: [{ type: 'text', text: 'hello' }],
      },
      {},
      [],
    ]
    await expect(requestWebQQMessages({ type: 'group', peerId: '20000' })).resolves.toEqual([{
      id: 'message-1',
      sequence: 'message-1',
      time: 1,
      senderId: '10000',
      senderName: 'Bot',
      senderAvatar: '',
      direction: 'incoming',
      summary: 'hello',
      elements: [{ type: 'text', text: 'hello' }],
    }])

    sendState.response = { announcements: {}, members: null }
    await expect(requestWebQQGroupInfo('20000')).resolves.toEqual({ announcements: [], members: [] })

    sendState.response = [{ id: 'notice-1' }, []]
    await expect(requestWebQQNotices()).resolves.toEqual([])

    sendState.response = { text: 'not a string' }
    await expect(requestWebQQRecordTranscription('message-1')).resolves.toBe('')
  })

  it('requests backend onebot robot switching', async () => {
    await selectWebQQBot('10001')

    expect(send).toHaveBeenCalledWith('onebot-webqq/webqq/bot/select', { selfId: '10001' })
  })
})
