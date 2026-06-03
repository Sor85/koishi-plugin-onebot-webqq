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

  it('uses the configured WebQQ theme without rendering an in-panel theme selector', () => {
    expect(webqqView).toContain("import { sortWebQQGroupMembers, webQQTheme } from './state'")
    expect(webqqView).toContain(":class=\"['chat-capsule-webqq', `is-theme-${webQQTheme}`]\"")
    expect(webqqView).not.toContain('class="chat-capsule-webqq__theme"')
    expect(webqqView).not.toContain('aria-label="WebQQ 主题"')
    expect(webqqView).not.toContain('v-model="webQQTheme"')
    expect(webqqView).not.toContain('webQQThemeOptions')
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
    expect(webqqView).toContain('v-for="message in messages"')
    expect(webqqView).not.toContain('textarea')
    expect(webqqView).not.toContain("send('chat-capsule/webqq/send'")
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
