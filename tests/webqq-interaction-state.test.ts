import { describe, expect, it } from 'vitest'
import type { WebQQMessage } from '../client/webqq/types'
import { applyLocalWebQQReaction, applyLocalWebQQRecall } from '../client/webqq/utils/webqq-interaction-state'

function createMessage(): WebQQMessage {
  return {
    id: 'message-1',
    sequence: '101',
    time: 1,
    senderId: '20000',
    senderName: 'Alice',
    senderAvatar: '',
    direction: 'incoming',
    summary: 'hello',
    elements: [{ type: 'text', text: 'hello' }],
    reactions: [{
      emojiId: '76',
      label: '赞',
      count: 2,
      userId: '10000',
      userAvatar: '',
      users: [
        { userId: '10000', userAvatar: '' },
        { userId: '30000', userAvatar: '' },
      ],
    }],
  }
}

describe('webqq local interaction state', () => {
  it('removes the current operator reaction immediately after a successful toggle', () => {
    const [message] = applyLocalWebQQReaction([createMessage()], 'message-1', '76', '10000', false)
    expect(message.reactions).toEqual([expect.objectContaining({
      emojiId: '76',
      count: 1,
      users: [{ userId: '30000', userAvatar: '' }],
    })])
  })

  it('removes an empty reaction capsule and marks recalled messages locally', () => {
    const source = createMessage()
    source.reactions = [{ emojiId: '76', label: '赞', count: 1, userId: '10000', userAvatar: '' }]
    const [withoutReaction] = applyLocalWebQQReaction([source], '101', '76', '10000', false)
    expect(withoutReaction.reactions).toEqual([])
    expect(applyLocalWebQQRecall([withoutReaction], 'group', '40000', '101')[0].recalled).toBe(true)
  })
})
