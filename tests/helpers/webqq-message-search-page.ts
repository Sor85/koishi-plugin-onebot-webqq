import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import WebQQMessageSearchPage from '../../client/webqq/components/WebQQMessageSearchPage.vue'
import type { WebQQMessage } from '../../client/webqq/types'

type WebQQMessageSearchPageProps = InstanceType<typeof WebQQMessageSearchPage>['$props']
export type WebQQMessageSearchPageWrapper = VueWrapper<InstanceType<typeof WebQQMessageSearchPage>>

const mountedPages: VueWrapper[] = []

export function createSearchHit(overrides: Partial<WebQQMessage> = {}): WebQQMessage {
  return {
    id: 'm1',
    sequence: '1',
    time: 1710000000000,
    senderId: '30000',
    senderName: 'Alice',
    senderAvatar: '',
    direction: 'incoming',
    summary: '早安',
    elements: [],
    ...overrides,
  }
}

export function mountWebQQMessageSearchPage(props: Partial<WebQQMessageSearchPageProps> = {}) {
  // attachTo 必须挂进真实文档：自动聚焦、document 上的外部 pointerdown 与 contains 判定都只对已连接节点生效。
  const wrapper = mount(WebQQMessageSearchPage, {
    attachTo: document.body,
    props: {
      query: '',
      localDate: '',
      results: [],
      loading: false,
      errorText: '',
      searched: false,
      exhausted: true,
      ...props,
    },
  })
  mountedPages.push(wrapper)
  return wrapper as WebQQMessageSearchPageWrapper
}

export function unmountWebQQMessageSearchPages() {
  while (mountedPages.length) mountedPages.pop()?.unmount()
}

export function searchInput(wrapper: WebQQMessageSearchPageWrapper) {
  return wrapper.get<HTMLInputElement>('input[type="search"]')
}

export function searchStatusText(wrapper: WebQQMessageSearchPageWrapper) {
  const status = wrapper.find('.onebot-webqq-webqq__message-search-status')
  return status.exists() ? status.text() : ''
}

export function searchResultsPanel(wrapper: WebQQMessageSearchPageWrapper) {
  return wrapper.find('.onebot-webqq-webqq__message-search-results')
}

export function searchHits(wrapper: WebQQMessageSearchPageWrapper) {
  return wrapper.findAll('.onebot-webqq-webqq__message-search-hit')
}

export function searchMoreButton(wrapper: WebQQMessageSearchPageWrapper) {
  return wrapper.find('.onebot-webqq-webqq__message-search-more')
}

export function datePopover(wrapper: WebQQMessageSearchPageWrapper) {
  return wrapper.find('.onebot-webqq-webqq__message-search-date-popover')
}

export function calendarMenu(wrapper: WebQQMessageSearchPageWrapper, kind: 'month' | 'year') {
  return wrapper.find(`.onebot-webqq-webqq__message-search-calendar-menu.is-${kind}`)
}

export function calendarSelectors(wrapper: WebQQMessageSearchPageWrapper) {
  return wrapper.findAll('.onebot-webqq-webqq__message-search-calendar-selectors button')
}

export function calendarWeekdays(wrapper: WebQQMessageSearchPageWrapper) {
  return wrapper.findAll('.onebot-webqq-webqq__message-search-calendar-weekdays span').map((day) => day.text())
}

export function calendarCells(wrapper: WebQQMessageSearchPageWrapper) {
  return wrapper.findAll('.onebot-webqq-webqq__message-search-calendar-grid button')
}

export interface CalendarCell {
  year: number
  month: number
  day: number
  text: string
  outside: boolean
  today: boolean
  selected: boolean
}

/** 日历格的年月日只在 aria-label 里，格子文本只有日号；跨月断言必须读 label。 */
export function readCalendarCell(cell: DOMWrapper<Element>): CalendarCell {
  const label = cell.attributes('aria-label') ?? ''
  const match = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(label)
  if (!match) throw new Error(`日历格 aria-label 不可解析：${label}`)
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    text: cell.text(),
    outside: cell.classes('is-outside'),
    today: cell.classes('is-today'),
    selected: cell.classes('is-selected'),
  }
}

export function readCalendarCells(wrapper: WebQQMessageSearchPageWrapper) {
  return calendarCells(wrapper).map(readCalendarCell)
}

export async function openDatePopover(wrapper: WebQQMessageSearchPageWrapper) {
  await wrapper.get('.onebot-webqq-webqq__message-search-date-trigger').trigger('click')
  // 打开浮层的 watch 是异步的：定位与 Top Layer 提升都在 nextTick 之后。
  await flushPromises()
  return datePopover(wrapper)
}

export async function typeSearchQuery(wrapper: WebQQMessageSearchPageWrapper, value: string) {
  const input = searchInput(wrapper)
  input.element.value = value
  await input.trigger('input')
}

export async function pressSearchEscape(wrapper: WebQQMessageSearchPageWrapper) {
  await searchInput(wrapper).trigger('keydown', { key: 'Escape' })
}

/** 外部点击关闭走的是 document 上的 pointerdown，必须派发真实冒泡事件而不是调处理器。 */
export async function pointerDownOn(target: Node) {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
  await flushPromises()
}

export function todayLocalDate() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
