// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  composerEditable,
  composerMentions,
  composerText,
  focusComposerEnd,
  groupMentionCandidates,
  lastComposerSubmit,
  submittedComposerElements,
  mountWebQQComposer,
  pressComposerKey,
  setDomCaret,
  typeIntoComposer,
  unmountWebQQComposers,
} from './helpers/webqq-composer'

vi.mock('@koishijs/client', () => ({
  withProxy: (url: string) => url,
  Binary: { toBase64: (buffer: ArrayBuffer) => Buffer.from(buffer).toString('base64') },
}))

// 提及插入会自动补一个不换行空格，断言里显式写出来，避免和普通空格混淆。
const NBSP = ' '

afterEach(unmountWebQQComposers)

describe('WebQQ 输入区草稿与光标', () => {
  it('挂载后是空草稿：显示占位文案且不可发送', () => {
    const wrapper = mountWebQQComposer()
    expect(wrapper.find('.onebot-webqq-webqq__send-placeholder').exists()).toBe(true)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(composerText(wrapper)).toBe('')
  })

  it('把可编辑区里的输入读回草稿，占位文案随之消失', async () => {
    const wrapper = mountWebQQComposer()
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '晚上好')
    expect(composerText(wrapper)).toBe('晚上好')
    expect(wrapper.find('.onebot-webqq-webqq__send-placeholder').exists()).toBe(false)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('插入提及后光标落在提及之后，继续输入接在提及后面', async () => {
    const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
    await wrapper.setProps({ mentionRequest: { id: '20001', name: 'Alice' } })
    await flushPromises()
    expect(composerText(wrapper)).toBe(`@Alice${NBSP}`)

    await typeIntoComposer(wrapper, '晚上好')
    expect(composerText(wrapper)).toBe(`@Alice${NBSP}晚上好`)
    expect(composerMentions(wrapper)).toEqual([{ id: '20001', name: 'Alice' }])
  })

  it('光标停在提及之后的文字 token 中间时，新提及插在光标处', async () => {
    const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
    await wrapper.setProps({ mentionRequest: { id: '20001', name: 'Alice' } })
    await flushPromises()
    await typeIntoComposer(wrapper, '晚上好')

    const editor = composerEditable(wrapper).element
    const tail = editor.lastChild
    expect(tail?.textContent).toBe(`${NBSP}晚上好`)
    setDomCaret(tail!, 3)
    await composerEditable(wrapper).trigger('keyup')

    await wrapper.setProps({ mentionRequest: { id: '20002', name: 'Bob' } })
    await flushPromises()
    expect(composerMentions(wrapper)).toEqual([
      { id: '20001', name: 'Alice' },
      { id: '20002', name: 'Bob' },
    ])
    expect(composerText(wrapper)).toBe(`@Alice${NBSP}晚上 @Bob${NBSP}好`)
  })
})

describe('WebQQ 输入区输入法', () => {
  it('输入法进行中回车不发送，上屏后回车才发送', async () => {
    const wrapper = mountWebQQComposer()
    focusComposerEnd(wrapper)
    await composerEditable(wrapper).trigger('compositionstart')
    await typeIntoComposer(wrapper, '晚上好')
    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()

    await composerEditable(wrapper).trigger('compositionend')
    await flushPromises()
    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    expect(await submittedComposerElements(wrapper)).toEqual([{ type: 'text', text: '晚上好' }])
  })

  it('输入法进行中不弹提及菜单，上屏后才弹', async () => {
    const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
    focusComposerEnd(wrapper)
    await composerEditable(wrapper).trigger('compositionstart')
    await typeIntoComposer(wrapper, '@')
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu').exists()).toBe(false)

    await composerEditable(wrapper).trigger('compositionend')
    await flushPromises()
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu').exists()).toBe(true)
  })
})

describe('WebQQ 输入区发送交接', () => {
  it('回车把草稿交给会话层，会话层确认已发出后清空草稿', async () => {
    const wrapper = mountWebQQComposer()
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '早上好')
    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()

    const [, complete] = lastComposerSubmit(wrapper)
    expect(await submittedComposerElements(wrapper)).toEqual([{ type: 'text', text: '早上好' }])
    complete({ sent: true, restoreFocus: true })
    await flushPromises()
    expect(composerText(wrapper)).toBe('')
    expect(wrapper.find('.onebot-webqq-webqq__send-placeholder').exists()).toBe(true)
  })

  it('会话层报告没发出时草稿原样留着', async () => {
    const wrapper = mountWebQQComposer()
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '早上好')
    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()

    lastComposerSubmit(wrapper)[1]({ sent: false, restoreFocus: true })
    await flushPromises()
    expect(composerText(wrapper)).toBe('早上好')
  })

  it('会话层要求恢复焦点时焦点回到可编辑区，否则不抢焦点', async () => {
    const wrapper = mountWebQQComposer()
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '早上好')
    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    lastComposerSubmit(wrapper)[1]({ sent: true, restoreFocus: true })
    await flushPromises()
    expect(document.activeElement).toBe(composerEditable(wrapper).element)

    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '中午好')
    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    lastComposerSubmit(wrapper)[1]({ sent: true, restoreFocus: false })
    await flushPromises()
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('点发送按钮与回车走同一条提交路径', async () => {
    const wrapper = mountWebQQComposer()
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '早上好')
    await wrapper.get('form.onebot-webqq-webqq__send').trigger('submit')
    await flushPromises()
    expect(await submittedComposerElements(wrapper)).toEqual([{ type: 'text', text: '早上好' }])
  })

  it('发送中禁用可编辑区与按钮，回车不再提交', async () => {
    const wrapper = mountWebQQComposer({ sending: true })
    const editor = composerEditable(wrapper)
    expect(editor.attributes('contenteditable')).toBe('false')
    expect(editor.attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="选择文件"]').attributes('disabled')).toBeDefined()

    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('回复条的关闭按钮把清除回复交回会话层', async () => {
    const wrapper = mountWebQQComposer({ replyingTo: { senderName: 'Alice', summary: '晚上好' } })
    expect(wrapper.get('.onebot-webqq-webqq__reply-draft').text()).toContain('回复 Alice：晚上好')
    await wrapper.get('.onebot-webqq-webqq__reply-draft-close').trigger('click')
    expect(wrapper.emitted('clear-reply')).toHaveLength(1)
  })
})

describe('WebQQ 输入区切换会话', () => {
  it('切换会话清空草稿与提及菜单', async () => {
    const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '晚上好 @Ali')
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu').exists()).toBe(true)

    await wrapper.setProps({ chatKey: 'friend:30000' })
    await flushPromises()
    expect(composerText(wrapper)).toBe('')
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu').exists()).toBe(false)
  })
})
