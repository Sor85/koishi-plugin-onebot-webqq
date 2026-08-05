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
  getGroupMemberKickDisabledReason,
  getGroupMemberMenuActions,
} from '../client/webqq/utils/group-menu'
import {
  buildGroupProfileCardModel,
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
})

describe('webqq profile card', () => {
  it('only surfaces real available fields', () => {
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
    expect(groupCard.fields[0]).toEqual({ group: 'group', label: '群成员', value: '3 人' })
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
