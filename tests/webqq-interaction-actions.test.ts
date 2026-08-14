import { describe, expect, it, vi } from 'vitest'
import { createOneBotWebQQService } from '../src/webqq/adapters/onebot/service'

function createBot(internal: Record<string, unknown> = {}) {
  return {
    platform: 'onebot',
    selfId: '10000',
    status: 1,
    internal: {
      get_friend_list: vi.fn(async () => []),
      get_group_list: vi.fn(async () => []),
      ...internal,
    } as Record<string, any>,
  }
}

describe('webqq interaction actions', () => {
  it('sends reply / at / face segments and recalls messages through OneBot', async () => {
    const bot = createBot({
      send_group_msg: vi.fn(async () => ({ message_id: 1 })),
      delete_msg: vi.fn(async () => ({})),
    })
    const service = createOneBotWebQQService({ bots: [bot] })

    await service.sendMessage({
      type: 'group',
      peerId: '20000',
      replyToMessageId: '12345',
      elements: [
        { type: 'at', userId: '30000' },
        { type: 'text', text: ' hello' },
        { type: 'face', faceId: '76' },
      ],
    })
    await service.recallMessage({
      type: 'group',
      peerId: '20000',
      messageId: '12345',
    })

    expect(bot.internal.send_group_msg).toHaveBeenCalledWith({
      group_id: 20000,
      message: [
        { type: 'reply', data: { id: '12345' } },
        { type: 'at', data: { qq: '30000' } },
        { type: 'text', data: { text: ' hello' } },
        { type: 'face', data: { id: '76' } },
      ],
    })
    expect(bot.internal.delete_msg).toHaveBeenCalledWith({ message_id: 12345 })
  })

  it('sends browser videos as native OneBot video segments in group and private chats', async () => {
    const bot = createBot({
      send_group_msg: vi.fn(async () => ({ message_id: 1 })),
      send_private_msg: vi.fn(async () => ({ message_id: 2 })),
    })
    const service = createOneBotWebQQService({ bots: [bot] })
    const video = {
      type: 'video' as const,
      data: 'data:video/mp4;base64,AAAA',
      name: 'clip.mp4',
    }

    await service.sendMessage({
      type: 'group',
      peerId: '20000',
      elements: [video],
    })
    await service.sendMessage({
      type: 'friend',
      peerId: '30000',
      elements: [video],
    })

    const message = [{
      type: 'video',
      data: {
        file: 'base64://AAAA',
        name: 'clip.mp4',
      },
    }]
    expect(bot.internal.send_group_msg).toHaveBeenCalledWith({ group_id: 20000, message })
    expect(bot.internal.send_private_msg).toHaveBeenCalledWith({ user_id: 30000, message })
  })

  it('sets group and private message reactions with NapCat set flag', async () => {
    const bot = createBot({
      set_msg_emoji_like: vi.fn(async () => ({})),
    })
    const service = createOneBotWebQQService({ bots: [bot] })

    await service.setMessageReaction({
      type: 'group',
      peerId: '20000',
      messageId: '88',
      emojiId: '76',
      enabled: false,
    })
    await service.setMessageReaction({
      type: 'friend',
      peerId: '30000',
      messageId: '89',
      emojiId: '66',
      enabled: true,
    })

    expect(bot.internal.set_msg_emoji_like).toHaveBeenNthCalledWith(1, {
      message_id: 88,
      emoji_id: '76',
      set: false,
    })
    expect(bot.internal.set_msg_emoji_like).toHaveBeenNthCalledWith(2, {
      message_id: 89,
      emoji_id: '66',
      set: true,
    })
  })

  it('loads stranger + optional group member profile and only allows self edit when supported', async () => {
    const bot = createBot({
      get_stranger_info: vi.fn(async () => ({
        user_id: 30000,
        nickname: 'Alice',
        sex: '1',
        age: 18,
        personal_note: 'hello',
      })),
      get_group_member_info: vi.fn(async () => ({
        user_id: 30000,
        nickname: 'Alice',
        card: '群名片',
        role: 'admin',
        title: '头衔',
      })),
      set_qq_profile: vi.fn(async () => ({})),
      set_qq_avatar: vi.fn(async () => ({})),
    })
    const service = createOneBotWebQQService({ bots: [bot] })

    await expect(service.loadProfile({
      userId: '30000',
      groupId: '20000',
    })).resolves.toMatchObject({
      kind: 'user',
      id: '30000',
      name: 'Alice',
      sex: 'male',
      age: 18,
      personalNote: 'hello',
      groupCard: '群名片',
      groupTitle: '头衔',
      groupRole: '管理员',
      rawRole: 'admin',
    })
    expect(bot.internal.get_stranger_info).toHaveBeenCalledWith({ user_id: 30000 })
    expect(bot.internal.get_group_member_info).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 30000,
    })

    const selfProfile = await service.loadProfile({ userId: '10000' })
    expect(selfProfile).toMatchObject({
      kind: 'bot',
      id: '10000',
      canEditSelf: true,
      canEditAvatar: true,
    })

    await service.updateSelfProfile({
      nickname: '新昵称',
      personalNote: '新签名',
      avatar: 'https://example.com/avatar.png',
    })
    expect(bot.internal.set_qq_avatar).toHaveBeenCalledWith({
      file: 'https://example.com/avatar.png',
    })
    expect(bot.internal.set_qq_profile).toHaveBeenCalledWith({
      nickname: '新昵称',
      personal_note: '新签名',
    })
  })

  it('gates friend actions and falls back across poke aliases', async () => {
    const bot = createBot({
      delete_friend: vi.fn(async () => ({})),
      set_friend_remark: vi.fn(async () => ({})),
      friend_poke: vi.fn(async () => ({})),
    })
    const service = createOneBotWebQQService({ bots: [bot] })

    await service.performFriendAction({ action: 'delete', targetId: '30000' })
    await service.performFriendAction({ action: 'set-remark', targetId: '30000', remark: '备注' })
    await service.performFriendAction({ action: 'poke', targetId: '30000' })

    expect(bot.internal.delete_friend).toHaveBeenCalledWith({ user_id: 30000 })
    expect(bot.internal.set_friend_remark).toHaveBeenCalledWith({
      user_id: 30000,
      remark: '备注',
    })
    expect(bot.internal.friend_poke).toHaveBeenCalledWith({ user_id: 30000 })
    await expect(service.performFriendAction({ action: 'poke', targetId: '10000' })).rejects.toThrow('不能戳自己')
    expect(bot.internal.friend_poke).toHaveBeenCalledTimes(1)

    const unsupported = createOneBotWebQQService({
      bots: [createBot()],
    })
    await expect(unsupported.performFriendAction({
      action: 'set-remark',
      targetId: '30000',
      remark: 'x',
    })).rejects.toThrow(/不支持/)
  })

  it('routes group actions to standard OneBot methods', async () => {
    const bot = createBot({
      set_group_kick: vi.fn(async () => ({})),
      set_group_admin: vi.fn(async () => ({})),
      set_group_card: vi.fn(async () => ({})),
      set_group_special_title: vi.fn(async () => ({})),
      set_group_name: vi.fn(async () => ({})),
      set_group_leave: vi.fn(async () => ({})),
      group_poke: vi.fn(async () => ({})),
    })
    const service = createOneBotWebQQService({ bots: [bot] })

    await service.performGroupAction({ action: 'kick', groupId: '20000', targetId: '30000' })
    await service.performGroupAction({ action: 'set-admin', groupId: '20000', targetId: '30000', enabled: true })
    await service.performGroupAction({ action: 'set-card', groupId: '20000', targetId: '30000', card: '名片' })
    await service.performGroupAction({ action: 'set-title', groupId: '20000', targetId: '30000', title: '头衔' })
    await service.performGroupAction({ action: 'set-name', groupId: '20000', name: '新群名' })
    await service.performGroupAction({ action: 'leave', groupId: '20000' })
    await service.performGroupAction({ action: 'poke', groupId: '20000', targetId: '30000' })

    expect(bot.internal.set_group_kick).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 30000,
    })
    expect(bot.internal.set_group_admin).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 30000,
      enable: true,
    })
    expect(bot.internal.set_group_card).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 30000,
      card: '名片',
    })
    expect(bot.internal.set_group_special_title).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 30000,
      special_title: '头衔',
    })
    expect(bot.internal.set_group_name).toHaveBeenCalledWith({
      group_id: 20000,
      group_name: '新群名',
    })
    expect(bot.internal.set_group_leave).toHaveBeenCalledWith({ group_id: 20000 })
    expect(bot.internal.group_poke).toHaveBeenCalledWith({
      group_id: 20000,
      user_id: 30000,
    })
  })

  it('sends forward messages via specialized then generic actions', async () => {
    const specialized = createBot({
      send_group_forward_msg: vi.fn(async () => ({ message_id: 1 })),
    })
    const specializedService = createOneBotWebQQService({ bots: [specialized] })
    await specializedService.sendForward({
      type: 'group',
      peerId: '20000',
      messageIds: ['11', '12'],
    })
    expect(specialized.internal.send_group_forward_msg).toHaveBeenCalledWith({
      group_id: 20000,
      messages: [
        { type: 'node', data: { id: '11' } },
        { type: 'node', data: { id: '12' } },
      ],
    })

    const generic = createBot({
      send_private_forward_msg: vi.fn(async () => {
        throw new Error('missing')
      }),
      send_forward_msg: vi.fn(async () => ({ message_id: 2 })),
    })
    const genericService = createOneBotWebQQService({ bots: [generic] })
    await genericService.sendForward({
      type: 'friend',
      peerId: '30000',
      messageIds: ['21'],
    })
    expect(generic.internal.send_private_forward_msg).toHaveBeenCalled()
    expect(generic.internal.send_forward_msg).toHaveBeenCalledWith({
      user_id: 30000,
      messages: [{ type: 'node', data: { id: '21' } }],
    })
  })

  it('throws explicit errors when write actions are unsupported', async () => {
    const service = createOneBotWebQQService({
      bots: [createBot()],
    })

    await expect(service.recallMessage({
      type: 'friend',
      peerId: '30000',
      messageId: '1',
    })).rejects.toThrow('当前 OneBot 实现不支持 delete_msg')
    await expect(service.setMessageReaction({
      type: 'group',
      peerId: '20000',
      messageId: '1',
      emojiId: '76',
      enabled: true,
    })).rejects.toThrow('当前 OneBot 实现不支持 set_msg_emoji_like')
    await expect(service.performGroupAction({
      action: 'kick',
      groupId: '20000',
      targetId: '30000',
    })).rejects.toThrow('当前 OneBot 实现不支持 set_group_kick')
    await expect(service.updateSelfProfile({
      nickname: 'x',
    })).rejects.toThrow('当前 OneBot 实现不支持 set_qq_profile')
  })
})
