import { send } from '@koishijs/client'
import type { WebQQMessage, WebQQStorageBackend } from '../state'
import { loadBrowserWebQQMessages, saveBrowserWebQQMessages } from '../webqq-message-cache'
import type { ConversationSummary, WebQQStoredState } from './webqq-state'

const webQQStorageKey = 'onebot-webqq:webqq:v1'

function readStoredConversationSummaries(value: unknown) {
  const summaries: Record<string, ConversationSummary> = {}
  if (!value || typeof value !== 'object') return summaries
  for (const [key, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object') continue
    const summary = Reflect.get(raw, 'summary')
    const time = Reflect.get(raw, 'time')
    if (typeof summary === 'string' && typeof time === 'number') summaries[key] = { summary, time }
  }
  return summaries
}

function readStoredUnreadCounts(value: unknown) {
  const counts: Record<string, number> = {}
  if (!value || typeof value !== 'object') return counts
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number' && count > 0) counts[key] = count
  }
  return counts
}

function createEmptyWebQQStoredState(): WebQQStoredState {
  return {
    conversationSummaries: {},
    conversationUnreadCounts: {},
  }
}

function normalizeWebQQStoredState(value: unknown): WebQQStoredState {
  if (!value || typeof value !== 'object') return createEmptyWebQQStoredState()
  return {
    conversationSummaries: readStoredConversationSummaries(Reflect.get(value, 'conversationSummaries')),
    conversationUnreadCounts: readStoredUnreadCounts(Reflect.get(value, 'conversationUnreadCounts')),
  }
}

export function loadBrowserWebQQStoredState(storageBackend: WebQQStorageBackend): WebQQStoredState {
  const empty = createEmptyWebQQStoredState()
  if (storageBackend !== 'browser') return empty
  if (typeof localStorage === 'undefined') return empty
  try {
    const raw = localStorage.getItem(webQQStorageKey)
    if (!raw) return empty
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return empty
    return normalizeWebQQStoredState(data)
  } catch {
    return empty
  }
}

export function persistWebQQStoredState(storageBackend: WebQQStorageBackend, state: WebQQStoredState) {
  if (storageBackend !== 'browser') {
    send('onebot-webqq/webqq/storage/save', state).catch(() => {})
    return
  }
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(webQQStorageKey, JSON.stringify(state))
  } catch {}
}

export async function loadRemoteWebQQStoredState(storageBackend: WebQQStorageBackend) {
  if (storageBackend === 'browser') return
  try {
    return normalizeWebQQStoredState(await send('onebot-webqq/webqq/storage/load'))
  } catch {
    return
  }
}

function normalizeCachedWebQQMessages(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((message) => message && typeof message === 'object') as WebQQMessage[]
}

export async function loadCachedWebQQMessages(type: 'friend' | 'group', peerId: string, storageBackend: WebQQStorageBackend) {
  if (storageBackend === 'koishi') {
    try {
      return normalizeCachedWebQQMessages(await send('onebot-webqq/webqq/messages/cache/load', { type, peerId }))
    } catch {
      return []
    }
  }
  return loadBrowserWebQQMessages(type, peerId)
}

export async function saveCachedWebQQMessages(type: 'friend' | 'group', peerId: string, messages: WebQQMessage[], storageBackend: WebQQStorageBackend, messageCacheLimit: number) {
  const cachedMessages = messages.slice(-messageCacheLimit)
  if (storageBackend === 'koishi') {
    await send('onebot-webqq/webqq/messages/cache/save', { type, peerId, messages: cachedMessages }).catch(() => {})
    return
  }
  await saveBrowserWebQQMessages(type, peerId, cachedMessages, messageCacheLimit)
}
