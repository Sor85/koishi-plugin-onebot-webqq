import { send } from '@koishijs/client'
import type { WebQQContacts, WebQQGroupInfo, WebQQMessage, WebQQNotice } from '../state'

export interface WebQQMessageQuery {
  type: 'friend' | 'group'
  peerId: string
  beforeSequence?: string
}

export async function requestWebQQContacts() {
  return await send('onebot-webqq/webqq/contacts') as WebQQContacts || { friends: [], groups: [] }
}

export async function requestWebQQMessages(query: WebQQMessageQuery) {
  return await send('onebot-webqq/webqq/messages', query) as WebQQMessage[] || []
}

export async function requestWebQQRecordTranscription(messageId: string) {
  return await send('onebot-webqq/webqq/record/transcribe', { messageId }) as string || ''
}

export async function requestWebQQGroupInfo(groupId: string) {
  return await send('onebot-webqq/webqq/group-info', { groupId }) as WebQQGroupInfo || { announcements: [], members: [] }
}

export async function requestWebQQNotices() {
  return await send('onebot-webqq/webqq/notices') as WebQQNotice[] || []
}

export async function approveWebQQNotice(notice: WebQQNotice, approve: boolean) {
  await send('onebot-webqq/webqq/notice-action', {
    id: notice.id,
    type: notice.type,
    flag: notice.flag,
    subType: notice.subType,
    approve,
  })
}
