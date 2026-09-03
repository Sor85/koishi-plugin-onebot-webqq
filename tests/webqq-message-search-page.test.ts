// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calendarMenu,
  calendarSelectors,
  calendarWeekdays,
  createSearchHit,
  datePopover,
  mountWebQQMessageSearchPage,
  openDatePopover,
  pointerDownOn,
  pressSearchEscape,
  readCalendarCells,
  searchHits,
  searchInput,
  searchMoreButton,
  searchResultsPanel,
  searchStatusText,
  todayLocalDate,
  typeSearchQuery,
  unmountWebQQMessageSearchPages,
} from './helpers/webqq-message-search-page'

vi.mock('@koishijs/client', () => ({
  withProxy: (url: string) => url,
  useColorMode: () => ({ value: 'light' }),
}))

afterEach(() => {
  unmountWebQQMessageSearchPages()
  vi.useRealTimers()
})

/** 自动聚焦要断言的是 preventScroll，只能在挂载前把入口换成可观测的实现。 */
function trackFocusCalls() {
  const calls: { tag: string; options?: FocusOptions }[] = []
  const original = HTMLElement.prototype.focus
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
    calls.push({ tag: this.tagName, options })
    return original.call(this, options)
  }
  return { calls, restore: () => { HTMLElement.prototype.focus = original } }
}

describe('WebQQ 查找页交互', () => {
  it('挂载后渲染查找框容器与占位文案，日历网格按需出现', async () => {
    const wrapper = mountWebQQMessageSearchPage()

    expect(wrapper.find('.onebot-webqq-webqq__message-search-field').exists()).toBe(true)
    expect(searchInput(wrapper).attributes('placeholder')).toBe('查找聊天记录...')
    expect(wrapper.find('.onebot-webqq-webqq__message-search-calendar-grid').exists()).toBe(false)

    await openDatePopover(wrapper)
    expect(wrapper.find('.onebot-webqq-webqq__message-search-calendar-grid').exists()).toBe(true)
  })

  it('连续输入在 250 毫秒内只发出一次查找', async () => {
    vi.useFakeTimers()
    const wrapper = mountWebQQMessageSearchPage()

    await typeSearchQuery(wrapper, '早')
    vi.advanceTimersByTime(100)
    await typeSearchQuery(wrapper, '早安')
    vi.advanceTimersByTime(249)
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('search')).toEqual([[{ query: '早安' }]])
  })

  it('清空输入不等防抖就发出查找', async () => {
    vi.useFakeTimers()
    const wrapper = mountWebQQMessageSearchPage({ query: '早安' })

    await typeSearchQuery(wrapper, '')
    vi.advanceTimersByTime(0)
    expect(wrapper.emitted('search')).toEqual([[{ query: '' }]])

    // 清空按钮那条入口连 0 毫秒都不等。
    const cleared = mountWebQQMessageSearchPage({ query: '早安', localDate: '2026-03-15' })
    await cleared.get('.onebot-webqq-webqq__message-search-clear').trigger('click')
    expect(cleared.emitted('update:query')).toEqual([['']])
    expect(cleared.emitted('search')).toEqual([[{ query: '', localDate: '2026-03-15' }]])
  })

  it('每次输入都同步发出查询串更新，防抖只压查找', async () => {
    vi.useFakeTimers()
    const wrapper = mountWebQQMessageSearchPage()

    await typeSearchQuery(wrapper, '早')
    await typeSearchQuery(wrapper, '早安')

    expect(wrapper.emitted('update:query')).toEqual([['早'], ['早安']])
    expect(wrapper.emitted('search')).toBeUndefined()
  })

  it('查找条件为空时不渲染结果面板', async () => {
    const empty = mountWebQQMessageSearchPage({ searched: true, results: [createSearchHit()] })
    expect(searchResultsPanel(empty).exists()).toBe(false)

    const byQuery = mountWebQQMessageSearchPage({ query: '早安' })
    expect(searchResultsPanel(byQuery).exists()).toBe(true)

    const byDate = mountWebQQMessageSearchPage({ localDate: '2026-03-15' })
    expect(searchResultsPanel(byDate).exists()).toBe(true)
    await flushPromises()
  })

  it('状态文案按错误 > 搜索中 > 无匹配取优先级', () => {
    expect(searchStatusText(mountWebQQMessageSearchPage({
      query: '早安',
      errorText: '查找聊天记录超时',
      loading: true,
      searched: true,
    }))).toBe('查找聊天记录超时')

    expect(searchStatusText(mountWebQQMessageSearchPage({
      query: '早安',
      loading: true,
      searched: true,
    }))).toBe('搜索中...')

    expect(searchStatusText(mountWebQQMessageSearchPage({
      query: '早安',
      searched: true,
    }))).toBe('没有匹配的聊天记录')

    // 已经有命中上屏时，搜索中不该再占一行。
    expect(searchStatusText(mountWebQQMessageSearchPage({
      query: '早安',
      loading: true,
      searched: true,
      results: [createSearchHit()],
    }))).toBe('')
  })

  it('点一条命中就把那条消息发出去', async () => {
    const hit = createSearchHit({ id: 'm9', summary: '早安啊' })
    const wrapper = mountWebQQMessageSearchPage({
      query: '早安',
      searched: true,
      results: [createSearchHit(), hit],
    })

    await searchHits(wrapper)[1].trigger('click')
    expect(wrapper.emitted('select')).toEqual([[hit]])
  })

  it('「加载更多结果」只在还有更早历史时出现，加载中禁用', async () => {
    const wrapper = mountWebQQMessageSearchPage({
      query: '早安',
      searched: true,
      exhausted: false,
      results: [createSearchHit()],
    })
    expect(searchMoreButton(wrapper).exists()).toBe(true)
    expect(searchMoreButton(wrapper).attributes('disabled')).toBeUndefined()
    expect(searchMoreButton(wrapper).text()).toBe('加载更多结果')

    await searchMoreButton(wrapper).trigger('click')
    expect(wrapper.emitted('more')).toHaveLength(1)

    await wrapper.setProps({ loading: true })
    expect(searchMoreButton(wrapper).attributes('disabled')).toBeDefined()
    expect(searchMoreButton(wrapper).text()).toBe('加载中...')

    // 历史翻到底、或者一条命中都没有时，这个按钮不该存在。
    await wrapper.setProps({ loading: false, exhausted: true })
    expect(searchMoreButton(wrapper).exists()).toBe(false)
    await wrapper.setProps({ exhausted: false, results: [] })
    expect(searchMoreButton(wrapper).exists()).toBe(false)
  })

  it('日历选日期时发出日期更新与查找并收起浮层', async () => {
    const wrapper = mountWebQQMessageSearchPage({ query: '  早安  ', localDate: '2026-03-15' })
    await openDatePopover(wrapper)

    const target = readCalendarCells(wrapper).findIndex((cell) => !cell.outside && cell.day === 20)
    await wrapper.findAll('.onebot-webqq-webqq__message-search-calendar-grid button')[target].trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:localDate')).toEqual([['2026-03-20']])
    expect(wrapper.emitted('search')).toEqual([[{ query: '早安', localDate: '2026-03-20' }]])
    expect(datePopover(wrapper).exists()).toBe(false)
  })

  it('Escape 依次收起月/年菜单、日期浮层，最后才关掉查找', async () => {
    const wrapper = mountWebQQMessageSearchPage({ localDate: '2026-03-15' })
    await openDatePopover(wrapper)
    await calendarSelectors(wrapper)[0].trigger('click')
    expect(calendarMenu(wrapper, 'month').exists()).toBe(true)

    await pressSearchEscape(wrapper)
    expect(calendarMenu(wrapper, 'month').exists()).toBe(false)
    expect(datePopover(wrapper).exists()).toBe(true)
    expect(wrapper.emitted('close')).toBeUndefined()

    await pressSearchEscape(wrapper)
    expect(datePopover(wrapper).exists()).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()

    await pressSearchEscape(wrapper)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('点查找框以外的地方才关闭', async () => {
    const wrapper = mountWebQQMessageSearchPage({ localDate: '2026-03-15' })

    await pointerDownOn(searchInput(wrapper).element)
    expect(wrapper.emitted('close')).toBeUndefined()

    await openDatePopover(wrapper)
    await pointerDownOn(datePopover(wrapper).element)
    expect(wrapper.emitted('close')).toBeUndefined()

    await pointerDownOn(document.body)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('挂载后自动聚焦输入框且不滚动外壳', async () => {
    const focus = trackFocusCalls()
    try {
      const wrapper = mountWebQQMessageSearchPage()
      await flushPromises()

      // 展开动画期间外壳还是 32px，默认 focus 会把 overflow 窗口整块推走。
      expect(focus.calls).toEqual([{ tag: 'INPUT', options: { preventScroll: true } }])
      expect(document.activeElement).toBe(searchInput(wrapper).element)
    } finally {
      focus.restore()
    }
  })

  it('卸载后再点外面不再发出关闭，未到点的防抖也不再触发', async () => {
    // 卸载会清掉 emitted 记录，所以这里用真实监听器计数。
    let closes = 0
    let searches = 0
    const wrapper = mountWebQQMessageSearchPage({
      onClose: () => { closes++ },
      onSearch: () => { searches++ },
    })

    await pointerDownOn(document.body)
    expect(closes).toBe(1)

    vi.useFakeTimers()
    await typeSearchQuery(wrapper, '早安')
    expect(vi.getTimerCount()).toBe(1)

    wrapper.unmount()
    // 卸载时挂着的防抖计时器必须清掉，否则关掉查找框之后还会打出一次查找。
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(500)
    expect(searches).toBe(0)
    // flushPromises 走 setImmediate，回真实计时器后才能继续派发事件。
    vi.useRealTimers()

    await pointerDownOn(document.body)
    expect(closes).toBe(1)
  })

  it('日历铺满 42 格、从周一起始，并标出跨月、今天与已选中的那天', async () => {
    const wrapper = mountWebQQMessageSearchPage({ localDate: '2026-03-15' })
    await openDatePopover(wrapper)

    expect(calendarWeekdays(wrapper)).toEqual(['一', '二', '三', '四', '五', '六', '日'])

    const cells = readCalendarCells(wrapper)
    expect(cells).toHaveLength(42)
    // 周一起始的偏移计算是这个组件里最容易写错又最难目视发现的一处。
    expect(new Date(cells[0].year, cells[0].month - 1, cells[0].day).getDay()).toBe(1)

    const gridStart = new Date(cells[0].year, cells[0].month - 1, cells[0].day)
    const consecutive = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + index)
      return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
    })
    expect(cells.map(({ year, month, day }) => ({ year, month, day }))).toEqual(consecutive)

    expect(cells.filter((cell) => !cell.outside).map((cell) => cell.day))
      .toEqual(Array.from({ length: 31 }, (_, index) => index + 1))
    expect(cells.filter((cell) => cell.outside).every((cell) => cell.month !== 3)).toBe(true)
    expect(cells.filter((cell) => cell.selected)).toMatchObject([{ month: 3, day: 15, text: '15' }])
    expect(cells.filter((cell) => cell.today)).toEqual([])

    const now = new Date()
    const todayWrapper = mountWebQQMessageSearchPage({ localDate: todayLocalDate() })
    await openDatePopover(todayWrapper)
    expect(readCalendarCells(todayWrapper).filter((cell) => cell.today)).toMatchObject([{
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      outside: false,
      selected: true,
    }])
  })
})
