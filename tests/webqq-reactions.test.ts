import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { WebQQMessage } from '../client/webqq/types'
import { applyLocalWebQQReaction } from '../client/webqq/utils/webqq-interaction-state'

const reactionView = await readFile(new URL('../client/webqq/components/WebQQMessageReactions.vue', import.meta.url), 'utf8')
const messageStyles = await readFile(new URL('../client/webqq/styles/webqq-messages.scss', import.meta.url), 'utf8')
const interactionStyles = await readFile(new URL('../client/webqq/styles/webqq-interactions.scss', import.meta.url), 'utf8')

function createMessage(reactions: WebQQMessage['reactions'] = []): WebQQMessage {
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
    reactions,
  }
}

describe('WebQQ 贴表情展示', () => {
  it('本地新增贴表情时立即补全表情资源和操作者头像', () => {
    const [message] = applyLocalWebQQReaction([createMessage()], 'message-1', '76', '10000', true)

    expect(message.reactions).toEqual([{
      emojiId: '76',
      label: '赞',
      emojiUrl: expect.stringContaining('76'),
      count: 1,
      userId: '10000',
      userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=10000&s=640',
      users: [{
        userId: '10000',
        userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=10000&s=640',
      }],
    }])
  })

  it('给已有贴表情加一时把新操作者加入头像栈', () => {
    const [message] = applyLocalWebQQReaction([createMessage([{
      emojiId: '76',
      label: '赞',
      count: 1,
      users: [{ userId: '30000', userAvatar: 'https://example.com/30000.png' }],
    }])], '101', '76', '10000', true)

    expect(message.reactions?.[0]).toEqual(expect.objectContaining({
      count: 2,
      users: [
        { userId: '30000', userAvatar: 'https://example.com/30000.png' },
        { userId: '10000', userAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=10000&s=640' },
      ],
    }))
  })

  it('渲染时按表情 ID 查询资源，并使用与 sandbox 一致的纯色胶囊和头像栈', () => {
    expect(reactionView).toContain("import { getWebQQEmojiFace } from '../utils/emoji-catalog'")
    expect(reactionView).toContain('getFace(reaction.emojiId)?.url')
    expect(reactionView).toContain('getReactionUserAvatar(user)')
    expect(reactionView).not.toContain('onebot-webqq-webqq__message-reaction-count')
    expect(reactionView).not.toContain('shouldShowReactionCount')
    expect(messageStyles).toContain('background: var(--onebot-webqq-webqq-reaction-bg);')
    expect(messageStyles).toContain('padding: 1px;')
    expect(interactionStyles).not.toContain('background: inherit;')
    expect(interactionStyles).not.toContain('.onebot-webqq-webqq__message-reaction.is-mine')
  })
})
