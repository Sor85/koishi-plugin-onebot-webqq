// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  composerEditable,
  composerMentions,
  composerText,
  focusComposerEnd,
  groupMentionCandidates,
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

const NBSP = " "

afterEach(unmountWebQQComposers)

function mentionOptions(wrapper: ReturnType<typeof mountWebQQComposer>) {
  return wrapper.findAll('.onebot-webqq-webqq__mention-menu-item')
}

function activeMentionName(wrapper: ReturnType<typeof mountWebQQComposer>) {
  return mentionOptions(wrapper).find((option) => option.classes().includes('is-active'))?.get('strong').text()
}

async function openMentionMenu(query = '') {
  const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
  focusComposerEnd(wrapper)
  await typeIntoComposer(wrapper, `@${query}`)
  return wrapper
}

/** 先点进空输入框打字、再把光标移回文字中间：此时 DOM 偏移比草稿 token 偏移多一个零宽锚点。 */
async function openMentionMenuMidText() {
  const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
  focusComposerEnd(wrapper)
  await typeIntoComposer(wrapper, '你好世界')
  const node = composerEditable(wrapper).element.firstChild as Text
  setDomCaret(node, node.data.indexOf('世'))
  await typeIntoComposer(wrapper, '@')
  await flushPromises()
  return wrapper
}

describe('WebQQ 输入区提及菜单', () => {
  it('键入 @ 打开菜单并按查询串筛选候选', async () => {
    const wrapper = await openMentionMenu()
    expect(mentionOptions(wrapper).map((option) => option.get('strong').text())).toEqual(['Alice', 'Bob'])

    await typeIntoComposer(wrapper, 'Al')
    expect(mentionOptions(wrapper).map((option) => option.get('strong').text())).toEqual(['Alice'])
  })

  it('查询串也匹配群名片关键字', async () => {
    const wrapper = await openMentionMenu('管理')
    expect(mentionOptions(wrapper).map((option) => option.get('strong').text())).toEqual(['Bob'])
  })

  it('在已有文字后面键入 @ 一样打开菜单', async () => {
    const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '晚上好')
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu').exists()).toBe(false)

    await typeIntoComposer(wrapper, '@')
    expect(mentionOptions(wrapper).map((option) => option.get('strong').text())).toEqual(['Alice', 'Bob'])
  })

  it('可编辑区的 input 早于光标更新时，下一微任务按真实光标补开菜单', async () => {
    const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '晚上好')

    // 模拟 contenteditable 的 input 抢在 Selection 之前：同步派发事件，光标还停在旧位置。
    const editor = composerEditable(wrapper).element
    const node = editor.lastChild!
    node.textContent = `${node.textContent}@`
    setDomCaret(node, 1)
    editor.dispatchEvent(new Event('input'))
    setDomCaret(node, node.textContent?.length ?? 0)
    await flushPromises()
    expect(mentionOptions(wrapper)).toHaveLength(2)

    // 光标一直没追上来时，补读也读不到 @，菜单保持关闭。
    await pressComposerKey(wrapper, 'Escape')
    node.textContent = `${node.textContent}@`
    setDomCaret(node, 1)
    editor.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu').exists()).toBe(false)
  })

  it('方向键改变选中项并循环', async () => {
    const wrapper = await openMentionMenu()
    expect(activeMentionName(wrapper)).toBe('Alice')

    await pressComposerKey(wrapper, 'ArrowDown')
    expect(activeMentionName(wrapper)).toBe('Bob')

    await pressComposerKey(wrapper, 'ArrowDown')
    expect(activeMentionName(wrapper)).toBe('Alice')

    await pressComposerKey(wrapper, 'ArrowUp')
    expect(activeMentionName(wrapper)).toBe('Bob')
  })

  it('回车把查询串换成一个原子提及 token', async () => {
    const wrapper = await openMentionMenu('Al')
    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    expect(composerText(wrapper)).toBe(`@Alice${NBSP}`)
    expect(composerMentions(wrapper)).toEqual([{ id: '20001', name: 'Alice' }])
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu').exists()).toBe(false)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('Tab 与回车走同一条选中路径', async () => {
    const wrapper = await openMentionMenu()
    await pressComposerKey(wrapper, 'ArrowDown')
    await pressComposerKey(wrapper, 'Tab')
    await flushPromises()
    expect(composerMentions(wrapper)).toEqual([{ id: '20002', name: 'Bob' }])
  })

  it('鼠标按下候选同样选中，移入候选改变选中项', async () => {
    const wrapper = await openMentionMenu()
    await mentionOptions(wrapper)[1].trigger('mouseenter')
    expect(activeMentionName(wrapper)).toBe('Bob')

    await mentionOptions(wrapper)[1].trigger('mousedown')
    await flushPromises()
    expect(composerMentions(wrapper)).toEqual([{ id: '20002', name: 'Bob' }])
  })

  it('Escape 只关菜单，草稿原样留着', async () => {
    const wrapper = await openMentionMenu('Al')
    await pressComposerKey(wrapper, 'Escape')
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu').exists()).toBe(false)
    expect(composerText(wrapper)).toBe('@Al')
    expect(composerMentions(wrapper)).toEqual([])
  })

  it('没有候选可提及时（私聊）不开菜单', async () => {
    const wrapper = mountWebQQComposer()
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '@Ali')
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu').exists()).toBe(false)
    expect(composerText(wrapper)).toBe('@Ali')
  })
})

describe('WebQQ 输入区在文字中间提及', () => {
  it('光标停在文字中间键入 @ 时，候选菜单按空查询串列出全部成员', async () => {
    const wrapper = await openMentionMenuMidText()
    expect(mentionOptions(wrapper).map((option) => option.get('strong').text())).toEqual(['Alice', 'Bob'])
  })

  it('在文字中间选中候选，提及插在光标处而不是偏一位', async () => {
    const wrapper = await openMentionMenuMidText()
    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    expect(composerText(wrapper)).toBe(`你好 @Alice${NBSP}世界`)
    expect(composerMentions(wrapper)).toEqual([{ id: '20001', name: 'Alice' }])
  })
})

describe('WebQQ 输入区外部提及请求', () => {
  it('外部请求插进当前草稿而不是另起一行', async () => {
    const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '你好')

    await wrapper.setProps({ mentionRequest: { id: '20002', name: 'Bob' } })
    await flushPromises()
    expect(composerText(wrapper)).toBe(`你好 @Bob${NBSP}`)
    expect(composerEditable(wrapper).findAll('br')).toHaveLength(0)
    expect(wrapper.emitted('update:mentionRequest')).toEqual([[undefined]])
  })

  it('同一个成员可以被连续插入两次', async () => {
    const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
    await wrapper.setProps({ mentionRequest: { id: '20001', name: 'Alice' } })
    await flushPromises()
    await wrapper.setProps({ mentionRequest: { id: '20001', name: 'Alice' } })
    await flushPromises()
    expect(composerMentions(wrapper)).toEqual([
      { id: '20001', name: 'Alice' },
      { id: '20001', name: 'Alice' },
    ])
  })
})

describe('WebQQ 输入区提及删除', () => {
  it('提及渲染成不可编辑的原子节点，所以删除时不会剩下半个名字', async () => {
    const wrapper = await openMentionMenu('Al')
    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    const mention = composerEditable(wrapper).get('.onebot-webqq-webqq__composer-mention')
    expect(mention.attributes('contenteditable')).toBe('false')
    expect(mention.text()).toBe('@Alice')
  })

  it('提及整块从可编辑区消失后草稿里也不剩残留 token', async () => {
    const wrapper = mountWebQQComposer({ mentionCandidates: groupMentionCandidates })
    await wrapper.setProps({ mentionRequest: { id: '20001', name: 'Alice' } })
    await flushPromises()
    await wrapper.setProps({ mentionRequest: { id: '20002', name: 'Bob' } })
    await flushPromises()
    expect(composerMentions(wrapper)).toHaveLength(2)

    // 浏览器把 contenteditable="false" 的提及当作一个字符删掉，这里直接摘掉节点再派发 input。
    const editor = composerEditable(wrapper)
    editor.element.querySelector('.onebot-webqq-webqq__composer-mention')?.remove()
    await editor.trigger('input')
    await flushPromises()
    expect(composerMentions(wrapper)).toEqual([{ id: '20002', name: 'Bob' }])
    expect(composerText(wrapper)).not.toContain('Alice')
  })
})
