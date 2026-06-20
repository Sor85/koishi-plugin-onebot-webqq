import { ref } from 'vue'
import type { WebQQMessage } from '../types'
import { getMessageKey } from '../utils/webqq-message-view'

export function useWebQQThinkingExpansion() {
  const expandedThinkingMessageIds = ref(new Set<string>())

  function isThinkingExpanded(message: WebQQMessage) {
    return expandedThinkingMessageIds.value.has(getMessageKey(message))
  }

  function toggleThinking(message: WebQQMessage) {
    const key = getMessageKey(message)
    const next = new Set(expandedThinkingMessageIds.value)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    expandedThinkingMessageIds.value = next
  }

  return {
    expandedThinkingMessageIds,
    isThinkingExpanded,
    toggleThinking,
  }
}
