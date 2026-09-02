import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  MOCK_FRIEND_ALICE_ID,
  MOCK_GROUP_ID,
  MOCK_SECOND_SELF_ID,
  MOCK_SELF_ID,
  createMockWebQQScene,
} from '../src/webqq/adapters/mock/scene'
import { createMockWebQQService } from '../src/webqq/adapters/mock/service'
import { createOneBotWebQQService } from '../src/webqq/adapters/onebot/service'

const runtimeSource = await readFile(new URL('../src/runtime/create-runtime.ts', import.meta.url), 'utf8')
const consoleSource = await readFile(new URL('../src/webqq/console.ts', import.meta.url), 'utf8')
const messageListSource = await readFile(new URL('../client/webqq/components/WebQQMessageList.vue', import.meta.url), 'utf8')

describe('webqq mock environment', () => {
  // webQQMockEnvironment 在「开发者选项」分组里的默认值与说明文案由 tests/config-panel.test.ts
  // 读 Schema 运行时节点断言，这里不再匹配配置 Schema 的源码文本。

  it('keeps the developer mock environment on the real WebQQ service and the real affinity path', () => {
    // create-runtime 与 console.ts 读哪个配置项、怎么兜底，由 tests/plugin.test.ts 通过
    // 插件 apply + 内存 Console 替身断言运行时行为；这里只钉住模块归属与前端渲染契约。
    // 装配层永远创建真实实现，开关只作为「是否纳入虚拟机器人」的选项传进去。
    expect(runtimeSource).not.toContain("from '../webqq/adapters/mock/service'")
    expect(runtimeSource).toContain('createOneBotWebQQService(ctx, {')
    expect(runtimeSource).toContain("includeVirtualBots: readConfigValue(config, 'webQQMockEnvironment')")
    // 好感度徽标不再按模拟环境整体跳过：虚拟机器人在 ChatLuna 库里查不到记录时徽标为空，那是正确答案而不是缺陷。
    expect(consoleSource).toContain('attachWebQQAffinityBadges')
    expect(consoleSource).not.toContain('webQQMockEnvironment')
    expect(messageListSource).toContain('message.senderId !== currentOperatorId && message.senderAffinity != null')
    expect(messageListSource).toContain('message.senderId !== currentOperatorId && message.senderRelationship')
  })

  it('loads preset contacts, message element types, reactions and recalled messages', async () => {
    const service = createMockWebQQService(createMockWebQQScene())
    const contacts = await service.loadContacts()
    expect(contacts.mockEnvironment).toBe(true)
    expect(contacts.friendCategories?.[0]?.friends.length).toBeGreaterThan(0)
    expect(contacts.groups[0]?.name).toBe('模拟开发群')

    const friendMessages = await service.loadMessages({
      type: 'friend',
      peerId: MOCK_FRIEND_ALICE_ID,
      limit: 50,
    })
    const types = new Set(friendMessages.flatMap((message) => message.elements.map((element) => element.type)))
    for (const type of ['text', 'image', 'quote', 'forward', 'card', 'face', 'file', 'record', 'video', 'unknown'] as const) {
      expect(types.has(type)).toBe(true)
    }
    expect(friendMessages.some((message) => message.recalled)).toBe(true)

    const groupMessages = await service.loadMessages({
      type: 'group',
      peerId: MOCK_GROUP_ID,
      limit: 20,
    })
    expect(groupMessages[0]?.reactions?.[0]?.users?.length).toBeGreaterThan(0)
    const imageMessage = groupMessages.find((message) => message.id === 'group-msg-3')
    expect(imageMessage?.elements[0]).toMatchObject({
      type: 'image',
      url: expect.stringMatching(/^data:image\/svg\+xml/),
    })
    expect(groupMessages.find((message) => message.senderId === MOCK_SELF_ID)).not.toHaveProperty('senderAffinity')
    expect(groupMessages.find((message) => message.senderId === MOCK_SELF_ID)).not.toHaveProperty('senderRelationship')
    expect(groupMessages.filter((message) => message.senderId !== MOCK_SELF_ID)).toEqual(expect.arrayContaining([
      expect.objectContaining({ senderAffinity: expect.any(Number), senderRelationship: expect.any(String) }),
    ]))

    const users = await service.loadReactionUsers(groupMessages[0]!.id, groupMessages[0]!.reactions![0]!.emojiId, 10)
    expect(users.length).toBeGreaterThan(0)
    expect(service.supportsReactionUsers()).toBe(true)

    const groupInfo = await service.loadGroupInfo({ groupId: MOCK_GROUP_ID })
    expect(groupInfo.members.length).toBeGreaterThan(0)
    expect(groupInfo.members.find((member) => member.userId === MOCK_SECOND_SELF_ID)?.rawRole).toBe('admin')
    for (const message of groupMessages) {
      const member = groupInfo.members.find((item) => item.userId === message.senderId)
      if (member) expect(message.senderRole).toBe(member.role)
    }
    expect(groupInfo.announcements.length).toBeGreaterThan(0)

    const notices = await service.loadNotices()
    expect(notices.some((notice) => notice.type === 'friend-request')).toBe(true)
    expect(notices.some((notice) => notice.type === 'group-notice')).toBe(true)

    const quote = await service.resolveQuote('friend-msg-1')
    expect(quote.type).toBe('quote')
    const forward = await service.resolveForward('forward-1')
    expect(forward.type).toBe('forward')
    const message = await service.resolveMessage('friend-msg-1')
    expect(message.id).toBe('friend-msg-1')
    await expect(service.resolveImage('friend-image.png')).resolves.toMatchObject({
      url: expect.stringMatching(/^data:image\/svg\+xml/),
      debug: {
        url: expect.stringMatching(/^data:image\/svg\+xml/),
        file: 'friend-image.png',
      },
    })
    await expect(service.resolveRecord('record.silk')).resolves.toMatchObject({
      url: 'https://example.com/record.silk',
      transcript: '这是一段模拟语音',
      debug: {
        url: 'https://example.com/record.silk',
        file: 'record.silk',
      },
    })
    await expect(service.transcribeRecord('friend-msg-8')).resolves.toBe('这是一段模拟语音')
  })

  it('stores sent videos as video messages in the mock environment', async () => {
    const service = createMockWebQQService(createMockWebQQScene())

    await service.sendMessage({
      type: 'friend',
      peerId: MOCK_FRIEND_ALICE_ID,
      elements: [{
        type: 'video',
        data: 'data:video/mp4;base64,AAAA',
        name: 'clip.mp4',
      }],
    })

    const sent = (await service.loadMessages({
      type: 'friend',
      peerId: MOCK_FRIEND_ALICE_ID,
      limit: 50,
    })).at(-1)
    expect(sent?.summary).toBe('[视频]')
    expect(sent?.elements).toEqual([{
      type: 'video',
      text: '[视频]',
      title: 'clip.mp4',
      url: 'data:video/mp4;base64,AAAA',
    }])
  })

  it('stops deriving extra mock robot profiles while the developer mock environment is enabled', () => {
    const virtualBot = {
      platform: 'onebot',
      selfId: '90001',
      name: '虚拟机器人',
      status: 1,
      hidden: true,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
    }
    const realBot = {
      platform: 'onebot',
      selfId: '10001',
      name: '真实机器人',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
    }
    const bots = [virtualBot, realBot]

    // 模拟环境下不再派生假画像：提供方插件里可以真的建多台虚拟机器人，走真实 action。
    expect(createOneBotWebQQService({ bots }, {
      includeVirtualBots: true,
      mockBotCount: 2,
    }).listBots().map((bot) => bot.selfId)).toEqual(['90001'])

    // 真实环境下这个配置项的行为一字不变。
    expect(createOneBotWebQQService({ bots }, { mockBotCount: 2 }).listBots().map((bot) => bot.selfId)).toEqual([
      '10001',
      '10001:mock:1',
      '10001:mock:2',
    ])
  })

  it('mutates in-memory state for key actions', async () => {
    const service = createMockWebQQService(createMockWebQQScene())

    expect(service.getSelectedSelfId()).toBe(MOCK_SELF_ID)
    expect(service.reconcileBotState().selectedSelfId).toBe(MOCK_SELF_ID)
    expect(service.isAvailableSelectedSelfId(MOCK_SELF_ID)).toBe(true)
    expect(service.selectSelfId(MOCK_SECOND_SELF_ID)).toBe(MOCK_SECOND_SELF_ID)
    expect(service.isSelectedSelfId(MOCK_SECOND_SELF_ID)).toBe(true)
    const secondBotMessages = await service.loadMessages({
      type: 'group',
      peerId: MOCK_GROUP_ID,
      limit: 20,
    })
    expect(secondBotMessages.find((message) => message.senderId === MOCK_SELF_ID)?.direction).toBe('incoming')
    const secondBotOwnMessage = secondBotMessages.find((message) => message.senderId === MOCK_SECOND_SELF_ID)
    expect(secondBotOwnMessage).toMatchObject({ direction: 'outgoing', senderRole: '管理员' })
    expect(secondBotOwnMessage).not.toHaveProperty('senderAffinity')
    expect(secondBotOwnMessage).not.toHaveProperty('senderRelationship')
    service.selectSelfId(MOCK_SELF_ID)

    await service.sendMessage({
      type: 'friend',
      peerId: MOCK_FRIEND_ALICE_ID,
      replyToMessageId: 'friend-msg-1',
      elements: [
        { type: 'text', text: 'mock reply' },
        { type: 'face', faceId: '76' },
      ],
    })
    const afterSend = await service.loadMessages({
      type: 'friend',
      peerId: MOCK_FRIEND_ALICE_ID,
      limit: 50,
    })
    const sent = afterSend[afterSend.length - 1]
    expect(sent?.direction).toBe('outgoing')
    expect(sent?.elements[0]).toMatchObject({
      type: 'quote',
      targetMessageId: 'friend-msg-1',
      title: 'Alice',
      text: '你好，这是一条文本消息',
    })
    expect(sent?.summary).toContain('mock reply')

    await service.sendMessage({
      type: 'group',
      peerId: MOCK_GROUP_ID,
      replyToMessageId: 'group-msg-1',
      elements: [
        { type: 'text', text: '前文 ' },
        { type: 'at', userId: MOCK_FRIEND_ALICE_ID },
        { type: 'text', text: ' 后文' },
      ],
    })
    const groupReply = (await service.loadMessages({
      type: 'group',
      peerId: MOCK_GROUP_ID,
      limit: 20,
    })).at(-1)
    expect(groupReply?.elements).toEqual([
      expect.objectContaining({ type: 'quote', targetMessageId: 'group-msg-1', title: 'Alice' }),
      { type: 'text', text: '前文 ' },
      { type: 'text', text: '@Alice' },
      { type: 'text', text: ' 后文' },
    ])

    await service.recallMessage({
      type: 'friend',
      peerId: MOCK_FRIEND_ALICE_ID,
      messageId: sent!.id,
    })
    const recalled = (await service.loadMessages({
      type: 'friend',
      peerId: MOCK_FRIEND_ALICE_ID,
      limit: 50,
    })).find((message) => message.id === sent!.id)
    expect(recalled?.recalled).toBe(true)

    await service.setMessageReaction({
      type: 'group',
      peerId: MOCK_GROUP_ID,
      messageId: 'group-msg-1',
      emojiId: '76',
      enabled: true,
    })
    const reacted = await service.resolveMessage('group-msg-1')
    expect(reacted.reactions?.some((reaction) => (
      reaction.emojiId === '76' && reaction.users?.some((user) => user.userId === MOCK_SELF_ID)
    ))).toBe(true)

    await service.setMessageReaction({
      type: 'friend',
      peerId: MOCK_FRIEND_ALICE_ID,
      messageId: 'friend-msg-1',
      emojiId: '66',
      enabled: true,
    })
    const privateReacted = await service.resolveMessage('friend-msg-1')
    expect(privateReacted.reactions?.some((reaction) => (
      reaction.emojiId === '66' && reaction.users?.some((user) => user.userId === MOCK_SELF_ID)
    ))).toBe(true)

    const selfProfile = await service.loadProfile({ userId: MOCK_SELF_ID, groupId: MOCK_GROUP_ID })
    expect(selfProfile).toMatchObject({ groupRole: '群主', rawRole: 'owner' })
    expect(selfProfile.canEditSelf).toBe(true)
    expect(selfProfile.canEditAvatar).toBe(true)
    await service.updateSelfProfile({
      nickname: '新模拟机器人',
      personalNote: 'updated note',
      sex: 'male',
      avatar: 'https://example.com/new-avatar.png',
    })
    const updatedSelf = await service.loadProfile({ userId: MOCK_SELF_ID })
    expect(updatedSelf.nickname).toBe('新模拟机器人')
    expect(updatedSelf.personalNote).toBe('updated note')
    expect(updatedSelf.sex).toBe('male')
    expect(updatedSelf.avatar).toBe('https://example.com/new-avatar.png')
    expect(service.listBots().find((bot) => bot.selfId === MOCK_SELF_ID)?.name).toBe('新模拟机器人')

    await service.performFriendAction({
      action: 'set-remark',
      targetId: MOCK_FRIEND_ALICE_ID,
      remark: 'Alice 备注',
    })
    expect((await service.loadContacts()).friends.find((friend) => friend.userId === MOCK_FRIEND_ALICE_ID)?.name).toBe('Alice 备注')

    await service.performFriendAction({
      action: 'delete',
      targetId: '20002',
    })
    expect((await service.loadContacts()).friends.some((friend) => friend.userId === '20002')).toBe(false)

    await service.performGroupAction({
      action: 'set-name',
      groupId: MOCK_GROUP_ID,
      name: '改名后的群',
    })
    await service.performGroupAction({
      action: 'set-card',
      groupId: MOCK_GROUP_ID,
      targetId: MOCK_FRIEND_ALICE_ID,
      card: '新名片',
    })
    await service.performGroupAction({
      action: 'set-title',
      groupId: MOCK_GROUP_ID,
      targetId: MOCK_FRIEND_ALICE_ID,
      title: '新头衔',
    })
    await service.performGroupAction({
      action: 'set-admin',
      groupId: MOCK_GROUP_ID,
      targetId: '20003',
      enabled: true,
    })
    let groupInfo = await service.loadGroupInfo({ groupId: MOCK_GROUP_ID })
    expect(groupInfo.members.find((member) => member.userId === '20003')?.role).toBe('管理员')
    await service.performGroupAction({
      action: 'set-admin',
      groupId: MOCK_GROUP_ID,
      targetId: '20003',
      enabled: false,
    })
    groupInfo = await service.loadGroupInfo({ groupId: MOCK_GROUP_ID })
    expect(groupInfo.members.find((member) => member.userId === '20003')?.role).toBe('成员')
    await service.performGroupAction({
      action: 'kick',
      groupId: MOCK_GROUP_ID,
      targetId: '20003',
    })
    groupInfo = await service.loadGroupInfo({ groupId: MOCK_GROUP_ID })
    expect((await service.loadContacts()).groups.find((group) => group.groupId === MOCK_GROUP_ID)?.name).toBe('改名后的群')
    expect(groupInfo.members.find((member) => member.userId === MOCK_FRIEND_ALICE_ID)).toMatchObject({
      card: '新名片',
      title: '新头衔',
    })
    expect(groupInfo.members.some((member) => member.userId === '20003')).toBe(false)

    await service.sendForward({
      type: 'group',
      peerId: MOCK_GROUP_ID,
      messageIds: ['group-msg-1', 'group-msg-2'],
    })
    const groupMessages = await service.loadMessages({
      type: 'group',
      peerId: MOCK_GROUP_ID,
      limit: 20,
    })
    expect(groupMessages[groupMessages.length - 1]?.elements[0]?.type).toBe('forward')

    const notices = await service.loadNotices()
    const friendRequest = notices.find((notice) => notice.type === 'friend-request')
    expect(friendRequest).toBeTruthy()
    await service.handleNotice({
      id: friendRequest!.id,
      type: 'friend-request',
      flag: friendRequest!.flag!,
      approve: true,
    })
    const afterNotice = await service.loadNotices()
    expect(afterNotice.some((notice) => notice.id === friendRequest!.id && notice.status === 'pending')).toBe(false)
    expect((await service.loadContacts()).friends.some((friend) => friend.userId === friendRequest!.requesterId)).toBe(true)

    await service.performGroupAction({
      action: 'leave',
      groupId: MOCK_GROUP_ID,
    })
    expect((await service.loadContacts()).groups.some((group) => group.groupId === MOCK_GROUP_ID)).toBe(false)
  })
})
