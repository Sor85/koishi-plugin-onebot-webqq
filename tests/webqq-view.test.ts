import { readFile } from 'node:fs/promises'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { WebQQCapsuleData } from '../client/entry-state'
import type { ConversationSummary, WebQQGroupInfo, WebQQMessage } from '../client/webqq/types'
import { useWebQQContacts } from '../client/webqq/stores/webqq-contacts'
import { useWebQQGroupInfo } from '../client/webqq/stores/webqq-group-info'
import { useWebQQForwardDialog } from '../client/webqq/stores/webqq-forward-dialog'
import { useWebQQMessageHistory } from '../client/webqq/stores/webqq-message-history'
import { useWebQQMessageList } from '../client/webqq/stores/webqq-message-list'
import { useWebQQMessageScroll } from '../client/webqq/stores/webqq-message-scroll'
import { useWebQQNotices } from '../client/webqq/stores/webqq-notices'
import { useWebQQSenderMetadata } from '../client/webqq/stores/webqq-sender-metadata'
import { useWebQQThinkingExpansion } from '../client/webqq/stores/webqq-thinking-expansion'
import { clearConversationUnreadCount, increaseConversationUnreadCount, setConversationSummary } from '../client/webqq/stores/webqq-conversation-state'
import { fitWebQQBubbleToInlineLines } from '../client/webqq/utils/webqq-bubble-width'
import { createBotThinkingMessage, getLastOutgoingClusterUsageMessage, mergeMessages, type WebQQMessageElement } from '../client/webqq/utils/webqq-message-view'
import { applyWebQQRecallToMessages } from '../client/webqq/utils/webqq-recall-view'
import type { WebQQChatSelection } from '../client/webqq/utils/webqq-contact-view'
import { createFriendChatSelection, createGroupChatSelection as createGroupChatSelectionFromContact, createRecentChatSelection, getCurrentChatAvatar, getCurrentChatSubtitle, getCurrentChatTitle } from '../client/webqq/utils/webqq-contact-view'
import { getWebQQAccentStyle, normalizeAccentColor } from '../client/webqq/utils/webqq-theme-view'

vi.mock('@koishijs/client', () => ({
  send: vi.fn(async () => undefined),
}))

const capsuleView = await readFile(new URL('../client/capsule/Capsule.vue', import.meta.url), 'utf8')
const capsuleState = await readFile(new URL('../client/capsule/state.ts', import.meta.url), 'utf8')
const entryState = await readFile(new URL('../client/entry-state.ts', import.meta.url), 'utf8')
const webqqSettings = await readFile(new URL('../client/webqq/settings.ts', import.meta.url), 'utf8')
const webqqTypes = await readFile(new URL('../client/webqq/types.ts', import.meta.url), 'utf8')
const clientIndex = await readFile(new URL('../client/index.ts', import.meta.url), 'utf8')
const clientShell = await readFile(new URL('../client/ClientShell.vue', import.meta.url), 'utf8')
const onebotSource = await readFile(new URL('../src/onebot/index.ts', import.meta.url), 'utf8')
const serverWebqqTypesSource = await readFile(new URL('../src/webqq/types.ts', import.meta.url), 'utf8')
const webqqView = await readFile(new URL('../client/webqq/WebQQObserver.vue', import.meta.url), 'utf8')
const webqqApi = await readFile(new URL('../client/webqq/api/webqq.ts', import.meta.url), 'utf8')
const webqqSidebar = await readFile(new URL('../client/webqq/components/WebQQSidebar.vue', import.meta.url), 'utf8')
const webqqMessageListView = await readFile(new URL('../client/webqq/components/WebQQMessageList.vue', import.meta.url), 'utf8')
const webqqMessageReactionsView = await readFile(new URL('../client/webqq/components/WebQQMessageReactions.vue', import.meta.url), 'utf8')
const webqqContactList = await readFile(new URL('../client/webqq/components/WebQQContactList.vue', import.meta.url), 'utf8')
const webqqForwardModal = await readFile(new URL('../client/webqq/components/WebQQForwardModal.vue', import.meta.url), 'utf8')
const webqqGroupInfoPanel = await readFile(new URL('../client/webqq/components/WebQQGroupInfoPanel.vue', import.meta.url), 'utf8')
const webqqImagePreviewView = await readFile(new URL('../client/webqq/components/WebQQImagePreview.vue', import.meta.url), 'utf8')
const webqqNoticeMenu = await readFile(new URL('../client/webqq/components/WebQQNoticeMenu.vue', import.meta.url), 'utf8')
const webqqMessageCache = await readFile(new URL('../client/webqq/storage/browser-message-cache.ts', import.meta.url), 'utf8').catch(() => '')
const webqqContactsStore = await readFile(new URL('../client/webqq/stores/webqq-contacts.ts', import.meta.url), 'utf8')
const webqqConversationStateStore = await readFile(new URL('../client/webqq/stores/webqq-conversation-state.ts', import.meta.url), 'utf8')
const webqqForwardDialogStore = await readFile(new URL('../client/webqq/stores/webqq-forward-dialog.ts', import.meta.url), 'utf8')
const webqqGroupInfoStore = await readFile(new URL('../client/webqq/stores/webqq-group-info.ts', import.meta.url), 'utf8')
const webqqLiveMessagesStore = await readFile(new URL('../client/webqq/stores/webqq-live-messages.ts', import.meta.url), 'utf8')
const webqqMessageHistoryStore = await readFile(new URL('../client/webqq/stores/webqq-message-history.ts', import.meta.url), 'utf8')
const webqqMessageListStore = await readFile(new URL('../client/webqq/stores/webqq-message-list.ts', import.meta.url), 'utf8')
const webqqMessageScroll = await readFile(new URL('../client/webqq/stores/webqq-message-scroll.ts', import.meta.url), 'utf8')
const webqqNoticesStore = await readFile(new URL('../client/webqq/stores/webqq-notices.ts', import.meta.url), 'utf8')
const webqqSenderMetadataStore = await readFile(new URL('../client/webqq/stores/webqq-sender-metadata.ts', import.meta.url), 'utf8')
const webqqThinkingExpansionStore = await readFile(new URL('../client/webqq/stores/webqq-thinking-expansion.ts', import.meta.url), 'utf8')
const webqqStorage = await readFile(new URL('../client/webqq/storage/webqq-storage.ts', import.meta.url), 'utf8')
const webqqBubbleWidth = await readFile(new URL('../client/webqq/utils/webqq-bubble-width.ts', import.meta.url), 'utf8').catch(() => '')
const webqqScrollbarDirective = await readFile(new URL('../client/webqq/utils/webqq-scrollbar.ts', import.meta.url), 'utf8').catch(() => '')
const webqqMessageView = await readFile(new URL('../client/webqq/utils/webqq-message-view.ts', import.meta.url), 'utf8')
const webqqNoticeView = await readFile(new URL('../client/webqq/utils/webqq-notice-view.ts', import.meta.url), 'utf8')
const webqqContactView = await readFile(new URL('../client/webqq/utils/webqq-contact-view.ts', import.meta.url), 'utf8')
const webqqThemeView = await readFile(new URL('../client/webqq/utils/webqq-theme-view.ts', import.meta.url), 'utf8')
const styleEntry = await readFile(new URL('../client/style.scss', import.meta.url), 'utf8')
const webqqMessagesStyle = await readFile(new URL('../client/webqq/styles/webqq-messages.scss', import.meta.url), 'utf8')
const webqqMessageCardsStyle = await readFile(new URL('../client/webqq/styles/webqq-message-cards.scss', import.meta.url), 'utf8')
const webqqMessageOverlaysStyle = await readFile(new URL('../client/webqq/styles/webqq-message-overlays.scss', import.meta.url), 'utf8')
const webqqMessageEffectsStyle = await readFile(new URL('../client/webqq/styles/webqq-message-effects.scss', import.meta.url), 'utf8')
const style = `${webqqMessagesStyle}\n${webqqMessageCardsStyle}\n${webqqMessageOverlaysStyle}\n${webqqMessageEffectsStyle}\n${styleEntry}`

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) return ''
  const endIndex = source.indexOf(end, startIndex + start.length)
  return endIndex < 0 ? source.slice(startIndex) : source.slice(startIndex, endIndex)
}

function runGetUnreadText(count: number) {
  const returnExpression = webqqMessageView.match(/function getUnreadText\(count: number\)[\s\S]*?return\s+([^\n]+)/)?.[1]
  if (!returnExpression) throw new Error('getUnreadText return expression not found')
  return Function('count', `return ${returnExpression}`)(count)
}

function createCapsuleData(conversation: Partial<WebQQCapsuleData['conversation']> = {}): WebQQCapsuleData {
  return {
    bot: {
      platform: 'onebot',
      selfId: '10000',
      name: 'Bot',
    },
    conversation: {
      channelId: '20000',
      channelName: '群聊',
      userId: '30000',
      userName: 'Alice',
      activityText: '正在思考',
      timestamp: 1710000000000,
      ...conversation,
    },
    counters: {
      received: 1,
      sent: 2,
    },
  }
}

type WebQQGroupChatSelection = Extract<WebQQChatSelection, { type: 'group' }>

function createGroupChatSelection(chat: Partial<WebQQGroupChatSelection> = {}): WebQQGroupChatSelection {
  return {
    type: 'group',
    peerId: '20000',
    name: '群聊',
    subtitle: '群聊 20000 · 2 人',
    avatar: '',
    ...chat,
  }
}

function createWebQQMessage(message: Partial<WebQQMessage> = {}): WebQQMessage {
  return {
    id: 'message-1',
    sequence: 'message-1',
    time: 1710000000000,
    senderId: '10000',
    senderName: 'Bot',
    senderAvatar: '',
    direction: 'outgoing',
    summary: 'hello',
    elements: [{ type: 'text', text: 'hello' }],
    ...message,
  }
}

describe('webqq observer view', () => {
  it('opens a read-only WebQQ panel from the capsule avatar', () => {
    expect(clientShell).toContain("import WebQQObserver from './webqq/WebQQObserver.vue'")
    expect(clientShell).toContain("import { webQQOpen } from './entry-state'")
    expect(capsuleView).toContain('@click="toggleWebQQ"')
    expect(clientShell).toContain('<WebQQObserver v-show="webQQOpen" :visible="webQQOpen" />')
  })

  it('keeps WebQQ mounted while hidden so unread counts can update the capsule', () => {
    expect(clientShell).toContain('<WebQQObserver v-show="webQQOpen" :visible="webQQOpen" />')
    expect(clientShell).not.toContain('v-if="webqqMounted"')
    expect(clientShell).not.toContain('const webqqMounted')
  })

  it('uses the configured WebQQ frosted glass option without rendering an in-panel theme selector', () => {
    expect(webqqView).toContain("from './settings'")
    expect(webqqContactView).toContain('sortWebQQGroupMembers')
    expect(webqqSettings).toContain('export const enableWebQQFrostedGlass = ref(true)')
    expect(clientIndex).toContain('enableWebQQFrostedGlass')
    expect(clientIndex).toMatch(/enableWebQQFrostedGlass\?:\s*boolean/)
    expect(clientIndex).toContain('enableWebQQFrostedGlass.value = value?.enableWebQQFrostedGlass ?? true')
    expect(webqqView).toContain('webQQAccentColor')
    expect(webqqView).toContain('webQQChatStyle')
    expect(webqqView).toContain('webQQTimBubbleTail')
    expect(webqqView).toContain('enableWebQQFrostedGlass')
    expect(webqqView).toContain('hideWebQQGroupLevel')
    expect(webqqView).toContain('showWebQQAffinity')
    expect(webqqView).toContain('showWebQQRelationship')
    expect(webqqView).toContain('showWebQQThinkingTokens')
    expect(webqqView).toContain('showWebQQThinkingTiming')
    expect(webqqView).toContain('allowWebQQResize')
    expect(webqqView).toContain("['onebot-webqq-webqq'")
    expect(webqqView).toContain("enableWebQQFrostedGlass ? 'is-frosted' : 'is-plain'")
    expect(webqqView).toContain('`is-chat-style-${webQQChatStyle}`')
    expect(webqqView).toContain("'has-tim-bubble-tail': webQQTimBubbleTail")
    expect(webqqView).toContain("'is-resizable': allowWebQQResize")
    expect(webqqView).toContain('`is-color-${webQQColorMode}`')
    expect(webqqView).toContain(':style="webQQAccentStyle"')
    expect(webqqView).not.toContain('class="onebot-webqq-webqq__theme"')
    expect(webqqView).not.toContain('aria-label="WebQQ 主题"')
    expect(webqqView).not.toContain('v-model="webQQTheme"')
    expect(webqqView).not.toContain('webQQThemeOptions')
    expect(webqqView).not.toContain('`is-theme-${webQQTheme}`')
  })

  it('uses the configured WebQQ color mode without rendering an in-panel switcher', () => {
    expect(webqqSettings).toContain("export type WebQQColorMode = 'auto' | 'light' | 'dark'")
    expect(webqqSettings).toContain("export const webQQColorMode = ref<WebQQColorMode>('auto')")
    expect(clientIndex).toContain('webQQColorMode')
    expect(clientIndex).toContain('type WebQQColorMode')
    expect(clientIndex).toMatch(/webQQColorMode\?:\s*WebQQColorMode/)
    expect(clientIndex).toMatch(/webQQColorMode\.value\s*=\s*value\?\.webQQColorMode\s*(?:\?\?|\|\|)\s*'auto'/)
    expect(webqqView).toContain('webQQColorMode')
    expect(webqqView).toContain('`is-color-${webQQColorMode}`')
    expect(webqqView).not.toContain('v-model="webQQColorMode"')
    expect(webqqView).not.toContain('webQQColorModeOptions')
    expect(webqqView).not.toContain('aria-label="WebQQ 颜色模式"')
  })

  it('keeps compact capsule shadow enabled by default from console entry data', () => {
    expect(webqqSettings).toContain('export const enableCapsuleFrostedGlass = ref(true)')
    expect(clientIndex).toContain('enableCapsuleFrostedGlass')
    expect(clientIndex).toMatch(/enableCapsuleFrostedGlass\?:\s*boolean/)
    expect(clientIndex).toContain('enableCapsuleFrostedGlass.value = value?.enableCapsuleFrostedGlass ?? true')
    expect(capsuleView).toContain("enableCapsuleFrostedGlass ? 'is-frosted' : 'is-plain'")
    expect(webqqSettings).toContain('export const useCompactCapsuleShadow = ref(true)')
    expect(clientIndex).toContain('useCompactCapsuleShadow')
    expect(clientIndex).toMatch(/useCompactCapsuleShadow\?:\s*boolean/)
    expect(clientIndex).toContain('useCompactCapsuleShadow.value = value?.useCompactCapsuleShadow ?? true')
    expect(capsuleView).toContain("'is-capsule-shadow-wide': !useCompactCapsuleShadow")
  })

  it('uses the configured WebQQ accent color for CSS variables', () => {
    expect(webqqView).toContain('webQQAccentColor.value')
    expect(webqqThemeView).toContain('function normalizeAccentColor(color: string)')
    expect(webqqView).toContain('const webQQAccentStyle = computed')
    expect(webqqView).toContain('getWebQQAccentStyle(webQQAccentColor.value)')
    expect(webqqThemeView).toContain("'--onebot-webqq-webqq-accent': accentColor")
    expect(webqqThemeView).toContain("'--onebot-webqq-webqq-accent-soft': hexToRgba(accentColor, 0.14)")
  })

  it('allows optional browser-local WebQQ shell resizing from invisible top and left edges', () => {
    expect(webqqSettings).toContain('export const allowWebQQResize = ref(false)')
    expect(clientIndex).toContain('allowWebQQResize')
    expect(clientIndex).toMatch(/allowWebQQResize\?:\s*boolean/)
    expect(clientIndex).toContain('allowWebQQResize.value = value?.allowWebQQResize ?? false')
    expect(webqqView).toContain('const webQQResizeStorageKey = \'onebot-webqq:webqq:resize:v1\'')
    expect(webqqView).toContain('const webQQResizeMinWidth = 640')
    expect(webqqView).toContain('const webQQResizeMinHeight = 420')
    expect(webqqView).toContain('const webQQResizeViewportHeightGap = 6')
    expect(webqqView).toContain('const webQQResizeDefaultBottomGap = 116')
    expect(webqqView).toContain('const bottomGap = webQQRoot.value ? Math.max(0, window.innerHeight - webQQRoot.value.getBoundingClientRect().bottom) : webQQResizeDefaultBottomGap')
    expect(webqqView).toContain('const maxHeight = Math.max(0, window.innerHeight - bottomGap - webQQResizeViewportHeightGap)')
    expect(webqqView).toContain('localStorage.getItem(webQQResizeStorageKey)')
    expect(webqqView).toContain('localStorage.setItem(webQQResizeStorageKey, JSON.stringify(size))')
    expect(webqqView).toContain('startWebQQResize(\'left\', $event)')
    expect(webqqView).toContain('startWebQQResize(\'top\', $event)')
    expect(webqqView).toContain('startWebQQResize(\'top-left\', $event)')
    expect(webqqView).not.toContain('onebot-webqq-webqq__resize-icon')
  })

  it('formats WebQQ accent colors for CSS variables', () => {
    expect(normalizeAccentColor('#123abc')).toBe('#123abc')
    expect(normalizeAccentColor('123abc')).toBe('#2563eb')
    expect(getWebQQAccentStyle('#336699')).toEqual({
      '--onebot-webqq-webqq-accent': '#336699',
      '--onebot-webqq-webqq-accent-soft': 'rgba(51, 102, 153, 0.14)',
      '--onebot-webqq-webqq-accent-hover': 'rgba(51, 102, 153, 0.18)',
      '--onebot-webqq-webqq-accent-shadow': 'rgba(51, 102, 153, 0.24)',
    })
  })

  it('passes panel visibility to the WebQQ observer', () => {
    expect(clientShell).toContain(':visible="webQQOpen"')
    expect(webqqView).toContain('defineProps<{ visible: boolean }>()')
    expect(webqqView).toContain('isVisible: () => props.visible')
    expect(webqqLiveMessagesStore).toContain('!options.isVisible()')
    expect(webqqView).toContain('watch(() => props.visible')
  })

  it('closes WebQQ when clicking outside the capsule host', () => {
    expect(capsuleView).toContain('ref="capsuleHost"')
    expect(capsuleView).toContain('function closeWebQQOnOutsideClick')
    expect(capsuleView).toContain("document.addEventListener('pointerdown', closeWebQQOnOutsideClick)")
    expect(capsuleView).toContain("document.removeEventListener('pointerdown', closeWebQQOnOutsideClick)")
  })

  it('renders contacts, groups, message history, and gated send input', () => {
    expect(webqqApi).toContain("send('onebot-webqq/webqq/contacts')")
    expect(webqqApi).toContain("send('onebot-webqq/webqq/messages'")
    expect(webqqApi).toContain("send('onebot-webqq/webqq/send'")
    expect(webqqView).toContain("from './stores/webqq-live-messages'")
    expect(webqqView).not.toContain("receive('onebot-webqq/webqq/message'")
    expect(webqqLiveMessagesStore).toContain("receive('onebot-webqq/webqq/message'")
    expect(webqqLiveMessagesStore).toContain('function useWebQQLiveMessages')
    expect(webqqView).toContain('<WebQQSidebar')
    expect(webqqSidebar).toContain("emit('select-tab', 'friends')")
    expect(webqqSidebar).toContain("emit('select-tab', 'groups')")
    expect(webqqSidebar.match(/class="onebot-webqq-webqq__tab-icon"/g)).toHaveLength(3)
    expect(webqqSidebar).not.toContain('is-clock')
    expect(webqqSidebar).not.toContain('is-user')
    expect(webqqSidebar).not.toContain('is-group')
    expect(webqqMessageListView).toMatch(/v-for="\(message, index\) in (messages|visibleMessages)"/)
    expect(webqqSettings).toContain('export const enableWebQQSend = ref(false)')
    expect(webqqView).toContain('v-if="enableWebQQSend && currentChat"')
    expect(webqqView).toContain('@keydown.enter.exact.prevent="sendCurrentWebQQMessage"')
    expect(webqqView).toContain('@paste="handleSendPaste"')
    expect(webqqView).toContain('Binary.toBase64(await file.arrayBuffer())')
    expect(webqqView).toContain('onebot-webqq-webqq__send-file-icon')
    expect(webqqView).toContain('onebot-webqq-webqq__send-file-base')
    expect(webqqView).toContain('function getSendFileNameParts(name: string)')
    expect(webqqView).toContain('URL.createObjectURL(file)')
    expect(webqqView).toContain('ref="sendAttachments"')
    expect(webqqView).toContain('const attachmentHeight = attachments ? Math.ceil(attachments.getBoundingClientRect().height) : 0')
    expect(webqqView).toContain('openLocalImagePreview(file.previewUrl)')
    expect(webqqView).toContain('class="onebot-webqq-webqq__send-image-remove"')
    expect(webqqView).toContain('URL.revokeObjectURL(file.previewUrl)')
    expect(webqqView).toContain("const capsuleProfileStorageKey = 'onebot-webqq:bot-profile:v1'")
    expect(webqqView).toContain('cachedCapsuleBotAvatar.value')
    expect(webqqView).not.toContain('只读模式')
    expect(webqqView).not.toContain('onebot-webqq-webqq__readonly-bar')
  })

  it('cleans WebQQ live listeners and singleton client state on unmount or plugin dispose', () => {
    expect(webqqView).toContain('onBeforeUnmount')
    expect(webqqView).toContain('const disposeWebQQLiveMessages = useWebQQLiveMessages')
    expect(webqqView).toContain('disposeWebQQLiveMessages()')
    expect(webqqView).toContain('stopWebQQResize()')
    expect(webqqView).toContain("window.removeEventListener('resize', clampCurrentWebQQShellSize)")
    expect(entryState).toContain('export function resetWebQQClientState()')
    expect(clientIndex).toContain('resetWebQQClientState()')
    expect(clientIndex).toContain("receive('onebot-webqq/update', () => {})")
  })

  it('renders a transient outgoing bot thinking message after the real WebQQ messages', () => {
    expect(webqqView).toContain("from './stores/webqq-message-list'")
    expect(webqqMessageListStore).toContain('const visibleMessages = computed')
    expect(webqqMessageListStore).toContain('const cachedMessages = messages.value.map(options.applyMessageSenderMetadata)')
    expect(webqqMessageListStore).toContain('return botThinkingMessage.value ? [...cachedMessages, options.applyMessageSenderMetadata(botThinkingMessage.value)] : cachedMessages')
    expect(webqqMessageListView).toContain('v-for="(message, index) in visibleMessages"')
    expect(webqqMessageListView).toContain("'is-thinking': isBotThinkingMessage(message)")
    expect(webqqMessageListStore).toContain('function isBotThinkingMessage(message: WebQQMessage)')
    expect(webqqMessageListView).not.toContain('onebot-webqq-webqq__thinking-bubble')
    expect(style).not.toContain('onebot-webqq-webqq__thinking-bubble')
    const messageBodySource = sourceBetween(
      webqqMessageListView,
      'class="onebot-webqq-webqq__message-body"',
      'class="onebot-webqq-webqq__message-time"',
    )
    expect(messageBodySource.indexOf('class="onebot-webqq-webqq__thinking-dots"')).toBeGreaterThan(messageBodySource.indexOf('class="onebot-webqq-webqq__bubble"'))
  })

  it('uses three animated floating dots as the temporary bot thinking content', () => {
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__thinking-dots"')
    expect(webqqMessageListView).toContain('v-for="dot in 3"')
    expect(webqqMessageListView).toContain(':key="dot"')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__thinking-dot"')
    expect(style).toContain('@keyframes onebot-webqq-webqq-thinking-dot')
  })

  it('keeps temporary bot thinking bubbles scoped to WebQQ conversations', () => {
    const webqqSources = [
      webqqView,
      webqqMessageListStore,
      webqqMessageView,
    ].join('\n')
    expect(webqqSources).not.toContain("from '../capsule")
    expect(webqqSources).not.toContain("from '../../capsule")
    expect(webqqView).toContain("import { webQQCapsule as capsule } from '../entry-state'")
    expect(entryState).toContain('export const webQQCapsule = capsule')
    expect(entryState).toContain('export type WebQQCapsuleData = CapsuleData')
    expect(webqqMessageListStore).toContain('const botThinkingMessages = ref<Record<string, WebQQMessage>>({})')
    expect(webqqMessageListStore).toContain('function syncBotThinkingMessage()')
    expect(webqqMessageListStore).toContain('createBotThinkingMessage(options.capsule.value, options.currentChat.value, messages.value)')
    expect(webqqMessageListStore).toContain('getCapsuleChatKeyForCurrentChat() === key')
    expect(webqqMessageView).toContain('const conversation = capsule?.conversation')
    expect(webqqMessageView).toContain("conversation.activityText !== '正在思考'")
    expect(webqqMessageView).toContain('conversation.channelId')
    expect(webqqMessageView).toContain('conversation.userId')
    expect(webqqMessageView).toContain('conversation.userName')
    expect(webqqMessageView).toContain('currentChat.type')
    expect(webqqMessageView).toContain('currentChat.peerId')
  })

  it('hides the temporary bot thinking bubble after a real outgoing WebQQ message reaches the same conversation', () => {
    expect(webqqMessageView).toContain('function hasOutgoingMessageAfter(messages: WebQQMessage[], timestamp: number)')
    expect(webqqMessageView).toContain("messages.some((message) => message.direction === 'outgoing' && message.time >= timestamp)")
    expect(webqqMessageView).toContain('if (hasOutgoingMessageAfter(messages, conversation.timestamp)) return')
  })

  it('lets capsule conversation data carry group sender metadata', () => {
    const capsuleConversationSource = sourceBetween(
      capsuleState,
      'conversation: {',
      '  counters: {',
    )

    expect(capsuleConversationSource).toContain('senderRole?: string')
    expect(capsuleConversationSource).toContain('senderLevel?: string')
    expect(capsuleConversationSource).toContain('senderTitle?: string')
  })

  it('lets WebQQ messages carry ChatLuna affinity badges', () => {
    expect(webqqTypes).toContain('senderAffinity?: number')
    expect(webqqTypes).toContain('senderRelationship?: string')
    expect(serverWebqqTypesSource).toContain('senderAffinity?: number')
    expect(serverWebqqTypesSource).toContain('senderRelationship?: string')
  })

  it('uses capsule conversation group sender metadata on the temporary bot thinking message', () => {
    const thinkingMessageSource = sourceBetween(
      webqqMessageView,
      'function createBotThinkingMessage',
      'export function formatThinkingDuration',
    )

    expect(thinkingMessageSource).toContain("direction: 'outgoing'")
    expect(thinkingMessageSource).toMatch(/senderRole:\s*conversation\.senderRole/)
    expect(thinkingMessageSource).toMatch(/senderLevel:\s*conversation\.senderLevel/)
    expect(thinkingMessageSource).toMatch(/senderTitle:\s*conversation\.senderTitle/)
    expect(webqqMessageListView).toContain("v-if=\"message.direction === 'outgoing'\"")
    expect(webqqMessageListView).toContain('getSenderAuthorityText(message)')
    expect(webqqMessageListView).toContain('message.senderLevel && !hideWebQQGroupLevel')
  })

  it('creates a temporary bot thinking message only for the active WebQQ conversation', () => {
    const message = createBotThinkingMessage(createCapsuleData({
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '头衔',
    }), createGroupChatSelection(), [])

    expect(message).toMatchObject({
      id: 'thinking:group:20000:1710000000000',
      sequence: 'thinking:1710000000000',
      time: 1710000000000,
      senderId: '10000',
      senderName: 'Bot',
      senderAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=10000&s=640',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '头衔',
      direction: 'outgoing',
      summary: '正在回复 Alice',
      elements: [{ type: 'unknown', text: '正在思考' }],
    })
    expect(createBotThinkingMessage(createCapsuleData(), createGroupChatSelection({ peerId: 'other' }), [])).toBeUndefined()
    expect(createBotThinkingMessage(createCapsuleData({ activityText: '空闲' }), createGroupChatSelection(), [])).toBeUndefined()
    expect(createBotThinkingMessage(createCapsuleData(), createGroupChatSelection(), [
      createWebQQMessage({ time: 1710000000000 }),
    ])).toBeUndefined()
  })

  it('hydrates missing live WebQQ sender metadata from cached messages in the same conversation', () => {
    const visibleMessagesSource = sourceBetween(
      webqqMessageListStore,
      'const visibleMessages = computed(() => {',
      'function isBotThinkingMessage',
    )
    const receiveSource = sourceBetween(
      webqqLiveMessagesStore,
      "receive('onebot-webqq/webqq/message'",
      '})',
    )

    expect(webqqView).toContain('useWebQQSenderMetadata(currentChat)')
    expect(webqqSenderMetadataStore).toContain('applyCachedWebQQSenderMetadata')
    expect(webqqSenderMetadataStore).toContain('rememberWebQQSenderMetadata')
    expect(webqqSenderMetadataStore).toContain('const senderMetadataCache = ref')
    expect(webqqSenderMetadataStore).toContain('function rememberMessageSenderMetadata')
    expect(webqqSenderMetadataStore).toContain('function applyMessageSenderMetadata')
    expect(visibleMessagesSource).toContain('messages.value.map(options.applyMessageSenderMetadata)')
    expect(webqqMessageHistoryStore).toContain('options.rememberMessageSenderMetadata(currentChat.type, currentChat.peerId, options.messages.value)')
    expect(receiveSource).toContain('rememberMessageSenderMetadata(payload.type, payload.peerId, [payload.message])')
  })

  it('keeps sender metadata cache state in a small composable', () => {
    const currentChat = ref<WebQQChatSelection | undefined>(createGroupChatSelection())
    const metadata = useWebQQSenderMetadata(currentChat)
    metadata.rememberMessageSenderMetadata('group', '20000', [createWebQQMessage({
      senderId: '30000',
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '头衔',
    })])

    expect(metadata.applyMessageSenderMetadata(createWebQQMessage({
      id: 'live-1',
      senderId: '30000',
    }))).toMatchObject({
      senderRole: '管理员',
      senderLevel: '100',
      senderTitle: '头衔',
    })

    currentChat.value = undefined
    const message = createWebQQMessage({ id: 'live-2', senderId: '30000' })
    expect(metadata.applyMessageSenderMetadata(message)).toBe(message)
  })

  it('uses backend recent contacts instead of the first contacts in each list', () => {
    expect(webqqView).toContain('useWebQQContacts(conversationSummaries)')
    expect(webqqContactsStore).toContain('getRecentItems(contacts.value, conversationSummaries.value)')
    expect(webqqContactView).toContain('contacts.recent')
    expect(webqqContactsStore).toContain('conversationSummaries.value')
    expect(webqqView).not.toContain('contacts.value.friends.slice(0, 4)')
    expect(webqqView).not.toContain('contacts.value.groups.slice(0, 4)')
  })

  it('creates current WebQQ chat selections from contacts and recent items', () => {
    expect(webqqView).toContain('selectWebQQFriend(friend)')
    expect(webqqView).toContain('selectWebQQGroup(group)')
    expect(webqqView).toContain('selectWebQQRecent(item)')
    expect(webqqContactsStore).toContain('createFriendChatSelection(friend)')
    expect(webqqContactsStore).toContain('createGroupChatSelection(group)')
    expect(webqqContactsStore).toContain('createRecentChatSelection(item)')
    expect(webqqContactView).toContain('function createFriendChatSelection')
    expect(webqqContactView).toContain('function createGroupChatSelection')
    expect(webqqContactView).toContain('function createRecentChatSelection')
    expect(createFriendChatSelection({
      userId: '10000',
      name: 'Alice',
      nickname: 'alice',
      avatar: 'friend.png',
    })).toEqual({
      type: 'friend',
      peerId: '10000',
      name: 'Alice',
      subtitle: 'alice',
      avatar: 'friend.png',
    })
    expect(createGroupChatSelectionFromContact({
      groupId: '20000',
      name: '群聊',
      memberCount: 42,
      avatar: 'group.png',
    })).toEqual({
      type: 'group',
      peerId: '20000',
      name: '群聊',
      subtitle: '群聊 20000 · 42 人',
      avatar: 'group.png',
    })
    expect(createRecentChatSelection({
      type: 'friend',
      peerId: '10000',
      name: 'Alice',
      subtitle: 'recent',
      avatar: 'friend.png',
      summary: '最近消息',
      time: 1,
    })).toEqual({
      type: 'friend',
      peerId: '10000',
      name: 'Alice',
      subtitle: 'recent',
      avatar: 'friend.png',
    })
  })

  it('formats the current WebQQ chat header from contact data', () => {
    expect(webqqContactsStore).toContain('getCurrentChatTitle(currentChat.value)')
    expect(webqqContactsStore).toContain('getCurrentChatSubtitle(currentChat.value, contacts.value)')
    expect(webqqContactsStore).toContain('getCurrentChatAvatar(currentChat.value)')
    expect(webqqContactView).toContain('function getCurrentChatTitle')
    expect(webqqContactView).toContain('function getCurrentChatSubtitle')
    expect(webqqContactView).toContain('function getCurrentChatAvatar')
    expect(getCurrentChatTitle(undefined)).toBe('WebQQ')
    expect(getCurrentChatSubtitle(undefined, { friends: [], groups: [] })).toBe('好友 / 群聊')
    expect(getCurrentChatAvatar(undefined)).toBe('')
    expect(getCurrentChatSubtitle(createGroupChatSelection({ subtitle: '旧群信息' }), {
      friends: [],
      groups: [{
        groupId: '20000',
        name: '群聊',
        memberCount: 42,
        avatar: '',
      }],
    })).toBe('群聊 20000 · 42 人')
  })

  it('keeps WebQQ contact selection and header state in a focused store', () => {
    const conversationSummaries = ref<Record<string, ConversationSummary>>({
      'friend:10000': { summary: '最近消息', time: 2 },
    })
    const store = useWebQQContacts(conversationSummaries)

    store.contacts.value = {
      friends: [{ userId: '10000', name: 'Alice', nickname: 'alice', avatar: 'friend.png' }],
      groups: [{ groupId: '20000', name: '群聊', memberCount: 42, avatar: 'group.png' }],
    }
    expect(store.recentItems.value[0]).toMatchObject({
      type: 'friend',
      peerId: '10000',
      summary: '最近消息',
    })

    store.searchQuery.value = 'alice'
    expect(store.visibleFriends.value).toHaveLength(1)
    expect(store.visibleGroups.value).toHaveLength(0)

    store.selectFriend(store.contacts.value.friends[0])
    expect(store.currentTitle.value).toBe('Alice')
    expect(store.currentSubtitle.value).toBe('alice')
    expect(store.currentAvatar.value).toBe('friend.png')
    store.selectTab('groups')
    expect(store.activeTab.value).toBe('groups')
    store.selectGroup(store.contacts.value.groups[0])
    expect(store.currentPeerId.value).toBe('20000')
    expect(store.currentSubtitle.value).toBe('群聊 20000 · 42 人')
  })

  it('retries WebQQ contacts while Koishi and OneBot are still starting', () => {
    expect(webqqView).toContain('requestWebQQContactsWithRetry(requestWebQQContacts)')
    expect(webqqApi).toContain('const webQQContactsRetryLimit = 10')
    expect(webqqApi).toContain('function waitWebQQContactsRetry()')
    expect(webqqApi).toContain('for (let attempt = 1; ; attempt++)')
    expect(webqqApi).toContain('if (attempt >= webQQContactsRetryLimit) throw error')
    expect(webqqApi).toContain('await waitWebQQContactsRetry()')
    expect(webqqApi).toContain('export async function requestWebQQContactsWithRetry')
  })

  it('persists WebQQ recent message summaries and unread counts in browser storage by default', () => {
    expect(webqqStorage).toContain("const webQQStorageKey = 'onebot-webqq:webqq:v1'")
    expect(webqqStorage).toContain('function loadBrowserWebQQStoredState')
    expect(webqqConversationStateStore).toContain('function persistWebQQState()')
    expect(webqqStorage).toContain("if (storageBackend !== 'browser') return empty")
    expect(webqqStorage).toContain('function getScopedStorageKey(key: string, scopeId?: string)')
    expect(webqqStorage).toContain('localStorage.getItem(getScopedStorageKey(webQQStorageKey, scopeId))')
    expect(webqqStorage).toContain('localStorage.setItem(getScopedStorageKey(webQQStorageKey, scopeId)')
    expect(webqqConversationStateStore).toContain('conversationSummaries.value = stored.conversationSummaries')
    expect(webqqConversationStateStore).toContain('conversationUnreadCounts.value = stored.conversationUnreadCounts')
    expect(webqqConversationStateStore).toContain('persistWebQQState()')
    expect(webqqView).not.toContain('messages.value = stored')
  })

  it('loads and saves WebQQ state through Koishi storage listeners for the koishi backend', () => {
    expect(webqqView).toContain('webQQStorageBackend')
    expect(webqqView).toContain('useWebQQConversationState(webQQStorageBackend, webQQStorageScope)')
    expect(webqqConversationStateStore).toContain('function createWebQQStoredState()')
    expect(webqqConversationStateStore).toContain('async function loadRemoteWebQQStoredState()')
    expect(webqqStorage).toContain("if (storageBackend === 'browser') return")
    expect(webqqStorage).toContain("send('onebot-webqq/webqq/storage/load')")
    expect(webqqConversationStateStore).toContain('applyWebQQStoredState(stored)')
    expect(webqqStorage).toContain("send('onebot-webqq/webqq/storage/save', state)")
    expect(webqqConversationStateStore).toContain('persistWebQQStoredState(storageBackend.value, createWebQQStoredState(), storageScope.value)')
    expect(webqqView).toContain('loadRemoteWebQQStoredState()')
  })

  it('caches full WebQQ messages in IndexedDB for the browser backend', () => {
    expect(webqqStorage).toContain('loadBrowserWebQQMessages')
    expect(webqqStorage).toContain('saveBrowserWebQQMessages')
    expect(webqqMessageCache).not.toContain('const webQQMessageCacheLimit = 100')
    expect(webqqMessageCache).toContain("indexedDB.open('onebot-webqq-webqq'")
    expect(webqqMessageCache).toContain("database.createObjectStore('messages', { keyPath: 'id' })")
    expect(webqqMessageCache).toContain('saveBrowserWebQQMessages(type: string, peerId: string, messages: WebQQMessage[], limit: number, scopeId?: string)')
    expect(webqqMessageCache).toContain('messages.slice(-limit)')
  })

  it('uses Koishi DB message cache listeners for the koishi backend', () => {
    expect(webqqStorage).toContain('async function loadCachedWebQQMessages')
    expect(webqqStorage).toContain('async function saveCachedWebQQMessages')
    expect(webqqStorage).toContain("if (storageBackend === 'koishi')")
    expect(webqqStorage).toContain("send('onebot-webqq/webqq/messages/cache/load'")
    expect(webqqStorage).toContain("send('onebot-webqq/webqq/messages/cache/save'")
    expect(webqqStorage).toContain('loadBrowserWebQQMessages(type, peerId, scopeId)')
    expect(webqqStorage).toContain('const cachedMessages = messages.slice(-messageCacheLimit)')
    expect(webqqStorage).toContain('saveBrowserWebQQMessages(type, peerId, cachedMessages, messageCacheLimit, scopeId)')
    expect(webqqView).toContain("import { loadCachedWebQQMessages as loadStoredWebQQMessages, saveCachedWebQQMessages as saveStoredWebQQMessages } from './storage/webqq-storage'")
    expect(webqqView).toContain("async function loadCachedWebQQMessages(type: 'friend' | 'group', peerId: string)")
    expect(webqqView).toContain('return loadStoredWebQQMessages(type, peerId, webQQStorageBackend.value, webQQStorageScope.value)')
    expect(webqqView).toContain('await saveStoredWebQQMessages(type, peerId, messages, webQQStorageBackend.value, webQQMessageCacheLimit.value, webQQStorageScope.value)')
  })

  it('preserves completed thinking metadata when cached messages merge with plain history', () => {
    expect(webqqMessageView).toContain('function mergeWebQQMessage')
    expect(webqqMessageView).toContain('merged.thinking = next.thinking || current.thinking')
    expect(webqqMessageHistoryStore).toContain('options.messages.value = limitMessages(mergeMessages(options.messages.value, remoteMessages))')
    expect(webqqMessageHistoryStore).toContain('options.saveCachedMessages')
    expect(mergeMessages([createWebQQMessage({
      usage: {
        inputTokens: 12,
        outputTokens: 34,
      },
    })], [createWebQQMessage({
      thinking: {
        content: '先分析',
        durationMs: 1200,
        usage: {
          inputTokens: 12,
          outputTokens: 34,
        },
      },
    })])[0]).not.toHaveProperty('usage')
  })

  it('preserves recalled message content when reaction-only updates merge into cached messages', () => {
    const recalledMessage = createWebQQMessage({
      id: 'message-1',
      sequence: '31318',
      summary: 'hello',
      elements: [{ type: 'text', text: 'hello' }],
      recalled: true,
    })
    const reactionOnlyUpdate = createWebQQMessage({
      id: 'message-1',
      sequence: '31318',
      summary: '',
      elements: [],
      reactions: [{
        emojiId: '76',
        label: '赞',
        count: 1,
      }],
    })

    expect(mergeMessages([recalledMessage], [reactionOnlyUpdate])).toEqual([
      expect.objectContaining({
        id: 'message-1',
        summary: 'hello',
        elements: [{ type: 'text', text: 'hello' }],
        recalled: true,
        reactions: [{
          emojiId: '76',
          label: '赞',
          count: 1,
        }],
      }),
    ])
  })

  it('renders WebQQ friends under backend categories', () => {
    expect(webqqView).toContain('<WebQQSidebar')
    expect(webqqSidebar).toContain('<WebQQContactList')
    expect(webqqView).toContain(':visible-friend-categories="visibleFriendCategories"')
    expect(webqqContactList).toContain('v-for="category in visibleFriendCategories"')
    expect(webqqContactList).toContain('class="onebot-webqq-webqq__friend-category"')
    expect(webqqContactList).toContain('class="onebot-webqq-webqq__friend-category-title"')
    expect(webqqContactList).toContain('v-for="friend in category.friends"')
  })

  it('opens a WebQQ notification dropdown menu from the bell button', () => {
    expect(webqqView).toContain('@open-notices="openNotices"')
    expect(webqqView).toContain('@click="closeNoticeMenu"')
    expect(webqqSidebar).toContain('class="onebot-webqq-webqq__notify-wrap" @click.stop')
    expect(webqqSidebar).toContain('class="onebot-webqq-webqq__notify-icon"')
    expect(webqqSidebar).toContain('viewBox="0 0 24 24"')
    expect(webqqSidebar).not.toContain('is-bell')
    expect(webqqSidebar).toContain('<WebQQNoticeMenu')
    expect(webqqSidebar).toContain('v-model:tab="noticeMenuTabModel"')
    expect(webqqSidebar).toContain(':notices="filteredNotices"')
    expect(webqqSidebar).toContain("@handle=\"(notice, approve) => emit('handle-notice', notice, approve)\"")
    expect(webqqNoticeMenu).toContain('onebot-webqq-webqq__notice-menu')
    expect(webqqNoticeMenu).toContain("tab === 'friends'")
    expect(webqqNoticeMenu).toContain("tab === 'groups'")
    expect(webqqNoticeMenu).toContain("emit('update:tab', 'friends')")
    expect(webqqNoticeMenu).toContain("emit('update:tab', 'groups')")
    expect(webqqNoticeMenu).toContain("emit('handle', notice, true)")
    expect(webqqNoticeMenu).toContain("emit('handle', notice, false)")
    expect(webqqNoticeView).toContain('function sortPendingNotices(items: WebQQNotice[])')
    expect(webqqView).toContain('useWebQQNotices({ requestNotices: requestWebQQNotices, approveNotice: approveWebQQNotice })')
    expect(webqqApi).toContain("send('onebot-webqq/webqq/notices')")
    expect(webqqApi).toContain("send('onebot-webqq/webqq/notice-action'")
    expect(webqqNoticesStore).toContain('requestNotices: () => Promise<WebQQNotice[]>')
    expect(webqqNoticesStore).toContain('approveNotice: (notice: WebQQNotice, approve: boolean) => Promise<void>')
    expect(webqqNoticesStore).toContain('const filteredNotices = computed')
    expect(webqqNoticeMenu).toContain('v-for="notice in notices"')
    expect(webqqNoticeMenu).toContain('onebot-webqq-webqq__notice-card')
    expect(webqqNoticeMenu).toContain(':src="withProxy(notice.avatar)"')
    expect(webqqNoticeMenu).toContain('class="onebot-webqq-webqq__notice-title"')
    expect(webqqNoticeMenu).toContain('getHandledNoticeStatusText(notice)')
    expect(webqqNoticeMenu).toContain('onebot-webqq-webqq__notice-result')
    expect(webqqNoticeMenu).toContain('<time v-if="notice.time" class="onebot-webqq-webqq__notice-time">{{ formatNoticeTime(notice.time) }}</time>')
    expect(webqqNoticeMenu).toContain('v-else-if="getHandledNoticeStatusText(notice)"')
    expect(webqqNoticeMenu).toContain('v-for="line in formatNoticeComment(notice.comment)"')
    expect(webqqNoticeMenu).toContain('onebot-webqq-webqq__notice-comment')
    expect(webqqNoticeMenu).toContain("emit('handle', notice, true)")
    expect(webqqNoticeMenu).toContain("emit('handle', notice, false)")
    expect(webqqNoticeMenu).toContain('暂无通知')
    expect(webqqView).not.toContain('onebot-webqq-webqq__notice-meta')
    expect(webqqView).not.toContain('onebot-webqq-webqq__notice-type')
    expect(webqqView).not.toContain('onebot-webqq-webqq__notice-status')
    expect(webqqView).not.toContain('getNoticeTypeText')
    expect(webqqView).not.toContain('getNoticeStatusText')
    expect(webqqView).not.toContain('申请时间：')
    expect(webqqView).not.toContain("return timestamp ? formatListTime(timestamp) : '未知'")
    expect(webqqView).not.toContain('<small class="onebot-webqq-webqq__notice-time"')
    expect(webqqView).not.toContain('<div v-if="noticeOpen" class="onebot-webqq-webqq__chat-title">')
  })

  it('renders a mobile full-page WebQQ notification view beside the narrow sidebar', () => {
    expect(webqqView).toContain(`:class="['onebot-webqq-webqq__chat-content', { 'is-mobile-notice-open': noticeOpen }]"`)
    expect(webqqView).toContain('<div v-if="noticeOpen" class="onebot-webqq-webqq__mobile-notice-page" @click.stop>')
    expect(webqqView).toContain('<WebQQNoticeMenu')
    expect(webqqView).toContain('class="onebot-webqq-webqq__mobile-notice-content"')
    expect(webqqView).toContain('v-model:tab="noticeMenuTab"')
    expect(webqqView).toContain(':notices="filteredNotices"')
    expect(webqqView).toContain('@handle="handleNotice"')
    expect(webqqView).toContain('<div class="onebot-webqq-webqq__chat-main">')
    expect(webqqSidebar).toContain('<WebQQNoticeMenu')
  })

  it('attaches the WebQQ overlay scrollbar directive to every WebQQ scroll area', () => {
    expect(webqqScrollbarDirective).toContain('export const vWebqqScrollbar')
    expect(webqqScrollbarDirective).toContain('document.body.appendChild')
    expect(webqqScrollbarDirective).toContain('ResizeObserver')
    expect(webqqScrollbarDirective).toContain('pointermove')
    expect(webqqScrollbarDirective).toContain('const overlayInset = 0')
    expect(webqqScrollbarDirective).toContain("element.closest<HTMLElement>('.onebot-webqq-webqq')")
    expect(webqqScrollbarDirective).toContain('const rect = getVisibleScrollbarRect(element)')
    expect(webqqScrollbarDirective).toContain('function stopEvent(event: Event)')
    expect(webqqScrollbarDirective).toContain('event.stopPropagation()')
    expect(webqqScrollbarDirective).toContain("addListener(thumb, 'click', stopEvent)")
    expect(webqqScrollbarDirective).toContain(`const thumbEnter = () => {
      state.hovering = true
      showScrollbar(state)
      overlay.classList.add('is-wide')
    }`)
    expect(webqqScrollbarDirective).toContain(`const thumbLeave = () => {
      state.hovering = false
      if (!state.dragging) overlay.classList.remove('is-wide')
      scheduleHide(state)
    }`)
    expect(webqqView).toContain('import { vWebqqScrollbar }')
    expect(webqqView).toContain('ref="messagePane" v-webqq-scrollbar class="onebot-webqq-webqq__messages" @scroll="updateMessageTracking"')
    expect(webqqContactList).toContain('import { vWebqqScrollbar }')
    expect(webqqContactList).toContain('<div v-webqq-scrollbar="{ hideOnNarrow: true }" class="onebot-webqq-webqq__list">')
    expect(webqqScrollbarDirective).toContain("overlay.classList.toggle('is-hidden-on-narrow', Boolean(binding.value?.hideOnNarrow))")
    expect(webqqNoticeMenu).toContain('import { vWebqqScrollbar }')
    expect(webqqNoticeMenu).toContain('<div v-webqq-scrollbar class="onebot-webqq-webqq__notice-menu-body">')
    expect(webqqGroupInfoPanel).toContain('import { vWebqqScrollbar }')
    expect(webqqGroupInfoPanel).toContain('<section v-webqq-scrollbar class="onebot-webqq-webqq__group-announcements">')
    expect(webqqGroupInfoPanel).toContain('<div v-else v-webqq-scrollbar class="onebot-webqq-webqq__group-member-list">')
    expect(webqqForwardModal).toContain('import { vWebqqScrollbar }')
    expect(webqqForwardModal).toContain('<div v-webqq-scrollbar class="onebot-webqq-webqq__forward-modal-body">')
  })

  it('keeps WebQQ notification menu state inside a composable', async () => {
    const events: string[] = []
    const notices = useWebQQNotices({
      requestNotices: async () => {
        events.push('load')
        return [
          {
            id: 'friend:1',
            type: 'friend-request',
            title: '好友申请',
            subtitle: 'Alice',
            avatar: '',
            status: 'pending',
            time: 2,
            flag: 'friend-flag',
          },
          {
            id: 'group:1',
            type: 'group-notice',
            title: '群通知',
            subtitle: 'Bob',
            avatar: '',
            status: 'approved',
            time: 1,
          },
        ]
      },
      approveNotice: async (notice, approve) => {
        events.push(`${notice.id}:${approve}`)
      },
    })

    expect(notices.noticeOpen.value).toBe(false)
    notices.openNotices()
    await Promise.resolve()
    expect(notices.noticeOpen.value).toBe(true)
    expect(events).toEqual(['load'])
    expect(notices.filteredNotices.value.map((notice) => notice.id)).toEqual(['friend:1'])

    notices.noticeMenuTab.value = 'groups'
    expect(notices.filteredNotices.value.map((notice) => notice.id)).toEqual(['group:1'])

    await notices.handleNotice(notices.notices.value[0], true)
    expect(events).toEqual(['load', 'friend:1:true', 'load'])
  })

  it('closes the WebQQ notification dropdown when clicking elsewhere in the panel', () => {
    expect(webqqView).toContain('function closeNoticeMenu()')
    expect(webqqView).toContain('noticeOpen.value = false')
  })

  it('formats WebQQ notice times as month/day plus clock time', () => {
    expect(webqqMessageView).toContain('function padNoticeTimePart(value: number)')
    expect(webqqMessageView).toContain('date.getMonth() + 1')
    expect(webqqMessageView).toContain('date.getDate()')
    expect(webqqMessageView).toContain('date.getHours()')
    expect(webqqMessageView).toContain('date.getMinutes()')
  })

  it('splits WebQQ notice question and answer comments into separate lines', () => {
    expect(webqqNoticeView).toContain('function formatNoticeComment(comment: string)')
    expect(webqqNoticeView).toContain('问题[:：]')
    expect(webqqNoticeView).toContain('答案[:：]')
    expect(webqqNoticeView).toContain('return match ? [match[1], match[2]] : [comment]')
  })

  it('renders sender avatars for WebQQ messages', () => {
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__message-avatar"')
    expect(webqqMessageListView).toContain(':src="withProxy(message.senderAvatar)"')
    expect(webqqMessageListView).toContain(':alt="message.senderName"')
  })

  it('marks consecutive messages from the same sender as merged in Telegram chat style', () => {
    expect(webqqMessageListView).toMatch(/v-for="\(message, index\) in (messages|visibleMessages)"/)
    expect(webqqMessageListView).toContain("'is-merged': isMergedMessage(index)")
    expect(webqqMessageListView).toContain('getMessageClusterClass(index)')
    expect(webqqMessageListView).toContain('v-if="!isMergedMessage(index)"')
    expect(webqqMessageListStore).toContain('function getMessageClusterClass(index: number)')
    expect(webqqMessageListStore).toContain('getMessageClusterClassFromView(messages.value, index, options.chatStyle.value)')
    expect(webqqMessageListStore).toContain('function isMergedMessage(index: number)')
    expect(webqqMessageListStore).toContain('isMergedMessageFromView(messages.value, index, options.chatStyle.value)')
    expect(webqqMessageView).toContain("chatStyle !== 'telegram'")
    expect(webqqMessageView).toContain("return 'is-cluster-middle'")
    expect(webqqMessageView).toContain("return 'is-cluster-first'")
    expect(webqqMessageView).toContain("return 'is-cluster-last'")
    expect(webqqMessageView).toContain("if (!message) return ''")
    expect(webqqMessageView).toContain('function getClusterBubbleMessage(messages: WebQQMessage[], index: number, step: 1 | -1)')
    expect(webqqMessageView).toContain('if (!isImageOnlyMessage(candidate)) return candidate')
    expect(webqqMessageView).toContain('const hasPrevious = !!getClusterBubbleMessage(messages, index, -1)')
    expect(webqqMessageView).toContain('const hasNext = !!getClusterBubbleMessage(messages, index, 1)')
  })

  it('wraps WebQQ message bubbles with their time for Telegram hover layout', () => {
    expect(webqqView).toContain(':chat-style="webQQChatStyle"')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__message-body"')
    expect(webqqMessageListView).toContain('onebot-webqq-webqq__bubble')
    expect(webqqMessageListView).toContain('<div class="onebot-webqq-webqq__message-time">{{ formatTime(message.time) }}</div>')
  })

  it('renders image-only WebQQ messages without a text bubble', () => {
    expect(webqqMessageListView).toContain('v-if="isImageOnlyMessage(message)"')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__message-media-stack"')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__message-media"')
    expect(webqqMessageListView).toContain(':src="withProxy(getImageOnlyUrl(message))"')
    expect(webqqMessageListView).toContain('function getImageOnlyUrl(message: WebQQMessage)')
    expect(webqqMessageView).toContain('function isImageOnlyMessage(message: WebQQMessage)')
  })

  it('opens WebQQ message images in a full-size preview overlay', () => {
    expect(webqqView).not.toContain('useWebQQImagePreview(withProxy)')
    expect(webqqView).toContain('const imagePreviewUrl = ref(\'\')')
    expect(webqqView).toContain('function openImagePreview(url: string)')
    expect(webqqView).toContain('imagePreviewUrl.value = withProxy(url)')
    expect(webqqView).toContain('function closeImagePreview()')
    expect(webqqView).toContain('imagePreviewUrl.value = \'\'')
    expect(webqqMessageListView).toContain('@click="openImage(getImageOnlyUrl(message))"')
    expect(webqqMessageListView).toContain("function openImage(url: string | undefined)")
    expect(webqqMessageListView).toContain("emit('open-image', run.element.url)")
    expect(webqqView).toContain('@open-image="openImagePreview"')
    expect(webqqView).toContain('<WebQQImagePreview')
    expect(webqqView).toContain('v-if="imagePreviewUrl"')
    expect(webqqView).toContain(':url="imagePreviewUrl"')
    expect(webqqView).toContain('@close="closeImagePreview"')
    expect(webqqImagePreviewView).toContain('const imagePreview = ref<HTMLElement>()')
    expect(webqqImagePreviewView).toContain('onMounted(() => {')
    expect(webqqImagePreviewView).toContain('imagePreview.value?.focus()')
    expect(webqqImagePreviewView).toContain('ref="imagePreview"')
    expect(webqqImagePreviewView).toContain('class="onebot-webqq-webqq__image-preview"')
    expect(webqqImagePreviewView).toContain("@click.stop.self=\"emit('close')\"")
    expect(webqqImagePreviewView).toContain("@keydown.esc=\"emit('close')\"")
    expect(webqqImagePreviewView).toContain(':src="url"')
    expect(webqqImagePreviewView).toContain('aria-label="关闭图片预览"')
  })

  it('declares optional completed thinking data on backend and client WebQQ messages', () => {
    const backendMessageSource = sourceBetween(
      serverWebqqTypesSource,
      'export interface WebQQMessage {',
      'export interface WebQQLiveMessage',
    )
    const clientMessageSource = sourceBetween(
      webqqTypes,
      'export interface WebQQMessage {',
      'export interface WebQQLiveMessage',
    )

    for (const messageSource of [backendMessageSource, clientMessageSource]) {
      expect(messageSource).toContain('usage?:')
      expect(messageSource).toContain('thinking?:')
      expect(messageSource).toContain('content: string')
      expect(messageSource).toContain('durationMs: number')
      expect(messageSource).toContain('ttftMs?: number')
      expect(messageSource).toContain('totalMs?: number')
      expect(messageSource).toContain('tps?: number')
    }
  })

  it('renders completed thinking below WebQQ messages as a collapsible disclosure', () => {
    expect(webqqView).toContain('useWebQQThinkingExpansion()')
    expect(webqqThinkingExpansionStore).toContain('const expandedThinkingMessageIds = ref')
    expect(webqqMessageView).toContain('function formatThinkingDuration(durationMs: number)')
    expect(webqqMessageView).toContain('Math.round(durationMs / 1000)')
    expect(webqqMessageView).toContain('return `已思考 ${seconds}s`')
    expect(webqqThinkingExpansionStore).toContain('function isThinkingExpanded(message: WebQQMessage)')
    expect(webqqThinkingExpansionStore).toContain('function toggleThinking(message: WebQQMessage)')
    expect(webqqMessageListStore).toContain('function getLastOutgoingClusterThinkingMessage(index: number)')
    expect(webqqMessageListStore).toContain('function getLastOutgoingClusterUsageMessage(index: number)')
    expect(webqqMessageView).toContain('function getLastOutgoingClusterThinkingMessage(messages: WebQQMessage[], index: number)')
    expect(webqqMessageView).toContain('function getLastOutgoingClusterUsageMessage(messages: WebQQMessage[], index: number)')
    expect(webqqMessageView).toContain('candidate.thinking?.content')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__thinking-row"')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__thinking-row is-usage-only"')
    expect(webqqMessageListView).toContain('shouldShowFallbackUsage(index)')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__thinking-toggle"')
    expect(webqqMessageListView).toContain('@click="toggleThinking(index)"')
    expect(webqqView).toContain('@toggle-thinking="toggleThinking"')
    expect(webqqView).toContain(':get-last-outgoing-cluster-usage-message="getLastOutgoingClusterUsageMessage"')
    expect(webqqMessageListView).toContain('getThinkingDurationText(index)')
    expect(webqqMessageListView).toContain("{ 'is-expanded': isThinkingMessageExpanded(index) }")
    expect(webqqMessageListView).toContain('<Transition name="onebot-webqq-webqq-thinking" @before-leave="prepareThinkingPanelLeave">')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__thinking-panel"')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__thinking-content"')
    expect(webqqMessageListView).toContain('{{ getThinkingMessage(index)?.thinking.content }}')
    expect(webqqMessageListView).toContain('function readMessageRowRects()')
    expect(webqqMessageListView).toContain('function animateMovedMessageRows(previousRects: Map<string, DOMRect>)')
    expect(webqqMessageListView).toContain('function prepareThinkingPanelLeave(element: Element)')
    expect(webqqMessageListView).toContain('const previousRects = readMessageRowRects()')
    expect(webqqMessageListView).toContain('await nextTick()')
    expect(webqqMessageListView).toContain('animateMovedMessageRows(previousRects)')
    expect(webqqMessageListView).toContain("element.style.position = 'absolute'")
    expect(webqqMessageListView).toContain("element.style.marginTop = '0'")
    expect(webqqMessageListView).toContain("element.style.transition = 'transform 0.16s ease'")
    expect(webqqMessageListView).toContain("element.style.willChange = 'transform'")
  })

  it('keeps WebQQ thinking expansion state inside a composable', () => {
    const expansion = useWebQQThinkingExpansion()
    const message = createWebQQMessage({ id: 'thinking-1', sequence: 'thinking-1' })
    expect(expansion.isThinkingExpanded(message)).toBe(false)
    expansion.toggleThinking(message)
    expect(expansion.isThinkingExpanded(message)).toBe(true)
    expansion.toggleThinking(message)
    expect(expansion.isThinkingExpanded(message)).toBe(false)
  })

  it('keeps WebQQ message list display state inside a composable', () => {
    const scrollEvents: string[] = []
    const list = useWebQQMessageList({
      capsule: ref<WebQQCapsuleData | undefined>(createCapsuleData()),
      currentChat: ref<WebQQChatSelection | undefined>(createGroupChatSelection()),
      chatStyle: ref('telegram'),
      messageCacheLimit: ref(100),
      applyMessageSenderMetadata: (message) => message,
      shouldScrollToBottom: () => true,
      scrollMessagesToBottom: () => scrollEvents.push('scroll'),
    })

    expect(list.botThinkingMessage.value?.id).toBe('thinking:group:20000:1710000000000')
    expect(list.visibleMessages.value).toHaveLength(1)
    list.appendMessage(createWebQQMessage({ id: 'message-2', sequence: 'message-2', time: 1710000000001 }))
    expect(list.messages.value).toHaveLength(1)
    expect(scrollEvents).toEqual(['scroll'])
    expect(list.isBotThinkingMessage(list.visibleMessages.value[0])).toBe(false)
  })

  it('keeps the current WebQQ chat thinking bubble when another chat starts thinking', () => {
    const capsule = ref<WebQQCapsuleData | undefined>(createCapsuleData())
    const currentChat = ref<WebQQChatSelection | undefined>(createGroupChatSelection())
    const list = useWebQQMessageList({
      capsule,
      currentChat,
      chatStyle: ref('telegram'),
      messageCacheLimit: ref(100),
      applyMessageSenderMetadata: (message) => message,
      shouldScrollToBottom: () => false,
      scrollMessagesToBottom: () => {},
    })

    expect(list.botThinkingMessage.value?.id).toBe('thinking:group:20000:1710000000000')

    capsule.value = createCapsuleData({
      channelId: '20001',
      channelName: '别的群',
      userId: '40000',
      userName: 'Bob',
      timestamp: 1710000001000,
    })

    expect(list.botThinkingMessage.value?.id).toBe('thinking:group:20000:1710000000000')

    list.appendMessage(createWebQQMessage({ id: 'reply-a', sequence: 'reply-a', time: 1710000002000 }))

    expect(list.botThinkingMessage.value).toBeUndefined()
  })

  it('limits the in-memory current WebQQ message list to the configured cache limit', () => {
    const list = useWebQQMessageList({
      capsule: ref<WebQQCapsuleData | undefined>(),
      currentChat: ref<WebQQChatSelection | undefined>(createGroupChatSelection()),
      chatStyle: ref('telegram'),
      messageCacheLimit: ref(2),
      applyMessageSenderMetadata: (message) => message,
      shouldScrollToBottom: () => false,
      scrollMessagesToBottom: () => {},
    })

    list.appendMessage(createWebQQMessage({ id: 'first', sequence: 'first', time: 1 }))
    list.appendMessage(createWebQQMessage({ id: 'second', sequence: 'second', time: 2 }))
    list.appendMessage(createWebQQMessage({ id: 'third', sequence: 'third', time: 3 }))

    expect(list.messages.value.map((message) => message.id)).toEqual(['second', 'third'])
  })

  it('applies WebQQ recall payloads to message lists', () => {
    const message = createWebQQMessage({ id: 'message-1', sequence: 'message-1' })
    const recallEvent = createWebQQMessage({
      id: 'recall:message-1',
      sequence: 'recall:message-1',
      time: 1710000000001,
      summary: 'Alice 撤回了一条消息',
      event: {
        type: 'recall',
        targetMessageId: 'message-1',
      },
    })

    expect(applyWebQQRecallToMessages([message], {
      type: 'group',
      peerId: '20000',
      messageId: 'message-1',
      mode: 'mark',
    })).toEqual([{ ...message, recalled: true }])
    expect(applyWebQQRecallToMessages([message], {
      type: 'group',
      peerId: '20000',
      messageId: 'message-1',
      mode: 'remove',
      eventMessage: recallEvent,
    })).toEqual([recallEvent])
  })

  it('switches WebQQ chats without showing the loading placeholder while history refreshes', async () => {
    const currentChat = ref<WebQQChatSelection | undefined>(createGroupChatSelection())
    const messages = ref<WebQQMessage[]>([])
    const loading = ref(false)
    const errorText = ref('')
    const trackingMessages = ref(false)
    const messagePane = ref<HTMLElement>()
    const cachedMessage = createWebQQMessage({ id: 'cached', sequence: 'cached', time: 1, summary: 'cached' })
    const remoteMessage = createWebQQMessage({ id: 'remote', sequence: 'remote', time: 2, summary: 'remote' })
    const savedMessages: WebQQMessage[][] = []
    let resolveRemoteMessages: (messages: WebQQMessage[]) => void = () => {}
    const remoteMessages = new Promise<WebQQMessage[]>((resolve) => {
      resolveRemoteMessages = resolve
    })
    const history = useWebQQMessageHistory({
      currentChat,
      messages,
      loading,
      errorText,
      trackingMessages,
      messagePane,
      requestMessages: async () => remoteMessages,
      loadCachedMessages: async () => [cachedMessage],
      saveCachedMessages: async (_type, _peerId, nextMessages) => {
        savedMessages.push(nextMessages)
      },
      messageCacheLimit: ref(100),
      rememberMessageSenderMetadata: () => {},
      updateConversationSummary: () => {},
      scrollMessagesToBottom: async () => {},
    })

    const loadingMessages = history.loadMessages()
    await Promise.resolve()
    await Promise.resolve()

    expect(messages.value).toEqual([cachedMessage])
    expect(loading.value).toBe(false)
    expect(savedMessages).toEqual([])

    resolveRemoteMessages([remoteMessage])
    await loadingMessages

    expect(messages.value.map((message) => message.id)).toEqual(['cached', 'remote'])
    expect(loading.value).toBe(false)
    expect(savedMessages[0].map((message) => message.id)).toEqual(['cached', 'remote'])
  })

  it('keeps prepended older WebQQ history beyond the current message cache limit', async () => {
    const currentChat = ref<WebQQChatSelection | undefined>(createGroupChatSelection())
    const messages = ref<WebQQMessage[]>([
      createWebQQMessage({ id: 'newer-1', sequence: 'newer-1', time: 2, summary: 'newer-1' }),
      createWebQQMessage({ id: 'newer-2', sequence: 'newer-2', time: 3, summary: 'newer-2' }),
    ])
    const loading = ref(false)
    const errorText = ref('')
    const trackingMessages = ref(false)
    const messagePane = ref<HTMLElement>()
    const savedMessages: WebQQMessage[][] = []
    const history = useWebQQMessageHistory({
      currentChat,
      messages,
      loading,
      errorText,
      trackingMessages,
      messagePane,
      requestMessages: async () => [createWebQQMessage({ id: 'older', sequence: 'older', time: 1, summary: 'older' })],
      loadCachedMessages: async () => [],
      saveCachedMessages: async (_type, _peerId, nextMessages) => {
        savedMessages.push(nextMessages)
      },
      messageCacheLimit: ref(2),
      rememberMessageSenderMetadata: () => {},
      updateConversationSummary: () => {},
      scrollMessagesToBottom: async () => {},
    })

    await history.loadOlderMessages()

    expect(messages.value.map((message) => message.id)).toEqual(['older', 'newer-1', 'newer-2'])
    expect(savedMessages[0].map((message) => message.id)).toEqual(['older', 'newer-1', 'newer-2'])
    expect(history.historyExhausted.value).toBe(false)
  })

  it('marks older WebQQ history exhausted when the backend repeats a page', async () => {
    const currentChat = ref<WebQQChatSelection | undefined>(createGroupChatSelection())
    const messages = ref<WebQQMessage[]>([
      createWebQQMessage({ id: 'oldest', sequence: 'oldest', time: 1, summary: 'oldest' }),
    ])
    const loading = ref(false)
    const errorText = ref('')
    const trackingMessages = ref(false)
    const messagePane = ref<HTMLElement>()
    const requestMessages = vi.fn(async () => [createWebQQMessage({ id: 'oldest', sequence: 'oldest', time: 1, summary: 'oldest' })])
    const history = useWebQQMessageHistory({
      currentChat,
      messages,
      loading,
      errorText,
      trackingMessages,
      messagePane,
      requestMessages,
      loadCachedMessages: async () => [],
      saveCachedMessages: async () => {},
      messageCacheLimit: ref(100),
      rememberMessageSenderMetadata: () => {},
      updateConversationSummary: () => {},
      scrollMessagesToBottom: async () => {},
    })

    await history.loadOlderMessages()

    expect(messages.value.map((message) => message.id)).toEqual(['oldest'])
    expect(history.historyExhausted.value).toBe(true)

    await history.loadOlderMessages()

    expect(requestMessages).toHaveBeenCalledTimes(1)
    expect(history.historyExhausted.value).toBe(true)
  })

  it('renders completed outgoing thinking after the last bubble in its WebQQ message cluster', () => {
    const thinkingRowStart = '<div\n        v-if="!message.event && getThinkingMessage(index)"'
    const messageContentSource = sourceBetween(
      webqqMessageListView,
      'class="onebot-webqq-webqq__message-content"',
      thinkingRowStart,
    )

    expect(messageContentSource).not.toContain('class="onebot-webqq-webqq__thinking-toggle"')
    expect(messageContentSource).not.toContain('class="onebot-webqq-webqq__thinking-content"')
    expect(webqqMessageListView.indexOf(thinkingRowStart)).toBeGreaterThan(webqqMessageListView.indexOf('class="onebot-webqq-webqq__message-content"'))
    expect(webqqMessageListView).toContain('getThinkingMessage(index)')
    expect(webqqMessageListView).toContain('getThinkingDurationText(index)')
    expect(webqqMessageListView).toContain('toggleThinking(index)')
    expect(webqqMessageListView).toContain('<Transition name="onebot-webqq-webqq-thinking" @before-leave="prepareThinkingPanelLeave">')
  })

  it('renders WebQQ recall events and recalled message marks', () => {
    expect(webqqTypes).toContain('recalled?: boolean')
    expect(webqqTypes).toContain("event?: {")
    expect(webqqTypes).toContain("type: 'recall'")
    expect(webqqTypes).toContain("type: 'recall' | 'poke' | 'mute' | 'reaction'")
    expect(webqqTypes).toContain('export interface WebQQMessageReactionUser')
    expect(webqqTypes).toContain('users?: WebQQMessageReactionUser[]')
    expect(webqqTypes).toContain('reactions?: WebQQMessageReaction[]')
    expect(webqqTypes).toContain('emojiUrl?: string')
    expect(webqqTypes).toContain('userAvatar?: string')
    expect(webqqMessageListView).toContain('chatStyle: WebQQChatStyle')
    expect(webqqMessageListView).toContain("message.event")
    expect(webqqMessageListView).toContain('onebot-webqq-webqq__message-event')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__message-recall-status"')
    expect(webqqMessageListView).toContain('已撤回')
    expect(webqqMessageListView).toContain("'is-recalled': message.recalled")
    expect(webqqMessageListView).toContain('WebQQMessageReactions')
    expect(webqqMessageListView).toContain(':reactions="message.reactions ?? []"')
    expect(webqqMessageListView).toContain("import { withProxy } from '@koishijs/client'")
    expect(webqqView).not.toContain(':format-time="formatTime"')
    expect(webqqView).not.toContain(':get-web-q-q-element-runs="getWebQQElementRuns"')
    expect(webqqView).not.toContain(':get-sender-authority-text="getSenderAuthorityText"')
    expect(webqqMessageListView).toContain('message.reactions')
    expect(webqqMessageListView).toContain("message.reactions?.length && chatStyle === 'telegram'")
    expect(webqqMessageListView).toContain("message.reactions?.length && chatStyle !== 'telegram'")
    expect(webqqMessageReactionsView).toContain('onebot-webqq-webqq__message-reactions')
    expect(webqqMessageReactionsView).toContain('getReactionUsers(reaction)')
    expect(webqqMessageReactionsView).toContain('getReactionUserZIndex(reaction, userIndex)')
    expect(webqqMessageReactionsView).toContain('onebot-webqq-webqq__message-reaction-users')
    expect(webqqMessageReactionsView).toContain('onebot-webqq-webqq__message-reaction-avatar')
    expect(webqqMessageReactionsView).toContain('onebot-webqq-webqq__message-reaction-avatar-image')
    expect(webqqMessageReactionsView).toContain('reaction.emojiUrl')
    expect(webqqMessageReactionsView).toContain(':src="withProxy(reaction.emojiUrl)"')
    expect(webqqMessageReactionsView).toContain('reaction.userAvatar')
    expect(webqqMessageReactionsView).toContain(':src="withProxy(user.userAvatar)"')
    expect(webqqMessageReactionsView).toContain(':title="user.userName || user.userId"')
    expect(webqqMessageReactionsView).toContain('reaction.label')
    expect(style).toContain('.onebot-webqq-webqq__message.is-recalled')
    expect(style).toContain('.onebot-webqq-webqq__message-recall-status')
    expect(style).toContain('.onebot-webqq-webqq__message.is-recalled:hover .onebot-webqq-webqq__message-recall-status')
    expect(style).toContain('.onebot-webqq-webqq__message-reactions')
    expect(style).toContain('.onebot-webqq-webqq__message-reaction')
    expect(style).toContain('.onebot-webqq-webqq__bubble .onebot-webqq-webqq__message-reactions')
    expect(style).toContain('.onebot-webqq-webqq__message-reaction-users')
    expect(style).toContain('.onebot-webqq-webqq__message-reaction-emoji')
    expect(style).toContain('.onebot-webqq-webqq__message-reaction-avatar')
  })

  it('renders QQ-style WebQQ reactions outside bubbles without user avatars', () => {
    const outsideReactionSource = sourceBetween(
      webqqMessageListView,
      "message.reactions?.length && chatStyle !== 'telegram'",
      'class="onebot-webqq-webqq__message-recall-status"',
    )

    expect(webqqMessageListView).toContain('<WebQQMessageReactions')
    expect(outsideReactionSource).toContain(':chat-style="chatStyle"')
    expect(webqqMessageReactionsView).toContain('function shouldShowReactionUsers(reaction: WebQQMessageReaction)')
    expect(webqqMessageReactionsView).toContain('function shouldShowReactionCount(reaction: WebQQMessageReaction)')
    expect(webqqMessageReactionsView).toContain("if (props.chatStyle !== 'telegram') return reaction.count > 1")
    expect(webqqMessageReactionsView).toContain("return props.chatStyle === 'telegram' && getReactionUsers(reaction).length > 0")
  })

  it('renders completed WebQQ thinking usage as icons before the thinking duration', () => {
    const thinkingToggleSource = sourceBetween(
      webqqMessageListView,
      'class="onebot-webqq-webqq__thinking-toggle"',
      "'onebot-webqq-webqq__thinking-chevron'",
    )

    expect(webqqMessageListView).not.toContain("return `输入 ${usage.inputTokens} / 输出 ${usage.outputTokens}`")
    expect(webqqMessageListView).not.toContain('输入 ${usage.inputTokens}')
    expect(webqqMessageListView).not.toContain('输出 ${usage.outputTokens}')
    expect(thinkingToggleSource).toContain('shouldShowThinkingUsage(index)')
    expect(thinkingToggleSource).toContain('class="onebot-webqq-webqq__thinking-usage"')
    expect(thinkingToggleSource).toContain('shouldShowThinkingTokens(index)')
    expect(thinkingToggleSource).toContain('shouldShowThinkingTiming(index)')
    expect(thinkingToggleSource).toContain('class="onebot-webqq-webqq__thinking-usage-group"')
    expect(thinkingToggleSource).toContain('class="onebot-webqq-webqq__thinking-usage-group is-timing"')
    expect(thinkingToggleSource).toContain('class="onebot-webqq-webqq__thinking-usage-icon is-input"')
    expect(thinkingToggleSource).toContain('class="onebot-webqq-webqq__thinking-usage-icon is-output"')
    expect(thinkingToggleSource).toContain('{{ getThinkingMessage(index)?.thinking.usage?.inputTokens }}')
    expect(thinkingToggleSource).toContain('{{ getThinkingMessage(index)?.thinking.usage?.outputTokens }}')
    expect(thinkingToggleSource).toContain('TTFT {{ formatThinkingMetricDuration')
    expect(thinkingToggleSource).toContain('TPS {{ formatThinkingTps')
    expect(thinkingToggleSource).toContain('Total {{ formatThinkingMetricDuration')
    expect(thinkingToggleSource).not.toContain('<strong>')
    expect(webqqMessageListView).toContain('showWebQQThinkingTokens: boolean')
    expect(webqqMessageListView).toContain('showWebQQThinkingTiming: boolean')
    expect(webqqMessageListView).toContain('function formatThinkingMetricDuration(value: number | undefined)')
    expect(webqqMessageListView).toContain('function formatThinkingTps(value: number | undefined)')
    expect(thinkingToggleSource).not.toContain(' / ')
    expect(thinkingToggleSource.indexOf('class="onebot-webqq-webqq__thinking-usage"')).toBeLessThan(
      thinkingToggleSource.indexOf('getThinkingDurationText(index)'),
    )
    expect(webqqMessageView).toContain('function formatThinkingDuration(durationMs: number)')
    expect(webqqThinkingExpansionStore).toContain('function toggleThinking(message: WebQQMessage)')
  })

  it('uses the last outgoing cluster usage as fallback when no completed thinking is shown', () => {
    const first = createWebQQMessage({
      id: 'first',
      sequence: 'first',
      usage: {
        inputTokens: 12,
        outputTokens: 34,
        ttftMs: 120,
        totalMs: 2400,
        tps: 14.2,
      },
    })
    const second = createWebQQMessage({
      id: 'second',
      sequence: 'second',
      time: 1710000000001,
      summary: '第二条',
    })

    expect(getLastOutgoingClusterUsageMessage([first, second], 0)).toBeUndefined()
    expect(getLastOutgoingClusterUsageMessage([first, second], 1)).toMatchObject({
      id: 'first',
      usage: {
        inputTokens: 12,
        outputTokens: 34,
        ttftMs: 120,
        totalMs: 2400,
        tps: 14.2,
      },
    })
    expect(getLastOutgoingClusterUsageMessage([{
      ...first,
      thinking: {
        content: '先分析',
        durationMs: 1200,
      },
    }, second], 1)).toBeUndefined()
    expect(webqqMessageListView).toContain('shouldShowUsageTokens(getUsageMessage(index)?.usage)')
    expect(webqqMessageListView).toContain('TTFT {{ formatThinkingMetricDuration(getUsageMessage(index)?.usage.ttftMs) }}')
    expect(webqqMessageListView).toContain('TPS {{ formatThinkingTps(getUsageMessage(index)?.usage.tps) }}')
    expect(webqqMessageListView).toContain('Total {{ formatThinkingMetricDuration(getUsageMessage(index)?.usage.totalMs) }}')
  })

  it('renders consecutive inline WebQQ elements inside one inline container', () => {
    const bubbleSource = sourceBetween(
      webqqMessageListView,
      'class="onebot-webqq-webqq__bubble"',
      '<div class="onebot-webqq-webqq__message-time"',
    )

    expect(bubbleSource).toContain('getWebQQElementRuns(message.elements)')
    expect(bubbleSource).toContain('class="onebot-webqq-webqq__inline-run"')
    expect(bubbleSource).toContain('v-for="element in run.elements"')
    expect(webqqMessageListView).not.toContain('v-else v-for')
    expect(bubbleSource).not.toContain('v-for="(element, index) in message.elements"')
  })

  it('renders WebQQ face elements with QQ emoji images when available', () => {
    expect(serverWebqqTypesSource).toContain('emojiUrl?: string')
    expect(webqqTypes).toContain('emojiUrl?: string')
    expect(webqqApi).toContain("const emojiUrl = readStringField(value, 'emojiUrl')")
    expect(webqqMessageListView).toContain("element.type === 'face' && element.emojiUrl")
    expect(webqqMessageListView).toContain(':src="withProxy(element.emojiUrl)"')
    expect(webqqForwardModal).toContain("element.type === 'face' && element.emojiUrl")
    expect(style).toContain('.onebot-webqq-webqq__message-face')
    const faceStyle = sourceBetween(style, '.onebot-webqq-webqq__message-face {', '}')
    expect(faceStyle).toContain('display: inline-block')
    expect(faceStyle).toContain('width: 18px')
    expect(faceStyle).toContain('height: 18px')
    expect(style).toContain('img:not(.onebot-webqq-webqq__message-reaction-avatar-image):not(.onebot-webqq-webqq__message-face)')
  })

  it('fits pure inline text bubbles to the measured rendered line width', () => {
    expect(webqqMessageListView).toContain("import { fitWebQQBubbleToInlineLines } from '../utils/webqq-bubble-width'")
    expect(webqqMessageListView).toContain(':ref="(element) => setBubbleElementRef(message, element)"')
    expect(webqqMessageListView).toContain('function shouldFitTextBubble(message: WebQQMessage)')
    expect(webqqMessageListView).not.toContain("message.direction === 'outgoing' &&")
    expect(webqqMessageListView).toContain('message.elements.length > 0')
    expect(webqqMessageListView).toContain('message.elements.every(isInlineWebQQElement)')
    expect(webqqMessageListView).toContain('function scheduleFitTextBubble(bubble: HTMLElement)')
    expect(webqqMessageListView).toContain('requestAnimationFrame(() => fitWebQQBubbleToInlineLines(bubble))')
    expect(webqqBubbleWidth).toContain('export function fitWebQQBubbleToInlineLines(bubble: HTMLElement)')
    expect(webqqBubbleWidth).toContain('range.getClientRects()')
    expect(webqqBubbleWidth).toContain('const lineWidths = measureInlineLineWidths(inlineRuns)')
    expect(webqqBubbleWidth).toContain('mergeRenderedLineRects(inlineRuns.flatMap(getRenderedContentRects))')
    expect(webqqBubbleWidth).toContain('setBubbleContentWidth(bubble, maxLineWidth, horizontalInset)')
    expect(webqqBubbleWidth).not.toContain('lineWidths.length <=')
    expect(webqqBubbleWidth).not.toContain('let low =')
    expect(webqqBubbleWidth).not.toContain('let high =')
    expect(webqqBubbleWidth).toContain('function setBubbleContentWidth(bubble: HTMLElement, contentWidth: number, horizontalInset: number)')
  })

  it('remeasures fitted text bubbles when the message row width changes', () => {
    expect(webqqMessageListView).toContain('const bubbleElementRefs = new Map<string, HTMLElement>()')
    expect(webqqMessageListView).toContain('bubbleElementRefs.set(key, element)')
    expect(webqqMessageListView).toContain('let textBubbleResizeObserver: ResizeObserver | undefined')
    expect(webqqMessageListView).toContain('function scheduleFitTextBubbles()')
    expect(webqqMessageListView).toContain('for (const bubble of bubbleElementRefs.values())')
    expect(webqqMessageListView).toContain('new ResizeObserver(() => scheduleFitTextBubbles())')
    expect(webqqMessageListView).toContain("bubble.closest<HTMLElement>('.onebot-webqq-webqq__message')")
    expect(webqqMessageListView).toContain('textBubbleResizeObserver.observe(resizeTarget)')
    expect(webqqMessageListView).toContain('textBubbleResizeObserver?.disconnect()')
    expect(webqqMessageListView).not.toContain('visible: boolean')
    expect(webqqMessageListView).not.toContain('watch(() => props.visible')
  })

  it('sets fitted bubble width to the current max rendered line width', () => {
    const inlineRun = {} as HTMLElement
    const getClientRects = vi.fn(() => [
      { top: 0, left: 0, right: 312.4, width: 312.4 },
      { top: 24, left: 0, right: 64, width: 64 },
    ])
    const bubble = {
      style: { width: '409px' },
      querySelectorAll: vi.fn(() => [inlineRun]),
    } as unknown as HTMLElement
    vi.stubGlobal('document', {
      createRange: vi.fn(() => ({
        selectNodeContents: vi.fn(),
        getClientRects,
        detach: vi.fn(),
      })),
    })
    vi.stubGlobal('window', {
      getComputedStyle: vi.fn(() => ({
        boxSizing: 'border-box',
        paddingLeft: '11px',
        paddingRight: '11px',
        borderLeftWidth: '0px',
        borderRightWidth: '0px',
      })),
    })

    fitWebQQBubbleToInlineLines(bubble)

    expect(bubble.style.width).toBe('335px')
    expect(getClientRects).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('keeps same-line inline fragments together when fitting mention text bubbles', () => {
    const inlineRun = {} as HTMLElement
    const getClientRects = vi.fn(() => [
      { top: 0, left: 0, right: 72, width: 72 },
      { top: 0.5, left: 72, right: 286.2, width: 214.2 },
      { top: 26, left: 0, right: 90, width: 90 },
    ])
    const bubble = {
      style: { width: '409px' },
      querySelectorAll: vi.fn(() => [inlineRun]),
    } as unknown as HTMLElement
    vi.stubGlobal('document', {
      createRange: vi.fn(() => ({
        selectNodeContents: vi.fn(),
        getClientRects,
        detach: vi.fn(),
      })),
    })
    vi.stubGlobal('window', {
      getComputedStyle: vi.fn(() => ({
        boxSizing: 'border-box',
        paddingLeft: '10px',
        paddingRight: '10px',
        borderLeftWidth: '0px',
        borderRightWidth: '0px',
      })),
    })

    fitWebQQBubbleToInlineLines(bubble)

    expect(bubble.style.width).toBe('307px')
    expect(getClientRects).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('clears fitted bubble width when there is no inline text run to measure', () => {
    const bubble = {
      style: { width: '387px' },
      querySelectorAll: vi.fn(() => []),
    } as unknown as HTMLElement

    fitWebQQBubbleToInlineLines(bubble)

    expect(bubble.style.width).toBe('')
  })

  it('renders group badges around sender names in opposite order by direction', () => {
    expect(webqqMessageListView).toContain('onebot-webqq-webqq__sender-line')
    expect(webqqMessageListView).toContain("v-if=\"message.direction === 'outgoing'\"")
    expect(webqqMessageListView).toContain("v-if=\"message.direction === 'incoming'\"")
    expect(webqqMessageView).toContain('message.senderRole')
    expect(webqqMessageListView).toContain('message.senderLevel')
    expect(webqqMessageView).toContain('message.senderTitle')
    expect(webqqMessageListView).toContain('getSenderAuthorityText')
    expect(webqqMessageListView).toContain('getSenderAuthorityClass')
    expect(webqqMessageView).toContain("message.senderRole === '群主'")
    expect(webqqMessageView).toContain("message.senderRole === '管理员'")
    expect(webqqMessageListView).toContain('formatSenderLevel')
    expect(webqqMessageListView).toContain('message.senderAffinity != null && showWebQQAffinity')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__message-avatar-wrap"')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__message-affinity"')
    expect(webqqMessageListView).toContain('class="onebot-webqq-webqq__message-affinity-icon"')
    expect(webqqMessageListView).toContain('<span v-if="message.senderAffinity < 0"><span class="onebot-webqq-webqq__message-affinity-sign">-</span>{{ -message.senderAffinity }}</span>')
    expect(webqqMessageListView).toContain('<span v-else>{{ message.senderAffinity }}</span>')
    expect(webqqMessageListView).not.toContain('function formatSenderAffinity')
    expect(webqqMessageListView).not.toContain('onebot-webqq-webqq__sender-badge is-affinity')
    expect(webqqMessageListView).toContain('message.senderRelationship && showWebQQRelationship')
  })

  it('shows group avatar, group id, and member count in the chat header', () => {
    expect(webqqView).toContain('class="onebot-webqq-webqq__chat-avatar"')
    expect(webqqView).toContain(':src="withProxy(currentAvatar)"')
    expect(webqqContactView).toContain('function getGroupSubtitle')
    expect(webqqContactView).toContain('function getCurrentChatSubtitle')
    expect(webqqContactsStore).toContain('currentSubtitle = computed')
  })

  it('opens a group-only WebQQ info panel with announcements and searchable members', () => {
    expect(webqqView).toContain('v-if="currentChat?.type === \'group\'"')
    expect(webqqView).toContain(`:aria-label="groupInfoOpen ? '关闭群信息' : '更多群信息'"`)
    expect(webqqView).toContain('@click="toggleGroupInfo"')
    expect(webqqView).not.toContain('@click="closeGroupInfo"')
    expect(webqqView).not.toContain('function closeGroupInfo()')
    expect(webqqView).toContain('useWebQQGroupInfo(currentChat, { requestGroupInfo: requestCurrentGroupInfo })')
    expect(webqqApi).toContain("send('onebot-webqq/webqq/group-info'")
    expect(webqqGroupInfoStore).toContain('requestGroupInfo: () => Promise<WebQQGroupInfo>')
    expect(webqqView).toContain('onebot-webqq-webqq__chat-main')
    expect(webqqView).toContain('<WebQQGroupInfoPanel')
    expect(webqqView).toContain('v-model:search-query="groupInfoSearchQuery"')
    expect(webqqView).toContain(':group-info="groupInfo"')
    expect(webqqView).toContain(':visible-members="visibleGroupMembers"')
    expect(webqqGroupInfoPanel).toContain('onebot-webqq-webqq__group-info')
    expect(webqqGroupInfoPanel).toContain('onebot-webqq-webqq__group-announcements')
    expect(webqqGroupInfoPanel).toContain('onebot-webqq-webqq__group-members')
    expect(webqqGroupInfoPanel).toContain('v-for="announcement in groupInfo.announcements"')
    expect(webqqGroupInfoPanel).not.toContain('v-else :key="announcement.id"')
    expect(webqqGroupInfoPanel).not.toContain('<strong>{{ announcement.title }}</strong>')
    expect(webqqGroupInfoPanel).toContain('v-for="member in visibleMembers"')
    expect(webqqGroupInfoPanel).toContain('placeholder="搜索群昵称或 QQ 号"')
    expect(webqqGroupInfoPanel).toContain('loading && !hasGroupInfo')
    expect(webqqGroupInfoStore).toContain('const visibleGroupMembers = computed')
    expect(webqqGroupInfoStore).toContain('getVisibleGroupMembers(groupInfo.value.members, groupInfoSearchQuery.value)')
    expect(webqqContactView).toContain('sortWebQQGroupMembers(visibleMembers)')
    expect(webqqContactView).toContain('member.card.toLowerCase().includes(query)')
    expect(webqqContactView).toContain('member.userId.includes(rawQuery)')
    expect(webqqView).not.toContain('<button type="button" @click="loadContacts">刷新</button>')
  })

  it('keeps WebQQ group info panel state inside a composable', async () => {
    const currentChat = ref<WebQQChatSelection>()
    const requests: string[] = []
    const groupInfo = useWebQQGroupInfo(currentChat, {
      requestGroupInfo: async () => {
        requests.push('load')
        return {
          announcements: [],
          members: [
            { userId: '2', nickname: 'Beta', card: '', avatar: '' },
            { userId: '1', nickname: 'Alice', card: 'Alice', avatar: '', role: '群主' },
          ],
        }
      },
    })
    expect(groupInfo.groupInfoOpen.value).toBe(false)
    expect(groupInfo.groupInfoLoading.value).toBe(false)
    expect(groupInfo.groupInfoErrorText.value).toBe('')
    expect(groupInfo.groupInfoSearchQuery.value).toBe('')
    expect(groupInfo.groupInfo.value).toEqual({ announcements: [], members: [] })

    await groupInfo.loadGroupInfo()
    expect(requests).toEqual([])

    currentChat.value = createGroupChatSelection()
    await groupInfo.loadGroupInfo()
    expect(requests).toEqual(['load'])
    groupInfo.groupInfoSearchQuery.value = '1'
    expect(groupInfo.visibleGroupMembers.value.map((member) => member.userId)).toEqual(['1'])
  })

  it('uses cached group info immediately while refreshing the current group', async () => {
    const currentChat = ref<WebQQChatSelection>(createGroupChatSelection({ peerId: '20000' }))
    const cachedInfo: WebQQGroupInfo = {
      announcements: [{ id: 'old', title: '旧公告', content: '旧公告' }],
      members: [{ userId: '1', nickname: 'Alice', card: '', avatar: '' }],
    }
    const otherGroupInfo: WebQQGroupInfo = {
      announcements: [{ id: 'other', title: '其他群公告', content: '其他群公告' }],
      members: [{ userId: '2', nickname: 'Bob', card: '', avatar: '' }],
    }
    const refreshedInfo: WebQQGroupInfo = {
      announcements: [{ id: 'new', title: '新公告', content: '新公告' }],
      members: [{ userId: '3', nickname: 'Carol', card: '', avatar: '' }],
    }
    let refreshCurrentGroup!: (value: WebQQGroupInfo) => void
    const refreshPromise = new Promise<WebQQGroupInfo>((resolve) => {
      refreshCurrentGroup = resolve
    })
    const responses = [
      Promise.resolve(cachedInfo),
      Promise.resolve(otherGroupInfo),
      refreshPromise,
    ]
    const groupInfo = useWebQQGroupInfo(currentChat, {
      requestGroupInfo: () => responses.shift() ?? Promise.resolve({ announcements: [], members: [] }),
    })

    await groupInfo.loadGroupInfo()
    expect(groupInfo.groupInfo.value).toEqual(cachedInfo)
    currentChat.value = createGroupChatSelection({ peerId: '30000' })
    await groupInfo.loadGroupInfo()
    expect(groupInfo.groupInfo.value).toEqual(otherGroupInfo)

    currentChat.value = createGroupChatSelection({ peerId: '20000' })
    const refresh = groupInfo.loadGroupInfo()
    expect(groupInfo.groupInfoLoading.value).toBe(true)
    expect(groupInfo.groupInfo.value).toEqual(cachedInfo)
    refreshCurrentGroup(refreshedInfo)
    await refresh
    expect(groupInfo.groupInfo.value).toEqual(refreshedInfo)
  })

  it('uses an inline SVG three-dot button as the only group info toggle', () => {
    const buttonSource = webqqView.match(/<button v-if="currentChat\?\.type === 'group'"[\s\S]*?<\/button>/)?.[0] ?? ''
    expect(buttonSource).toContain(`:aria-label="groupInfoOpen ? '关闭群信息' : '更多群信息'"`)
    expect(buttonSource).toContain('@click="toggleGroupInfo"')
    expect(buttonSource).toContain('class="onebot-webqq-webqq__header-icon"')
    expect(buttonSource.match(/<circle /g)).toHaveLength(3)
    expect(buttonSource).not.toContain('::before')
    expect(buttonSource).not.toContain('::after')
  })

  it('uses an inline SVG search icon in the WebQQ search field', () => {
    const searchSource = webqqSidebar.match(/<div v-if="activeTab !== 'recent'" class="onebot-webqq-webqq__search">[\s\S]*?<\/div>/)?.[0] ?? ''
    expect(searchSource).toContain('<svg class="onebot-webqq-webqq__search-icon"')
    expect(searchSource).toContain('<circle')
    expect(searchSource).toContain('<path')
    expect(searchSource).not.toContain('<span class="onebot-webqq-webqq__search-icon"></span>')
  })

  it('shows latest message summary and time in the WebQQ contact list', () => {
    expect(webqqSidebar).toContain(':get-contact-subtitle="getContactSubtitle"')
    expect(webqqSidebar).toContain(':get-contact-time="getContactTime"')
    expect(webqqSidebar).not.toContain(':format-list-time="formatListTime"')
    expect(webqqContactList).toContain('getContactSubtitle')
    expect(webqqContactList).toContain('getContactTime')
    expect(webqqContactList).toContain('formatTime')
    expect(webqqContactList).toContain('onebot-webqq-webqq__contact-time')
    expect(webqqContactList).toContain('<template v-if="activeTab === \'recent\'">')
    expect(webqqContactList).toContain('<template v-else-if="activeTab === \'friends\'">')
    expect(webqqContactList).not.toContain('v-show="activeTab')
    expect(webqqConversationStateStore).toContain('function setConversationSummary')
    expect(webqqConversationStateStore).toContain('setConversationSummary(conversationSummaries.value, type, peerId, message)')
  })

  it('shows unread counts for conversations the user is not viewing', () => {
    expect(webqqConversationStateStore).toContain('conversationUnreadCounts')
    expect(webqqView).toContain('webQQTotalUnread')
    expect(webqqContactList).toContain('class="onebot-webqq-webqq__contact-avatar"')
    expect(webqqContactList).toContain('class="onebot-webqq-webqq__contact-unread"')
    expect(webqqContactList).toContain('getUnreadCount(item.type, item.peerId)')
    expect(webqqContactList).toContain('getUnreadText')
    expect(webqqLiveMessagesStore).toContain("payload.message.direction === 'incoming'")
    expect(webqqLiveMessagesStore).toContain('!options.trackingMessages.value')
    expect(webqqLiveMessagesStore).toContain('options.increaseUnreadCount(payload.type, payload.peerId)')
    expect(webqqView).toContain('clearUnreadCount(currentChat.value.type, currentChat.value.peerId)')
    expect(webqqConversationStateStore).toContain('function increaseConversationUnreadCount')
    expect(webqqConversationStateStore).toContain('function clearConversationUnreadCount')
  })

  it('shares the summed WebQQ unread count with the capsule state', () => {
    expect(webqqView).toMatch(/import\s+\{[^}]*webQQTotalUnread[^}]*\}\s+from '\.\/settings'/)
    expect(webqqConversationStateStore).toContain('const totalUnreadCount = computed(() => Object.values(conversationUnreadCounts.value).reduce((sum, count) => sum + count, 0))')
    expect(webqqView).toContain('watch(totalUnreadCount, (count) => {')
    expect(webqqView).toContain('webQQTotalUnread.value = count')
    expect(webqqView).toContain('{ immediate: true }')
  })

  it('updates WebQQ stored conversation summary and unread counts immutably', () => {
    const summaries = { 'friend:10000': { summary: '旧消息', time: 1 } }
    const unreadCounts = { 'friend:10000': 2, 'group:20000': 1 }
    expect(setConversationSummary(summaries, 'friend', '10000', undefined)).toBe(summaries)
    expect(setConversationSummary(summaries, 'friend', '10000', createWebQQMessage({
      summary: '新消息',
      time: 2,
    }))).toEqual({
      'friend:10000': { summary: '新消息', time: 2 },
    })
    expect(increaseConversationUnreadCount(unreadCounts, 'friend', '10000')).toEqual({
      'friend:10000': 3,
      'group:20000': 1,
    })
    expect(clearConversationUnreadCount(unreadCounts, 'friend', '10000')).toEqual({
      'group:20000': 1,
    })
    expect(clearConversationUnreadCount(unreadCounts, 'group', '30000')).toBe(unreadCounts)
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
    expect(webqqView).toContain('useWebQQMessageScroll({')
    expect(webqqMessageScroll).toContain('const trackingMessages = ref(true)')
    expect(webqqMessageScroll).toContain('function updateMessageTracking()')
    expect(webqqMessageScroll).toContain('function scrollMessagesToBottom')
    expect(webqqMessageScroll).toContain('if (trackingMessages.value) scrollMessagesToBottom()')
    expect(webqqView).toContain('if (trackingMessages.value) scrollMessagesToBottom()')
  })

  it('keeps WebQQ message scroll tracking state inside a composable', () => {
    const events: string[] = []
    const scroll = useWebQQMessageScroll({
      clearCurrentUnreadCount: () => events.push('clear'),
      shouldLoadOlderMessages: () => {
        events.push('check')
        return false
      },
      loadOlderMessages: () => events.push('load'),
    })

    scroll.trackingMessages.value = false
    scroll.updateMessageTracking()
    expect(scroll.trackingMessages.value).toBe(true)
    expect(events).toEqual(['clear', 'check'])

    events.length = 0
    scroll.returnMessagesToBottom()
    expect(scroll.trackingMessages.value).toBe(true)
    expect(scroll.returningMessagesToBottom.value).toBe(true)

    scroll.updateMessageTracking()
    expect(scroll.returningMessagesToBottom.value).toBe(false)
    expect(events).toEqual(['clear'])
  })

  it('shows a WebQQ return-to-bottom button only when message tracking is paused', () => {
    const scrollBottomButton = webqqView.match(/<button[\s\S]*?onebot-webqq-webqq__scroll-bottom[\s\S]*?>/)?.[0] ?? ''
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
      scrollBottomTransition.includes('class="onebot-webqq-webqq__scroll-bottom"')
        ? ''
        : '返回底部按钮没有放在过渡容器内',
      /v-if="!\s*trackingMessages\s*&&\s*visibleMessages\.length"/.test(scrollBottomTransition)
        ? ''
        : '过渡容器内的返回底部按钮没有保留显示条件',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('returns WebQQ messages to the bottom by resuming tracking before scrolling', () => {
    const returnMessagesToBottomSource = webqqMessageScroll.match(/(?:async\s+)?function returnMessagesToBottom\(\)\s*{[\s\S]*?^}/m)?.[0] ?? ''
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
      webqqMessageScroll,
      'function updateMessageTracking()',
      'async function scrollMessagesToBottom',
    )
    const missingRequirements = [
      webqqMessageScroll.includes('const returningMessagesToBottom = ref(false)')
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
    const scrollMessagesToBottomSource = webqqMessageScroll.match(/async function scrollMessagesToBottom\([\s\S]*?^}/m)?.[0] ?? ''
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

  it('refreshes WebQQ history in the background without showing the loading placeholder', () => {
    const loadMessagesSource = sourceBetween(
      webqqMessageHistoryStore,
      'async function loadMessages()',
      'function shouldLoadOlderMessages()',
    )

    expect(loadMessagesSource).not.toContain('options.loading.value = true')
    expect(loadMessagesSource).toContain('const remoteMessages = await options.requestMessages')
    expect(loadMessagesSource).toContain('options.messages.value = limitMessages(mergeMessages(options.messages.value, remoteMessages))')
    expect(webqqMessageHistoryStore).toContain('async function scrollLoadedMessagesToBottom()')
  })

  it('keeps following the latest message after WebQQ images finish loading', () => {
    expect(webqqMessageListView).toContain("@load=\"emit('image-load')\"")
    expect(webqqView).toContain('@image-load="handleMessageImageLoad"')
    expect(webqqMessageScroll).toContain('function handleMessageImageLoad()')
    expect(webqqMessageScroll).toContain('if (trackingMessages.value) scrollMessagesToBottom()')
  })

  it('renders quote blocks inside WebQQ message bubbles', () => {
    expect(webqqMessageListView).toContain('element.type === \'quote\'')
    expect(webqqMessageListView).toContain('onebot-webqq-webqq__quote')
    expect(webqqMessageListView).toContain('onebot-webqq-webqq__quote-title')
  })

  it('renders playable WebQQ record messages with voice transcription controls', () => {
    const clientElementSource = sourceBetween(
      webqqTypes,
      'export interface WebQQMessageElement {',
      'export interface WebQQMessageReaction {',
    )
    const backendElementSource = sourceBetween(
      serverWebqqTypesSource,
      'export interface WebQQMessageElement {',
      'export interface WebQQMessageReaction {',
    )
    const missingRequirements = [
      backendElementSource.includes('duration?: number') && clientElementSource.includes('duration?: number')
        ? ''
        : 'WebQQMessageElement 缺少语音时长字段',
      backendElementSource.includes('transcript?: string') && clientElementSource.includes('transcript?: string')
        ? ''
        : 'WebQQMessageElement 缺少语音转文字字段',
      webqqApi.includes("send('onebot-webqq/webqq/record/transcribe'")
        ? ''
        : '前端 API 缺少语音转文字请求',
      webqqView.includes(':transcribe-record="requestWebQQRecordTranscription"')
        ? ''
        : 'WebQQObserver 没有把语音转文字 API 传给消息列表',
      webqqMessageListView.includes("run.element.type === 'record'")
        ? ''
        : '消息列表没有渲染 record 语音元素',
      webqqMessageListView.includes('class="onebot-webqq-webqq__record"')
        ? ''
        : '语音元素缺少独立样式容器',
      webqqMessageListView.includes('class="onebot-webqq-webqq__record-audio"') &&
        webqqMessageListView.includes(':ref="(element) => setRecordAudioRef(message, run.element, runIndex, element)"')
        ? ''
        : '语音元素没有挂载隐藏 audio 播放源',
      webqqMessageListView.includes('onebot-webqq-webqq__record-player') &&
        webqqMessageListView.includes('toggleRecordPlayback(message, run.element, runIndex)') &&
        webqqMessageListView.includes('class="onebot-webqq-webqq__record-wave"') &&
        webqqMessageListView.includes('viewBox="0 0 60 18"') &&
        webqqMessageListView.includes('Math.min(220, Math.max(128, 128 + duration * 3))') &&
        !webqqMessageListView.includes('isRecordOnlyMessage') &&
        !webqqMessageListView.includes('onebot-webqq-webqq__record-divider')
        ? ''
        : '语音元素没有使用跟随普通气泡样式的自定义播放条',
      webqqMessageListView.includes('controls')
        ? '语音元素不能继续显示浏览器原生 audio controls'
        : '',
      webqqMessageListView.includes('<svg v-else class="onebot-webqq-webqq__record-transcribe-icon"') &&
        webqqMessageListView.includes('M5 5.5h14a2.5 2.5 0 0 1 2.5 2.5v6') &&
        webqqMessageListView.includes('M7.5 9.5h9') &&
        !webqqMessageListView.includes('<span v-else>文</span>')
        ? ''
        : '语音转文字按钮必须使用 SVG 图标',
      webqqMessageListView.includes('transcribeRecordMessage(message, run.element, runIndex)')
        ? ''
        : '语音元素没有触发转文字函数',
      webqqMessageListView.includes('getRecordTranscript(message, run.element, runIndex)')
        ? ''
        : '语音元素没有显示已有或新转换的文字',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('lets clickable WebQQ quote blocks scroll to the original message in the current list', () => {
    const missingRequirements = [
      webqqTypes.includes('targetMessageId?: string')
        ? ''
        : 'WebQQMessageElement 缺少引用目标消息 ID 字段',
      webqqMessageListView.includes(':ref="(element) => setMessageElementRef(message, element)"')
        ? ''
        : '消息行没有注册 DOM 引用，引用点击后无法定位原消息',
      webqqMessageListView.includes("run.element.type === 'quote' && run.element.targetMessageId")
        ? ''
        : '带 targetMessageId 的 quote 没有渲染为可点击控件',
      webqqMessageListView.includes('scrollToQuotedMessage(run.element.targetMessageId)')
        ? ''
        : '引用块点击没有调用跳转函数',
      webqqMessageListView.includes('function scrollToQuotedMessage(targetMessageId: string)')
        ? ''
        : '缺少按引用目标 ID 跳转的函数',
      webqqMessageListView.includes('message.id === targetMessageId || message.sequence === targetMessageId')
        ? ''
        : '跳转函数没有同时匹配消息 ID 和 sequence',
      webqqMessageListView.includes("scrollIntoView({ block: 'center', behavior: 'smooth' })")
        ? ''
        : '跳转函数没有把原消息平滑滚动到视图中间',
      webqqMessageListView.includes('highlightedMessageKey.value = getMessageDomKey(target)')
        ? ''
        : '跳转后没有记录高亮目标消息',
      webqqMessageListView.includes("'is-quote-target': isHighlightedMessage(message)")
        ? ''
        : '消息行没有绑定引用目标高亮 class',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('renders forward message elements as block previews inside WebQQ bubbles', () => {
    const backendForwardItemSource = sourceBetween(
      serverWebqqTypesSource,
      'export interface WebQQForwardItem {',
      'export interface WebQQMessageElement {',
    )
    const clientForwardItemSource = sourceBetween(
      webqqTypes,
      'export interface WebQQForwardItem {',
      'export interface WebQQMessageElement {',
    )
    const backendMessageSource = sourceBetween(
      serverWebqqTypesSource,
      'export interface WebQQMessageElement {',
      'export interface WebQQMessage {',
    )
    const clientMessageSource = sourceBetween(
      webqqTypes,
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
    expect(webqqMessageListView).toContain("run.element.type === 'forward'")
    expect(webqqMessageListView).toContain('onebot-webqq-webqq__forward')
    expect(webqqMessageListView).toContain("run.element.title || '合并转发'")
    expect(webqqMessageListView).toContain("run.element.text || '[合并转发]'")
    expect(webqqMessageView).toContain("element.type !== 'forward'")
  })

  it('limits WebQQ forward bubble previews to the first four items and shows a total entry', () => {
    const forwardBubbleSource = sourceBetween(
      webqqMessageListView,
      'v-else-if="run.element.type === \'forward\'"',
      '</button>',
    )
    const hasFixedPreviewLimit = /(?:const\s+[\w_]*forward[\w_]*preview[\w_]*(?:limit|count|items)[\w_]*\s*=\s*4|\.slice\(0,\s*4\)|\.slice\(0,\s*[\w_]*forward[\w_]*preview[\w_]*(?:limit|count|items)[\w_]*\))/i.test(`${webqqMessageListView}\n${webqqForwardDialogStore}`)
    const hasPreviewItemsLoop = /v-for="[^"]*(?:run\.element\.items|forward[\w_]*preview|get[\w_]*forward[\w_]*preview)[^"]*"/is.test(forwardBubbleSource)
    const hasPreviewItemSummary = /(?:item\.elements|(?:get|format)[\w_]*forward[\w_]*(?:summary|previewtext|previewText)[\w_]*\(item\))/i.test(forwardBubbleSource)
    const hasTotalEntryInBubble = /(?:查看[\s\S]{0,120}条转发消息|(?:get|format)[\w_]*forward[\w_]*(?:count|total|entry)[\w_]*\(run\.element\))/i.test(forwardBubbleSource)
    const hasTotalEntryText = /查看[\s\S]{0,160}(?:items(?:\?\.|\.)length|run\.element\.items(?:\?\.|\.)length)[\s\S]{0,160}条转发消息/i.test(webqqMessageListView)
    const missingRequirements = [
      hasFixedPreviewLimit ? '' : 'forward preview uses a fixed limit of 4',
      hasPreviewItemsLoop ? '' : 'forward bubble renders a preview loop from run.element.items',
      hasPreviewItemSummary ? '' : 'forward preview summary is derived from item.elements',
      hasTotalEntryInBubble && hasTotalEntryText ? '' : 'forward bubble shows 查看${items.length}条转发消息 total entry',
      forwardBubbleSource.includes("@click.stop=\"emit('open-forward', run.element)\"") ? '' : 'forward total entry keeps emitting open-forward with run.element',
      forwardBubbleSource.includes("run.element.text || '[合并转发]'") ? '' : 'forward elements without items keep the existing [合并转发] fallback',
      /webQQ.*Forward.*Preview/i.test(webqqTypes) ? 'forward preview must not add a client state config option' : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('renders card message elements as block previews inside WebQQ bubbles', () => {
    const backendMessageSource = sourceBetween(
      serverWebqqTypesSource,
      'export interface WebQQMessageElement {',
      'export interface WebQQMessage {',
    )
    const clientMessageSource = sourceBetween(
      webqqTypes,
      'export interface WebQQMessageElement {',
      'export interface WebQQMessage {',
    )

    expect(backendMessageSource).toContain("'card'")
    expect(clientMessageSource).toContain("'card'")
    expect(backendMessageSource).toContain('imageUrl?:')
    expect(clientMessageSource).toContain('imageUrl?:')
    expect(backendMessageSource).toContain('source?:')
    expect(clientMessageSource).toContain('source?:')
    expect(webqqMessageListView).toContain("run.element.type === 'card'")
    expect(webqqMessageListView).toContain('onebot-webqq-webqq__card')
    expect(webqqMessageView).toContain("element.type !== 'card'")
    expect(webqqMessageListView).not.toContain(`:is="run.element.url ? 'a' : 'div'"`)
    expect(webqqMessageListView).not.toContain(':href="run.element.url || undefined"')
    expect(webqqMessageListView).not.toContain(':target=')
    expect(webqqMessageListView).not.toContain(':rel=')
  })

  it('opens forward message elements in an LLBot-style modal using the current WebQQ message style', () => {
    expect(webqqView).toContain("from './stores/webqq-forward-dialog'")
    expect(webqqForwardDialogStore).toContain('const forwardDialog = ref<WebQQMessageElement>()')
    expect(webqqForwardDialogStore).toContain('const forwardDialogItems = computed(() => forwardDialog.value?.items ?? [])')
    expect(webqqView).toContain('function openForwardDialog(element: WebQQMessageElement)')
    expect(webqqView).toContain('openWebQQForwardDialog(element)')
    expect(webqqForwardDialogStore).toContain('function closeForwardDialog()')
    expect(webqqMessageListView).toContain("@click.stop=\"emit('open-forward', run.element)\"")
    expect(webqqMessageListView).toContain(':disabled="!run.element.items?.length"')
    expect(webqqView).toContain('<WebQQForwardModal')
    expect(webqqView).toContain('v-if="forwardDialog"')
    expect(webqqView).toContain(':dialog="forwardDialog"')
    expect(webqqView).toContain(':items="forwardDialogItems"')
    expect(webqqView).toContain('@close="closeForwardDialog"')
    expect(webqqView).toContain('@open-forward="openForwardDialog"')
    expect(webqqView).toContain('@open-image="openImagePreview"')
    expect(webqqView).toContain('@image-load="handleMessageImageLoad"')
    expect(webqqForwardModal).toContain('class="onebot-webqq-webqq__forward-modal-backdrop"')
    expect(webqqForwardModal).toContain('class="onebot-webqq-webqq__forward-modal"')
    expect(webqqForwardModal).toContain("emit('close')")
    expect(webqqForwardModal).toContain("{{ dialog.title || '合并转发' }}")
    expect(webqqForwardModal).toContain('v-for="(item, itemIndex) in items"')
    expect(webqqForwardModal).toContain(':class="[\'onebot-webqq-webqq__message\', \'is-incoming\', getForwardItemClusterClass(itemIndex), { \'is-merged\': isMergedForwardItem(itemIndex) }]"')
    expect(webqqForwardModal).toContain('class="onebot-webqq-webqq__message-avatar-wrap"')
    expect(webqqForwardModal).toContain('class="onebot-webqq-webqq__message-avatar"')
    expect(webqqForwardModal).toContain(':src="withProxy(getForwardItemAvatar(item))"')
    expect(webqqForwardModal).toContain(':alt="getForwardItemName(item)"')
    expect(webqqForwardModal).toContain('class="onebot-webqq-webqq__message-content"')
    expect(webqqForwardModal).toContain('class="onebot-webqq-webqq__message-body"')
    expect(webqqForwardModal).toContain('class="onebot-webqq-webqq__bubble"')
    expect(webqqForwardModal).toContain('getWebQQElementRuns(item.elements)')
    expect(webqqForwardModal).toContain("emit('open-forward', run.element)")
    expect(webqqForwardModal).toContain("emit('open-image', run.element.url)")
    expect(webqqForwardModal).toContain("emit('image-load')")
    expect(webqqMessageView).toContain('function getForwardItemName(item: WebQQForwardItem)')
    expect(webqqMessageView).toContain('function getForwardItemAvatar(item: WebQQForwardItem, defaultAvatar: string)')
    expect(webqqForwardDialogStore).toContain('function isMergedForwardItem(index: number)')
    expect(webqqForwardDialogStore).toContain('isMergedForwardItemFromView(forwardDialogItems.value, index, chatStyle.value)')
    expect(webqqForwardDialogStore).toContain('function getForwardItemClusterClass(index: number)')
    expect(webqqForwardDialogStore).toContain('getForwardItemClusterClassFromView(forwardDialogItems.value, index, chatStyle.value)')
    expect(`${webqqView}\n${webqqForwardModal}`).not.toContain('onebot-webqq-webqq__forward-popover')
    expect(`${webqqView}\n${webqqForwardModal}`).not.toContain('onebot-webqq-webqq__forward-page')
  })

  it('keeps forward modal state and style-aware grouping in a focused store', () => {
    const chatStyle = ref('telegram')
    const store = useWebQQForwardDialog(chatStyle)
    const forwardElement: WebQQMessageElement = {
      type: 'forward',
      items: [
        { title: 'Alice', senderId: '10001', elements: [{ type: 'text', text: 'one' }] },
        { title: 'Alice', senderId: '10001', elements: [{ type: 'text', text: 'two' }] },
        { title: 'Bob', senderId: '10002', elements: [{ type: 'text', text: 'three' }] },
        { title: 'Carol', senderId: '10003', elements: [{ type: 'text', text: 'four' }] },
        { title: 'Dave', senderId: '10004', elements: [{ type: 'text', text: 'five' }] },
      ],
    }

    expect(store.openForwardDialog({ type: 'forward' })).toBe(false)
    expect(store.forwardDialog.value).toBeUndefined()
    expect(store.openForwardDialog(forwardElement)).toBe(true)
    expect(store.forwardDialogItems.value).toHaveLength(5)
    expect(store.getForwardPreviewItems(forwardElement)).toHaveLength(4)
    expect(store.getForwardItemAvatar(store.forwardDialogItems.value[0])).toContain('nk=0')
    expect(store.isMergedForwardItem(1)).toBe(true)
    expect(store.getForwardItemClusterClass(0)).toBe('is-cluster-first')
    chatStyle.value = 'default'
    expect(store.isMergedForwardItem(1)).toBe(false)
    expect(store.getForwardItemClusterClass(0)).toBe('')
    store.closeForwardDialog()
    expect(store.forwardDialog.value).toBeUndefined()
  })

  it('loads earlier WebQQ messages when scrolling to the top', () => {
    expect(webqqView).toContain('useWebQQMessageHistory({')
    expect(webqqView).toContain('shouldLoadOlderMessages: () => messageHistory.shouldLoadOlderMessages()')
    expect(webqqMessageHistoryStore).toContain('const historyLoading = ref(false)')
    expect(webqqMessageHistoryStore).toContain('const historyExhausted = ref(false)')
    expect(webqqMessageHistoryStore).toContain('function shouldLoadOlderMessages()')
    expect(webqqMessageHistoryStore).toContain('async function loadOlderMessages()')
    expect(webqqMessageHistoryStore).toContain('beforeSequence: options.messages.value[0]?.sequence')
  })

  it('keeps tabs at the top without the WebQQ profile block', () => {
    expect(webqqView).not.toContain('onebot-webqq-webqq__profile')
    expect(webqqView).not.toContain('onebot-webqq-webqq__profile-avatar')

    const sidebarIndex = webqqView.indexOf('class="onebot-webqq-webqq__sidebar"')
    const tabsIndex = webqqSidebar.indexOf('class="onebot-webqq-webqq__tabs-row"')
    const listIndex = webqqSidebar.indexOf('<WebQQContactList')

    expect(webqqView).toContain('<WebQQSidebar')
    expect(webqqSidebar).toContain('class="onebot-webqq-webqq__sidebar"')
    expect(sidebarIndex).toBe(-1)
    expect(tabsIndex).toBeGreaterThan(webqqSidebar.indexOf('class="onebot-webqq-webqq__sidebar"'))
    expect(tabsIndex).toBeLessThan(listIndex)
  })
})
