import { describe, expect, it } from 'vitest'
import type { WebQQGroupMember, WebQQMessage } from '../client/webqq/types'
import {
  canRecallWebQQMessage,
  canReactToWebQQMessage,
} from '../client/webqq/utils/webqq-message-permissions'

function createMessage(senderId: string, direction: WebQQMessage['direction'] = 'incoming'): WebQQMessage {
  return {
    id: 'message-1',
    sequence: '101',
    time: 1,
    senderId,
    senderName: senderId,
    senderAvatar: '',
    direction,
    summary: 'hello',
    elements: [{ type: 'text', text: 'hello' }],
  }
}

function createMember(userId: string, rawRole: WebQQGroupMember['rawRole']): WebQQGroupMember {
  return {
    userId,
    nickname: userId,
    card: '',
    avatar: '',
    rawRole,
  }
}

describe('WebQQ 消息操作权限', () => {
  it('允许在私聊和群聊的普通消息上贴表情', () => {
    const message = createMessage('20000')

    expect(canReactToWebQQMessage(message, 'friend', '10000')).toBe(true)
    expect(canReactToWebQQMessage(message, 'group', '10000')).toBe(true)
    expect(canReactToWebQQMessage({ ...message, recalled: true }, 'friend', '10000')).toBe(false)
  })

  it('允许群主或管理员撤回普通成员消息', () => {
    const target = createMessage('20000')
    const member = createMember('20000', 'member')

    expect(canRecallWebQQMessage(target, 'group', '10000', [
      createMember('10000', 'owner'),
      member,
    ])).toBe(true)
    expect(canRecallWebQQMessage(target, 'group', '10000', [
      createMember('10000', 'admin'),
      member,
    ])).toBe(true)
  })

  it('阻止管理员撤回群主或其他管理员消息', () => {
    const actor = createMember('10000', 'admin')

    expect(canRecallWebQQMessage(createMessage('20000'), 'group', '10000', [
      actor,
      createMember('20000', 'owner'),
    ])).toBe(false)
    expect(canRecallWebQQMessage(createMessage('30000'), 'group', '10000', [
      actor,
      createMember('30000', 'admin'),
    ])).toBe(false)
  })
})
