import { describe, expect, it, vi } from 'vitest'
import { createOneBotWebQQService } from '../src/onebot'

describe('onebot webqq adapter', () => {
  it('loads friends and groups through the OneBot request API', async () => {
    const request = vi.fn(async (action: string) => {
      if (action === 'get_friend_list') return [{
        user_id: 30000,
        nickname: 'Alice',
      }]
      if (action === 'get_group_list') return [{
        group_id: 20000,
        group_name: 'General',
      }]
      return []
    })
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        _request: request,
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadContacts()).resolves.toMatchObject({
      friends: [{
        userId: '30000',
        name: 'Alice',
      }],
      groups: [{
        groupId: '20000',
        name: 'General',
      }],
    })
    expect(request).toHaveBeenCalledWith('get_friend_list', {})
    expect(request).toHaveBeenCalledWith('get_group_list', {})
  })

  it('loads friends and groups from the selected OneBot bot', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => [{
          user_id: 30000,
          nickname: 'Alice',
          remark: 'Alice Remark',
        }]),
        get_group_list: vi.fn(async () => [{
          group_id: 20000,
          group_name: 'General',
          member_count: 12,
        }]),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadContacts()).resolves.toEqual({
      friends: [{
        userId: '30000',
        name: 'Alice Remark',
        nickname: 'Alice',
        avatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
      }],
      groups: [{
        groupId: '20000',
        name: 'General',
        memberCount: 12,
        avatar: 'https://p.qlogo.cn/gh/20000/20000/640/',
      }],
    })
  })

  it('loads group and friend history without calling send actions', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 1,
            message_seq: 11,
            time: 1710000000,
            group_id: 20000,
            user_id: 30000,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'text', data: { text: 'hello group' } }],
          }],
        })),
        get_friend_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 2,
            message_seq: 12,
            time: 1710000001,
            user_id: 10000,
            sender: {
              user_id: 10000,
              nickname: 'Capsule Bot',
            },
            message: 'hello friend',
          }],
        })),
        send_msg: vi.fn(),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([{
      id: '1',
      sequence: '11',
      time: 1710000000000,
      senderId: '30000',
      senderName: 'Alice',
      senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
      direction: 'incoming',
      summary: 'hello group',
      elements: [{ type: 'text', text: 'hello group' }],
    }])
    await expect(service.loadMessages({ type: 'friend', peerId: '30000', limit: 20 })).resolves.toEqual([{
      id: '2',
      sequence: '12',
      time: 1710000001000,
      senderId: '10000',
      senderName: 'Capsule Bot',
      senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=10000&s=640',
      direction: 'outgoing',
      summary: 'hello friend',
      elements: [{ type: 'text', text: 'hello friend' }],
    }])

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      message_seq: 0,
      count: 20,
    })
    expect(bot.internal.get_friend_msg_history).toHaveBeenCalledWith({
      user_id: 30000,
      message_seq: 0,
      count: 20,
    })
    expect(bot.internal.send_msg).not.toHaveBeenCalled()
  })

  it('adds LLBot history ordering parameter only for the LLBot protocol', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        get_friend_msg_history: vi.fn(async () => ({ messages: [] })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] }, { protocol: 'llbot' })

    await service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })
    await service.loadMessages({ type: 'friend', peerId: '30000', limit: 10 })

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      message_seq: 0,
      count: 20,
      reverseOrder: false,
    })
    expect(bot.internal.get_friend_msg_history).toHaveBeenCalledWith({
      user_id: 30000,
      message_seq: 0,
      count: 10,
      reverseOrder: false,
    })
  })

  it('passes the oldest loaded message sequence when loading earlier history', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await service.loadMessages({ type: 'group', peerId: '20000', limit: 20, beforeSequence: '42' })

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      message_seq: 42,
      count: 20,
    })
  })
})
