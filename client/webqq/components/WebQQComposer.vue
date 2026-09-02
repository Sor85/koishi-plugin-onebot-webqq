<template>
  <form ref="sendForm" class="onebot-webqq-webqq__send" :style="sendHeightStyle" @submit.prevent="requestSubmit">
    <div v-if="replyingTo || sendFiles.length" ref="sendContext" class="onebot-webqq-webqq__send-context">
      <div v-if="replyingTo" class="onebot-webqq-webqq__reply-draft">
        <span>回复 {{ replyingTo.senderName }}：{{ replyingTo.summary }}</span>
        <button type="button" class="onebot-webqq-webqq__reply-draft-close" aria-label="清除回复" @click="emit('clear-reply')">
          <IconX :size="15" aria-hidden="true" />
        </button>
      </div>
      <template v-for="file in sendFiles" :key="file.id">
        <span v-if="file.kind === 'file' || !file.previewUrl" class="onebot-webqq-webqq__send-file">
          <svg class="onebot-webqq-webqq__send-file-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"></path>
            <path d="M14 2v5h5"></path>
          </svg>
          <span class="onebot-webqq-webqq__send-file-name">
            <span class="onebot-webqq-webqq__send-file-base">{{ file.baseName }}</span><span>{{ file.extension }}</span>
          </span>
          <button type="button" :aria-label="`移除 ${file.file.name}`" @click="removeSendFile(file.id)">
            <svg class="onebot-webqq-webqq__send-remove-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
          </button>
        </span>
        <span v-else-if="file.kind === 'video'" class="onebot-webqq-webqq__send-image">
          <span class="onebot-webqq-webqq__send-image-preview" role="img" :aria-label="`视频 ${file.file.name}`">
            <video :src="file.previewUrl" muted playsinline preload="metadata" aria-hidden="true"></video>
          </span>
          <button type="button" class="onebot-webqq-webqq__send-image-remove" :aria-label="`移除 ${file.file.name}`" @click="removeSendFile(file.id)">
            <svg class="onebot-webqq-webqq__send-remove-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
          </button>
        </span>
        <span v-else class="onebot-webqq-webqq__send-image">
          <button class="onebot-webqq-webqq__send-image-preview" type="button" :aria-label="`预览 ${file.file.name}`" @click="emit('preview-attachment', file.previewUrl)"><img :src="file.previewUrl" :alt="file.file.name"></button>
          <button type="button" class="onebot-webqq-webqq__send-image-remove" :aria-label="`移除 ${file.file.name}`" @click="removeSendFile(file.id)">
            <svg class="onebot-webqq-webqq__send-remove-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
          </button>
        </span>
      </template>
    </div>
    <img v-if="botAvatar" class="onebot-webqq-webqq__send-avatar" :src="withProxy(botAvatar)" alt="">
    <span v-else class="onebot-webqq-webqq__send-avatar" aria-hidden="true"></span>
    <div class="onebot-webqq-webqq__send-main">
      <span v-if="isComposerDraftEmpty" class="onebot-webqq-webqq__send-placeholder" aria-hidden="true">发送消息</span>
      <div
        ref="sendTextInput"
        v-webqq-scrollbar="{ tone: 'accent' }"
        class="onebot-webqq-webqq__send-text"
        role="textbox"
        aria-multiline="true"
        :aria-disabled="sending ? 'true' : undefined"
        :contenteditable="sending ? 'false' : 'true'"
        @keydown="handleComposerKeydown"
        @input="handleComposerInput"
        @compositionstart="composerIsComposing = true"
        @compositionend="handleComposerCompositionEnd"
        @paste="handleSendPaste"
        @mouseup="syncComposerCaretFromDom"
        @keyup="syncComposerCaretFromDom"
      ></div>
      <WebQQMentionMenu v-if="mentionMenuOpen" :candidates="filteredMentionCandidates" :active-index="mentionMenuIndex" @select="selectMentionCandidate" @hover="mentionMenuIndex = $event" />
    </div>
    <input ref="sendFileInput" class="onebot-webqq-webqq__send-file-input" type="file" multiple @change="handleSendFileSelect">
    <button class="onebot-webqq-webqq__send-action" type="button" aria-label="选择文件" :disabled="sending" @click="openSendFilePicker">
      <svg class="onebot-webqq-webqq__send-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.5 12.5 21a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5"></path></svg>
    </button>
    <button class="onebot-webqq-webqq__send-action is-primary" type="submit" aria-label="发送" :disabled="sending || !canSendWebQQMessage">
      <svg class="onebot-webqq-webqq__send-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"></path><path d="m22 2-7 20-4-9-9-4Z"></path></svg>
    </button>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Binary, withProxy } from '@koishijs/client'
import { IconX } from '@tabler/icons-vue'
import WebQQMentionMenu from './WebQQMentionMenu.vue'
import type { WebQQSendElement } from '../types'
import { vWebqqScrollbar } from '../utils/webqq-scrollbar'
import {
  createEmptyWebQQComposerDraft,
  detectWebQQMentionTrigger,
  filterWebQQMentionCandidates,
  insertWebQQComposerMention,
  isWebQQComposerDraftEmpty,
  normalizeWebQQComposerTokens,
  replaceWebQQComposerTextRange,
  serializeWebQQComposerDraft,
  type WebQQComposerDraft,
  type WebQQComposerDraftToken,
  type WebQQMentionCandidate,
} from '../utils/webqq-composer-draft'

/** 输入区上方回复条要展示的内容；回复目标本身归会话层持有。 */
export interface WebQQComposerReplyTarget {
  senderName: string
  summary: string
}

/** 外部入口（消息头像右键菜单、群资料栏）请求把某个成员插入当前草稿。 */
export interface WebQQComposerMentionRequest {
  id: string
  name: string
}

/** 会话层完成一次发送尝试后回给输入区的结果：是否已发出、是否应把焦点还给输入框。 */
export interface WebQQComposerSubmitResult {
  sent: boolean
  restoreFocus: boolean
}

type WebQQSendFileKind = 'image' | 'video' | 'file'

interface WebQQSendFile {
  id: string
  file: File
  kind: WebQQSendFileKind
  previewUrl?: string
  baseName: string
  extension: string
}

const webQQVideoFileExtensions = new Set(['mp4', 'webm', 'mov', 'm4v', '3gp'])

const props = defineProps<{
  /** 观察窗是否可见；不可见时布局高度为 0，重新可见后必须重测发送区占位。 */
  visible: boolean
  /** 会话层的发送锁；进行中禁用可编辑区与两个按钮。 */
  sending: boolean
  /** 提及候选由调用方传入，输入区不认识群成员领域；私聊传空数组即不开菜单。 */
  mentionCandidates: WebQQMentionCandidate[]
  /** 当前会话的不透明标识；变化即视为切换会话，草稿、提及菜单与待发附件一起清空。 */
  chatKey: string
  botAvatar?: string
  replyingTo?: WebQQComposerReplyTarget
  mentionRequest?: WebQQComposerMentionRequest
}>()

const emit = defineEmits<{
  submit: [elements: WebQQSendElement[], complete: (result: WebQQComposerSubmitResult) => void]
  'clear-reply': []
  'preview-attachment': [url: string]
  'update:sendSpace': [space: number]
  'update:mentionRequest': [request: WebQQComposerMentionRequest | undefined]
}>()

const composerDraft = ref<WebQQComposerDraft>(createEmptyWebQQComposerDraft())
const sendFiles = ref<WebQQSendFile[]>([])
const sendTextInput = ref<HTMLElement>()
const sendFileInput = ref<HTMLInputElement>()
const sendForm = ref<HTMLElement>()
const sendContext = ref<HTMLElement>()
const webQQSendSpace = ref(80)
const webQQSendHeight = ref(44)
const composerIsComposing = ref(false)
const mentionMenu = ref<{ tokenIndex: number, start: number, query: string }>()
const mentionMenuIndex = ref(0)
let suppressComposerInput = false
let preparingSubmit = false

const isComposerDraftEmpty = computed(() => isWebQQComposerDraftEmpty(composerDraft.value.tokens))
const canSendWebQQMessage = computed(() => !isComposerDraftEmpty.value || !!sendFiles.value.length)
const mentionMenuOpen = computed(() => !!mentionMenu.value && !!props.mentionCandidates.length)
const filteredMentionCandidates = computed(() => (
  mentionMenu.value
    ? filterWebQQMentionCandidates(props.mentionCandidates, mentionMenu.value.query)
    : []
))
// 发送区占位是对外的唯一数字；发送控件自身高度只被输入区内部的附件缩略图消费，因此挂在 form 上。
const sendHeightStyle = computed(() => ({ '--onebot-webqq-webqq-send-height': `${webQQSendHeight.value}px` }))
function getSendFileNameParts(name: string) {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0) return { baseName: name, extension: '' }
  return {
    baseName: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  }
}

function getSendFileKind(file: File): WebQQSendFileKind {
  const mime = file.type.toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  // Firefox 与部分系统文件选择器可能不提供 MIME；仅对 QQ 常见可播放格式回退，
  // 避免把不受支持的视频容器误发为原生视频消息。
  return webQQVideoFileExtensions.has(extension) ? 'video' : 'file'
}

function addSendFiles(files: Iterable<File>) {
  for (const file of files) {
    const kind = getSendFileKind(file)
    sendFiles.value.push({
      id: `${file.name}:${file.size}:${file.lastModified}:${sendFiles.value.length}`,
      file,
      kind,
      previewUrl: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : undefined,
      ...getSendFileNameParts(file.name),
    })
  }
}

function removeSendFile(id: string) {
  const file = sendFiles.value.find((file) => file.id === id)
  if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
  sendFiles.value = sendFiles.value.filter((file) => file.id !== id)
}

function clearSendFiles() {
  for (const file of sendFiles.value) {
    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
  }
  sendFiles.value = []
}

function openSendFilePicker() {
  sendFileInput.value?.click()
}

function handleSendFileSelect(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  if (input.files) addSendFiles(input.files)
  input.value = ''
}

function handleSendPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? [])
  if (!files.length) return
  event.preventDefault()
  addSendFiles(files)
}

function resetComposerDraft(options: { focus?: boolean } = {}) {
  applyComposerDraft(createEmptyWebQQComposerDraft(), options)
}

function closeMentionMenu() {
  mentionMenu.value = undefined
  mentionMenuIndex.value = 0
}
function renderComposerDraft(current: WebQQComposerDraft) {
  const editor = sendTextInput.value
  if (!editor) return
  suppressComposerInput = true
  editor.replaceChildren()
  for (const token of current.tokens) {
    if (token.type === 'text') {
      // 空文本 token 用零宽字符提供可点击的光标锚点；读回草稿时会统一移除。
      editor.appendChild(document.createTextNode(token.text || '​'))
      continue
    }
    const mention = document.createElement('span')
    mention.className = 'onebot-webqq-webqq__composer-mention'
    mention.contentEditable = 'false'
    mention.dataset.mentionId = token.id
    mention.dataset.mentionName = token.name
    mention.textContent = `@${token.name}`
    editor.appendChild(mention)
  }
  if (!editor.childNodes.length) editor.appendChild(document.createTextNode(''))
  suppressComposerInput = false
}

function applyComposerDraft(next: WebQQComposerDraft, options: { focus?: boolean } = {}) {
  composerDraft.value = {
    tokens: normalizeWebQQComposerTokens(next.tokens),
    tokenIndex: next.tokenIndex,
    offset: next.offset,
  }
  renderComposerDraft(composerDraft.value)
  if (options.focus === false) return
  void nextTick(() => {
    sendTextInput.value?.focus()
    setComposerCaret(composerDraft.value.tokenIndex, composerDraft.value.offset)
  })
}

function readComposerDraftFromDom(): WebQQComposerDraft {
  const editor = sendTextInput.value
  if (!editor) return createEmptyWebQQComposerDraft()
  const tokens: WebQQComposerDraftToken[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      tokens.push({ type: 'text', text: node.textContent ?? '' })
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.dataset.mentionId) {
      tokens.push({
        type: 'mention',
        id: node.dataset.mentionId,
        name: node.dataset.mentionName || node.textContent?.replace(/^@/, '') || node.dataset.mentionId,
      })
      return
    }
    if (node.tagName === 'BR') {
      tokens.push({ type: 'text', text: '\n' })
      return
    }
    node.childNodes.forEach(walk)
  }
  editor.childNodes.forEach(walk)
  return {
    tokens: normalizeWebQQComposerTokens(tokens),
    tokenIndex: composerDraft.value.tokenIndex,
    offset: composerDraft.value.offset,
  }
}
/** 可编辑区的直接子节点里，只有文本节点和提及节点对应草稿 token；其余节点不参与 token 计数。 */
function isComposerTokenNode(node: Node) {
  return node.nodeType === Node.TEXT_NODE || (node instanceof HTMLElement && !!node.dataset.mentionId)
}

function getComposerCaret(tokens = composerDraft.value.tokens) {
  const editor = sendTextInput.value
  const selection = window.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.startContainer)) return

  const mapNodeToToken = (node: Node) => {
    let index = 0
    for (const child of Array.from(editor.childNodes)) {
      if (child === node || child.contains(node)) return index
      if (isComposerTokenNode(child)) index += 1
    }
    return Math.max(0, tokens.length - 1)
  }

  if (range.startContainer === editor) {
    let tokenIndex = 0
    for (let childIndex = 0; childIndex < editor.childNodes.length; childIndex += 1) {
      const child = editor.childNodes[childIndex]
      if (childIndex === range.startOffset) {
        if (child.nodeType === Node.TEXT_NODE) return { tokenIndex, offset: 0 }
        return { tokenIndex: Math.max(0, tokenIndex - 1), offset: Number.MAX_SAFE_INTEGER }
      }
      if (isComposerTokenNode(child)) tokenIndex += 1
    }
    return { tokenIndex: Math.max(0, tokens.length - 1), offset: Number.MAX_SAFE_INTEGER }
  }

  let tokenIndex = mapNodeToToken(range.startContainer)
  let offset = range.startContainer.nodeType === Node.TEXT_NODE ? range.startOffset : 0
  const token = tokens[tokenIndex]
  if (token?.type === 'text') {
    offset = Math.min(Math.max(offset, 0), token.text.length)
  } else {
    tokenIndex = Math.min(tokenIndex + 1, tokens.length - 1)
    offset = 0
  }
  return { tokenIndex, offset }
}

function setComposerCaret(tokenIndex: number, offset: number) {
  const editor = sendTextInput.value
  const selection = window.getSelection()
  if (!editor || !selection) return
  let index = 0
  let targetNode: Node | undefined
  let targetOffset = 0
  for (const child of Array.from(editor.childNodes)) {
    if (!isComposerTokenNode(child)) continue
    if (index === tokenIndex) {
      if (child.nodeType === Node.TEXT_NODE) {
        targetNode = child
        targetOffset = Math.min(Math.max(offset, 0), child.textContent?.length ?? 0)
      } else {
        const next = child.nextSibling
        targetNode = next?.nodeType === Node.TEXT_NODE ? next : child
      }
      break
    }
    index += 1
  }
  if (!targetNode) {
    targetNode = editor
    targetOffset = editor.childNodes.length
  }
  const range = document.createRange()
  try {
    range.setStart(targetNode, targetOffset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  } catch {
    // Chrome 与 Firefox 在节点刚替换时都可能暂时拒绝 setStart；下次输入会重新同步光标。
  }
}

/** 把草稿光标同步到可编辑区里的真实光标；读不到光标时返回 false，调用方据此跳过后续判断。 */
function syncComposerCaretFromDom() {
  const caret = getComposerCaret()
  if (!caret) return false
  const token = composerDraft.value.tokens[caret.tokenIndex]
  composerDraft.value = {
    ...composerDraft.value,
    tokenIndex: caret.tokenIndex,
    offset: token?.type === 'text' ? Math.min(caret.offset, token.text.length) : 0,
  }
  return true
}
function updateMentionMenuFromDraft(current: WebQQComposerDraft) {
  if (!props.mentionCandidates.length || composerIsComposing.value) {
    closeMentionMenu()
    return
  }
  const token = current.tokens[current.tokenIndex]
  if (token?.type !== 'text') {
    closeMentionMenu()
    return
  }
  const trigger = detectWebQQMentionTrigger(token.text, current.offset)
  if (!trigger) {
    closeMentionMenu()
    return
  }
  mentionMenu.value = { tokenIndex: current.tokenIndex, start: trigger.start, query: trigger.query }
  mentionMenuIndex.value = 0
}

function handleComposerInput() {
  if (suppressComposerInput) return
  const next = readComposerDraftFromDom()
  // 当前 DOM 已经包含新输入，光标必须按 next.tokens 限制；若仍按旧草稿长度钳制，中途键入的 @ 会被截到光标之后。
  const caret = getComposerCaret(next.tokens)
  composerDraft.value = {
    tokens: next.tokens,
    tokenIndex: caret?.tokenIndex ?? next.tokenIndex,
    offset: caret?.offset ?? next.offset,
  }
  updateMentionMenuFromDraft(composerDraft.value)
  // 与 sandbox 一致：contenteditable 的 input 可能早于 Selection 更新，下一微任务必须重新读取真实光标。
  void nextTick(() => {
    if (syncComposerCaretFromDom()) updateMentionMenuFromDraft(composerDraft.value)
  })
}

function handleComposerCompositionEnd() {
  composerIsComposing.value = false
  handleComposerInput()
}

function insertExternalMention(candidate: WebQQComposerMentionRequest) {
  syncComposerCaretFromDom()
  const current = composerDraft.value
  const token = current.tokens[current.tokenIndex]
  const offset = token?.type === 'text' ? current.offset : 0
  applyComposerDraft(insertWebQQComposerMention(current.tokens, current.tokenIndex, offset, candidate))
  closeMentionMenu()
}

function selectMentionCandidate(candidate: WebQQMentionCandidate) {
  const menu = mentionMenu.value
  if (!menu) return
  const token = composerDraft.value.tokens[menu.tokenIndex]
  const end = token?.type === 'text' ? composerDraft.value.offset : menu.start
  applyComposerDraft(replaceWebQQComposerTextRange(
    composerDraft.value.tokens,
    menu.tokenIndex,
    menu.start,
    Math.max(menu.start, end),
    candidate,
  ))
  closeMentionMenu()
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (props.sending) {
    event.preventDefault()
    return
  }
  if (mentionMenuOpen.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!filteredMentionCandidates.value.length) return
      const direction = event.key === 'ArrowDown' ? 1 : -1
      mentionMenuIndex.value = (mentionMenuIndex.value + direction + filteredMentionCandidates.value.length) % filteredMentionCandidates.value.length
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      const candidate = filteredMentionCandidates.value[mentionMenuIndex.value]
      if (candidate) selectMentionCandidate(candidate)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMentionMenu()
      return
    }
  }
  if (event.key === 'Enter' && !event.shiftKey && !composerIsComposing.value) {
    event.preventDefault()
    void requestSubmit()
  }
}
async function toSendElement(file: File): Promise<WebQQSendElement> {
  return {
    type: getSendFileKind(file),
    data: `data:${file.type || 'application/octet-stream'};base64,${Binary.toBase64(await file.arrayBuffer())}`,
    name: file.name,
  }
}

// 输入区只负责产出可发送内容；会话、回复目标、发送 RPC 与错误文案都在会话层。
async function requestSubmit() {
  if (props.sending || preparingSubmit || !canSendWebQQMessage.value) return
  preparingSubmit = true
  try {
    const elements: WebQQSendElement[] = [
      ...serializeWebQQComposerDraft(composerDraft.value.tokens),
      ...await Promise.all(sendFiles.value.map(({ file }) => toSendElement(file))),
    ]
    emit('submit', elements, completeSubmit)
  } finally {
    // 会话层在 submit 里同步拿到发送锁，因此这里放开重入闸门不会留出双发窗口。
    preparingSubmit = false
  }
}

async function completeSubmit(result: WebQQComposerSubmitResult) {
  if (result.sent) {
    resetComposerDraft({ focus: false })
    closeMentionMenu()
    clearSendFiles()
  }
  if (!result.restoreFocus) return
  // 与 chatluna-sandbox 保持一致：必须等 contenteditable 解除禁用后再恢复焦点，否则浏览器会忽略 focus。
  await nextTick()
  sendTextInput.value?.focus()
}

let sendFormResizeObserver: ResizeObserver | undefined
let sendContextResizeObserver: ResizeObserver | undefined

function updateWebQQSendSpace() {
  const form = sendForm.value
  const context = sendContext.value
  const contextHeight = context ? Math.ceil(context.getBoundingClientRect().height) + 8 : 0
  webQQSendHeight.value = form ? Math.ceil(form.getBoundingClientRect().height) : 44
  // 回复和附件共用同一个 wrap 包络，只计一次真实高度，避免两者同时存在时重复撑大消息区留白。
  webQQSendSpace.value = webQQSendHeight.value + contextHeight + 28
}

async function observeWebQQSendForm() {
  sendFormResizeObserver?.disconnect()
  sendContextResizeObserver?.disconnect()
  await nextTick()
  updateWebQQSendSpace()
  if (typeof ResizeObserver === 'undefined' || !sendForm.value) return
  sendFormResizeObserver = new ResizeObserver(updateWebQQSendSpace)
  sendFormResizeObserver.observe(sendForm.value)
  if (!sendContext.value) return
  sendContextResizeObserver = new ResizeObserver(updateWebQQSendSpace)
  sendContextResizeObserver.observe(sendContext.value)
}
watch(webQQSendSpace, (space) => {
  emit('update:sendSpace', space)
}, { immediate: true })

watch(filteredMentionCandidates, (candidates) => {
  if (!mentionMenu.value) return
  mentionMenuIndex.value = candidates.length
    ? Math.min(mentionMenuIndex.value, candidates.length - 1)
    : 0
})

// 切会话时草稿、提及菜单与待发附件必须一起清空：只清草稿会让上一个会话选的附件跟进新会话，回车即误发。
watch(() => props.chatKey, () => {
  resetComposerDraft({ focus: false })
  closeMentionMenu()
  clearSendFiles()
})

// 外部提及请求消费后立即回收，这样同一个成员可以被连续插入；immediate 覆盖“请求早于输入区挂载”的场景。
watch(() => props.mentionRequest, (request) => {
  if (!request) return
  insertExternalMention(request)
  emit('update:mentionRequest', undefined)
}, { immediate: true })

// 观察窗隐藏时布局高度为 0，重新可见后必须重测，否则消息区底部留白会停在旧值。
watch(() => props.visible, (visible) => {
  if (visible) void observeWebQQSendForm()
})

watch(() => sendFiles.value.length, () => {
  void observeWebQQSendForm()
})

watch(() => props.replyingTo, () => {
  void observeWebQQSendForm()
})

onMounted(() => {
  renderComposerDraft(composerDraft.value)
  void observeWebQQSendForm()
})

onBeforeUnmount(() => {
  clearSendFiles()
  sendFormResizeObserver?.disconnect()
  sendContextResizeObserver?.disconnect()
})
</script>


