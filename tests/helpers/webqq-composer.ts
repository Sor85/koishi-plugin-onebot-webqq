import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import WebQQComposer, { type WebQQComposerSubmitResult } from '../../client/webqq/components/WebQQComposer.vue'
import type { WebQQSendElement } from '../../client/webqq/types'
import type { WebQQMentionCandidate } from '../../client/webqq/utils/webqq-composer-draft'

type WebQQComposerProps = InstanceType<typeof WebQQComposer>['$props']
export type WebQQComposerWrapper = VueWrapper<InstanceType<typeof WebQQComposer>>

export const groupMentionCandidates: WebQQMentionCandidate[] = [
  { id: '20001', name: 'Alice' },
  { id: '20002', name: 'Bob', keywords: ['管理员'] },
]

const mountedComposers: VueWrapper[] = []

export function mountWebQQComposer(props: Partial<WebQQComposerProps> = {}) {
  // attachTo 必须挂进真实文档：Selection、Range 与 focus 都只对已连接节点生效。
  const wrapper = mount(WebQQComposer, {
    attachTo: document.body,
    props: {
      visible: true,
      sending: false,
      mentionCandidates: [],
      chatKey: 'group:20000',
      ...props,
    },
  })
  mountedComposers.push(wrapper)
  return wrapper as WebQQComposerWrapper
}

export function unmountWebQQComposers() {
  while (mountedComposers.length) mountedComposers.pop()?.unmount()
}

export function composerEditable(wrapper: WebQQComposerWrapper) {
  return wrapper.get('.onebot-webqq-webqq__send-text')
}

type WebQQComposerSubmitPayload = [WebQQSendElement[], (result: WebQQComposerSubmitResult) => void]

/** 取最后一次 submit 的载荷：发送元素与交回会话层结果的回调。 */
export function lastComposerSubmit(wrapper: WebQQComposerWrapper) {
  const events = wrapper.emitted('submit') as WebQQComposerSubmitPayload[] | undefined
  if (!events?.length) throw new Error('没有发出 submit')
  return events[events.length - 1]
}

/** 零宽字符只是可编辑区的光标锚点，断言草稿文本时要去掉。 */
export function composerText(wrapper: WebQQComposerWrapper) {
  return (composerEditable(wrapper).element.textContent ?? '').replace(/​/g, '')
}

export function composerMentions(wrapper: WebQQComposerWrapper) {
  const nodes = composerEditable(wrapper).element.querySelectorAll<HTMLElement>('.onebot-webqq-webqq__composer-mention')
  return [...nodes].map((node) => ({ id: node.dataset.mentionId ?? '', name: node.dataset.mentionName ?? '' }))
}

export function setDomCaret(node: Node, offset: number) {
  const selection = window.getSelection()
  if (!selection) throw new Error('无头 DOM 没有提供 Selection')
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** 把光标放到可编辑区最后一个文本节点末尾，模拟用户点进输入框。 */
export function focusComposerEnd(wrapper: WebQQComposerWrapper) {
  const editor = composerEditable(wrapper).element
  const last = editor.lastChild
  if (!last || last.nodeType !== Node.TEXT_NODE) throw new Error('可编辑区末尾不是文本节点')
  setDomCaret(last, last.textContent?.length ?? 0)
}

/** 在当前光标处插入字符再派发 input，和浏览器输入字符的顺序一致。 */
export async function typeIntoComposer(wrapper: WebQQComposerWrapper, text: string) {
  const selection = window.getSelection()
  if (!selection?.rangeCount) throw new Error('输入前必须先放置光标')
  const range = selection.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) throw new Error('光标不在文本节点上')
  const value = node.textContent ?? ''
  const at = range.startOffset
  node.textContent = value.slice(0, at) + text + value.slice(at)
  setDomCaret(node, at + text.length)
  await composerEditable(wrapper).trigger('input')
  await nextTick()
}

export async function pressComposerKey(
  wrapper: WebQQComposerWrapper,
  key: string,
  init: Record<string, unknown> = {},
) {
  const event = await composerEditable(wrapper).trigger('keydown', { key, ...init })
  await nextTick()
  return event
}

export function createComposerFile(name: string, type: string, bytes = [7, 8, 9]) {
  return new File([new Uint8Array(bytes)], name, { type, lastModified: 1710000000000 })
}

/** 派发真实 ClipboardEvent：粘贴分支要读 clipboardData.files，并可能调用 preventDefault。 */
export async function pasteIntoComposer(wrapper: WebQQComposerWrapper, files: File[], text = '') {
  const transfer = new DataTransfer()
  for (const file of files) transfer.items.add(file)
  if (text) transfer.setData('text/plain', text)
  const event = new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })
  composerEditable(wrapper).element.dispatchEvent(event)
  await nextTick()
  return event
}

export async function selectComposerFiles(wrapper: WebQQComposerWrapper, files: File[]) {
  const input = wrapper.get<HTMLInputElement>('input.onebot-webqq-webqq__send-file-input')
  const transfer = new DataTransfer()
  for (const file of files) transfer.items.add(file)
  input.element.files = transfer.files
  await input.trigger('change')
  await nextTick()
}
