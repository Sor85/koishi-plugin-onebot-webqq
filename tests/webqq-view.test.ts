import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/Capsule.vue', import.meta.url), 'utf8')
const webqqView = await readFile(new URL('../client/WebQQObserver.vue', import.meta.url), 'utf8')

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
    expect(webqqView).toContain("activeTab = 'friends'")
    expect(webqqView).toContain("activeTab = 'groups'")
    expect(webqqView).toContain('v-for="message in messages"')
    expect(webqqView).not.toContain('textarea')
    expect(webqqView).not.toContain("send('chat-capsule/webqq/send'")
  })

  it('renders sender avatars for WebQQ messages', () => {
    expect(webqqView).toContain('class="chat-capsule-webqq__message-avatar"')
    expect(webqqView).toContain(':src="withProxy(message.senderAvatar)"')
    expect(webqqView).toContain(':alt="message.senderName"')
  })

  it('shows group avatar, group id, and member count in the chat header', () => {
    expect(webqqView).toContain('class="chat-capsule-webqq__chat-avatar"')
    expect(webqqView).toContain(':src="withProxy(currentAvatar)"')
    expect(webqqView).toContain('function getGroupSubtitle')
    expect(webqqView).toContain('currentSubtitle = computed')
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
