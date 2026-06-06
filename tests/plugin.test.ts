import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import * as plugin from '../src'
import type { ChatCapsuleContext } from '../src'
import type { CapsuleSnapshot } from '../src/state'

const pluginSource = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')

type Listener = (...payload: any[]) => void
type TestLogger = {
  info: ReturnType<typeof vi.fn>
}

function createFakeContext(options: { console?: boolean; character?: Record<string, unknown>; bots?: unknown[]; server?: boolean; database?: Record<string, unknown> } = {}) {
  const listeners: Record<string, Listener[]> = {}
  const addEntry = vi.fn((_files: unknown, _data?: () => { capsule: CapsuleSnapshot | undefined }) => {})
  const broadcast = vi.fn((_type: string, _body: CapsuleSnapshot | undefined, _options?: { authority?: number }) => {})
  const addListener = vi.fn((_event: string, _listener: (...args: unknown[]) => unknown, _options?: { authority?: number }) => {})
  const serverGet = vi.fn((_path: string, _callback: (ctx: unknown) => unknown) => {})
  const modelExtend = vi.fn((_table: string, _fields: unknown, _options?: unknown) => {})
  const hasConsole = options.console ?? true

  const base: Pick<ChatCapsuleContext, 'on' | 'before'> = {
    on(event, listener) {
      ;(listeners[event] ||= []).push(listener)
    },
    before(event, listener) {
      ;(listeners[`before:${event}`] ||= []).push(listener)
    },
  }

  if (hasConsole) {
    const ctx: ChatCapsuleContext & { console: NonNullable<ChatCapsuleContext['console']>; bots?: unknown[] } = {
      ...base,
      ...(options.bots ? { bots: options.bots } : {}),
      console: {
        addEntry,
        broadcast,
        addListener,
      },
      ...(options.server ? { server: { get: serverGet } } : {}),
      ...(options.character ? { chatluna_character: options.character } : {}),
      ...(options.database ? { database: options.database, model: { extend: modelExtend } } : {}),
      inject(services, callback) {
        if ('console' in services) callback(ctx)
        if ('chatluna_character' in services && options.character) callback(ctx)
      },
    }
    return { ctx, listeners, addEntry, broadcast, addListener, serverGet, modelExtend }
  }

  const ctx: ChatCapsuleContext & { bots?: unknown[] } = {
    ...base,
    ...(options.bots ? { bots: options.bots } : {}),
    ...(options.server ? { server: { get: serverGet } } : {}),
    ...(options.character ? { chatluna_character: options.character } : {}),
    ...(options.database ? { database: options.database, model: { extend: modelExtend } } : {}),
    inject(services, callback) {
      if ('chatluna_character' in services && options.character) callback(ctx)
    },
  }

  return { ctx, listeners, addEntry, broadcast, addListener, serverGet, modelExtend }
}

function createSession(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'onebot',
    selfId: '10000',
    channelId: '20000',
    userId: '30000',
    username: 'Session Alice',
    timestamp: 1710000000000,
    bot: {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    },
    event: {
      guild: {
        name: 'Guild Name',
      },
      channel: {
        name: 'Channel Name',
      },
      user: {
        name: 'Event Alice',
      },
    },
    ...overrides,
  }
}

describe('chat capsule plugin wiring', () => {
  it('exports plugin name and optional console injection', () => {
    expect(plugin.name).toBe('onebot-webqq')
    expect(plugin.inject).toEqual({
      optional: ['console', 'server', 'database', 'chatluna', 'chatluna_character'],
    })
  })

  it('exports a Config schema for backend options', () => {
    expect(plugin.Config).toBeDefined()
    expect(pluginSource).toContain('webQQTheme?:')
    expect(pluginSource).toContain("Schema.const('fresh').description('清爽')")
    expect(pluginSource).toContain("Schema.const('frosted').description('毛玻璃')")
    expect(pluginSource).toContain("Schema.const('glass').description('玻璃')")
    expect(pluginSource).toContain(".default('fresh')")
    expect(pluginSource).toContain("description('WebQQ 主题')")
    expect(pluginSource).toContain("webQQChatStyle?:")
    expect(pluginSource).toContain("Schema.const('qq').description('传统 QQ')")
    expect(pluginSource).toContain("Schema.const('telegram').description('Telegram')")
    expect(pluginSource).toContain("description('WebQQ 聊天页面样式')")
    expect(pluginSource).toContain("webQQAccentColor?:")
    expect(pluginSource).toContain("Schema.string().default('#2563eb').role('color').description('WebQQ 手动主题色')")
    expect(pluginSource).toContain("useBotAvatarThemeColor?: boolean")
    expect(pluginSource).toContain("Schema.boolean().default(false).description('使用 bot 头像主色作为 WebQQ 主题色，开启后手动主题色不生效')")
    expect(pluginSource).toContain("hideWebQQGroupLevel?: boolean")
    expect(pluginSource).toContain("Schema.boolean().default(false).description('隐藏 WebQQ 消息中的群等级徽标')")
    expect(pluginSource).toContain("showWebQQCapsuleUnread?: boolean")
    expect(pluginSource).toContain("Schema.boolean().default(true).description('在小胶囊 bot 头像上显示 WebQQ 总未读数')")
    expect(pluginSource).toContain("webQQStorageBackend?: 'browser' | 'koishi'")
    expect(pluginSource).toContain("Schema.const('browser').description('浏览器')")
    expect(pluginSource).toContain("Schema.const('koishi').description('Koishi 数据库')")
    expect(pluginSource).toContain(".default('browser')")
    expect(pluginSource).toContain("description('WebQQ 状态存储后端')")
    expect(pluginSource).not.toContain("Schema.const('s3')")
    expect(pluginSource).not.toContain('webQQS3')
    expect(pluginSource).not.toContain('@aws-sdk/client-s3')
  })

  it('registers a console entry with empty capsule data', () => {
    const { ctx, addEntry } = createFakeContext()

    plugin.apply(ctx)

    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(addEntry.mock.calls[0][0]).toEqual({
      dev: expect.stringContaining('/client/index.ts'),
      prod: expect.stringContaining('/dist'),
    })
    const data = addEntry.mock.calls[0][1]
    expect(data).toBeDefined()
    expect(data?.()).toEqual({
      capsule: undefined,
      debug: false,
      webQQTheme: 'fresh',
      webQQChatStyle: 'qq',
      webQQAccentColor: '#2563eb',
      useBotAvatarThemeColor: false,
      hideWebQQGroupLevel: false,
      showWebQQCapsuleUnread: true,
      webQQStorageBackend: 'browser',
    })
  })

  it('registers read-only WebQQ console listeners backed by OneBot actions', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        get_group_member_list: vi.fn(async () => []),
      },
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)

    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/contacts', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/messages', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/group-info', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/notices', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/notice-action', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/storage/load', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/storage/save', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/messages/cache/load', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/messages/cache/save', expect.any(Function), { authority: 1 })
    expect(addListener).not.toHaveBeenCalledWith('chat-capsule/webqq/send', expect.any(Function))

    const loadContacts = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/contacts')?.[1]
    const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]
    const loadGroupInfo = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/group-info')?.[1]

    await expect(loadContacts?.()).resolves.toEqual({ friends: [], groups: [] })
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([])
    await expect(loadGroupInfo?.({ groupId: '20000' })).resolves.toEqual({ announcements: [], members: [] })
  })

  it('loads and saves WebQQ state and message cache through the Koishi database backend', async () => {
    const storedState = {
      conversationSummaries: {
        'friend:10001': { summary: '你好', time: 1710000000000 },
      },
      conversationUnreadCounts: {
        'friend:10001': 2,
      },
    }
    const cachedMessages = [{
      id: 'msg-1',
      sequence: '100',
      time: 1710000000000,
      senderId: '10000',
      senderName: 'Capsule Bot',
      senderAvatar: 'https://example.com/avatar.png',
      direction: 'outgoing',
      summary: '这是答案',
      thinking: {
        content: '先分析',
        durationMs: 2400,
        usage: {
          inputTokens: 12,
          outputTokens: 34,
        },
      },
      elements: [{ type: 'text', text: '这是答案' }],
    }]
    const database = {
      get: vi.fn(async (_table: string, query: { id?: string }) => {
        if (query.id === 'state:webqq') return [{ id: 'state:webqq', payload: storedState }]
        if (query.id === 'messages:friend:10001') return [{ id: 'messages:friend:10001', payload: { messages: cachedMessages } }]
        return []
      }),
      upsert: vi.fn(async () => {}),
    }
    const { ctx, addListener, modelExtend } = createFakeContext({ database })
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: { webQQStorageBackend?: 'koishi' }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, { webQQStorageBackend: 'koishi' })

    expect(modelExtend).toHaveBeenCalledWith('onebot_webqq_storage', {
      id: 'string(128)',
      payload: 'object',
      updatedAt: 'timestamp',
    }, { primary: 'id' })

    const loadStorage = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/storage/load')?.[1]
    const saveStorage = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/storage/save')?.[1]
    const loadMessageCache = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages/cache/load')?.[1]
    const saveMessageCache = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages/cache/save')?.[1]
    await expect(loadStorage?.()).resolves.toEqual(storedState)
    await saveStorage?.(storedState)
    await expect(loadMessageCache?.({ type: 'friend', peerId: '10001' })).resolves.toEqual(cachedMessages)
    await saveMessageCache?.({ type: 'friend', peerId: '10001', messages: cachedMessages })

    expect(database.get).toHaveBeenCalledWith('onebot_webqq_storage', { id: 'state:webqq' })
    expect(database.get).toHaveBeenCalledWith('onebot_webqq_storage', { id: 'messages:friend:10001' })
    expect(database.upsert).toHaveBeenCalledWith('onebot_webqq_storage', [{
      id: 'state:webqq',
      payload: storedState,
      updatedAt: expect.any(Date),
    }])
    expect(database.upsert).toHaveBeenCalledWith('onebot_webqq_storage', [{
      id: 'messages:friend:10001',
      payload: { messages: cachedMessages },
      updatedAt: expect.any(Date),
    }])
  })

  it('exposes pending WebQQ friend requests and group notices through the console listener', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_system_msg: vi.fn(async () => ({
          data: {
            join_requests: [{
              request_id: 'join-1',
              group_id: 20000,
              group_name: 'General',
              requester_uin: 30000,
              requester_nick: 'Alice',
              checked: false,
            }],
          },
        })),
        set_friend_add_request: vi.fn(async () => ({})),
        set_group_add_request: vi.fn(async () => ({})),
      },
    }
    const { ctx, listeners, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    listeners['friend-request'][0](createSession({
      userId: '40000',
      username: 'Bob',
      event: {
        user: { id: '40000', name: 'Bob' },
        _data: { flag: 'friend-flag', comment: '加个好友' },
      },
    }))
    listeners['guild-member-removed'][0](createSession({
      channelId: '20000',
      userId: '50000',
      username: 'Carol',
      event: {
        guild: { id: '20000', name: 'General' },
        user: { id: '50000', name: 'Carol' },
      },
    }))

    const loadNotices = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/notices')?.[1]
    await expect(loadNotices?.()).resolves.toEqual([
      expect.objectContaining({
        id: 'friend:friend-flag',
        type: 'friend-request',
        title: 'Bob',
        avatar: 'https://q1.qlogo.cn/g?b=qq&nk=40000&s=640',
        status: 'pending',
        comment: '加个好友',
      }),
      expect.objectContaining({
        id: 'group:leave:20000:50000:1710000000000',
        type: 'group-notice',
        title: 'General',
        subtitle: 'Carol 退出群聊',
        avatar: 'https://p.qlogo.cn/gh/20000/20000/640/',
        status: 'approved',
        subType: 'leave',
      }),
      expect.objectContaining({
        id: 'group:join-1',
        type: 'group-notice',
        title: 'General',
        avatar: 'https://p.qlogo.cn/gh/20000/20000/640/',
        status: 'pending',
      }),
    ])

    const handleNotice = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/notice-action')?.[1]
    await handleNotice?.({ id: 'friend:friend-flag', type: 'friend-request', flag: 'friend-flag', approve: true })
    await handleNotice?.({ id: 'group:join-1', type: 'group-notice', flag: 'join-1', subType: 'add', approve: false })

    expect(bot.internal.set_friend_add_request).toHaveBeenCalledWith({
      flag: 'friend-flag',
      approve: true,
    })
    expect(bot.internal.set_group_add_request).toHaveBeenCalledWith({
      flag: 'join-1',
      sub_type: 'add',
      approve: false,
    })
  })

  it('requires a logged-in console user for WebQQ data and live broadcasts', async () => {
    const { ctx, listeners, addListener, broadcast } = createFakeContext()

    plugin.apply(ctx)

    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/contacts', expect.any(Function), { authority: 1 })
    expect(addListener).toHaveBeenCalledWith('chat-capsule/webqq/messages', expect.any(Function), { authority: 1 })

    await listeners.message[0](createSession({
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'new message' } }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/update', expect.any(Object), { authority: 1 })
    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', expect.any(Object), { authority: 1 })
  })

  it('uses the configured WebQQ protocol for OneBot history calls', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx, { onebotProtocol: 'llbot' })

    const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([])

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      message_seq: 0,
      count: 20,
      reverseOrder: false,
    })
  })

  it('uses 100 messages as the default WebQQ history limit', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
    }
    const { ctx, addListener } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)

    const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]
    await expect(loadMessages?.({ type: 'group', peerId: '20000' })).resolves.toEqual([])

    expect(bot.internal.get_group_msg_history).toHaveBeenCalledWith({
      group_id: 20000,
      message_seq: 0,
      count: 100,
    })
  })

  it('merges live OneBot messages into WebQQ message history', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({
          messages: [{
            message_id: 'old-1',
            message_seq: 10,
            time: 1710000000,
            sender: {
              user_id: 30000,
              nickname: 'Alice',
            },
            message: 'old message',
          }],
        })),
      },
    }
    const { ctx, listeners, addListener, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: {
          id: '20000',
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Guild Name',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
        member: {
          name: '群昵称',
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'new message' } }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'new-1',
        senderId: '30000',
        senderName: '群昵称',
        senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
        senderRole: '管理员',
        senderLevel: '100',
        senderTitle: '闪亮头衔',
        direction: 'incoming',
        summary: 'new message',
      }),
    }, { authority: 1 })

    const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        id: 'old-1',
        summary: 'old message',
      }),
      expect.objectContaining({
        id: 'new-1',
        summary: 'new message',
      }),
    ])
  })

  it('refreshes live group sender metadata from OneBot member info and overwrites cached changes', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        get_group_member_info: vi.fn()
          .mockResolvedValueOnce({
            role: 'admin',
            level: '100',
            title: '旧头衔',
          })
          .mockResolvedValueOnce({
            role: 'owner',
            level: '101',
            title: '新头衔',
          }),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, addListener, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'first' } }],
        },
      },
    }))
    await listeners.message[0](createSession({
      bot,
      timestamp: 1710000002000,
      event: {
        platform: 'onebot',
        timestamp: 1710000002000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-2',
          elements: [{ type: 'text', attrs: { content: 'second' } }],
        },
      },
    }))

    expect(bot.internal.get_group_member_info).toHaveBeenNthCalledWith(1, {
      group_id: 20000,
      user_id: 30000,
      no_cache: true,
    })
    expect(bot.internal.get_group_member_info).toHaveBeenNthCalledWith(2, {
      group_id: 20000,
      user_id: 30000,
      no_cache: true,
    })
    const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')
    expect(webQQCalls[0][1].message).not.toHaveProperty('senderRole')
    expect(webQQCalls[1][1].message).toMatchObject({
      id: 'new-1',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '旧头衔',
    })
    expect(webQQCalls[2][1].message).toMatchObject({
      id: 'new-2',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '旧头衔',
    })
    expect(webQQCalls[3][1].message).toMatchObject({
      id: 'new-2',
      senderRole: '群主',
      senderLevel: '101',
      senderTitle: '新头衔',
    })

    const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]
    await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        id: 'new-1',
        senderRole: '管理员',
        senderLevel: '100',
        senderTitle: '旧头衔',
      }),
      expect.objectContaining({
        id: 'new-2',
        senderRole: '群主',
        senderLevel: '101',
        senderTitle: '新头衔',
      }),
    ])
  })

  it('refreshes outgoing bot WebQQ group sender metadata from OneBot member info', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_group_member_info: vi.fn(async () => ({
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'bot-1',
          elements: [{ type: 'text', attrs: { content: 'bot reply' } }],
        },
      },
    }))

    expect(bot.internal.get_group_member_info).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 10000,
      no_cache: true,
    })
    const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')
    expect(webQQCalls[0][1].message).toMatchObject({
      id: 'bot-1',
      senderId: '10000',
      direction: 'outgoing',
    })
    expect(webQQCalls[0][1].message).not.toHaveProperty('senderRole')
    expect(webQQCalls[1][1].message).toMatchObject({
      id: 'bot-1',
      senderId: '10000',
      direction: 'outgoing',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('keeps live WebQQ messages when OneBot member info refresh fails', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_group_member_info: vi.fn(async () => {
          throw new Error('member info failed')
        }),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await expect(listeners.message[0](createSession({
      bot,
      timestamp: 1710000001000,
      event: {
        platform: 'onebot',
        timestamp: 1710000001000,
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'new-1',
          elements: [{ type: 'text', attrs: { content: 'first' } }],
        },
      },
    }))).resolves.toBeUndefined()

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'new-1',
        summary: 'first',
      }),
    }, { authority: 1 })
  })

  it('broadcasts live at segments as text in WebQQ messages', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      event: {
        guild: {
          id: '20000',
          name: 'Guild Name',
        },
        channel: {
          id: '20000',
          name: 'Guild Name',
        },
        user: {
          id: '30000',
          name: 'Alice',
        },
        message: {
          id: 'at-1',
          elements: [
            { type: 'at', attrs: { id: '10000', name: '宁宁' } },
            { type: 'text', attrs: { content: ' 那我自己去吃' } },
          ],
        },
      },
      elements: [
        { type: 'at', attrs: { id: '10000', name: '宁宁' } },
        { type: 'text', attrs: { content: ' 那我自己去吃' } },
      ],
    }))

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'at-1',
        summary: '@宁宁 那我自己去吃',
        elements: [
          { type: 'text', text: '@宁宁' },
          { type: 'text', text: ' 那我自己去吃' },
        ],
      }),
    }, { authority: 1 })
  })

  it('records OneBot self message echoes as outgoing WebQQ messages', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'self-1',
          elements: [{ type: 'text', attrs: { content: 'sent message' } }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'self-1',
        senderId: '10000',
        senderName: 'Capsule Bot',
        direction: 'outgoing',
        summary: 'sent message',
      }),
    }, { authority: 1 })
  })

  it('does not broadcast WebQQ live messages from before send', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners['before:send'][0](createSession({
      content: 'sent message',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
      },
    }))

    expect(broadcast).not.toHaveBeenCalledWith('chat-capsule/webqq/message', expect.any(Object), { authority: 1 })
  })

  it('resolves live OneBot image messages before broadcasting WebQQ updates', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_image: vi.fn(async () => ({
          url: 'https://example.com/live.jpg',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'image-1',
          elements: [{ type: 'img', attrs: { file: 'live.image' } }],
        },
      },
    }))

    expect(bot.internal.get_image).toHaveBeenCalledWith({
      file: 'live.image',
    })
    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'image-1',
        summary: '[图片]',
        elements: [{ type: 'image', url: 'https://example.com/live.jpg' }],
      }),
    }, { authority: 1 })
  })

  it('proxies live OneBot image URLs before broadcasting WebQQ updates', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_image: vi.fn(async () => ({
          url: 'https://example.com/unused.jpg',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot], server: true })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'image-url-1',
          elements: [{
            type: 'img',
            attrs: {
              src: 'https://multimedia.nt.qq.com.cn/download?fileid=remote',
            },
          }],
        },
      },
    }))

    expect(bot.internal.get_image).not.toHaveBeenCalled()
    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'image-url-1',
        summary: '[图片]',
        elements: [{
          type: 'image',
          url: expect.stringMatching(/^\/chat-capsule\/webqq\/image\//),
        }],
      }),
    }, { authority: 1 })
  })

  it('renders live quote elements before the WebQQ message body', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'quote-1',
          elements: [
            {
              type: 'quote',
              attrs: { name: '彩虹猫' },
              children: [{ type: 'text', attrs: { content: '宁宁摸摸头' } }],
            },
            { type: 'text', attrs: { content: '这还差不多' } },
          ],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'quote-1',
        summary: '这还差不多',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    }, { authority: 1 })
  })

  it('renders live quote attrs message payloads before the WebQQ message body', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'quote-attrs-1',
          elements: [
            {
              type: 'quote',
              attrs: {
                name: '彩虹猫',
                message: [{ type: 'text', attrs: { content: '宁宁摸摸头' } }],
              },
            },
            { type: 'text', attrs: { content: '这还差不多' } },
          ],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'quote-attrs-1',
        summary: '这还差不多',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    }, { authority: 1 })
  })

  it('renders live event message quote fields before the WebQQ message body', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'quote-field-1',
          quote: {
            id: 'quoted-field-1',
            user: { id: '40000', name: '彩虹猫' },
            content: '宁宁摸摸头',
          },
          elements: [
            { type: 'text', attrs: { content: '这还差不多' } },
          ],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'quote-field-1',
        summary: '这还差不多',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    }, { authority: 1 })
  })

  it('resolves live reply ids before rendering WebQQ quote elements', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_msg: vi.fn(async () => ({
          message_id: 'quoted-1',
          sender: {
            user_id: 40000,
            nickname: '彩虹猫',
          },
          message: [{ type: 'text', data: { text: '宁宁摸摸头' } }],
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'reply-1',
          elements: [
            { type: 'reply', attrs: { id: 'quoted-1' } },
            { type: 'text', attrs: { content: '这还差不多' } },
          ],
        },
      },
    }))

    expect(bot.internal.get_msg).toHaveBeenCalledWith({
      message_id: 'quoted-1',
    })
    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'reply-1',
        direction: 'outgoing',
        summary: '这还差不多',
        elements: [
          { type: 'quote', title: '彩虹猫', text: '宁宁摸摸头' },
          { type: 'text', text: '这还差不多' },
        ],
      }),
    }, { authority: 1 })
  })

  it('reads live forward elements before broadcasting WebQQ updates', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_forward_msg: vi.fn(async () => ({
          message: [{
            type: 'node',
            data: {
              user_id: 30000,
              nickname: 'Alice',
              content: [{ type: 'text', data: { text: '第一条' } }],
            },
          }],
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'forward-1',
          elements: [{ type: 'forward', attrs: { id: 'forward-detail-1' } }],
        },
      },
    }))

    expect(bot.internal.get_forward_msg).toHaveBeenCalledWith({
      id: 'forward-detail-1',
    })
    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'forward-1',
        summary: '[合并转发]',
        elements: [{
          type: 'forward',
          title: '合并转发',
          text: 'Alice：第一条',
          items: [{
            title: 'Alice',
            senderId: '30000',
            senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=30000&s=640',
            elements: [{ type: 'text', text: '第一条' }],
          }],
        }],
      }),
    }, { authority: 1 })
  })

  it('renders live json card elements before broadcasting WebQQ updates', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await listeners.message[0](createSession({
      bot,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
        message: {
          id: 'card-1',
          elements: [{
            type: 'json',
            attrs: {
              data: JSON.stringify({
                meta: {
                  music: {
                    title: '春日影',
                    desc: 'MyGO!!!!!',
                    preview: 'https://example.com/cover.jpg',
                    jumpUrl: 'https://example.com/song',
                    tag: 'QQ音乐',
                  },
                },
              }),
            },
          }],
        },
      },
    }))

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/webqq/message', {
      type: 'group',
      peerId: '20000',
      message: expect.objectContaining({
        id: 'card-1',
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
    }, { authority: 1 })
  })

  it('passes enabled debug config to console entry data', () => {
    const { ctx, addEntry } = createFakeContext()
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: { debug?: boolean }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, { debug: true })

    const data = addEntry.mock.calls[0][1]
    expect(data?.()).toEqual({
      capsule: undefined,
      debug: true,
      webQQTheme: 'fresh',
      webQQChatStyle: 'qq',
      webQQAccentColor: '#2563eb',
      useBotAvatarThemeColor: false,
      hideWebQQGroupLevel: false,
      showWebQQCapsuleUnread: true,
      webQQStorageBackend: 'browser',
    })
  })

  it('passes configured WebQQ theme and accent settings to console entry data', () => {
    const { ctx, addEntry } = createFakeContext()
    type ApplyWithConfig = (ctx: ChatCapsuleContext, config?: {
      webQQTheme?: 'fresh' | 'frosted' | 'glass'
      webQQChatStyle?: 'qq' | 'telegram'
      webQQAccentColor?: string
      useBotAvatarThemeColor?: boolean
      hideWebQQGroupLevel?: boolean
      showWebQQCapsuleUnread?: boolean
      webQQStorageBackend?: 'browser' | 'koishi'
    }) => void
    const applyWithConfig: ApplyWithConfig = plugin.apply

    applyWithConfig(ctx, {
      webQQTheme: 'fresh',
      webQQChatStyle: 'telegram',
      webQQAccentColor: '#22c55e',
      useBotAvatarThemeColor: false,
      hideWebQQGroupLevel: true,
      showWebQQCapsuleUnread: false,
      webQQStorageBackend: 'koishi',
    })

    const data = addEntry.mock.calls[0][1]
    expect(data?.()).toEqual({
      capsule: undefined,
      debug: false,
      webQQTheme: 'fresh',
      webQQChatStyle: 'telegram',
      webQQAccentColor: '#22c55e',
      useBotAvatarThemeColor: false,
      hideWebQQGroupLevel: true,
      showWebQQCapsuleUnread: false,
      webQQStorageBackend: 'koishi',
    })
  })

  it('writes debug snapshots to Koishi logs when debug is enabled', () => {
    const { ctx, listeners } = createFakeContext()
    const logger: TestLogger = {
      info: vi.fn(),
    }
    const ctxWithLogger = {
      ...ctx,
      logger: vi.fn(() => logger),
    } as ChatCapsuleContext & { logger: (name: string) => TestLogger }

    plugin.apply(ctxWithLogger, { debug: true })
    listeners.message[0](createSession())

    expect(ctxWithLogger.logger).toHaveBeenCalledWith('chat-capsule')
    expect(logger.info).toHaveBeenCalledWith(
      'message %s',
      expect.stringContaining('"received":1'),
    )
  })

  it('broadcasts normalized state when a message is received', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners.message[0](createSession())

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/update', {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Capsule Bot',
        avatar: 'https://example.com/avatar.png',
      },
      conversation: {
        channelId: '20000',
        channelName: 'Guild Name',
        timestamp: 1710000000000,
      },
      counters: {
        received: 1,
        sent: 0,
      },
    }, { authority: 1 })
  })

  it('keeps bot avatar URLs stable in console entry data when server image proxy exists', () => {
    const { ctx, listeners, addEntry, broadcast } = createFakeContext({ server: true })

    plugin.apply(ctx)
    listeners.message[0](createSession())

    const data = addEntry.mock.calls[0][1]
    const entryData = data?.()
    expect(entryData).toEqual(expect.objectContaining({
      capsule: expect.objectContaining({
        bot: expect.objectContaining({
          avatar: 'https://example.com/avatar.png',
        }),
      }),
    }))
    expect(entryData?.capsule?.bot.avatar).not.toMatch(/^\/chat-capsule\/webqq\/image\//)
    expect(broadcast).toHaveBeenCalledWith('chat-capsule/update', expect.objectContaining({
      bot: expect.objectContaining({
        avatar: 'https://example.com/avatar.png',
      }),
    }), { authority: 1 })
  })

  it('increments sent counter from before send and broadcasts the latest snapshot', async () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners.message[0](createSession())
    broadcast.mockClear()

    await listeners['before:send'][0]()

    expect(broadcast).toHaveBeenCalledWith('chat-capsule/update', {
      bot: {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        name: 'Capsule Bot',
        avatar: 'https://example.com/avatar.png',
      },
      conversation: {
        channelId: '20000',
        channelName: 'Guild Name',
        timestamp: 1710000000000,
      },
      counters: {
        received: 1,
        sent: 1,
      },
    }, { authority: 1 })
  })

  it('falls back to session names and ids when event names are missing', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners.message[0](createSession({
      event: {
        channel: {
          name: 'Session Channel',
        },
      },
    }))
    listeners.message[0](createSession({
      channelId: 'channel-id',
      userId: 'user-id',
      username: undefined,
      timestamp: 1710000000001,
      event: {},
    }))

    expect(broadcast.mock.calls[0][1]?.conversation).toMatchObject({
      channelName: 'Session Channel',
    })
    expect(broadcast.mock.calls[1][1]?.conversation).toMatchObject({
      channelId: 'channel-id',
      channelName: 'channel-id',
      timestamp: 1710000000001,
    })
  })

  it('uses ChatLuna chat events to show and clear generation status', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners['chatluna/before-chat'][0]('conversation-1', { name: 'Alice' }, {}, {}, createSession())

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelName: 'Guild Name',
      userName: 'Alice',
      activityText: '正在思考',
    })

    listeners['chatluna/after-chat'][0]('conversation-1')

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelId: '20000',
      channelName: 'Guild Name',
      timestamp: 1710000000000,
      thinkingDurationMs: expect.any(Number),
    })
  })

  it('carries group sender metadata from ChatLuna before-chat sessions into thinking conversation', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners['chatluna/before-chat'][0]('conversation-1', {
      id: '30000',
      name: 'Alice',
    }, {}, {}, createSession({
      event: {
        guild: {
          name: 'Guild Name',
        },
        channel: {
          name: 'Channel Name',
        },
        member: {
          name: '群昵称',
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        },
        user: {
          name: 'Event Alice',
        },
      },
    }))

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userId: '30000',
      userName: '群昵称',
      activityText: '正在思考',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('loads bot group sender metadata from OneBot before showing ChatLuna thinking status', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_group_member_info: vi.fn(async () => ({
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    await listeners['chatluna/before-chat'][0]('conversation-1', {
      id: '30000',
      name: 'Alice',
    }, {}, {}, createSession({ bot }))

    expect(bot.internal.get_group_member_info).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 10000,
      no_cache: false,
    })
    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelId: '20000',
      activityText: '正在思考',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('updates usage from matching ChatLuna model usage events', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners['chatluna/before-chat'][0]('conversation-1', { name: 'Alice' }, {}, {}, createSession())

    listeners['chatluna/model-usage'][0]({
      source: 'chatluna',
      context: {
        conversationId: 'conversation-2',
      },
      usageMetadata: {
        input_tokens: 99,
        output_tokens: 100,
        total_tokens: 199,
      },
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation.usage).toBeUndefined()

    listeners['chatluna/model-usage'][0]({
      source: 'extension-agent',
      context: {
        conversationId: 'conversation-1',
      },
      usageMetadata: {
        input_tokens: 56,
        output_tokens: 78,
        total_tokens: 134,
      },
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation.usage).toBeUndefined()

    listeners['chatluna/model-usage'][0]({
      source: 'chatluna',
      context: {
        conversationId: 'conversation-1',
      },
      usageMetadata: {
        input_tokens: 12,
        output_tokens: 34,
        total_tokens: 46,
      },
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation.usage).toEqual({
      inputTokens: 12,
      outputTokens: 34,
    })

    listeners['chatluna/model-usage'][0]({
      source: 'extension-tools',
      context: {
        conversationId: 'conversation-1',
      },
      usageMetadata: {
        input_tokens: 90,
        output_tokens: 91,
        total_tokens: 181,
      },
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation.usage).toEqual({
      inputTokens: 12,
      outputTokens: 34,
    })

    listeners['chatluna/model-usage'][0]({
      source: 'unknown',
      context: {
        conversationId: 'conversation-1',
      },
      usageMetadata: {
        input_tokens: 101,
        output_tokens: 102,
        total_tokens: 203,
      },
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation.usage).toEqual({
      inputTokens: 12,
      outputTokens: 34,
    })
  })

  it('accepts ChatLuna character usage sources for the current conversation', () => {
    const { ctx, listeners, broadcast } = createFakeContext()

    plugin.apply(ctx)
    listeners['chatluna/before-chat'][0]('conversation-1', { name: 'Alice' }, {}, {}, createSession())

    listeners['chatluna/model-usage'][0]({
      source: 'chatluna-character',
      context: {
        conversationId: 'conversation-1',
      },
      usageMetadata: {
        input_tokens: 21,
        output_tokens: 43,
        total_tokens: 64,
      },
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation.usage).toEqual({
      inputTokens: 21,
      outputTokens: 43,
    })

    listeners['chatluna/model-usage'][0]({
      source: 'character',
      context: {
        conversationId: 'conversation-1',
      },
      usageMetadata: {
        input_tokens: 22,
        output_tokens: 44,
        total_tokens: 66,
      },
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation.usage).toEqual({
      inputTokens: 22,
      outputTokens: 44,
    })
  })

  it('uses character response locks and collect events to show active status', async () => {
    const character = {
      acquireResponseLock: vi.fn(async () => true),
      releaseResponseLock: vi.fn(async () => undefined),
    }
    const originalAcquireResponseLock = character.acquireResponseLock
    const originalReleaseResponseLock = character.releaseResponseLock
    const { ctx, listeners, broadcast } = createFakeContext({ character })
    const session = createSession({
      event: {
        guild: {
          name: 'Guild Name',
        },
        channel: {
          name: 'Channel Name',
        },
        member: {
          name: 'Group Card Alice',
        },
        user: {
          name: 'Event Alice',
        },
      },
    })

    plugin.apply(ctx)
    await character.acquireResponseLock(session as any, {
      id: '30000',
      name: 'Alice',
      content: 'hello',
    })

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userName: 'Group Card Alice',
      activityText: '正在与 Group Card Alice 对话',
    })

    listeners['chatluna_character/message_collect'][0](session, [{
      id: '30000',
      name: 'Alice',
      content: 'hello',
    }], 'trigger')

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userName: 'Group Card Alice',
      activityText: '正在思考',
    })

    await character.releaseResponseLock(session as any)

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      channelId: '20000',
      channelName: 'Guild Name',
      timestamp: 1710000000000,
      thinkingDurationMs: expect.any(Number),
    })

    listeners.dispose[0]()

    expect(character.acquireResponseLock).toBe(originalAcquireResponseLock)
    expect(character.releaseResponseLock).toBe(originalReleaseResponseLock)
  })

  it('carries group sender metadata from ChatLuna character collect sessions into thinking conversation', () => {
    const { ctx, listeners, broadcast } = createFakeContext()
    const session = createSession({
      event: {
        guild: {
          name: 'Guild Name',
        },
        channel: {
          name: 'Channel Name',
        },
        member: {
          name: '群昵称',
          role: 'admin',
          level: '100',
          title: '闪亮头衔',
        },
        user: {
          name: 'Event Alice',
        },
      },
    })

    plugin.apply(ctx)
    listeners['chatluna_character/message_collect'][0](session, [{
      id: '30000',
      name: 'Alice',
      content: 'hello',
    }], 'trigger')

    expect(broadcast.mock.calls.at(-1)?.[1]?.conversation).toMatchObject({
      userId: '30000',
      userName: '群昵称',
      activityText: '正在思考',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '闪亮头衔',
    })
  })

  it('updates the last outgoing WebQQ message with completed character thinking content', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1710000000000)
      const bot = {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        internal: {
          get_friend_list: vi.fn(async () => []),
          get_group_list: vi.fn(async () => []),
          get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        },
        toJSON: () => ({
          user: {
            name: 'Capsule Bot',
            avatar: 'https://example.com/avatar.png',
          },
        }),
      }
      const { ctx, listeners, addListener, broadcast } = createFakeContext({ bots: [bot] })
      const session = createSession({
        bot,
        timestamp: 1710000000000,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '30000', name: 'Alice' },
        },
      })

      plugin.apply(ctx)
      await listeners['chatluna_character/message_collect'][0](session, [{ id: '30000', name: 'Alice' }])
      listeners['chatluna/model-usage'][0]({
        source: 'chatluna-character',
        usageMetadata: {
          input_tokens: 12,
          output_tokens: 34,
          total_tokens: 46,
        },
      })
      listeners['chatluna/model-usage'][0]({
        source: 'extension-agent',
        context: {
          conversationId: 'conversation-1',
        },
        usageMetadata: {
          input_tokens: 90,
          output_tokens: 91,
          total_tokens: 181,
        },
      })
      await listeners.message[0](createSession({
        bot,
        userId: '10000',
        timestamp: 1710000003600,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '10000', name: 'Capsule Bot' },
          message: {
            id: 'self-1',
            elements: [{ type: 'text', attrs: { content: '这是答案' } }],
          },
        },
      }))

      const initialWebQQCalls = broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')
      expect(initialWebQQCalls).toHaveLength(1)
      expect(initialWebQQCalls[0][1].message).not.toHaveProperty('thinking')

      vi.setSystemTime(1710000004200)
      listeners['chatluna_character/after-chat'][0]({
        session,
        lastResponseMessage: {
          content: '开头<think>\n先分析\n再回答\n</think>这是答案',
        },
      })

      const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')
      expect(webQQCalls.at(-1)?.[1]).toEqual({
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          id: 'self-1',
          direction: 'outgoing',
          summary: '这是答案',
          thinking: {
            content: '先分析\n再回答',
            durationMs: 4200,
            usage: {
              inputTokens: 12,
              outputTokens: 34,
            },
          },
        }),
      })

      const loadMessages = addListener.mock.calls.find(([event]) => event === 'chat-capsule/webqq/messages')?.[1]
      await expect(loadMessages?.({ type: 'group', peerId: '20000', limit: 20 })).resolves.toEqual([
        expect.objectContaining({
          id: 'self-1',
          thinking: {
            content: '先分析\n再回答',
            durationMs: 4200,
            usage: {
              inputTokens: 12,
              outputTokens: 34,
            },
          },
        }),
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('extracts character thinking from completionMessages LangChain AIMessage snapshots', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1710000000000)
      const bot = {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        internal: {
          get_friend_list: vi.fn(async () => []),
          get_group_list: vi.fn(async () => []),
          get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        },
        toJSON: () => ({
          user: {
            name: 'Capsule Bot',
            avatar: 'https://example.com/avatar.png',
          },
        }),
      }
      const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })
      const session = createSession({
        bot,
        timestamp: 1710000000000,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '30000', name: 'Alice' },
        },
      })

      plugin.apply(ctx)
      await listeners['chatluna_character/message_collect'][0](session, [{ id: '30000', name: 'Alice' }])
      await listeners.message[0](createSession({
        bot,
        userId: '10000',
        timestamp: 1710000003600,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '10000', name: 'Capsule Bot' },
          message: {
            id: 'self-1',
            elements: [{ type: 'text', attrs: { content: '这是答案' } }],
          },
        },
      }))

      const initialWebQQCalls = broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')
      expect(initialWebQQCalls).toHaveLength(1)
      expect(initialWebQQCalls[0][1].message).not.toHaveProperty('thinking')

      vi.setSystemTime(1710000004200)
      listeners['chatluna_character/after-chat'][0]({
        session,
        completionMessages: [{
          lc: 1,
          type: 'constructor',
          id: ['langchain_core', 'messages', 'AIMessage'],
          kwargs: {
            content: '前<think>\n从快照分析\n</think>后',
          },
        }],
      })

      const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')
      expect(webQQCalls.at(-1)?.[1]).toEqual({
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          id: 'self-1',
          direction: 'outgoing',
          thinking: {
            content: '从快照分析',
            durationMs: 4200,
          },
        }),
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps completed character thinking pending until the matching outgoing WebQQ message arrives', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1710000000000)
      const bot = {
        platform: 'onebot',
        selfId: '10000',
        status: 1,
        internal: {
          get_friend_list: vi.fn(async () => []),
          get_group_list: vi.fn(async () => []),
          get_group_msg_history: vi.fn(async () => ({ messages: [] })),
        },
        toJSON: () => ({
          user: {
            name: 'Capsule Bot',
            avatar: 'https://example.com/avatar.png',
          },
        }),
      }
      const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })
      const session = createSession({
        bot,
        timestamp: 1710000000000,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '30000', name: 'Alice' },
        },
      })

      plugin.apply(ctx)
      await listeners['chatluna_character/message_collect'][0](session, [{ id: '30000', name: 'Alice' }])

      vi.setSystemTime(1710000004200)
      listeners['chatluna_character/after-chat'][0]({
        session,
        lastResponseMessage: {
          content: '开头<think>\n先分析\n再回答\n</think>这是答案',
        },
      })

      expect(broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')).toHaveLength(0)

      await listeners.message[0](createSession({
        bot,
        userId: '30000',
        timestamp: 1710000004300,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '30000', name: 'Alice' },
          message: {
            id: 'incoming-1',
            elements: [{ type: 'text', attrs: { content: '收到' } }],
          },
        },
      }))

      await listeners.message[0](createSession({
        bot,
        channelId: '20001',
        userId: '10000',
        timestamp: 1710000004400,
        event: {
          guild: { id: '20001', name: 'Other Guild' },
          channel: { id: '20001', name: 'Other Guild' },
          user: { id: '10000', name: 'Capsule Bot' },
          message: {
            id: 'other-self-1',
            elements: [{ type: 'text', attrs: { content: '别处回复' } }],
          },
        },
      }))

      const nonMatchingWebQQCalls = broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')
      expect(nonMatchingWebQQCalls).toHaveLength(2)
      expect(nonMatchingWebQQCalls[0][1].message).toMatchObject({
        id: 'incoming-1',
        direction: 'incoming',
      })
      expect(nonMatchingWebQQCalls[0][1].message).not.toHaveProperty('thinking')
      expect(nonMatchingWebQQCalls[1][1]).toEqual(expect.objectContaining({
        peerId: '20001',
        message: expect.objectContaining({
          id: 'other-self-1',
          direction: 'outgoing',
        }),
      }))
      expect(nonMatchingWebQQCalls[1][1].message).not.toHaveProperty('thinking')

      await listeners.message[0](createSession({
        bot,
        userId: '10000',
        timestamp: 1710000004500,
        event: {
          guild: { id: '20000', name: 'Guild Name' },
          channel: { id: '20000', name: 'Guild Name' },
          user: { id: '10000', name: 'Capsule Bot' },
          message: {
            id: 'self-1',
            elements: [{ type: 'text', attrs: { content: '这是答案' } }],
          },
        },
      }))

      const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')
      expect(webQQCalls.at(-1)?.[1]).toEqual({
        type: 'group',
        peerId: '20000',
        message: expect.objectContaining({
          id: 'self-1',
          direction: 'outgoing',
          summary: '这是答案',
          thinking: {
            content: '先分析\n再回答',
            durationMs: 4200,
          },
        }),
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not add thinking data to WebQQ messages when character output has no non-empty think content', async () => {
    const bot = {
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
        get_group_msg_history: vi.fn(async () => ({ messages: [] })),
      },
      toJSON: () => ({
        user: {
          name: 'Capsule Bot',
          avatar: 'https://example.com/avatar.png',
        },
      }),
    }
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })
    const session = createSession({
      bot,
      timestamp: 1710000000000,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '30000', name: 'Alice' },
      },
    })

    plugin.apply(ctx)
    await listeners['chatluna_character/message_collect'][0](session, [{ id: '30000', name: 'Alice' }])
    await listeners.message[0](createSession({
      bot,
      userId: '10000',
      timestamp: 1710000003600,
      event: {
        guild: { id: '20000', name: 'Guild Name' },
        channel: { id: '20000', name: 'Guild Name' },
        user: { id: '10000', name: 'Capsule Bot' },
        message: {
          id: 'self-1',
          elements: [{ type: 'text', attrs: { content: '这是答案' } }],
        },
      },
    }))

    listeners['chatluna_character/after-chat'][0]({
      session,
      text: '开头<think>   </think>这是答案',
    })

    const webQQCalls = broadcast.mock.calls.filter(([event]) => event === 'chat-capsule/webqq/message')
    expect(webQQCalls).toHaveLength(1)
    expect(webQQCalls[0][1].message).toMatchObject({
      id: 'self-1',
      direction: 'outgoing',
      summary: '这是答案',
    })
    expect(webQQCalls[0][1].message).not.toHaveProperty('thinking')
  })

  it('keeps message and send listeners safe when console is unavailable', () => {
    const { ctx, listeners } = createFakeContext({ console: false })

    plugin.apply(ctx)

    expect(() => listeners.message[0](createSession())).not.toThrow()
    expect(() => listeners['before:send'][0]()).not.toThrow()
  })
})
