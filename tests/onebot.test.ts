import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { createOneBotWebQQService } from '../src/onebot'

const onebotSource = await readFile(new URL('../src/onebot/index.ts', import.meta.url), 'utf8')
const onebotDataSource = await readFile(new URL('../src/onebot/data.ts', import.meta.url), 'utf8')
const onebotActionsSource = await readFile(new URL('../src/onebot/actions.ts', import.meta.url), 'utf8')
const onebotTypesSource = await readFile(new URL('../src/onebot/types.ts', import.meta.url), 'utf8')
const onebotAdapterSource = await readFile(new URL('../src/webqq/adapters/onebot/service.ts', import.meta.url), 'utf8')
const onebotTextSource = await readFile(new URL('../src/webqq/adapters/onebot/text.ts', import.meta.url), 'utf8')
const onebotCardSource = await readFile(new URL('../src/webqq/adapters/onebot/card.ts', import.meta.url), 'utf8')
const onebotNoticesSource = await readFile(new URL('../src/webqq/adapters/onebot/notices.ts', import.meta.url), 'utf8')
const onebotGroupInfoSource = await readFile(new URL('../src/webqq/adapters/onebot/group-info.ts', import.meta.url), 'utf8')
const onebotContactsSource = await readFile(new URL('../src/webqq/adapters/onebot/contacts.ts', import.meta.url), 'utf8')
const onebotImagesSource = await readFile(new URL('../src/webqq/adapters/onebot/images.ts', import.meta.url), 'utf8')
const onebotMessagesSource = await readFile(new URL('../src/webqq/adapters/onebot/messages.ts', import.meta.url), 'utf8')
const webqqDisplaySource = await readFile(new URL('../src/webqq/display.ts', import.meta.url), 'utf8')
const webqqTypesSource = await readFile(new URL('../src/webqq/types.ts', import.meta.url), 'utf8')

describe('onebot webqq adapter', () => {
  it('keeps OneBot WebQQ public types outside the adapter entry', () => {
    expect(onebotSource).toContain("from './types'")
    expect(onebotSource).not.toContain('export interface WebQQMessage {')
    expect(onebotSource).not.toContain('export interface WebQQContacts {')
    expect(onebotTypesSource).toContain("from '../webqq/types'")
    expect(onebotTypesSource).not.toContain('export interface WebQQMessage')
    expect(onebotTypesSource).not.toContain('export interface WebQQContacts')
    expect(webqqTypesSource).toContain('export interface WebQQMessage')
    expect(webqqTypesSource).toContain('export interface WebQQContacts')
  })

  it('keeps OneBot data field helpers outside the adapter entry', () => {
    expect(onebotAdapterSource).toContain("from '../../../onebot/data'")
    expect(onebotSource).not.toContain('function toArrayResult(')
    expect(onebotSource).not.toContain('function getActionData(')
    expect(onebotDataSource).toContain("from '../shared/record'")
    expect(onebotDataSource).toContain('export function toArrayResult')
    expect(onebotDataSource).toContain('export function getActionData')
  })

  it('keeps OneBot text markup helpers outside the adapter entry', () => {
    expect(onebotAdapterSource).toContain("from './text'")
    expect(onebotSource).not.toContain('function normalizeMentionMarkupText(')
    expect(onebotSource).not.toContain('function getTextValue(')
    expect(onebotTextSource).toContain('export function normalizeMentionMarkupText')
    expect(onebotTextSource).toContain('export function getTextValue')
  })

  it('keeps OneBot card payload helpers outside the adapter entry', () => {
    expect(onebotMessagesSource).toContain("from './card'")
    expect(onebotSource).not.toContain("from './card'")
    expect(onebotSource).not.toContain('function normalizeCardElement(')
    expect(onebotCardSource).toContain('export function normalizeCardElement')
  })

  it('keeps OneBot display field helpers in shared OneBot data helpers', () => {
    expect(onebotSource).not.toContain("from './display'")
    expect(onebotSource).not.toContain('function getUserAvatar(')
    expect(onebotSource).not.toContain('function normalizeGroupRole(')
    expect(onebotDataSource).not.toContain('export function getUserAvatar')
    expect(onebotDataSource).not.toContain('export function normalizeGroupRole')
    expect(webqqDisplaySource).toContain('export function getWebQQUserAvatar')
    expect(webqqDisplaySource).toContain('export function normalizeWebQQGroupRole')
  })

  it('keeps OneBot group notice normalization outside the adapter entry', () => {
    expect(onebotAdapterSource).toContain("from './notices'")
    expect(onebotSource).not.toContain('function normalizeGroupNotices(')
    expect(onebotNoticesSource).toContain('export function normalizeGroupNotices')
  })

  it('keeps OneBot group info normalization outside the adapter entry', () => {
    expect(onebotAdapterSource).toContain("from './group-info'")
    expect(onebotSource).not.toContain('function normalizeGroupMember(')
    expect(onebotSource).not.toContain('function normalizeGroupAnnouncement(')
    expect(onebotGroupInfoSource).toContain('export function normalizeGroupMember')
    expect(onebotGroupInfoSource).toContain('export function normalizeGroupAnnouncement')
  })

  it('keeps OneBot contact normalization outside the adapter entry', () => {
    expect(onebotAdapterSource).toContain("from './contacts'")
    expect(onebotSource).not.toContain('function getRecentPeerType(')
    expect(onebotSource).not.toContain('function normalizeFriend(')
    expect(onebotSource).not.toContain('function normalizeFriendCategory(')
    expect(onebotSource).not.toContain('function normalizeGroup(')
    expect(onebotContactsSource).toContain('export function getRecentPeerType')
    expect(onebotContactsSource).toContain('export function normalizeFriend')
    expect(onebotContactsSource).toContain('export function normalizeGroup')
  })

  it('keeps OneBot action selection outside the adapter entry', () => {
    expect(onebotAdapterSource).toContain("from '../../../onebot/actions'")
    expect(onebotSource).not.toContain('function selectBot(')
    expect(onebotSource).not.toContain('async function callAction(')
    expect(onebotSource).not.toContain('function supportsAction(')
    expect(onebotAdapterSource).toContain('supportsOneBotAction')
    expect(onebotActionsSource).toContain('export function selectBot')
    expect(onebotActionsSource).toContain('export async function callAction')
    expect(onebotActionsSource).toContain('export function supportsOneBotAction')
  })

  it('keeps OneBot image resolving outside the adapter entry', () => {
    expect(onebotAdapterSource).toContain("from './images'")
    expect(onebotSource).not.toContain('async function normalizeImageElement(')
    expect(onebotSource).not.toContain('async function resolveOneBotImage(')
    expect(onebotImagesSource).toContain('export async function normalizeImageElement')
    expect(onebotImagesSource).toContain('export async function resolveOneBotImage')
  })

  it('keeps OneBot message element display helpers with message normalization', () => {
    expect(onebotSource).not.toContain("from './message-elements'")
    expect(onebotSource).not.toContain('function normalizeFaceElement(')
    expect(onebotSource).not.toContain('function summarizeElements(')
    expect(onebotMessagesSource).toContain('export function normalizeFaceElement')
    expect(onebotMessagesSource).toContain('export function summarizeElements')
  })

  it('keeps OneBot message normalization outside the adapter entry', () => {
    expect(onebotAdapterSource).toContain("from './messages'")
    expect(onebotSource).not.toContain('async function normalizeSegment(')
    expect(onebotSource).not.toContain('async function normalizeMessage(')
    expect(onebotSource).not.toContain('async function resolveOneBotQuote(')
    expect(onebotSource).not.toContain('async function resolveOneBotForward(')
    expect(onebotMessagesSource).toContain('export async function normalizeMessage(')
    expect(onebotMessagesSource).toContain('export async function normalizeMessageElements(')
    expect(onebotMessagesSource).toContain('export async function resolveOneBotQuote(')
    expect(onebotMessagesSource).toContain('export async function resolveOneBotForward(')
  })

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

  it('loads friend categories and recent contacts when the OneBot implementation supports them', async () => {
    const request = vi.fn(async (action: string) => {
      if (action === 'get_friends_with_category') return [{
        categoryId: 1,
        categoryName: '家人',
        buddyList: [{
          user_id: 30000,
          nickname: 'Alice',
          remark: 'Alice Remark',
        }],
      }]
      if (action === 'get_group_list') return [{
        group_id: 20000,
        group_name: 'General',
      }]
      if (action === 'get_recent_contact') return [{
        chatType: 1,
        peerUin: 30000,
        remark: 'Alice Remark',
        peerName: 'Alice',
        msgTime: 1710000000,
        lastestMsg: {
          message_id: 1,
          message_seq: 11,
          time: 1710000000,
          sender: { user_id: 30000, nickname: 'Alice' },
          message: [{ type: 'text', data: { text: 'hello recent friend' } }],
        },
      }, {
        chatType: 2,
        peerUin: 20000,
        peerName: 'General',
        msgTime: 1710000001,
        lastestMsg: {
          message_id: 2,
          message_seq: 12,
          time: 1710000001,
          sender: { user_id: 30000, nickname: 'Alice' },
          message: [{ type: 'text', data: { text: 'hello recent group' } }],
        },
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
        name: 'Alice Remark',
        categoryName: '家人',
      }],
      friendCategories: [{
        id: '1',
        name: '家人',
        friends: [{
          userId: '30000',
          name: 'Alice Remark',
        }],
      }],
      recent: [{
        type: 'friend',
        peerId: '30000',
        name: 'Alice Remark',
        summary: 'hello recent friend',
        time: 1710000000000,
      }, {
        type: 'group',
        peerId: '20000',
        name: 'General',
        summary: 'hello recent group',
        time: 1710000001000,
      }],
    })
    expect(request).toHaveBeenCalledWith('get_friends_with_category', {})
    expect(request).toHaveBeenCalledWith('get_recent_contact', { count: 50 })
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

  it('skips connecting OneBot bots when loading contacts', async () => {
    const connectingBot = {
      platform: 'onebot',
      selfId: '10000',
      status: 2,
      internal: {
        get_friend_list: vi.fn(async () => [{
          user_id: 30000,
          nickname: 'Connecting Bot Friend',
        }]),
        get_group_list: vi.fn(async () => []),
      },
    }
    const onlineBot = {
      platform: 'onebot',
      selfId: '10001',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => [{
          user_id: 30001,
          nickname: 'Online Bot Friend',
        }]),
        get_group_list: vi.fn(async () => []),
      },
    }
    const service = createOneBotWebQQService({ bots: [connectingBot, onlineBot] })

    await expect(service.loadContacts()).resolves.toMatchObject({
      friends: [{
        userId: '30001',
        name: 'Online Bot Friend',
      }],
    })
    expect(connectingBot.internal.get_friend_list).not.toHaveBeenCalled()
    expect(onlineBot.internal.get_friend_list).toHaveBeenCalled()
  })

  it('adds mock OneBot profiles and maps selected mock bots back to the real bot', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      name: 'Capsule Bot',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] }, { mockBotCount: 2 })

    expect(service.listBots()).toEqual([
      expect.objectContaining({
        selfId: '10000',
        name: 'Capsule Bot',
      }),
      expect.objectContaining({
        selfId: '10000:mock:1',
        name: 'Capsule Bot 模拟 1',
      }),
      expect.objectContaining({
        selfId: '10000:mock:2',
        name: 'Capsule Bot 模拟 2',
      }),
    ])

    expect(service.selectSelfId('10000:mock:1')).toBe('10000:mock:1')
    expect(service.isSelectedSelfId('10000')).toBe(true)
    await expect(service.loadContacts()).resolves.toEqual({ friends: [], groups: [] })
    expect(bot.internal.get_friend_list).toHaveBeenCalled()
  })

  it('uses the Satori bot user profile as the robot display profile', () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      user: {
        id: '10000',
        name: '酣眠睡意脑内排练',
        avatar: 'https://example.com/bot-avatar.png',
      },
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] }, { mockBotCount: 0 })

    expect(service.listBots()).toEqual([
      expect.objectContaining({
        selfId: '10000',
        name: '酣眠睡意脑内排练',
        avatar: 'https://example.com/bot-avatar.png',
      }),
    ])
  })

  it('loads group info with announcements and members', async () => {
    const request = vi.fn(async (action: string) => {
      if (action === 'get_group_member_list') return [{
        user_id: 30000,
        nickname: 'Alice',
        card: '群昵称',
        role: 'owner',
      }, {
        user_id: 40000,
        nickname: 'Bob',
      }]
      if (action === '_get_group_notice') return {
        data: [{
          fid: 'notice-1',
          title: '维护公告',
          message: {
            text: '今晚维护',
          },
          publish_time: 1710000000,
        }],
      }
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

    await expect(service.loadGroupInfo({ groupId: '20000' })).resolves.toEqual({
      announcements: [{
        id: 'notice-1',
        title: '维护公告',
        content: '今晚维护',
        time: 1710000000000,
      }],
      members: [{
        userId: '30000',
        nickname: 'Alice',
        card: '群昵称',
        avatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
        role: '群主',
      }, {
        userId: '40000',
        nickname: 'Bob',
        card: '',
        avatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
      }],
    })
    expect(request).toHaveBeenCalledWith('get_group_member_list', { group_id: 20000 })
    expect(request).toHaveBeenCalledWith('_get_group_notice', { group_id: 20000 })
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

  it('decodes text entities in plain OneBot text segments', async () => {
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
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'text', data: { text: 'A &amp; B &#91;ok&#93;' } }],
          }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: 'A & B [ok]',
        elements: [{ type: 'text', text: 'A & B [ok]' }],
      }),
    ])
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

  it('renders at segments as text in history messages', async () => {
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
            message: [
              { type: 'at', data: { qq: '10000', name: '宁宁' } },
              { type: 'text', data: { text: ' 在吗' } },
            ],
          }, {
            message_id: 4,
            message_seq: 14,
            time: 1710000003,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'at', data: { qq: '10001' } }],
          }, {
            message_id: 5,
            message_seq: 15,
            time: 1710000004,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [
              { type: 'at', data: { qq: '10000', name: '宁宁' } },
              { type: 'text', data: { text: '在吗' } },
            ],
          }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '@宁宁 在吗',
        elements: [
          { type: 'text', text: '@宁宁' },
          { type: 'text', text: ' 在吗' },
        ],
      }),
      expect.objectContaining({
        summary: '@10001',
        elements: [{ type: 'text', text: '@10001' }],
      }),
      expect.objectContaining({
        summary: '@宁宁在吗',
        elements: [
          { type: 'text', text: '@宁宁' },
          { type: 'text', text: '在吗' },
        ],
      }),
    ])
  })

  it('renders mface segments from history messages as readable face elements', async () => {
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
            message: [{ type: 'mface', data: { summary: '[开心]', emoji_id: '123' } }],
          }, {
            message_id: 6,
            message_seq: 16,
            time: 1710000005,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'mface', data: { emoji_id: '456' } }],
          }, {
            message_id: 7,
            message_seq: 17,
            time: 1710000006,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'mface', data: { id: '789' } }],
          }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[开心]',
        elements: [{ type: 'face', text: '[开心]' }],
      }),
      expect.objectContaining({
        summary: '[表情 456]',
        elements: [{ type: 'face', text: '[表情 456]' }],
      }),
      expect.objectContaining({
        summary: '[表情 789]',
        elements: [{ type: 'face', text: '[表情 789]' }],
      }),
    ])
  })

  it('renders history mface segments with URLs as image elements', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 8,
            message_seq: 18,
            time: 1710000007,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'mface', data: { summary: '[开心]', url: 'https://example.com/mface.gif', emoji_id: '123' } }],
          }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        elements: [{ type: 'image', url: 'https://example.com/mface.gif' }],
      }),
    ])
  })

  it('resolves history mface file ids through get_image', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 9,
            message_seq: 19,
            time: 1710000008,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'mface', data: { file: 'mface-file.image' } }],
          }, {
            message_id: 10,
            message_seq: 20,
            time: 1710000009,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'mface', data: { file_id: 'mface-file-id.image' } }],
          }],
        })),
        get_image: vi.fn(async ({ file }: { file: string }) => ({
          url: `https://example.com/${file}.jpg`,
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        elements: [{ type: 'image', url: 'https://example.com/mface-file.image.jpg' }],
      }),
      expect.objectContaining({
        elements: [{ type: 'image', url: 'https://example.com/mface-file-id.image.jpg' }],
      }),
    ])
    expect(bot.internal.get_image).toHaveBeenCalledWith({ file: 'mface-file.image' })
    expect(bot.internal.get_image).toHaveBeenCalledWith({ file: 'mface-file-id.image' })
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

  it('rejects unsafe image file values before calling get_image', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_image: vi.fn(async () => ({
          url: 'https://example.com/unsafe.jpg',
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.resolveImage('/etc/passwd')).rejects.toThrow('不安全')

    expect(bot.internal.get_image).not.toHaveBeenCalled()
  })

  it('renders history record segments with playable audio urls and duration', async () => {
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
            message: [{ type: 'record', data: { temp_url: 'https://example.com/voice.mp3', duration: 4, text: '你好' } }],
          }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] }, {
      imageUrlResolver: (file) => `/onebot-webqq/webqq/image/${encodeURIComponent(file)}`,
    })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[语音]',
        elements: [{
          type: 'record',
          text: '[语音]',
          url: '/onebot-webqq/webqq/image/https%3A%2F%2Fexample.com%2Fvoice.mp3',
          duration: 4,
          transcript: '你好',
        }],
      }),
    ])
  })

  it('resolves record file ids from history messages through get_record as mp3', async () => {
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
            message: [{ type: 'record', data: { file: 'voice.silk', duration: '7' } }],
          }],
        })),
        get_record: vi.fn(async () => ({
          file: '/tmp/voice.mp3',
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] }, {
      imageUrlResolver: (file) => `/onebot-webqq/webqq/image/${encodeURIComponent(file)}`,
    })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[语音]',
        elements: [{
          type: 'record',
          text: '[语音]',
          url: '/onebot-webqq/webqq/image/%2Ftmp%2Fvoice.mp3',
          duration: 7,
        }],
      }),
    ])
    expect(bot.internal.get_record).toHaveBeenCalledWith({
      file: 'voice.silk',
      out_format: 'mp3',
    })
  })

  it('rejects unsafe record file values before calling get_record', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_record: vi.fn(async () => ({
          url: 'https://example.com/unsafe.mp3',
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.resolveRecord('file:///etc/passwd')).rejects.toThrow('不安全')

    expect(bot.internal.get_record).not.toHaveBeenCalled()
  })

  it('transcribes record messages through the OneBot voice_msg_to_text action', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        voice_msg_to_text: vi.fn(async () => ({
          text: '语音内容',
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.transcribeRecord('12345')).resolves.toBe('语音内容')
    expect(bot.internal.voice_msg_to_text).toHaveBeenCalledWith({
      message_id: 12345,
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
      imageUrlResolver: (file) => `/onebot-webqq/webqq/image/${encodeURIComponent(file)}`,
    })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[图片]',
        elements: [{ type: 'image', url: '/onebot-webqq/webqq/image/%2Ftmp%2Fllbot-image.jpg' }],
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
      imageUrlResolver: (file) => `/onebot-webqq/webqq/image/${encodeURIComponent(file)}`,
    })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[图片]',
        elements: [{
          type: 'image',
          url: '/onebot-webqq/webqq/image/https%3A%2F%2Fmultimedia.nt.qq.com.cn%2Fdownload%3Ffileid%3Dremote',
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
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头', targetMessageId: 'quoted-1' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    ])
    expect(bot.internal.get_msg).toHaveBeenCalledWith({
      message_id: 'quoted-1',
    })
  })

  it('renders xml at mentions inside quoted messages as readable text', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 7,
            message_seq: 17,
            time: 1710000006,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [
              { type: 'reply', data: { id: 'quoted-xml-1' } },
              { type: 'text', data: { text: '收到' } },
            ],
          }],
        })),
        get_msg: vi.fn(async () => ({
          message_id: 'quoted-xml-1',
          sender: {
            user_id: 40000,
            nickname: '彩虹猫',
          },
          message: '<msg><at qq="10000" name="宁宁"/>摸摸头</msg>',
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '收到',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '@宁宁摸摸头', targetMessageId: 'quoted-xml-1' },
          { type: 'text', text: '收到' },
        ],
      }),
    ])
  })

  it('reads forward segments from history messages through get_forward_msg', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 8,
            message_seq: 18,
            time: 1710000007,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [{ type: 'forward', data: { id: 'forward-1' } }],
          }],
        })),
        get_forward_msg: vi.fn(async () => ({
          message: [{
            type: 'node',
            data: {
              user_id: 30000,
              nickname: 'Alice',
              content: [{ type: 'text', data: { text: '第一条' } }],
            },
          }, {
            type: 'node',
            data: {
              nickname: 'Bob',
              content: [
                { type: 'image', data: { url: 'https://example.com/forward.jpg' } },
                { type: 'text', data: { text: '第二条' } },
              ],
            },
          }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[合并转发]',
        elements: [{
          type: 'forward',
          title: '合并转发',
          text: 'Alice：第一条\nBob：[图片]第二条',
          items: [{
            title: 'Alice',
            senderId: '30000',
            senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
            elements: [{ type: 'text', text: '第一条' }],
          }, {
            title: 'Bob',
            senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=0&s=640',
            elements: [
              { type: 'image', url: 'https://example.com/forward.jpg' },
              { type: 'text', text: '第二条' },
            ],
          }],
        }],
      }),
    ])
    expect(bot.internal.get_forward_msg).toHaveBeenCalledWith({
      id: 'forward-1',
    })
  })

  it('renders json card segments from history messages', async () => {
    const cardPayload = JSON.stringify({
      prompt: '[分享] 春日影',
      meta: {
        music: {
          title: '春日影',
          desc: 'MyGO!!!!!',
          preview: 'https://example.com/cover.jpg',
          jumpUrl: 'https://example.com/song',
          tag: 'QQ音乐',
        },
      },
    })
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 9,
            message_seq: 19,
            time: 1710000008,
            sender: { user_id: 30000, nickname: 'Alice' },
            message: [{ type: 'json', data: { data: cardPayload } }],
          }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '春日影',
        elements: [{
          type: 'card',
          title: '春日影',
          text: 'MyGO!!!!!',
          url: 'https://example.com/song',
          imageUrl: 'https://example.com/cover.jpg',
          source: 'QQ音乐',
        }],
      }),
    ])
  })

  it('falls back xml card segments to a readable card message', async () => {
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
            time: 1710000009,
            sender: { user_id: 30000, nickname: 'Alice' },
            message: [{ type: 'xml', data: { data: '<msg serviceID="1" />' } }],
          }],
        })),
      },
    }
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadMessages({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        summary: '[卡片消息]',
        elements: [{ type: 'card', title: '卡片消息', text: '[卡片消息]' }],
      }),
    ])
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
              request_time: 1710000000,
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
            leave_notices: [{
              notice_id: 'leave-1',
              group_id: 20000,
              group_name: 'General',
              user_id: 50000,
              nickname: 'Carol',
              time: 1710000001,
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
      time: 1710000000000,
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
    }, {
      id: 'group:leave:leave-1',
      type: 'group-notice',
      title: 'General',
      subtitle: 'Carol 退出群聊',
      avatar: 'https://p.qlogo.cn/gh/20000/20000/640/',
      status: 'approved',
      time: 1710000001000,
      subType: 'leave',
      groupId: '20000',
      groupName: 'General',
      requesterId: '50000',
      requesterName: 'Carol',
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

  it('renders inline reply payloads as quote elements when no reply id is present', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 7,
            message_seq: 17,
            time: 1710000006,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: [
              {
                type: 'reply',
                data: {
                  sender: { nickname: '彩虹猫' },
                  message: [{ type: 'text', data: { text: '宁宁摸摸头' } }],
                },
              },
              { type: 'text', data: { text: '这还差不多' } },
            ],
          }],
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
  })
})
