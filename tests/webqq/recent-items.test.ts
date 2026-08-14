import { describe, expect, it } from 'vitest'
import {
  getRecentItems,
  hideRecentConversation,
  revealRecentConversation,
} from '../../client/webqq/utils/webqq-contact-view'
import type { WebQQContacts } from '../../client/webqq/types'

const contacts: WebQQContacts = {
  friends: [{
    userId: '30000',
    name: 'Alice',
    nickname: 'Alice Nick',
    avatar: 'https://example.com/alice.png',
  }],
  groups: [{
    groupId: '20000',
    name: 'Guild',
    avatar: 'https://example.com/guild.png',
    memberCount: 3,
  }],
  recent: [{
    type: 'friend',
    peerId: '30000',
    name: 'Alice',
    subtitle: 'Alice Nick',
    avatar: 'https://example.com/alice.png',
    summary: '你好',
    time: 2,
  }, {
    type: 'group',
    peerId: '20000',
    name: 'Guild',
    subtitle: '群聊 20000 · 3 人',
    avatar: 'https://example.com/guild.png',
    summary: '在吗',
    time: 1,
  }],
}

describe('webqq recent items', () => {
  it('hides a recent conversation without removing the contact', () => {
    const hidden = hideRecentConversation([], 'friend', '30000')
    expect(hidden).toEqual(['friend:30000'])
    expect(getRecentItems(contacts, {}, hidden).map((item) => item.peerId)).toEqual(['20000'])
    expect(contacts.friends).toHaveLength(1)
    expect(contacts.groups).toHaveLength(1)
  })

  it('brings a hidden conversation back after it is revealed', () => {
    const hidden = hideRecentConversation(['friend:30000'], 'group', '20000')
    expect(revealRecentConversation(hidden, 'friend', '30000')).toEqual(['group:20000'])
  })
})
