import { describe, expect, it } from 'vitest'
import { sortWebQQGroupMembers, useBotAvatarThemeColor, webQQAccentColor, webQQAvatarAccentColor, webQQChatStyle, webQQTheme, type WebQQGroupMember } from '../client/state'

function member(userId: string, card: string, role?: string, nickname = card): WebQQGroupMember {
  return {
    userId,
    nickname,
    card,
    avatar: '',
    ...(role ? { role } : {}),
  }
}

describe('webqq group members', () => {
  it('uses the fresh WebQQ theme as the frontend default', () => {
    expect(webQQTheme.value).toBe('fresh')
    expect(webQQChatStyle.value).toBe('qq')
    expect(webQQAccentColor.value).toBe('#2563eb')
    expect(webQQAvatarAccentColor.value).toBe('')
    expect(useBotAvatarThemeColor.value).toBe(false)
  })

  it('sorts owner first, then admins and members by A-Z display name', () => {
    const members = [
      member('5', 'zulu'),
      member('3', 'charlie', '管理员'),
      member('2', 'bravo'),
      member('4', 'alpha', '管理员'),
      member('1', 'owner', '群主'),
    ]

    expect(sortWebQQGroupMembers(members).map((item) => item.userId)).toEqual(['1', '4', '3', '2', '5'])
    expect(members.map((item) => item.userId)).toEqual(['5', '3', '2', '4', '1'])
  })

  it('places symbol-prefixed names after Z inside the same role group', () => {
    const members = [
      member('1', '#hash', '管理员'),
      member('2', 'zulu', '管理员'),
      member('3', 'alpha', '管理员'),
      member('4', '_under', '管理员'),
    ]

    const sortedIds = sortWebQQGroupMembers(members).map((item) => item.userId)

    expect(sortedIds.slice(0, 2)).toEqual(['3', '2'])
    expect(sortedIds.slice(2)).toEqual(expect.arrayContaining(['1', '4']))
  })
})
