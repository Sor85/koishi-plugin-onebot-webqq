import { describe, expect, it } from 'vitest'
import { parseThinkContent, readCharacterAfterChatText } from '../../src/webqq/thinking'

describe('ChatLuna character thinking parser', () => {
  it('keeps searching payload candidates when an earlier response has no think tag', () => {
    const text = readCharacterAfterChatText({
      lastResponseMessage: {
        content: '这是已经清理后的回复',
      },
      completionMessages: [{
        lc: 1,
        type: 'constructor',
        id: ['langchain_core', 'messages', 'AIMessage'],
        kwargs: {
          content: '前文<think>\n从完整快照读取\n</think>后文',
        },
      }],
    })

    expect(parseThinkContent(text)).toBe('从完整快照读取')
  })
})
