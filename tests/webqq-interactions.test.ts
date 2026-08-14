import { describe, expect, it } from 'vitest'
import {
  getCommonWebQQEmojiFaces,
  getWebQQEmojiFace,
  loadRecentWebQQEmojiIds,
  rememberWebQQEmojiId,
  searchWebQQEmojiFaces,
} from '../client/webqq/utils/emoji-catalog'
import { getFriendMenuActions } from '../client/webqq/utils/friend-menu'
import {
  getGroupMemberInteractionActions,
  getGroupMemberKickDisabledReason,
  getGroupMemberManagementActions,
  getGroupMemberMenuActions,
  hasGroupMemberManagementMenu,
} from '../client/webqq/utils/group-menu'
import {
  buildGroupProfileCardModel,
  buildProfileCardModelFromProfile,
  buildUserProfileCardModel,
  groupProfileCardFields,
} from '../client/webqq/utils/profile-card'

describe('webqq interaction menus', () => {
  it('returns friend menu actions by relationship state', () => {
    expect(getFriendMenuActions({ isFriend: false, pendingOutgoing: false, pendingIncoming: false }, true)).toEqual([])
    expect(getFriendMenuActions({ isFriend: false, pendingOutgoing: true, pendingIncoming: false }, true)).toEqual([])
    expect(getFriendMenuActions({ isFriend: true, pendingOutgoing: false, pendingIncoming: false }, true)).toEqual(['poke', 'remark', 'delete'])
    expect(getFriendMenuActions({ isFriend: true, pendingOutgoing: false, pendingIncoming: false }, false)).toEqual(['remark', 'delete'])
  })

  it('gates group member actions by role without fabricating permissions', () => {
    const owner = { userId: '1', role: '群主' }
    const admin = { userId: '2', role: '管理员' }
    const member = { userId: '3', role: '成员' }

    expect(getGroupMemberMenuActions(owner, member)).toEqual([
      'mention',
      'poke',
      'set-card',
      'set-title',
      'set-admin',
      'kick',
    ])
    expect(getGroupMemberMenuActions(admin, member)).toEqual(['mention', 'poke', 'set-card', 'kick'])
    expect(getGroupMemberMenuActions(admin, owner)).toEqual(['mention', 'poke'])
    expect(getGroupMemberMenuActions(member, admin)).toEqual(['mention', 'poke'])
    expect(getGroupMemberKickDisabledReason(member, admin)).toBe('需要管理员权限才能踢人')
    expect(getGroupMemberKickDisabledReason(admin, owner)).toBe('管理员不能管理群主或管理员')
  })

  it('separates group member interactions from management menu content', () => {
    const owner = { userId: '1', role: '群主' }
    const admin = { userId: '2', role: '管理员' }
    const member = { userId: '3', role: '成员' }

    expect(getGroupMemberInteractionActions(owner, member)).toEqual(['mention', 'poke'])
    expect(getGroupMemberManagementActions(owner, member)).toEqual([
      'set-card',
      'set-title',
      'set-admin',
      'kick',
    ])
    expect(getGroupMemberManagementActions(admin, member)).toEqual(['set-card', 'kick'])
    expect(getGroupMemberManagementActions(member, admin)).toEqual([])
    expect(getGroupMemberInteractionActions(owner, owner)).toEqual([])
    expect(getGroupMemberManagementActions(owner, owner)).toEqual(['set-card', 'set-title'])
    expect(getGroupMemberInteractionActions(undefined, member)).toEqual([])
    expect(getGroupMemberManagementActions(undefined, member)).toEqual([])

    const allActions = getGroupMemberMenuActions(owner, member)
    expect([
      ...getGroupMemberInteractionActions(owner, member),
      ...getGroupMemberManagementActions(owner, member),
    ]).toEqual(allActions)
    expect(hasGroupMemberManagementMenu(owner, member)).toBe(true)
    expect(hasGroupMemberManagementMenu(member, admin)).toBe(true)
    expect(hasGroupMemberManagementMenu(undefined, member)).toBe(false)
  })
})

describe('webqq profile card', () => {
  it('keeps identity fields in their sections after moving the avatar to the top', () => {
    const card = buildUserProfileCardModel({
      userId: '10001',
      name: '测试用户',
      avatar: 'https://example.com/a.png',
      personalNote: '签名',
      isFriend: true,
      remark: '备注名',
      group: { groupId: '200', name: '测试群', memberCount: 2, avatar: '' },
      member: { userId: '10001', nickname: '昵称', card: '名片', avatar: '', role: '管理员' },
      accountFields: [{ label: '性别', value: '男' }, { label: '空值', value: '' }],
    })

    expect(card.personalNote).toBe('签名')
    expect(card.fields.map((field) => field.label)).toEqual([
      '昵称',
      'QQ',
      '性别',
      '好友关系',
      '好友备注',
      '所在群',
      '群号',
      '群身份',
      '群名片',
      '昵称',
    ])
    expect(groupProfileCardFields(card.fields).map((section) => section.group)).toEqual([
      'account',
      'friendship',
      'group-member',
    ])

    const groupCard = buildGroupProfileCardModel({ groupId: '200', name: '测试群', memberCount: 3, avatar: '' })
    expect(groupCard.identityLabel).toBe('群号')
    expect(groupCard.fields).toEqual([
      { group: 'group', label: '群名称', value: '测试群' },
      { group: 'group', label: '群号', value: '200' },
      { group: 'group', label: '群成员', value: '3 人' },
    ])
  })

  it('marks only editable self account fields and preserves empty edit entries', () => {
    const card = buildProfileCardModelFromProfile({
      kind: 'bot',
      id: '10000',
      name: '机器人',
      avatar: 'https://example.com/avatar.png',
      nickname: '机器人',
      fields: [
        { group: '基础', label: '昵称', value: '机器人' },
        { group: '基础', label: 'QQ', value: '10000' },
        { group: '机器人运行', label: '状态', value: '在线' },
      ],
      canEditSelf: true,
      canEditAvatar: true,
    })

    expect(card.fields.filter((field) => field.editKey).map((field) => [field.label, field.editKey, field.value])).toEqual([
      ['昵称', 'nickname', '机器人'],
      ['性别', 'sex', ''],
      ['签名', 'personalNote', ''],
    ])
    expect(card.fields.find((field) => field.label === 'QQ')?.editKey).toBeUndefined()
    expect(card.canEditAvatar).toBe(true)
  })
})

describe('webqq emoji catalog', () => {
  it('searches faces and remembers recent ids', () => {
    const common = getCommonWebQQEmojiFaces()
    expect(common.length).toBeGreaterThan(0)
    expect(getWebQQEmojiFace(common[0].id)?.id).toBe(common[0].id)

    const storage = {
      data: '' as string,
      getItem() { return this.data || null },
      setItem(_key: string, value: string) { this.data = value },
    }
    expect(loadRecentWebQQEmojiIds(storage)).toEqual([])
    expect(rememberWebQQEmojiId(common[0].id, storage)).toEqual([common[0].id])
    expect(rememberWebQQEmojiId(common[1]?.id || '2', storage)[0]).toBe(common[1]?.id || '2')
    expect(searchWebQQEmojiFaces(common[0].label.slice(0, 1)).length).toBeGreaterThan(0)
  })
})
