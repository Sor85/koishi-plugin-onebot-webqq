import { send } from '@koishijs/client'
import type { WebQQContacts, WebQQGroupInfo, WebQQMessage, WebQQNotice } from '../state'

export interface WebQQMessageQuery {
  type: 'friend' | 'group'
  peerId: string
  beforeSequence?: string
}

export async function requestWebQQContacts() {
  return await send('chat-capsule/webqq/contacts') as WebQQContacts || { friends: [], groups: [] }
}

export async function requestWebQQMessages(query: WebQQMessageQuery) {
  return await send('chat-capsule/webqq/messages', query) as WebQQMessage[] || []
}

export async function requestWebQQGroupInfo(groupId: string) {
  return await send('chat-capsule/webqq/group-info', { groupId }) as WebQQGroupInfo || { announcements: [], members: [] }
}

export async function requestWebQQNotices() {
  return await send('chat-capsule/webqq/notices') as WebQQNotice[] || []
}

export async function approveWebQQNotice(notice: WebQQNotice, approve: boolean) {
  await send('chat-capsule/webqq/notice-action', {
    id: notice.id,
    type: notice.type,
    flag: notice.flag,
    subType: notice.subType,
    approve,
  })
}
