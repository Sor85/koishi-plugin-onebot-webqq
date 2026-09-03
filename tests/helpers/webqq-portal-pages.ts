import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import WebQQEmojiPicker from '../../client/webqq/components/WebQQEmojiPicker.vue'
import WebQQProfileCard from '../../client/webqq/components/WebQQProfileCard.vue'
import type { ProfileCardModel } from '../../client/webqq/utils/profile-card'

type WebQQProfileCardProps = InstanceType<typeof WebQQProfileCard>['$props']
type WebQQEmojiPickerProps = InstanceType<typeof WebQQEmojiPicker>['$props']
export type WebQQProfileCardWrapper = VueWrapper<InstanceType<typeof WebQQProfileCard>>
export type WebQQEmojiPickerWrapper = VueWrapper<InstanceType<typeof WebQQEmojiPicker>>
export type WebQQPortalPageWrapper = WebQQProfileCardWrapper | WebQQEmojiPickerWrapper

const mountedPortalPages: VueWrapper[] = []

/** 浮层的 Top Layer 提升排在 nextTick 之后，断言前必须先让它跑完。 */
export async function settlePortalPage() {
  await flushPromises()
}

/** 自己的资料卡：三个可编辑字段都在场，才测得到「先退编辑再关面板」这条内层分支。 */
export const editableProfileCardModel: ProfileCardModel = {
  participantId: '10001',
  name: 'Alice',
  avatarKind: 'user',
  identityLabel: 'QQ',
  nickname: 'Alice',
  personalNote: '在写测试',
  sex: 'female',
  canEditSelf: true,
  canEditAvatar: true,
  fields: [
    { group: 'account', label: '昵称', value: 'Alice', editKey: 'nickname' },
    { group: 'account', label: 'QQ', value: '10001' },
    { group: 'account', label: '性别', value: '女', editKey: 'sex' },
    { group: 'account', label: '签名', value: '在写测试', editKey: 'personalNote' },
  ],
}

export async function mountWebQQProfileCard(props: Partial<WebQQProfileCardProps> = {}) {
  // attachTo 必须挂进真实文档：面板级 Escape 走 document 监听，只有已连接的节点才把按键冒泡上去。
  const wrapper = mount(WebQQProfileCard, {
    attachTo: document.body,
    props: {
      open: true,
      model: editableProfileCardModel,
      ...props,
    },
  })
  mountedPortalPages.push(wrapper)
  await settlePortalPage()
  return wrapper as WebQQProfileCardWrapper
}

export async function mountWebQQEmojiPicker(props: Partial<WebQQEmojiPickerProps> = {}) {
  const wrapper = mount(WebQQEmojiPicker, {
    attachTo: document.body,
    props: {
      open: true,
      ...props,
    },
  })
  mountedPortalPages.push(wrapper)
  await settlePortalPage()
  return wrapper as WebQQEmojiPickerWrapper
}

export function unmountWebQQPortalPages() {
  while (mountedPortalPages.length) mountedPortalPages.pop()?.unmount()
}

export async function setPortalPageProps(wrapper: WebQQPortalPageWrapper, props: Record<string, unknown>) {
  await (wrapper as VueWrapper).setProps(props)
  await settlePortalPage()
}

/** 两个面板都 Teleport 到 body，查询必须走文档而不是 wrapper 子树。 */
function findInDocument(selector: string) {
  return document.body.querySelector<HTMLElement>(selector)
}

export function profileCardPage() {
  return findInDocument('.onebot-webqq-webqq__profile-card-page')
}

export function emojiPickerPage() {
  return findInDocument('.onebot-webqq-webqq__emoji-picker-page')
}

function requireProfileCardPage() {
  const page = profileCardPage()
  if (!page) throw new Error('资料卡不在文档里')
  return page
}

function requireEmojiPickerPage() {
  const page = emojiPickerPage()
  if (!page) throw new Error('表情选择不在文档里')
  return page
}

/** 编辑态只看渲染结果：哪些字段行换成了编辑器，而不是组件内部的 editingField。 */
export function editingProfileCardFields() {
  return [...requireProfileCardPage().querySelectorAll('.onebot-webqq-webqq__profile-card-field-editor')]
    .map((editor) => editor.parentElement?.querySelector('dt')?.textContent ?? '')
}

export function profileCardFieldEditButton(label: string) {
  const button = requireProfileCardPage().querySelector<HTMLButtonElement>(`button[aria-label="编辑${label}"]`)
  if (!button) throw new Error(`资料卡没有「编辑${label}」按钮`)
  return new DOMWrapper(button)
}

export function profileCardFieldEditor(label: string) {
  const input = requireProfileCardPage().querySelector<HTMLInputElement>(`input[aria-label="编辑${label}"]`)
  if (!input) throw new Error(`资料卡的「${label}」不在编辑态`)
  return new DOMWrapper(input)
}

export async function startProfileCardFieldEdit(label: string) {
  await profileCardFieldEditButton(label).trigger('click')
  await settlePortalPage()
}

export function emojiPickerSearchInput() {
  const input = requireEmojiPickerPage().querySelector<HTMLInputElement>('.onebot-webqq-webqq__emoji-picker-search')
  if (!input) throw new Error('表情选择没有搜索框')
  return new DOMWrapper(input)
}

/** 面板根节点没有 tabindex，真机上按键往往落在面板外；默认从 body 发起最接近现场。 */
export async function pressEscapeOnBody() {
  await pressEscapeOn(document.body)
}

export async function pressEscapeOn(element: HTMLElement) {
  await new DOMWrapper(element).trigger('keydown', { key: 'Escape' })
  await settlePortalPage()
}

export async function pointerDownOutsidePortalPage() {
  await new DOMWrapper(document.body).trigger('pointerdown')
  await settlePortalPage()
}

export function openEvents(wrapper: WebQQPortalPageWrapper) {
  return ((wrapper as VueWrapper).emitted('update:open') ?? []) as [open: boolean][]
}

/**
 * 观察窗那条 Escape 分支挂在 window 上（查找 → 转发目标 → 多选模式 → 回复目标）。
 * 门户页有没有吃掉这一下，只能从 window 收不收到同一个事件来判断。
 */
export function trackWindowKeydown() {
  const keys: string[] = []
  const record = (event: Event) => { keys.push((event as KeyboardEvent).key) }
  window.addEventListener('keydown', record)
  return {
    keys,
    stop: () => window.removeEventListener('keydown', record),
  }
}
