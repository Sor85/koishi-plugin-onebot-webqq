import { nextTick, ref } from 'vue'

export function useWebQQMessageScroll(options: {
  clearCurrentUnreadCount: () => void
  shouldLoadOlderMessages: () => boolean
  loadOlderMessages: () => void
}) {
  const messagePane = ref<HTMLElement>()
  const trackingMessages = ref(true)
  const returningMessagesToBottom = ref(false)

  function isMessagePaneAtBottom() {
    const pane = messagePane.value
    if (!pane) return true
    return pane.scrollHeight - pane.scrollTop - pane.clientHeight <= 8
  }

  function updateMessageTracking() {
    const atBottom = isMessagePaneAtBottom()
    if (returningMessagesToBottom.value) {
      trackingMessages.value = true
      if (atBottom) returningMessagesToBottom.value = false
      if (atBottom) options.clearCurrentUnreadCount()
      return
    }
    trackingMessages.value = atBottom
    if (trackingMessages.value) options.clearCurrentUnreadCount()
    if (options.shouldLoadOlderMessages()) options.loadOlderMessages()
  }

  async function scrollMessagesToBottom(behavior: ScrollBehavior = 'auto') {
    await nextTick()
    const pane = messagePane.value
    if (!pane) return
    pane.scrollTo({
      top: pane.scrollHeight,
      behavior,
    })
  }

  function handleMessageImageLoad() {
    if (trackingMessages.value) scrollMessagesToBottom()
  }

  function returnMessagesToBottom() {
    returningMessagesToBottom.value = true
    trackingMessages.value = true
    scrollMessagesToBottom('smooth')
  }

  return {
    messagePane,
    trackingMessages,
    returningMessagesToBottom,
    isMessagePaneAtBottom,
    updateMessageTracking,
    handleMessageImageLoad,
    scrollMessagesToBottom,
    returnMessagesToBottom,
  }
}
