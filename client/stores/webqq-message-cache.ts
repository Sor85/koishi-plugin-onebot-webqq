import type { Ref } from 'vue'
import type { WebQQMessage, WebQQStorageBackend } from '../state'
import {
  loadCachedWebQQMessages as loadStoredWebQQMessages,
  saveCachedWebQQMessages as saveStoredWebQQMessages,
} from './webqq-storage'

export function useWebQQMessageCache(storageBackend: Readonly<Ref<WebQQStorageBackend>>) {
  async function loadCachedWebQQMessages(type: 'friend' | 'group', peerId: string) {
    return loadStoredWebQQMessages(type, peerId, storageBackend.value)
  }

  async function saveCachedWebQQMessages(type: 'friend' | 'group', peerId: string, messages: WebQQMessage[]) {
    await saveStoredWebQQMessages(type, peerId, messages, storageBackend.value)
  }

  return {
    loadCachedWebQQMessages,
    saveCachedWebQQMessages,
  }
}
