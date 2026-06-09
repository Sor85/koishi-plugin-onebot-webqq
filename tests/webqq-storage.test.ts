import { describe, expect, it, vi } from 'vitest'
import type { Config } from '../src/config'
import { loadKoishiWebQQMessageCache } from '../src/webqq/storage'

describe('webqq koishi storage', () => {
  it('filters cached messages that do not satisfy WebQQMessage fields', async () => {
    const validMessage = {
      id: 'message-1',
      sequence: 'message-1',
      time: 1,
      senderId: '10000',
      senderName: 'Bot',
      senderAvatar: '',
      direction: 'incoming',
      summary: 'hello',
      elements: [{ type: 'text', text: 'hello' }],
    }
    const database = {
      get: vi.fn(async () => [{
        payload: {
          messages: [
            validMessage,
            { id: 'missing-fields', elements: [] },
            [],
          ],
        },
      }]),
      upsert: vi.fn(),
    }
    const config: Config = { webQQStorageBackend: 'koishi' }

    await expect(loadKoishiWebQQMessageCache({ database }, config, {
      type: 'group',
      peerId: '20000',
    })).resolves.toEqual([validMessage])
  })
})
