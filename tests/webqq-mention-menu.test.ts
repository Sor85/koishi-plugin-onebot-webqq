// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import WebQQMentionMenu from '../client/webqq/components/WebQQMentionMenu.vue'
import type { WebQQMentionCandidate } from '../client/webqq/utils/webqq-composer-draft'

vi.mock('@koishijs/client', () => ({
  withProxy: (url: string) => `proxy:${url}`,
}))

const candidates: WebQQMentionCandidate[] = [
  { id: '20001', name: 'Alice', avatar: 'https://example.invalid/alice.png' },
  { id: '20002', name: 'Bob' },
]

function mountMentionMenu(activeIndex = 0, list = candidates) {
  return mount(WebQQMentionMenu, { props: { candidates: list, activeIndex } })
}

describe('WebQQ 提及候选菜单', () => {
  it('按候选顺序渲染选项，并标出当前选中项', () => {
    const wrapper = mountMentionMenu(1)
    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(2)
    expect(options.map((option) => option.find('.onebot-webqq-webqq__mention-menu-meta').text())).toEqual(['Alice20001', 'Bob20002'])
    expect(options[0].attributes('aria-selected')).toBe('false')
    expect(options[1].attributes('aria-selected')).toBe('true')
    expect(options[1].classes()).toContain('is-active')
    wrapper.unmount()
  })

  it('有头像走控制台代理，缺头像回退成首字母', () => {
    const wrapper = mountMentionMenu()
    expect(wrapper.find('img.onebot-webqq-webqq__mention-menu-avatar').attributes('src')).toBe('proxy:https://example.invalid/alice.png')
    expect(wrapper.findAll('span.onebot-webqq-webqq__mention-menu-avatar')[0].text()).toBe('B')
    wrapper.unmount()
  })

  it('按下候选发出选中事件，移入候选发出悬停下标', async () => {
    const wrapper = mountMentionMenu()
    const options = wrapper.findAll('[role="option"]')
    await options[1].trigger('mousedown')
    await options[1].trigger('mouseenter')
    expect(wrapper.emitted('select')).toEqual([[candidates[1]]])
    expect(wrapper.emitted('hover')).toEqual([[1]])
    wrapper.unmount()
  })

  it('候选为空时给出无匹配提示', () => {
    const wrapper = mountMentionMenu(0, [])
    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
    expect(wrapper.find('.onebot-webqq-webqq__mention-menu-empty').text()).toBe('无匹配成员')
    wrapper.unmount()
  })
})
