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
} = await import('../client/webqq/api/webqq')

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
        elements: [{ type: 'face', text: '[表情 264]', emojiUrl: 'https://koishi.js.org/QFace/gif/s264.gif' }],
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
      elements: [{ type: 'face', text: '[表情 264]', emojiUrl: 'https://koishi.js.org/QFace/gif/s264.gif' }],
    }])

    sendState.response = { announcements: {}, members: null }
    await expect(requestWebQQGroupInfo('20000')).resolves.toEqual({ announcements: [], members: [] })

    sendState.response = [{ id: 'notice-1' }, []]
    await expect(requestWebQQNotices()).resolves.toEqual([])

    sendState.response = { text: 'not a string' }
    await expect(requestWebQQRecordTranscription('message-1')).resolves.toBe('')
  })

  it('preserves raw group roles for message recall permission checks', async () => {
    sendState.response = {
      announcements: [],
      members: [{
        userId: '10000',
        nickname: 'Bot',
        card: '',
        avatar: '',
        role: '管理员',
        rawRole: 'admin',
      }],
    }

    await expect(requestWebQQGroupInfo('20000')).resolves.toEqual({
      announcements: [],
      members: [expect.objectContaining({
        userId: '10000',
        rawRole: 'admin',
      })],
    })
  })

  it('preserves the mock environment marker from contacts', async () => {
    sendState.response = { friends: [], groups: [], mockEnvironment: true }

    await expect(requestWebQQContacts()).resolves.toEqual({
      friends: [],
      groups: [],
      mockEnvironment: true,
    })
  })

  it('keeps an empty reaction array as an authoritative cleared state', async () => {
    sendState.response = [{
      id: 'message-1',
      sequence: 'message-1',
      time: 1,
      senderId: '10000',
      senderName: 'Bot',
      senderAvatar: '',
      direction: 'incoming',
      summary: 'hello',
      elements: [{ type: 'text', text: 'hello' }],
      reactions: [],
    }]

    await expect(requestWebQQMessages({ type: 'group', peerId: '20000' })).resolves.toEqual([
      expect.objectContaining({ reactions: [] }),
    ])
  })

  it('requests backend onebot robot switching', async () => {
    await selectWebQQBot('10001')

    expect(send).toHaveBeenCalledWith('onebot-webqq/webqq/bot/select', { selfId: '10001' })
  })
})
