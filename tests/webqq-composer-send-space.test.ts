// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createComposerFile,
  mountWebQQComposer,
  pasteIntoComposer,
  unmountWebQQComposers,
} from './helpers/webqq-composer'

vi.mock('@koishijs/client', () => ({
  withProxy: (url: string) => url,
  Binary: { toBase64: (buffer: ArrayBuffer) => Buffer.from(buffer).toString('base64') },
}))

afterEach(() => {
  unmountWebQQComposers()
  vi.restoreAllMocks()
})

/**
 * 无头 DOM 没有布局引擎：尺寸观测回调永不触发，取矩形恒返回 0。
 * 因此这里直接给出各层高度，断言占位公式，而不是断言「改了样式后数字自己变了」。
 */
function stubLayoutHeights(heights: Array<[string, number]>) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const height = heights.find(([selector]) => this.matches(selector))?.[1] ?? 0
    return { x: 0, y: 0, width: 0, height, top: 0, right: 0, bottom: height, left: 0, toJSON: () => ({}) } as DOMRect
  })
}

function lastSendSpace(wrapper: ReturnType<typeof mountWebQQComposer>) {
  const events = wrapper.emitted('update:sendSpace') as Array<[number]> | undefined
  if (!events?.length) throw new Error('没有发出发送区占位')
  return events[events.length - 1][0]
}

describe('WebQQ 发送区占位', () => {
  it('只有发送控件时占位等于控件高度加固定留白', async () => {
    stubLayoutHeights([['.onebot-webqq-webqq__send', 44]])
    const wrapper = mountWebQQComposer()
    await flushPromises()
    expect(lastSendSpace(wrapper)).toBe(44 + 28)
  })

  it('回复条出现时占位加上上下文层高度与其间距，消失后退回去', async () => {
    stubLayoutHeights([
      ['.onebot-webqq-webqq__send', 44],
      ['.onebot-webqq-webqq__send-context', 40],
    ])
    const wrapper = mountWebQQComposer()
    await flushPromises()
    expect(lastSendSpace(wrapper)).toBe(44 + 28)

    await wrapper.setProps({ replyingTo: { senderName: 'Alice', summary: '晚上好' } })
    await flushPromises()
    expect(lastSendSpace(wrapper)).toBe(44 + 40 + 8 + 28)

    await wrapper.setProps({ replyingTo: undefined })
    await flushPromises()
    expect(lastSendSpace(wrapper)).toBe(44 + 28)
  })

  it('待发附件出现时同样让出空间，移除后退回去', async () => {
    stubLayoutHeights([
      ['.onebot-webqq-webqq__send', 44],
      ['.onebot-webqq-webqq__send-context', 52],
    ])
    const wrapper = mountWebQQComposer()
    await flushPromises()

    await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png')])
    await flushPromises()
    expect(lastSendSpace(wrapper)).toBe(44 + 52 + 8 + 28)

    await wrapper.get('button[aria-label="移除 shot.png"]').trigger('click')
    await flushPromises()
    expect(lastSendSpace(wrapper)).toBe(44 + 28)
  })

  it('回复条与附件共用同一个上下文层，只计一次高度', async () => {
    stubLayoutHeights([
      ['.onebot-webqq-webqq__send', 60],
      ['.onebot-webqq-webqq__send-context', 52],
    ])
    const wrapper = mountWebQQComposer({ replyingTo: { senderName: 'Alice', summary: '晚上好' } })
    await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png')])
    await flushPromises()
    expect(wrapper.findAll('.onebot-webqq-webqq__send-context')).toHaveLength(1)
    expect(lastSendSpace(wrapper)).toBe(60 + 52 + 8 + 28)
  })

  it('发送控件高度只作为 CSS 变量挂在自己身上，不对外多给一个数字', async () => {
    stubLayoutHeights([['.onebot-webqq-webqq__send', 76]])
    const wrapper = mountWebQQComposer()
    await flushPromises()
    expect(wrapper.get('form.onebot-webqq-webqq__send').attributes('style')).toContain('--onebot-webqq-webqq-send-height: 76px')
    expect(Object.keys(wrapper.emitted())).toEqual(expect.not.arrayContaining(['update:sendHeight']))
  })
})
