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
              card: '群昵称',
              role: 'owner',
              level: '100',
              title: '彩色头衔',
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
      senderName: '群昵称',
      senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
      senderRole: '群主',
      senderLevel: '100',
      senderTitle: '彩色头衔',
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

  it('does not expose normal group member roles as sender badges', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 10,
            message_seq: 20,
            time: 1710000010,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
              role: 'member',
            },
            message: [{ type: 'text', data: { text: 'normal member' } }],
          }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.not.objectContaining({
        senderRole: expect.any(String),
      }),
    ])
  })

  it('resolves image file ids from history messages through get_image', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 3,
            message_seq: 13,
            time: 1710000002,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'image', data: { file: 'abc.image' } }],
          }],
        })),
        get_image: vi.fn(async () => ({
          url: 'https://example.com/abc.jpg',
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([{
      id: '3',
      sequence: '13',
      time: 1710000002000,
      senderId: '30000',
      senderName: 'Alice',
      senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
      direction: 'incoming',
      summary: '[图片]',
      elements: [{ type: 'image', url: 'https://example.com/abc.jpg' }],
    }])
    expect(bot.internal.get_image).toHaveBeenCalledWith({
      file: 'abc.image',
    })
  })

  it('converts local get_image file paths to browser-accessible image URLs', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 4,
            message_seq: 14,
            time: 1710000003,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'image', data: { file: 'local.image' } }],
          }],
        })),
        get_image: vi.fn(async () => ({
          file: '/tmp/llbot-image.jpg',
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] }, {
      imageUrlResolver: (file) => `/chat-capsule/webqq/image/${encodeURIComponent(file)}`,
    })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[图片]',
        elements: [{ type: 'image', url: '/chat-capsule/webqq/image/%2Ftmp%2Fllbot-image.jpg' }],
      }),
    ])
  })

  it('converts remote get_image URLs to browser-accessible image URLs when a resolver is available', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 5,
            message_seq: 15,
            time: 1710000004,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'image', data: { file: 'remote.image' } }],
          }],
        })),
        get_image: vi.fn(async () => ({
          url: 'https://multimedia.nt.qq.com.cn/download?fileid=remote',
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] }, {
      imageUrlResolver: (file) => `/chat-capsule/webqq/image/${encodeURIComponent(file)}`,
    })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[图片]',
        elements: [{
          type: 'image',
          url: '/chat-capsule/webqq/image/https%3A%2F%2Fmultimedia.nt.qq.com.cn%2Fdownload%3Ffileid%3Dremote',
        }],
      }),
    ])
  })

  it('renders reply segments as quote elements without adding them to the message summary', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 6,
            message_seq: 16,
            time: 1710000005,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [
              { type: 'reply', data: { id: 'quoted-1' } },
              { type: 'text', data: { text: '这还差不多' } },
            ],
          }],
        })),
        get_msg: vi.fn(async () => ({
          message_id: 'quoted-1',
          sender: {
            user_id: 40000,
            nickname: '彩虹猫',
          },
          message: [{ type: 'text', data: { text: '宁宁摸摸头' } }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '这还差不多',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    ])
    expect(bot.internal.get_msg).toHaveBeenCalledWith({
      message_id: 'quoted-1',
    })
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

  it('loads group system notices with avatars and request results', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_group_system_msg: vi.fn(async () => ({
          data: {
            join_requests: [{
              request_id: 'join-1',
              group_id: 20000,
              group_name: 'General',
              requester_uin: 30000,
              requester_nick: 'Alice',
              message: '申请入群',
              checked: false,
            }, {
              request_id: 'join-2',
              group_id: 20000,
              group_name: 'General',
              requester_uin: 40000,
              requester_nick: 'Bob',
              approved: false,
              checked: true,
            }],
          },
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadNotices()).resolves.toEqual([{
      id: 'group:join-1',
      type: 'group-notice',
      title: 'General',
      subtitle: 'Alice 申请加入群聊',
      avatar: 'https://p.qlogo.cn/gh/20000/20000/640/',
      status: 'pending',
      time: 0,
      flag: 'join-1',
      subType: 'add',
      groupId: '20000',
      groupName: 'General',
      requesterId: '30000',
      requesterName: 'Alice',
      comment: '申请入群',
    }, {
      id: 'group:join-2',
      type: 'group-notice',
      title: 'General',
      subtitle: 'Bob 申请加入群聊',
      avatar: 'https://p.qlogo.cn/gh/20000/20000/640/',
      status: 'rejected',
      time: 0,
      flag: 'join-2',
      subType: 'add',
      groupId: '20000',
      groupName: 'General',
      requesterId: '40000',
      requesterName: 'Bob',
    }])
    expect(bot.internal.get_group_system_msg).toHaveBeenCalledWith({})
  })

  it('handles friend and group notice actions through OneBot APIs', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        set_friend_add_request: vi.fn(async () => ({})),
        set_group_add_request: vi.fn(async () => ({})),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await service.handleNotice({ id: 'friend:friend-flag', type: 'friend-request', flag: 'friend-flag', approve: true })
    await service.handleNotice({ id: 'group:group-flag', type: 'group-notice', flag: 'group-flag', subType: 'add', approve: false })

    expect(bot.internal.set_friend_add_request).toHaveBeenCalledWith({
      flag: 'friend-flag',
      approve: true,
    })
    expect(bot.internal.set_group_add_request).toHaveBeenCalledWith({
      flag: 'group-flag',
      sub_type: 'add',
      approve: false,
    })
  })
})
