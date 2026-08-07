import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  MOCK_FRIEND_ALICE_ID,
  MOCK_GROUP_ID,
  MOCK_SELF_ID,
  createMockWebQQScene,
} from '../src/webqq/adapters/mock/scene'
import { createMockWebQQService } from '../src/webqq/adapters/mock/service'

const configSource = await readFile(new URL('../src/config.ts', import.meta.url), 'utf8')
const runtimeSource = await readFile(new URL('../src/runtime/create-runtime.ts', import.meta.url), 'utf8')

describe('webqq mock environment', () => {
  it('exposes webQQMockEnvironment in developer options with default false', () => {
    expect(configSource).toContain('webQQMockEnvironment?: boolean')
    expect(configSource).toContain("webQQMockEnvironment: Schema.boolean().default(false).description('启用 WebQQ 开发者模拟环境，使用内存预设场景代替真实 OneBot')")
    expect(configSource).toContain(".description('开发者选项')")
    expect(configSource).not.toContain("description('启用 WebQQ 开发者模拟环境，使用内存预设场景代替真实 OneBot。')")
    expect(configSource).not.toContain("description('启用 WebQQ 开发者模拟环境，使用内存预设场景代替真实 OneBot.')")
  })

  it('createPluginRuntime selects mock service when webQQMockEnvironment is enabled', () => {
    expect(runtimeSource).toContain("import { createMockWebQQService } from '../webqq/adapters/mock/service'")
    expect(runtimeSource).toContain('config.webQQMockEnvironment')
    expect(runtimeSource).toContain('createMockWebQQService()')
    expect(runtimeSource).toContain('createOneBotWebQQService(ctx, {')
  })

  it('loads preset contacts, message element types, reactions and recalled messages', async () => {
    const service = createMockWebQQService(createMockWebQQScene())
    const contacts = await service.loadContacts()
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

    const users = await service.loadReactionUsers(groupMessages[0]!.id, groupMessages[0]!.reactions![0]!.emojiId, 10)
    expect(users.length).toBeGreaterThan(0)
    expect(service.supportsReactionUsers()).toBe(true)

    const groupInfo = await service.loadGroupInfo({ groupId: MOCK_GROUP_ID })
    expect(groupInfo.members.length).toBeGreaterThan(0)
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
      url: 'https://example.com/friend-image.png',
      debug: {
        url: 'https://example.com/friend-image.png',
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

  it('mutates in-memory state for key actions', async () => {
    const service = createMockWebQQService(createMockWebQQScene())

    expect(service.getSelectedSelfId()).toBe(MOCK_SELF_ID)
    expect(service.reconcileBotState().selectedSelfId).toBe(MOCK_SELF_ID)
    expect(service.isAvailableSelectedSelfId(MOCK_SELF_ID)).toBe(true)
    expect(service.selectSelfId('10002')).toBe('10002')
    expect(service.isSelectedSelfId('10002')).toBe(true)
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
    expect(sent?.elements.some((element) => element.type === 'quote')).toBe(true)
    expect(sent?.summary).toContain('mock reply')

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

    const selfProfile = await service.loadProfile({ userId: MOCK_SELF_ID, groupId: MOCK_GROUP_ID })
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
      action: 'set-admin',
      groupId: MOCK_GROUP_ID,
      targetId: '20003',
      enabled: true,
    })
    await service.performGroupAction({
      action: 'kick',
      groupId: MOCK_GROUP_ID,
      targetId: '20003',
    })
    const groupInfo = await service.loadGroupInfo({ groupId: MOCK_GROUP_ID })
    expect((await service.loadContacts()).groups.find((group) => group.groupId === MOCK_GROUP_ID)?.name).toBe('改名后的群')
    expect(groupInfo.members.find((member) => member.userId === MOCK_FRIEND_ALICE_ID)?.card).toBe('新名片')
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
