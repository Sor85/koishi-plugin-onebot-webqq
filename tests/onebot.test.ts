import { describe, expect, it, vi } from 'vitest'
import { createOneBotWebQQService } from '../src/onebot'

describe('onebot webqq adapter', () => {
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
      direction: 'outgoing',
      summary: 'hello friend',
      elements: [{ type: 'text', text: 'hello friend' }],
    }])

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      count: 20,
    })
    expect(bot.internal.get_friend_msg_history).toHaveBeenCalledWith({
      user_id: 30000,
      count: 20,
    })
    expect(bot.internal.send_msg).not.toHaveBeenCalled()
  })
})
