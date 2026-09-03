import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import WebQQActionDialog from '../../client/webqq/components/WebQQActionDialog.vue'
import WebQQConfirmDialog from '../../client/webqq/components/WebQQConfirmDialog.vue'

type WebQQActionDialogProps = InstanceType<typeof WebQQActionDialog>['$props']
type WebQQConfirmDialogProps = InstanceType<typeof WebQQConfirmDialog>['$props']
export type WebQQActionDialogWrapper = VueWrapper<InstanceType<typeof WebQQActionDialog>>
export type WebQQConfirmDialogWrapper = VueWrapper<InstanceType<typeof WebQQConfirmDialog>>
export type WebQQDialogWrapper = WebQQActionDialogWrapper | WebQQConfirmDialogWrapper

const mountedDialogs: VueWrapper[] = []

/** 打开分支的自动聚焦与 Top Layer 提升都排在 nextTick 之后，断言前必须先让它们跑完。 */
export async function settleDialog() {
  await flushPromises()
}

export async function mountWebQQActionDialog(props: Partial<WebQQActionDialogProps> = {}) {
  // attachTo 必须挂进真实文档：打开时的自动聚焦与关闭后的焦点恢复只对已连接节点生效。
  const wrapper = mount(WebQQActionDialog, {
    attachTo: document.body,
    props: {
      open: true,
      title: '设置好友备注',
      ...props,
    },
  })
  mountedDialogs.push(wrapper)
  await settleDialog()
  return wrapper as WebQQActionDialogWrapper
}

export async function mountWebQQConfirmDialog(props: Partial<WebQQConfirmDialogProps> = {}) {
  const wrapper = mount(WebQQConfirmDialog, {
    attachTo: document.body,
    props: {
      open: true,
      title: '删除好友',
      description: '确定删除好友「Alice」？',
      ...props,
    },
  })
  mountedDialogs.push(wrapper)
  await settleDialog()
  return wrapper as WebQQConfirmDialogWrapper
}

export function unmountWebQQDialogs() {
  while (mountedDialogs.length) mountedDialogs.pop()?.unmount()
}

export async function setDialogProps(wrapper: WebQQDialogWrapper, props: Record<string, unknown>) {
  await (wrapper as VueWrapper).setProps(props)
  await settleDialog()
}

/** 内容被 Teleport 到 body，查询必须走文档而不是 wrapper 子树。 */
function findInDocument(selector: string) {
  return document.body.querySelector<HTMLElement>(selector)
}

export function dialogOverlay() {
  return findInDocument('[data-slot="dialog-overlay"]')
}

export function dialogContent() {
  return findInDocument('[data-slot="dialog-content"]')
}

/** 遮罩与内容必须由同一个 open 分支同步创建，断言两者的在场情况而不是只看其中一个。 */
export function dialogLayers() {
  return {
    overlay: !!dialogOverlay(),
    content: !!dialogContent(),
  }
}

function requireDialogContent() {
  const content = dialogContent()
  if (!content) throw new Error('对话框内容不在文档里')
  return content
}

function footerButtons() {
  const nodes = requireDialogContent().querySelectorAll<HTMLButtonElement>('[data-slot="button"]')
  return [...nodes]
}

export function dialogCancelButton() {
  const button = footerButtons().find((node) => node.dataset.variant === 'outline')
  if (!button) throw new Error('对话框没有取消按钮')
  return new DOMWrapper(button)
}

export function dialogConfirmButton() {
  const button = footerButtons().find((node) => node.dataset.variant !== 'outline')
  if (!button) throw new Error('对话框没有确认按钮')
  return new DOMWrapper(button)
}

export function dialogTitleText() {
  return requireDialogContent().querySelector('[data-slot="dialog-title"]')?.textContent ?? ''
}

export function dialogDescriptionText() {
  return requireDialogContent().querySelector('[data-slot="dialog-description"]')?.textContent ?? ''
}

export function dialogInput() {
  const input = requireDialogContent().querySelector<HTMLInputElement>('[data-slot="input"]')
  if (!input) throw new Error('对话框没有输入框')
  return new DOMWrapper(input)
}

export async function typeIntoDialog(value: string) {
  const input = dialogInput()
  input.element.value = value
  await input.trigger('input')
  await settleDialog()
}

export async function pressDialogEnter() {
  await dialogInput().trigger('keydown', { key: 'Enter' })
  await settleDialog()
}

export async function pressDialogEscape() {
  await new DOMWrapper(requireDialogContent()).trigger('keydown', { key: 'Escape' })
  await settleDialog()
}

export async function clickDialogOverlay() {
  const overlay = dialogOverlay()
  if (!overlay) throw new Error('对话框遮罩不在文档里')
  await new DOMWrapper(overlay).trigger('click')
  await settleDialog()
}

export async function clickDialogContent() {
  await new DOMWrapper(requireDialogContent()).trigger('click')
  await settleDialog()
}

export function openEvents(wrapper: WebQQDialogWrapper) {
  return ((wrapper as VueWrapper).emitted('update:open') ?? []) as [open: boolean][]
}

export function submittedValues(wrapper: WebQQActionDialogWrapper) {
  return ((wrapper as VueWrapper).emitted('confirm') ?? []) as [value: string][]
}

type WebQQConfirmRequest = [resolve: () => void, reject: (error: unknown) => void]

export function confirmRequests(wrapper: WebQQConfirmDialogWrapper) {
  return ((wrapper as VueWrapper).emitted('confirm') ?? []) as WebQQConfirmRequest[]
}

export function lastConfirmRequest(wrapper: WebQQConfirmDialogWrapper) {
  const requests = confirmRequests(wrapper)
  if (!requests.length) throw new Error('确认对话框没有发出 confirm')
  return requests[requests.length - 1]
}

/** 失败路径必须自己吞掉拒绝：Vue 的点击处理器不会替它兜。 */
export function trackUnhandledRejections() {
  const reasons: unknown[] = []
  const record = (reason: unknown) => { reasons.push(reason) }
  process.on('unhandledRejection', record)
  return {
    async collect() {
      // 未处理拒绝在当前宏任务末尾才判定，必须跨一次计时器才读得到。
      await new Promise((resolve) => setTimeout(resolve, 0))
      process.off('unhandledRejection', record)
      return reasons
    },
  }
}
