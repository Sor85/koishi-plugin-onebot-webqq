import { describe, expect, it } from 'vitest'
import {
  createEmptyWebQQComposerDraft,
  detectWebQQMentionTrigger,
  filterWebQQMentionCandidates,
  insertWebQQComposerMention,
  replaceWebQQComposerTextRange,
  serializeWebQQComposerDraft,
} from '../client/webqq/utils/webqq-composer-draft'

describe('WebQQ 发送草稿', () => {
  it('按光标位置保留文字与提及的发送顺序', () => {
    const afterText = insertWebQQComposerMention(
      [{ type: 'text', text: '前文' }],
      0,
      2,
      { id: '20001', name: 'Alice' },
    )
    expect(serializeWebQQComposerDraft(afterText.tokens)).toEqual([
      { type: 'text', text: '前文 ' },
      { type: 'at', userId: '20001' },
      { type: 'text', text: ' ' },
    ])

    const beforeText = insertWebQQComposerMention(
      [{ type: 'text', text: '后文' }],
      0,
      0,
      { id: '20002', name: 'Bob' },
    )
    expect(serializeWebQQComposerDraft(beforeText.tokens)).toEqual([
      { type: 'at', userId: '20002' },
      { type: 'text', text: ' 后文' },
    ])
  })

  it('用键入的 @ 查询替换为原子 mention token', () => {
    const trigger = detectWebQQMentionTrigger('你好 @Ali', 7)
    expect(trigger).toEqual({ start: 3, query: 'Ali' })
    expect(detectWebQQMentionTrigger('消息中途@', 5)).toEqual({ start: 4, query: '' })
    expect(detectWebQQMentionTrigger('消息中途@Ali', 8)).toEqual({ start: 4, query: 'Ali' })

    const draft = replaceWebQQComposerTextRange(
      [{ type: 'text', text: '你好 @Ali 后文' }],
      0,
      trigger!.start,
      7,
      { id: '20001', name: 'Alice' },
    )
    expect(serializeWebQQComposerDraft(draft.tokens)).toEqual([
      { type: 'text', text: '你好 ' },
      { type: 'at', userId: '20001' },
      { type: 'text', text: ' 后文' },
    ])
  })

  it('支持按名称、账号和群名片关键字筛选候选成员', () => {
    const candidates = [
      { id: '20001', name: 'Alice', keywords: ['管理员'] },
      { id: '20002', name: 'Bob' },
    ]
    expect(filterWebQQMentionCandidates(candidates, '20002').map(({ id }) => id)).toEqual(['20002'])
    expect(filterWebQQMentionCandidates(candidates, '管理').map(({ id }) => id)).toEqual(['20001'])
    expect(createEmptyWebQQComposerDraft().tokens).toEqual([{ type: 'text', text: '' }])
  })
})
