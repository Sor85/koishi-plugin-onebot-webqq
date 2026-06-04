import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/Capsule.vue', import.meta.url), 'utf8')
const clientState = await readFile(new URL('../client/state.ts', import.meta.url), 'utf8')
const onebotSource = await readFile(new URL('../src/onebot.ts', import.meta.url), 'utf8')
const webqqView = await readFile(new URL('../client/WebQQObserver.vue', import.meta.url), 'utf8')
const style = await readFile(new URL('../client/style.scss', import.meta.url), 'utf8')

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) return ''
  const endIndex = source.indexOf(end, startIndex + start.length)
  return endIndex < 0 ? source.slice(startIndex) : source.slice(startIndex, endIndex)
}

describe('webqq observer view', () => {
  it('opens a read-only WebQQ panel from the capsule avatar', () => {
    expect(capsuleView).toContain('import WebQQObserver from')
    expect(capsuleView).toContain('const webqqOpen = ref(false)')
    expect(capsuleView).toContain('@click="toggleWebQQ"')
    expect(capsuleView).toContain('<WebQQObserver v-if="webqqMounted" v-show="webqqOpen" :visible="webqqOpen" />')
  })

  it('keeps WebQQ mounted after first open to preserve its last state', () => {
    expect(capsuleView).toContain('const webqqMounted = ref(false)')
    expect(capsuleView).toContain('function toggleWebQQ()')
    expect(capsuleView).toContain('if (webqqOpen.value) webqqMounted.value = true')
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
    expect(webqqView).toContain(":class=\"['chat-capsule-webqq', `is-theme-${webQQTheme}`, `is-chat-style-${webQQChatStyle}`]\"")
    expect(webqqView).toContain(':style="webQQAccentStyle"')
    expect(webqqView).not.toContain('class="chat-capsule-webqq__theme"')
    expect(webqqView).not.toContain('aria-label="WebQQ 主题"')
    expect(webqqView).not.toContain('v-model="webQQTheme"')
    expect(webqqView).not.toContain('webQQThemeOptions')
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

  it('persists WebQQ recent message summaries and unread counts in browser storage', () => {
    expect(webqqView).toContain("const webQQStorageKey = 'chat-capsule:webqq:v1'")
    expect(webqqView).toContain('function loadWebQQStoredState()')
    expect(webqqView).toContain('function persistWebQQState()')
    expect(webqqView).toContain('localStorage.getItem(webQQStorageKey)')
    expect(webqqView).toContain('localStorage.setItem(webQQStorageKey')
    expect(webqqView).toContain('conversationSummaries.value = stored.conversationSummaries')
    expect(webqqView).toContain('conversationUnreadCounts.value = stored.conversationUnreadCounts')
    expect(webqqView).toContain('persistWebQQState()')
    expect(webqqView).not.toContain('messages.value = stored')
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
    expect(webqqView).toContain('aria-label="关闭群信息"')
    expect(webqqView).toContain('@click="closeGroupInfo"')
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

  it('shows latest message summary and time in the WebQQ contact list', () => {
    expect(webqqView).toContain('getContactSubtitle')
    expect(webqqView).toContain('getContactTime')
    expect(webqqView).toContain('formatListTime')
    expect(webqqView).toContain('chat-capsule-webqq__contact-time')
  })

  it('shows unread counts for conversations the user is not viewing', () => {
    expect(webqqView).toContain('conversationUnreadCounts')
    expect(webqqView).toContain('class="chat-capsule-webqq__contact-avatar"')
    expect(webqqView).toContain('class="chat-capsule-webqq__contact-unread"')
    expect(webqqView).toContain('getUnreadCount(item.type, item.peerId)')
    expect(webqqView).toContain('getUnreadText')
    expect(webqqView).toContain("payload.message.direction === 'incoming'")
    expect(webqqView).toContain('!trackingMessages.value')
    expect(webqqView).toContain('increaseUnreadCount(payload.type, payload.peerId)')
    expect(webqqView).toContain('clearUnreadCount(currentChat.value.type, currentChat.value.peerId)')
  })

  it('tracks new WebQQ messages only while the message pane is at the bottom', () => {
    expect(webqqView).toContain('ref="messagePane"')
    expect(webqqView).toContain('@scroll="updateMessageTracking"')
    expect(webqqView).toContain('const trackingMessages = ref(true)')
    expect(webqqView).toContain('function updateMessageTracking()')
    expect(webqqView).toContain('function scrollMessagesToBottom()')
    expect(webqqView).toContain('if (trackingMessages.value) scrollMessagesToBottom()')
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
