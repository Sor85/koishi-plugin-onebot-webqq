import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/Capsule.vue', import.meta.url), 'utf8')
const clientState = await readFile(new URL('../client/state.ts', import.meta.url), 'utf8')
const clientIndex = await readFile(new URL('../client/index.ts', import.meta.url), 'utf8')
const onebotSource = await readFile(new URL('../src/onebot.ts', import.meta.url), 'utf8')
const webqqView = await readFile(new URL('../client/WebQQObserver.vue', import.meta.url), 'utf8')
const webqqMessageCache = await readFile(new URL('../client/webqq-message-cache.ts', import.meta.url), 'utf8').catch(() => '')
const style = await readFile(new URL('../client/style.scss', import.meta.url), 'utf8')

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) return ''
  const endIndex = source.indexOf(end, startIndex + start.length)
  return endIndex < 0 ? source.slice(startIndex) : source.slice(startIndex, endIndex)
}

function runGetUnreadText(count: number) {
  const unreadTextSource = sourceBetween(
    webqqView,
    'function getUnreadText(count: number)',
    'function increaseUnreadCount',
  )
  const returnExpression = unreadTextSource.match(/return\s+([^\n]+)/)?.[1]
  if (!returnExpression) throw new Error('getUnreadText return expression not found')
  return Function('count', `return ${returnExpression}`)(count)
}

describe('webqq observer view', () => {
  it('opens a read-only WebQQ panel from the capsule avatar', () => {
    expect(capsuleView).toContain('import WebQQObserver from')
    expect(capsuleView).toContain('const webqqOpen = ref(false)')
    expect(capsuleView).toContain('@click="toggleWebQQ"')
    expect(capsuleView).toContain('<WebQQObserver v-show="webqqOpen" :visible="webqqOpen" />')
  })

  it('keeps WebQQ mounted while hidden so unread counts can update the capsule', () => {
    expect(capsuleView).toContain('<WebQQObserver v-show="webqqOpen" :visible="webqqOpen" />')
    expect(capsuleView).not.toContain('v-if="webqqMounted"')
    expect(capsuleView).not.toContain('const webqqMounted')
  })

  it('uses the configured WebQQ theme without rendering an in-panel theme selector', () => {
    expect(webqqView).toContain("from './state'")
    expect(webqqView).toContain('sortWebQQGroupMembers')
    expect(webqqView).toContain('useBotAvatarThemeColor')
    expect(webqqView).toContain('webQQAccentColor')
    expect(webqqView).toContain('webQQAvatarAccentColor')
    expect(webqqView).toContain('webQQChatStyle')
    expect(webqqView).toContain('webQQTheme')
    expect(webqqView).toContain('hideWebQQGroupLevel')
    expect(webqqView).toContain('showWebQQAffinity')
    expect(webqqView).toContain('showWebQQRelationship')
    expect(webqqView).toContain("['chat-capsule-webqq'")
    expect(webqqView).toContain('`is-theme-${webQQTheme}`')
    expect(webqqView).toContain('`is-chat-style-${webQQChatStyle}`')
    expect(webqqView).toContain('`is-color-${webQQColorMode}`')
    expect(webqqView).toContain(':style="webQQAccentStyle"')
    expect(webqqView).not.toContain('class="chat-capsule-webqq__theme"')
    expect(webqqView).not.toContain('aria-label="WebQQ 主题"')
    expect(webqqView).not.toContain('v-model="webQQTheme"')
    expect(webqqView).not.toContain('webQQThemeOptions')
  })

  it('uses the configured WebQQ color mode without rendering an in-panel switcher', () => {
    expect(clientState).toContain("export type WebQQColorMode = 'auto' | 'light' | 'dark'")
    expect(clientState).toContain("export const webQQColorMode = ref<WebQQColorMode>('auto')")
    expect(clientIndex).toContain('webQQColorMode')
    expect(clientIndex).toContain('type WebQQColorMode')
    expect(clientIndex).toMatch(/webQQColorMode\?:\s*WebQQColorMode/)
    expect(clientIndex).toMatch(/webQQColorMode\.value\s*=\s*data\?\.value\?\.webQQColorMode\s*(?:\?\?|\|\|)\s*'auto'/)
    expect(webqqView).toContain('webQQColorMode')
    expect(webqqView).toContain('`is-color-${webQQColorMode}`')
    expect(webqqView).not.toContain('v-model="webQQColorMode"')
    expect(webqqView).not.toContain('webQQColorModeOptions')
    expect(webqqView).not.toContain('aria-label="WebQQ 颜色模式"')
  })

  it('uses bot avatar accent color ahead of the manual WebQQ accent color', () => {
    expect(webqqView).toContain('const webQQEffectiveAccentColor = computed')
    expect(webqqView).toContain('if (useBotAvatarThemeColor.value)')
    expect(webqqView).toContain('return normalizeAccentColor(webQQAvatarAccentColor.value)')
    expect(webqqView).toContain("return '#2563eb'")
    expect(webqqView).toContain('return normalizeAccentColor(webQQAccentColor.value)')
    expect(webqqView).toContain('const webQQAccentStyle = computed')
    expect(webqqView).toContain("'--chat-capsule-webqq-accent': webQQEffectiveAccentColor.value")
    expect(webqqView).toContain("'--chat-capsule-webqq-accent-soft': hexToRgba(webQQEffectiveAccentColor.value, 0.14)")
  })

  it('passes panel visibility to the WebQQ observer', () => {
    expect(capsuleView).toContain(':visible="webqqOpen"')
    expect(webqqView).toContain('defineProps<{ visible: boolean }>()')
    expect(webqqView).toContain('!props.visible')
    expect(webqqView).toContain('watch(() => props.visible')
  })

  it('closes WebQQ when clicking outside the capsule host', () => {
    expect(capsuleView).toContain('ref="capsuleHost"')
    expect(capsuleView).toContain('function closeWebQQOnOutsideClick')
    expect(capsuleView).toContain("document.addEventListener('pointerdown', closeWebQQOnOutsideClick)")
    expect(capsuleView).toContain("document.removeEventListener('pointerdown', closeWebQQOnOutsideClick)")
  })

  it('renders contacts, groups, message history, and no send input', () => {
    expect(webqqView).toContain("send('chat-capsule/webqq/contacts')")
    expect(webqqView).toContain("send('chat-capsule/webqq/messages'")
    expect(webqqView).toContain("receive('chat-capsule/webqq/message'")
    expect(webqqView).toContain("@click=\"selectTab('friends')\"")
    expect(webqqView).toContain("@click=\"selectTab('groups')\"")
    expect(webqqView.match(/class="chat-capsule-webqq__tab-icon"/g)).toHaveLength(3)
    expect(webqqView).not.toContain('is-clock')
    expect(webqqView).not.toContain('is-user')
    expect(webqqView).not.toContain('is-group')
    expect(webqqView).toMatch(/v-for="\(message, index\) in (messages|visibleMessages)"/)
    expect(webqqView).not.toContain('textarea')
    expect(webqqView).not.toContain("send('chat-capsule/webqq/send'")
    expect(webqqView).not.toContain('只读模式')
    expect(webqqView).not.toContain('chat-capsule-webqq__readonly-bar')
  })

  it('renders a transient outgoing bot thinking message after the real WebQQ messages', () => {
    expect(webqqView).toContain('const visibleMessages = computed')
    expect(webqqView).toContain('const cachedMessages = messages.value.map(applyMessageSenderMetadata)')
    expect(webqqView).toContain('return botThinkingMessage.value ? [...cachedMessages, applyMessageSenderMetadata(botThinkingMessage.value)] : cachedMessages')
    expect(webqqView).toContain('v-for="(message, index) in visibleMessages"')
    expect(webqqView).toContain("'is-thinking': isBotThinkingMessage(message)")
    expect(webqqView).toContain('function isBotThinkingMessage(message: WebQQMessage)')
    expect(webqqView).not.toContain('chat-capsule-webqq__thinking-bubble')
    expect(style).not.toContain('chat-capsule-webqq__thinking-bubble')
    const messageBodySource = sourceBetween(
      webqqView,
      'class="chat-capsule-webqq__message-body"',
      'class="chat-capsule-webqq__message-time"',
    )
    expect(messageBodySource.indexOf('class="chat-capsule-webqq__thinking-dots"')).toBeGreaterThan(messageBodySource.indexOf('class="chat-capsule-webqq__bubble"'))
  })

  it('uses three animated floating dots as the temporary bot thinking content', () => {
    expect(webqqView).toContain('class="chat-capsule-webqq__thinking-dots"')
    expect(webqqView).toContain('v-for="dot in 3"')
    expect(webqqView).toContain(':key="dot"')
    expect(webqqView).toContain('class="chat-capsule-webqq__thinking-dot"')
    expect(style).toContain('@keyframes chat-capsule-webqq-thinking-dot')
  })

  it('shows the temporary bot thinking bubble only for the capsule current WebQQ conversation', () => {
    expect(webqqView).toContain('const botThinkingMessage = computed<WebQQMessage | undefined>(() => {')
    expect(webqqView).toContain('const conversation = capsule.value?.conversation')
    expect(webqqView).toContain("conversation.activityText !== '正在思考'")
    expect(webqqView).toContain('conversation.channelId')
    expect(webqqView).toContain('conversation.userId')
    expect(webqqView).toContain('conversation.userName')
    expect(webqqView).toContain('currentChat.value.type')
    expect(webqqView).toContain('currentChat.value.peerId')
  })

  it('hides the temporary bot thinking bubble after a real outgoing WebQQ message reaches the same conversation', () => {
    expect(webqqView).toContain('function hasOutgoingMessageAfter(timestamp: number)')
    expect(webqqView).toContain("messages.value.some((message) => message.direction === 'outgoing' && message.time >= timestamp)")
    expect(webqqView).toContain('if (hasOutgoingMessageAfter(conversation.timestamp)) return')
  })

  it('lets capsule conversation data carry group sender metadata', () => {
    const capsuleConversationSource = sourceBetween(
      clientState,
      'conversation: {',
      '  counters: {',
    )

    expect(capsuleConversationSource).toContain('senderRole?: string')
    expect(capsuleConversationSource).toContain('senderLevel?: string')
    expect(capsuleConversationSource).toContain('senderTitle?: string')
  })

  it('lets WebQQ messages carry ChatLuna affinity badges', () => {
    expect(clientState).toContain('senderAffinity?: number')
    expect(clientState).toContain('senderRelationship?: string')
    expect(onebotSource).toContain('senderAffinity?: number')
    expect(onebotSource).toContain('senderRelationship?: string')
  })

  it('uses capsule conversation group sender metadata on the temporary bot thinking message', () => {
    const thinkingMessageSource = sourceBetween(
      webqqView,
      'const botThinkingMessage = computed<WebQQMessage | undefined>(() => {',
      'const visibleMessages = computed(() => {',
    )

    expect(thinkingMessageSource).toContain("direction: 'outgoing'")
    expect(thinkingMessageSource).toMatch(/senderRole:\s*conversation\.senderRole/)
    expect(thinkingMessageSource).toMatch(/senderLevel:\s*conversation\.senderLevel/)
    expect(thinkingMessageSource).toMatch(/senderTitle:\s*conversation\.senderTitle/)
    expect(webqqView).toContain("v-if=\"message.direction === 'outgoing'\"")
    expect(webqqView).toContain('getSenderAuthorityText(message)')
    expect(webqqView).toContain('message.senderLevel && !hideWebQQGroupLevel')
  })

  it('hydrates missing live WebQQ sender metadata from cached messages in the same conversation', () => {
    const visibleMessagesSource = sourceBetween(
      webqqView,
      'const visibleMessages = computed(() => {',
      'function getGroupSubtitle',
    )
    const receiveSource = sourceBetween(
      webqqView,
      "receive('chat-capsule/webqq/message'",
      "watch(() => props.visible",
    )

    expect(webqqView).toContain('applyCachedWebQQSenderMetadata')
    expect(webqqView).toContain('rememberWebQQSenderMetadata')
    expect(webqqView).toContain('const senderMetadataCache = ref')
    expect(webqqView).toContain('function rememberMessageSenderMetadata')
    expect(webqqView).toContain('function applyMessageSenderMetadata')
    expect(visibleMessagesSource).toContain('messages.value.map(applyMessageSenderMetadata)')
    expect(webqqView).toContain('rememberMessageSenderMetadata(currentChat.value.type, currentChat.value.peerId, messages.value)')
    expect(receiveSource).toContain('rememberMessageSenderMetadata(payload.type, payload.peerId, [payload.message])')
  })

  it('uses backend recent contacts instead of the first contacts in each list', () => {
    expect(webqqView).toContain('contacts.value.recent')
    expect(webqqView).toContain('conversationSummaries.value')
    expect(webqqView).not.toContain('contacts.value.friends.slice(0, 4)')
    expect(webqqView).not.toContain('contacts.value.groups.slice(0, 4)')
  })

  it('retries WebQQ contacts while Koishi and OneBot are still starting', () => {
    expect(webqqView).toContain('const webQQContactsRetryLimit')
    expect(webqqView).toContain('function waitWebQQContactsRetry()')
    expect(webqqView).toContain('for (let attempt = 1; attempt <= webQQContactsRetryLimit; attempt++)')
    expect(webqqView).toContain('if (attempt === webQQContactsRetryLimit) throw error')
    expect(webqqView).toContain('await waitWebQQContactsRetry()')
  })

  it('persists WebQQ recent message summaries and unread counts in browser storage by default', () => {
    expect(webqqView).toContain("const webQQStorageKey = 'chat-capsule:webqq:v1'")
    expect(webqqView).toContain('function loadBrowserWebQQStoredState()')
    expect(webqqView).toContain('function persistWebQQState()')
    expect(webqqView).toContain("if (webQQStorageBackend.value !== 'browser') return empty")
    expect(webqqView).toContain('localStorage.getItem(webQQStorageKey)')
    expect(webqqView).toContain('localStorage.setItem(webQQStorageKey')
    expect(webqqView).toContain('conversationSummaries.value = stored.conversationSummaries')
    expect(webqqView).toContain('conversationUnreadCounts.value = stored.conversationUnreadCounts')
    expect(webqqView).toContain('persistWebQQState()')
    expect(webqqView).not.toContain('messages.value = stored')
  })

  it('loads and saves WebQQ state through Koishi storage listeners for the koishi backend', () => {
    expect(webqqView).toContain('webQQStorageBackend')
    expect(webqqView).toContain('function createWebQQStoredState()')
    expect(webqqView).toContain('async function loadRemoteWebQQStoredState()')
    expect(webqqView).toContain("if (webQQStorageBackend.value === 'browser') return")
    expect(webqqView).toContain("send('chat-capsule/webqq/storage/load')")
    expect(webqqView).toContain('applyWebQQStoredState(stored)')
    expect(webqqView).toContain("send('chat-capsule/webqq/storage/save', createWebQQStoredState())")
    expect(webqqView).toContain('loadRemoteWebQQStoredState()')
  })

  it('caches full WebQQ messages in IndexedDB for the browser backend', () => {
    expect(webqqView).toContain('loadBrowserWebQQMessages')
    expect(webqqView).toContain('saveBrowserWebQQMessages')
    expect(webqqMessageCache).toContain('const webQQMessageCacheLimit = 100')
    expect(webqqMessageCache).toContain("indexedDB.open('chat-capsule-webqq'")
    expect(webqqMessageCache).toContain("database.createObjectStore('messages', { keyPath: 'id' })")
    expect(webqqMessageCache).toContain('messages.slice(-webQQMessageCacheLimit)')
  })

  it('uses Koishi DB message cache listeners for the koishi backend', () => {
    expect(webqqView).toContain('async function loadCachedWebQQMessages')
    expect(webqqView).toContain('async function saveCachedWebQQMessages')
    expect(webqqView).toContain("if (webQQStorageBackend.value === 'koishi')")
    expect(webqqView).toContain("send('chat-capsule/webqq/messages/cache/load'")
    expect(webqqView).toContain("send('chat-capsule/webqq/messages/cache/save'")
    expect(webqqView).toContain('loadBrowserWebQQMessages(type, peerId)')
    expect(webqqView).toContain('saveBrowserWebQQMessages(type, peerId, messages)')
  })

  it('preserves completed thinking metadata when cached messages merge with plain history', () => {
    expect(webqqView).toContain('function mergeWebQQMessage')
    expect(webqqView).toContain('thinking: next.thinking || current.thinking')
    expect(webqqView).toContain('messages.value = mergeMessages(cachedMessages, messages.value)')
    expect(webqqView).toContain('saveCachedWebQQMessages')
  })

  it('renders WebQQ friends under backend categories', () => {
    expect(webqqView).toContain('visibleFriendCategories')
    expect(webqqView).toContain('v-for="category in visibleFriendCategories"')
    expect(webqqView).toContain('class="chat-capsule-webqq__friend-category"')
    expect(webqqView).toContain('class="chat-capsule-webqq__friend-category-title"')
    expect(webqqView).toContain('v-for="friend in category.friends"')
  })

  it('opens a WebQQ notification dropdown menu from the bell button', () => {
    expect(webqqView).toContain('@click="openNotices"')
    expect(webqqView).toContain('@click="closeNoticeMenu"')
    expect(webqqView).toContain('class="chat-capsule-webqq__notify-wrap" @click.stop')
    expect(webqqView).toContain('class="chat-capsule-webqq__notify-icon"')
    expect(webqqView).toContain('viewBox="0 0 24 24"')
    expect(webqqView).not.toContain('is-bell')
    expect(webqqView).toContain('chat-capsule-webqq__notice-menu')
    expect(webqqView).toContain("noticeMenuTab === 'friends'")
    expect(webqqView).toContain("noticeMenuTab === 'groups'")
    expect(webqqView).toContain("@click=\"noticeMenuTab = 'friends'\"")
    expect(webqqView).toContain("@click=\"noticeMenuTab = 'groups'\"")
    expect(webqqView).toContain('sortPendingNotices')
    expect(webqqView).toContain("send('chat-capsule/webqq/notices')")
    expect(webqqView).toContain("send('chat-capsule/webqq/notice-action'")
    expect(webqqView).toContain('v-for="notice in filteredNotices"')
    expect(webqqView).toContain('chat-capsule-webqq__notice-card')
    expect(webqqView).toContain(':src="withProxy(notice.avatar)"')
    expect(webqqView).toContain('class="chat-capsule-webqq__notice-title"')
    expect(webqqView).toContain('getHandledNoticeStatusText(notice)')
    expect(webqqView).toContain('chat-capsule-webqq__notice-result')
    expect(webqqView).toContain('<time v-if="notice.time" class="chat-capsule-webqq__notice-time">{{ formatNoticeTime(notice.time) }}</time>')
    expect(webqqView).toContain('v-else-if="getHandledNoticeStatusText(notice)"')
    expect(webqqView).toContain('v-for="line in formatNoticeComment(notice.comment)"')
    expect(webqqView).toContain('chat-capsule-webqq__notice-comment')
    expect(webqqView).toContain("@click=\"handleNotice(notice, true)\"")
    expect(webqqView).toContain("@click=\"handleNotice(notice, false)\"")
    expect(webqqView).toContain('暂无通知')
    expect(webqqView).not.toContain('chat-capsule-webqq__notice-meta')
    expect(webqqView).not.toContain('chat-capsule-webqq__notice-type')
    expect(webqqView).not.toContain('chat-capsule-webqq__notice-status')
    expect(webqqView).not.toContain('getNoticeTypeText')
    expect(webqqView).not.toContain('getNoticeStatusText')
    expect(webqqView).not.toContain('申请时间：')
    expect(webqqView).not.toContain("return timestamp ? formatListTime(timestamp) : '未知'")
    expect(webqqView).not.toContain('<small class="chat-capsule-webqq__notice-time"')
    expect(webqqView).not.toContain('<div v-if="noticeOpen" class="chat-capsule-webqq__chat-title">')
  })

  it('closes the WebQQ notification dropdown when clicking elsewhere in the panel', () => {
    expect(webqqView).toContain('function closeNoticeMenu()')
    expect(webqqView).toContain('noticeOpen.value = false')
  })

  it('formats WebQQ notice times as month/day plus clock time', () => {
    expect(webqqView).toContain('function padNoticeTimePart(value: number)')
    expect(webqqView).toContain('date.getMonth() + 1')
    expect(webqqView).toContain('date.getDate()')
    expect(webqqView).toContain('date.getHours()')
    expect(webqqView).toContain('date.getMinutes()')
  })

  it('splits WebQQ notice question and answer comments into separate lines', () => {
    expect(webqqView).toContain('function formatNoticeComment(comment: string)')
    expect(webqqView).toContain('问题[:：]')
    expect(webqqView).toContain('答案[:：]')
    expect(webqqView).toContain('return match ? [match[1], match[2]] : [comment]')
  })

  it('renders sender avatars for WebQQ messages', () => {
    expect(webqqView).toContain('class="chat-capsule-webqq__message-avatar"')
    expect(webqqView).toContain(':src="withProxy(message.senderAvatar)"')
    expect(webqqView).toContain(':alt="message.senderName"')
  })

  it('marks consecutive messages from the same sender as merged in Telegram chat style', () => {
    expect(webqqView).toMatch(/v-for="\(message, index\) in (messages|visibleMessages)"/)
    expect(webqqView).toContain("'is-merged': isMergedMessage(index)")
    expect(webqqView).toContain('getMessageClusterClass(index)')
    expect(webqqView).toContain('v-if="!isMergedMessage(index)"')
    expect(webqqView).toContain('function getMessageClusterClass(index: number)')
    expect(webqqView).toContain('function isMergedMessage(index: number)')
    expect(webqqView).toContain("webQQChatStyle.value !== 'telegram'")
    expect(webqqView).toContain("return 'is-cluster-middle'")
    expect(webqqView).toContain("return 'is-cluster-first'")
    expect(webqqView).toContain("return 'is-cluster-last'")
    expect(webqqView).toContain("if (!message) return ''")
    expect(webqqView).toContain('function getClusterBubbleMessage(index: number, step: 1 | -1)')
    expect(webqqView).toContain('if (!isImageOnlyMessage(candidate)) return candidate')
    expect(webqqView).toContain('const hasPrevious = !!getClusterBubbleMessage(index, -1)')
    expect(webqqView).toContain('const hasNext = !!getClusterBubbleMessage(index, 1)')
  })

  it('wraps WebQQ message bubbles with their time for Telegram hover layout', () => {
    expect(webqqView).toContain('class="chat-capsule-webqq__message-body"')
    expect(webqqView).toContain('<div v-else class="chat-capsule-webqq__bubble">')
    expect(webqqView).toContain('<div class="chat-capsule-webqq__message-time">{{ formatTime(message.time) }}</div>')
  })

  it('renders image-only WebQQ messages without a text bubble', () => {
    expect(webqqView).toContain('v-if="isImageOnlyMessage(message)"')
    expect(webqqView).toContain('class="chat-capsule-webqq__message-media"')
    expect(webqqView).toContain(':src="withProxy(message.elements[0].url)"')
    expect(webqqView).toContain('function isImageOnlyMessage(message: WebQQMessage)')
  })

  it('opens WebQQ message images in a full-size preview overlay', () => {
    expect(webqqView).toContain('const imagePreviewUrl = ref(\'\')')
    expect(webqqView).toContain('const imagePreview = ref<HTMLElement>()')
    expect(webqqView).toContain('function openImagePreview(url: string)')
    expect(webqqView).toContain('imagePreviewUrl.value = withProxy(url)')
    expect(webqqView).toContain('imagePreview.value?.focus()')
    expect(webqqView).toContain('function closeImagePreview()')
    expect(webqqView).toContain('imagePreviewUrl.value = \'\'')
    expect(webqqView).toContain('@click="openImagePreview(message.elements[0].url)"')
    expect(webqqView).toContain('@click="openImagePreview(run.element.url)"')
    expect(webqqView).toContain('v-if="imagePreviewUrl"')
    expect(webqqView).toContain('ref="imagePreview"')
    expect(webqqView).toContain('class="chat-capsule-webqq__image-preview"')
    expect(webqqView).toContain('@click.stop.self="closeImagePreview"')
    expect(webqqView).toContain('@keydown.esc="closeImagePreview"')
    expect(webqqView).toContain(':src="imagePreviewUrl"')
    expect(webqqView).toContain('aria-label="关闭图片预览"')
  })

  it('declares optional completed thinking data on backend and client WebQQ messages', () => {
    const backendMessageSource = sourceBetween(
      onebotSource,
      'export interface WebQQMessage {',
      'export interface WebQQLiveMessage',
    )
    const clientMessageSource = sourceBetween(
      clientState,
      'export interface WebQQMessage {',
      'export interface WebQQLiveMessage',
    )

    for (const messageSource of [backendMessageSource, clientMessageSource]) {
      expect(messageSource).toContain('thinking?:')
      expect(messageSource).toContain('content: string')
      expect(messageSource).toContain('durationMs: number')
    }
  })

  it('renders completed thinking below WebQQ messages as a collapsible disclosure', () => {
    expect(webqqView).toContain('const expandedThinkingMessageIds = ref')
    expect(webqqView).toContain('function formatThinkingDuration(durationMs: number)')
    expect(webqqView).toContain('Math.round(durationMs / 1000)')
    expect(webqqView).toContain('return `已思考 ${seconds}s`')
    expect(webqqView).toContain('function isThinkingExpanded(message: WebQQMessage)')
    expect(webqqView).toContain('function toggleThinking(message: WebQQMessage)')
    expect(webqqView).toContain('function getLastOutgoingClusterThinkingMessage(index: number)')
    expect(webqqView).toContain('candidate.thinking?.content')
    expect(webqqView).toContain('class="chat-capsule-webqq__thinking-row"')
    expect(webqqView).toContain('class="chat-capsule-webqq__thinking-toggle"')
    expect(webqqView).toContain('@click="toggleThinking(getLastOutgoingClusterThinkingMessage(index))"')
    expect(webqqView).toContain('formatThinkingDuration(getLastOutgoingClusterThinkingMessage(index).thinking.durationMs)')
    expect(webqqView).toContain('class="chat-capsule-webqq__thinking-content"')
    expect(webqqView).toContain('{{ getLastOutgoingClusterThinkingMessage(index).thinking.content }}')
  })

  it('renders completed outgoing thinking after the last bubble in its WebQQ message cluster', () => {
    const thinkingRowStart = '<div\n                  v-if="getLastOutgoingClusterThinkingMessage(index)"'
    const messageContentSource = sourceBetween(
      webqqView,
      'class="chat-capsule-webqq__message-content"',
      thinkingRowStart,
    )

    expect(messageContentSource).not.toContain('class="chat-capsule-webqq__thinking-toggle"')
    expect(messageContentSource).not.toContain('class="chat-capsule-webqq__thinking-content"')
    expect(webqqView.indexOf(thinkingRowStart)).toBeGreaterThan(webqqView.indexOf('class="chat-capsule-webqq__message-content"'))
    expect(webqqView).toContain('getLastOutgoingClusterThinkingMessage(index)')
    expect(webqqView).toContain('formatThinkingDuration(getLastOutgoingClusterThinkingMessage(index).thinking.durationMs)')
    expect(webqqView).toContain('toggleThinking(getLastOutgoingClusterThinkingMessage(index))')
  })

  it('renders completed WebQQ thinking usage as icons before the thinking duration', () => {
    const thinkingToggleSource = sourceBetween(
      webqqView,
      'class="chat-capsule-webqq__thinking-toggle"',
      'class="chat-capsule-webqq__thinking-chevron"',
    )

    expect(webqqView).not.toContain("return `输入 ${usage.inputTokens} / 输出 ${usage.outputTokens}`")
    expect(webqqView).not.toContain('输入 ${usage.inputTokens}')
    expect(webqqView).not.toContain('输出 ${usage.outputTokens}')
    expect(thinkingToggleSource).toContain('getLastOutgoingClusterThinkingMessage(index).thinking.usage')
    expect(thinkingToggleSource).toContain('class="chat-capsule-webqq__thinking-usage"')
    expect(thinkingToggleSource).toContain('class="chat-capsule-webqq__thinking-usage-icon is-input"')
    expect(thinkingToggleSource).toContain('class="chat-capsule-webqq__thinking-usage-icon is-output"')
    expect(thinkingToggleSource).toContain('{{ getLastOutgoingClusterThinkingMessage(index).thinking.usage.inputTokens }}')
    expect(thinkingToggleSource).toContain('{{ getLastOutgoingClusterThinkingMessage(index).thinking.usage.outputTokens }}')
    expect(thinkingToggleSource).not.toContain(' / ')
    expect(thinkingToggleSource.indexOf('class="chat-capsule-webqq__thinking-usage"')).toBeLessThan(
      thinkingToggleSource.indexOf('formatThinkingDuration(getLastOutgoingClusterThinkingMessage(index).thinking.durationMs)'),
    )
    expect(webqqView).toContain('function formatThinkingDuration(durationMs: number)')
    expect(webqqView).toContain('function toggleThinking(message: WebQQMessage)')
  })

  it('renders consecutive inline WebQQ elements inside one inline container', () => {
    const bubbleSource = sourceBetween(
      webqqView,
      '<div v-else class="chat-capsule-webqq__bubble">',
      '<div class="chat-capsule-webqq__message-time"',
    )

    expect(bubbleSource).toContain('getWebQQElementRuns(message.elements)')
    expect(bubbleSource).toContain('class="chat-capsule-webqq__inline-run"')
    expect(bubbleSource).toContain('v-for="element in run.elements"')
    expect(bubbleSource).not.toContain('v-for="(element, index) in message.elements"')
  })

  it('renders group badges around sender names in opposite order by direction', () => {
    expect(webqqView).toContain('chat-capsule-webqq__sender-line')
    expect(webqqView).toContain("v-if=\"message.direction === 'outgoing'\"")
    expect(webqqView).toContain("v-if=\"message.direction === 'incoming'\"")
    expect(webqqView).toContain('message.senderRole')
    expect(webqqView).toContain('message.senderLevel')
    expect(webqqView).toContain('message.senderTitle')
    expect(webqqView).toContain('getSenderAuthorityText')
    expect(webqqView).toContain('getSenderAuthorityClass')
    expect(webqqView).toContain('formatSenderLevel')
    expect(webqqView).toContain('message.senderAffinity != null && showWebQQAffinity')
    expect(webqqView).toContain('class="chat-capsule-webqq__sender-heart"')
    expect(webqqView).toContain('{{ message.senderAffinity }}')
    expect(webqqView).not.toContain('function formatSenderAffinity')
    expect(webqqView).toContain('message.senderRelationship && showWebQQRelationship')
  })

  it('shows group avatar, group id, and member count in the chat header', () => {
    expect(webqqView).toContain('class="chat-capsule-webqq__chat-avatar"')
    expect(webqqView).toContain(':src="withProxy(currentAvatar)"')
    expect(webqqView).toContain('function getGroupSubtitle')
    expect(webqqView).toContain('currentSubtitle = computed')
  })

  it('opens a group-only WebQQ info panel with announcements and searchable members', () => {
    expect(webqqView).toContain('v-if="currentChat?.type === \'group\'"')
    expect(webqqView).toContain('aria-label="更多群信息"')
    expect(webqqView).toContain('@click="toggleGroupInfo"')
    expect(webqqView).not.toContain('aria-label="关闭群信息"')
    expect(webqqView).not.toContain('@click="closeGroupInfo"')
    expect(webqqView).not.toContain('function closeGroupInfo()')
    expect(webqqView).toContain("send('chat-capsule/webqq/group-info'")
    expect(webqqView).toContain('chat-capsule-webqq__chat-main')
    expect(webqqView).toContain('chat-capsule-webqq__group-info')
    expect(webqqView).toContain('chat-capsule-webqq__group-announcements')
    expect(webqqView).toContain('chat-capsule-webqq__group-members')
    expect(webqqView).toContain('v-for="announcement in groupInfo.announcements"')
    expect(webqqView).not.toContain('<strong>{{ announcement.title }}</strong>')
    expect(webqqView).toContain('v-for="member in visibleGroupMembers"')
    expect(webqqView).toContain('v-model="groupInfoSearchQuery"')
    expect(webqqView).toContain('const visibleGroupMembers = computed')
    expect(webqqView).toContain('sortWebQQGroupMembers(members)')
    expect(webqqView).toContain('member.card.toLowerCase().includes(query)')
    expect(webqqView).toContain('member.userId.includes(groupInfoSearchQuery.value)')
    expect(webqqView).not.toContain('<button type="button" @click="loadContacts">刷新</button>')
  })

  it('uses an inline SVG three-dot button as the only group info toggle', () => {
    const buttonSource = webqqView.match(/<button v-if="currentChat\?\.type === 'group'"[\s\S]*?<\/button>/)?.[0] ?? ''
    expect(buttonSource).toContain('aria-label="更多群信息"')
    expect(buttonSource).toContain('@click="toggleGroupInfo"')
    expect(buttonSource).toContain('class="chat-capsule-webqq__header-icon"')
    expect(buttonSource.match(/<circle /g)).toHaveLength(3)
    expect(buttonSource).not.toContain('::before')
    expect(buttonSource).not.toContain('::after')
  })

  it('uses an inline SVG search icon in the WebQQ search field', () => {
    const searchSource = webqqView.match(/<div v-if="activeTab !== 'recent'" class="chat-capsule-webqq__search">[\s\S]*?<\/div>/)?.[0] ?? ''
    expect(searchSource).toContain('<svg class="chat-capsule-webqq__search-icon"')
    expect(searchSource).toContain('<circle')
    expect(searchSource).toContain('<path')
    expect(searchSource).not.toContain('<span class="chat-capsule-webqq__search-icon"></span>')
  })

  it('shows latest message summary and time in the WebQQ contact list', () => {
    expect(webqqView).toContain('getContactSubtitle')
    expect(webqqView).toContain('getContactTime')
    expect(webqqView).toContain('formatListTime')
    expect(webqqView).toContain('chat-capsule-webqq__contact-time')
  })

  it('shows unread counts for conversations the user is not viewing', () => {
    expect(webqqView).toContain('conversationUnreadCounts')
    expect(webqqView).toContain('webQQTotalUnread')
    expect(webqqView).toContain('class="chat-capsule-webqq__contact-avatar"')
    expect(webqqView).toContain('class="chat-capsule-webqq__contact-unread"')
    expect(webqqView).toContain('getUnreadCount(item.type, item.peerId)')
    expect(webqqView).toContain('getUnreadText')
    expect(webqqView).toContain("payload.message.direction === 'incoming'")
    expect(webqqView).toContain('!trackingMessages.value')
    expect(webqqView).toContain('increaseUnreadCount(payload.type, payload.peerId)')
    expect(webqqView).toContain('clearUnreadCount(currentChat.value.type, currentChat.value.peerId)')
  })

  it('shares the summed WebQQ unread count with the capsule state', () => {
    expect(webqqView).toMatch(/import\s+\{[^}]*webQQTotalUnread[^}]*\}\s+from '\.\/state'/)
    expect(webqqView).toContain('const totalUnreadCount = computed(() => Object.values(conversationUnreadCounts.value).reduce((sum, count) => sum + count, 0))')
    expect(webqqView).toContain('watch(totalUnreadCount, (count) => {')
    expect(webqqView).toContain('webQQTotalUnread.value = count')
    expect(webqqView).toContain('{ immediate: true }')
  })

  it('caps WebQQ unread badge text at 9999+ only above 9999', () => {
    expect([
      runGetUnreadText(999),
      runGetUnreadText(1000),
      runGetUnreadText(9999),
      runGetUnreadText(10000),
    ]).toEqual(['999', '1000', '9999', '9999+'])
  })

  it('tracks new WebQQ messages only while the message pane is at the bottom', () => {
    expect(webqqView).toContain('ref="messagePane"')
    expect(webqqView).toContain('@scroll="updateMessageTracking"')
    expect(webqqView).toContain('const trackingMessages = ref(true)')
    expect(webqqView).toContain('function updateMessageTracking()')
    expect(webqqView).toContain('function scrollMessagesToBottom')
    expect(webqqView).toContain('if (trackingMessages.value) scrollMessagesToBottom()')
  })

  it('shows a WebQQ return-to-bottom button only when message tracking is paused', () => {
    const scrollBottomButton = webqqView.match(/<button[\s\S]*?chat-capsule-webqq__scroll-bottom[\s\S]*?>/)?.[0] ?? ''
    const missingRequirements = [
      scrollBottomButton ? '' : '缺少返回底部按钮',
      /v-if="!\s*trackingMessages\s*&&\s*visibleMessages\.length"/.test(scrollBottomButton)
        ? ''
        : '返回底部按钮没有只在 !trackingMessages && visibleMessages.length 时显示',
      scrollBottomButton.includes('type="button"') ? '' : '返回底部按钮不是明确的 button 控件',
      scrollBottomButton.includes('aria-label="返回底部"') ? '' : '返回底部按钮缺少 aria-label="返回底部"',
      scrollBottomButton.includes('@click="returnMessagesToBottom"') ? '' : '返回底部按钮没有调用 returnMessagesToBottom',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('wraps the WebQQ return-to-bottom button in a named transition', () => {
    const scrollBottomTransition = webqqView.match(/<Transition\s+name="webqq-scroll-bottom">[\s\S]*?<\/Transition>/)?.[0] ?? ''
    const missingRequirements = [
      scrollBottomTransition ? '' : '缺少返回底部按钮过渡容器',
      scrollBottomTransition.includes('class="chat-capsule-webqq__scroll-bottom"')
        ? ''
        : '返回底部按钮没有放在过渡容器内',
      /v-if="!\s*trackingMessages\s*&&\s*visibleMessages\.length"/.test(scrollBottomTransition)
        ? ''
        : '过渡容器内的返回底部按钮没有保留显示条件',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('returns WebQQ messages to the bottom by resuming tracking before scrolling', () => {
    const returnMessagesToBottomSource = webqqView.match(/(?:async\s+)?function returnMessagesToBottom\(\)\s*{[\s\S]*?^}/m)?.[0] ?? ''
    const missingRequirements = [
      returnMessagesToBottomSource ? '' : '缺少 returnMessagesToBottom 函数',
      returnMessagesToBottomSource.includes('trackingMessages.value = true')
        ? ''
        : 'returnMessagesToBottom 没有先恢复 trackingMessages',
      returnMessagesToBottomSource.includes('returningMessagesToBottom.value = true')
        ? ''
        : 'returnMessagesToBottom 没有标记正在平滑返回底部',
      /scrollMessagesToBottom\(['"]smooth['"]\)/.test(returnMessagesToBottomSource)
        ? ''
        : 'returnMessagesToBottom 没有以 smooth 行为复用 scrollMessagesToBottom',
      returnMessagesToBottomSource.includes('loadOlderMessages')
        ? 'returnMessagesToBottom 不应改动历史加载逻辑'
        : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('keeps the WebQQ return-to-bottom button hidden while smooth scrolling back', () => {
    const updateTrackingSource = sourceBetween(
      webqqView,
      'function updateMessageTracking()',
      'function handleMessageImageLoad',
    )
    const missingRequirements = [
      webqqView.includes('const returningMessagesToBottom = ref(false)')
        ? ''
        : '缺少返回底部中的状态标记',
      updateTrackingSource.includes('const atBottom = isMessagePaneAtBottom()')
        ? ''
        : 'updateMessageTracking 没有复用单次 atBottom 判断',
      updateTrackingSource.includes('if (returningMessagesToBottom.value)')
        ? ''
        : 'updateMessageTracking 没有识别正在返回底部的滚动过程',
      updateTrackingSource.includes('trackingMessages.value = true')
        ? ''
        : '返回底部过程中 trackingMessages 没有保持为 true',
      updateTrackingSource.includes('if (atBottom) returningMessagesToBottom.value = false')
        ? ''
        : '到达底部后没有清理返回底部状态标记',
      updateTrackingSource.includes('trackingMessages.value = atBottom')
        ? ''
        : '非返回底部滚动没有继续按 atBottom 更新 trackingMessages',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('lets WebQQ bottom scrolling choose instant or smooth behavior', () => {
    const scrollMessagesToBottomSource = webqqView.match(/async function scrollMessagesToBottom\([\s\S]*?^}/m)?.[0] ?? ''
    const missingRequirements = [
      scrollMessagesToBottomSource ? '' : '缺少 scrollMessagesToBottom 函数',
      /behavior:\s*ScrollBehavior\s*=\s*['"]auto['"]/.test(scrollMessagesToBottomSource)
        ? ''
        : 'scrollMessagesToBottom 没有保留默认即时滚动',
      scrollMessagesToBottomSource.includes('pane.scrollTo({')
        ? ''
        : 'scrollMessagesToBottom 没有使用支持 behavior 的 scrollTo',
      scrollMessagesToBottomSource.includes('top: pane.scrollHeight')
        ? ''
        : 'scrollMessagesToBottom 没有滚动到消息底部',
      scrollMessagesToBottomSource.includes('behavior,')
        ? ''
        : 'scrollMessagesToBottom 没有把 behavior 传给 scrollTo',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('scrolls to the latest message after the loading placeholder is hidden', () => {
    expect(webqqView).toContain('finally {\n    loading.value = false\n  }')
    expect(webqqView).toContain('if (!errorText.value && trackingMessages.value) await scrollMessagesToBottom()')
  })

  it('keeps following the latest message after WebQQ images finish loading', () => {
    expect(webqqView).toContain('@load="handleMessageImageLoad"')
    expect(webqqView).toContain('function handleMessageImageLoad()')
    expect(webqqView).toContain('if (trackingMessages.value) scrollMessagesToBottom()')
  })

  it('renders quote blocks inside WebQQ message bubbles', () => {
    expect(webqqView).toContain('element.type === \'quote\'')
    expect(webqqView).toContain('chat-capsule-webqq__quote')
    expect(webqqView).toContain('chat-capsule-webqq__quote-title')
  })

  it('renders forward message elements as block previews inside WebQQ bubbles', () => {
    const backendForwardItemSource = sourceBetween(
      onebotSource,
      'export interface WebQQForwardItem {',
      'export interface WebQQMessageElement {',
    )
    const clientForwardItemSource = sourceBetween(
      clientState,
      'export interface WebQQForwardItem {',
      'export interface WebQQMessageElement {',
    )
    const backendMessageSource = sourceBetween(
      onebotSource,
      'export interface WebQQMessageElement {',
      'export interface WebQQMessage {',
    )
    const clientMessageSource = sourceBetween(
      clientState,
      'export interface WebQQMessageElement {',
      'export interface WebQQMessage {',
    )

    expect(backendMessageSource).toContain("'forward'")
    expect(clientMessageSource).toContain("'forward'")
    expect(backendMessageSource).toContain('items?:')
    expect(clientMessageSource).toContain('items?:')
    expect(backendForwardItemSource).toContain('senderId?: string')
    expect(backendForwardItemSource).toContain('senderAvatar?: string')
    expect(clientForwardItemSource).toContain('senderId?: string')
    expect(clientForwardItemSource).toContain('senderAvatar?: string')
    expect(webqqView).toContain("run.element.type === 'forward'")
    expect(webqqView).toContain('chat-capsule-webqq__forward')
    expect(webqqView).toContain("run.element.title || '合并转发'")
    expect(webqqView).toContain("run.element.text || '[合并转发]'")
    expect(webqqView).toContain("element.type !== 'forward'")
  })

  it('limits WebQQ forward bubble previews to the first four items and shows a total entry', () => {
    const forwardBubbleSource = sourceBetween(
      webqqView,
      'v-else-if="run.element.type === \'forward\'"',
      '</button>',
    )
    const hasFixedPreviewLimit = /(?:const\s+[\w_]*forward[\w_]*preview[\w_]*(?:limit|count|items)[\w_]*\s*=\s*4|\.slice\(0,\s*4\)|\.slice\(0,\s*[\w_]*forward[\w_]*preview[\w_]*(?:limit|count|items)[\w_]*\))/i.test(webqqView)
    const hasPreviewItemsLoop = /v-for="[^"]*(?:run\.element\.items|forward[\w_]*preview|get[\w_]*forward[\w_]*preview)[^"]*"/is.test(forwardBubbleSource)
    const hasPreviewItemSummary = /(?:item\.elements|(?:get|format)[\w_]*forward[\w_]*(?:summary|previewtext|previewText)[\w_]*\(item\))/i.test(forwardBubbleSource)
    const hasTotalEntryInBubble = /(?:查看[\s\S]{0,120}条转发消息|(?:get|format)[\w_]*forward[\w_]*(?:count|total|entry)[\w_]*\(run\.element\))/i.test(forwardBubbleSource)
    const hasTotalEntryText = /查看[\s\S]{0,160}(?:items(?:\?\.|\.)length|run\.element\.items(?:\?\.|\.)length)[\s\S]{0,160}条转发消息/i.test(webqqView)
    const missingRequirements = [
      hasFixedPreviewLimit ? '' : 'forward preview uses a fixed limit of 4',
      hasPreviewItemsLoop ? '' : 'forward bubble renders a preview loop from run.element.items',
      hasPreviewItemSummary ? '' : 'forward preview summary is derived from item.elements',
      hasTotalEntryInBubble && hasTotalEntryText ? '' : 'forward bubble shows 查看${items.length}条转发消息 total entry',
      forwardBubbleSource.includes('@click.stop="openForwardDialog(run.element)"') ? '' : 'forward total entry keeps opening openForwardDialog(run.element)',
      forwardBubbleSource.includes("run.element.text || '[合并转发]'") ? '' : 'forward elements without items keep the existing [合并转发] fallback',
      /webQQ.*Forward.*Preview/i.test(clientState) ? 'forward preview must not add a client state config option' : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('renders card message elements as block previews inside WebQQ bubbles', () => {
    const backendMessageSource = sourceBetween(
      onebotSource,
      'export interface WebQQMessageElement {',
      'export interface WebQQMessage {',
    )
    const clientMessageSource = sourceBetween(
      clientState,
      'export interface WebQQMessageElement {',
      'export interface WebQQMessage {',
    )

    expect(backendMessageSource).toContain("'card'")
    expect(clientMessageSource).toContain("'card'")
    expect(backendMessageSource).toContain('imageUrl?:')
    expect(clientMessageSource).toContain('imageUrl?:')
    expect(backendMessageSource).toContain('source?:')
    expect(clientMessageSource).toContain('source?:')
    expect(webqqView).toContain("run.element.type === 'card'")
    expect(webqqView).toContain('chat-capsule-webqq__card')
    expect(webqqView).toContain("element.type !== 'card'")
    expect(webqqView).not.toContain(`:is="run.element.url ? 'a' : 'div'"`)
    expect(webqqView).not.toContain(':href="run.element.url || undefined"')
    expect(webqqView).not.toContain(':target=')
    expect(webqqView).not.toContain(':rel=')
  })

  it('opens forward message elements in an LLBot-style modal using the current WebQQ message style', () => {
    expect(webqqView).toContain('const forwardDialog = ref<WebQQMessageElement>()')
    expect(webqqView).toContain('const forwardDialogItems = computed(() => forwardDialog.value?.items ?? [])')
    expect(webqqView).toContain('function openForwardDialog(element: WebQQMessageElement)')
    expect(webqqView).toContain('function closeForwardDialog()')
    expect(webqqView).toContain('@click.stop="openForwardDialog(run.element)"')
    expect(webqqView).toContain(':disabled="!run.element.items?.length"')
    expect(webqqView).toContain('v-if="forwardDialog"')
    expect(webqqView).toContain('class="chat-capsule-webqq__forward-modal-backdrop"')
    expect(webqqView).toContain('class="chat-capsule-webqq__forward-modal"')
    expect(webqqView).toContain('@click.self="closeForwardDialog"')
    expect(webqqView).toContain("{{ forwardDialog.title || '合并转发' }}")
    expect(webqqView).toContain('v-for="(item, itemIndex) in forwardDialogItems"')
    expect(webqqView).toContain(':class="[\'chat-capsule-webqq__message\', \'is-incoming\', getForwardItemClusterClass(itemIndex), { \'is-merged\': isMergedForwardItem(itemIndex) }]"')
    expect(webqqView).toContain('class="chat-capsule-webqq__message-avatar"')
    expect(webqqView).toContain(':src="withProxy(getForwardItemAvatar(item))"')
    expect(webqqView).toContain(':alt="getForwardItemName(item)"')
    expect(webqqView).toContain('class="chat-capsule-webqq__message-content"')
    expect(webqqView).toContain('class="chat-capsule-webqq__message-body"')
    expect(webqqView).toContain('class="chat-capsule-webqq__bubble"')
    expect(webqqView).toContain('getWebQQElementRuns(item.elements)')
    expect(webqqView).toContain('function getForwardItemName(item: WebQQForwardItem)')
    expect(webqqView).toContain('function getForwardItemAvatar(item: WebQQForwardItem)')
    expect(webqqView).toContain('function isMergedForwardItem(index: number)')
    expect(webqqView).toContain('function getForwardItemClusterClass(index: number)')
    expect(webqqView).toContain('@click="closeForwardDialog"')
    expect(webqqView).not.toContain('chat-capsule-webqq__forward-popover')
    expect(webqqView).not.toContain('chat-capsule-webqq__forward-page')
  })

  it('loads earlier WebQQ messages when scrolling to the top', () => {
    expect(webqqView).toContain('const historyLoading = ref(false)')
    expect(webqqView).toContain('const historyExhausted = ref(false)')
    expect(webqqView).toContain('function shouldLoadOlderMessages()')
    expect(webqqView).toContain('async function loadOlderMessages()')
    expect(webqqView).toContain('beforeSequence: messages.value[0]?.sequence')
  })

  it('keeps tabs at the top without the WebQQ profile block', () => {
    expect(webqqView).not.toContain('chat-capsule-webqq__profile')
    expect(webqqView).not.toContain('chat-capsule-webqq__profile-avatar')

    const sidebarIndex = webqqView.indexOf('class="chat-capsule-webqq__sidebar"')
    const tabsIndex = webqqView.indexOf('class="chat-capsule-webqq__tabs-row"')
    const listIndex = webqqView.indexOf('class="chat-capsule-webqq__list"')

    expect(tabsIndex).toBeGreaterThan(sidebarIndex)
    expect(tabsIndex).toBeLessThan(listIndex)
  })
})
