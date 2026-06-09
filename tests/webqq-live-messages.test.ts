import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebQQLiveMessage, WebQQMessage } from '../client/state'
import type { WebQQChatSelection } from '../client/utils/webqq-contact-view'

const receiveState = vi.hoisted((): { listeners: Record<string, (payload: unknown) => void>; disposed: string[] } => ({ listeners: {}, disposed: [] }))

vi.mock('@koishijs/client', () => ({
  receive: vi.fn((event: string, listener: (payload: unknown) => void) => {
    receiveState.listeners[event] = listener
    return () => {
      if (receiveState.listeners[event] === listener) delete receiveState.listeners[event]
      receiveState.disposed.push(event)
    }
  }),
}))

const { useWebQQLiveMessages } = await import('../client/stores/webqq-live-messages')

function createWebQQMessage(message: Partial<WebQQMessage> = {}): WebQQMessage {
  return {
    id: 'message-1',
    sequence: 'message-1',
    time: 1710000000000,
    senderId: '10000',
    senderName: 'Bot',
    senderAvatar: '',
    direction: 'incoming',
    summary: 'hello',
    elements: [{ type: 'text', text: 'hello' }],
    ...message,
  }
}

function createLivePayload(message: WebQQMessage): WebQQLiveMessage {
  return {
    type: 'group',
    peerId: '20000',
    message,
  }
}

async function flushPromises() {
  for (let index = 0; index < 8; index++) await Promise.resolve()
}

describe('webqq live message store', () => {
  beforeEach(() => {
    receiveState.listeners = {}
    receiveState.disposed = []
  })

  it('serializes non-current chat cache writes without dropping live messages', async () => {
    let storedMessages: WebQQMessage[] = []
    const saveCachedMessages = vi.fn(async (_type: WebQQLiveMessage['type'], _peerId: string, messages: WebQQMessage[]) => {
      await Promise.resolve()
      storedMessages = messages.slice()
    })
    useWebQQLiveMessages({
      isVisible: () => true,
      currentChat: ref<WebQQChatSelection | undefined>(undefined),
      trackingMessages: ref(true),
      messages: ref<WebQQMessage[]>([]),
      rememberMessageSenderMetadata: () => {},
      updateConversationSummary: () => {},
      increaseUnreadCount: () => {},
      appendMessage: () => {},
      loadCachedMessages: async () => storedMessages.slice(),
      saveCachedMessages,
    })
    const messageListener = receiveState.listeners['onebot-webqq/webqq/message']
    if (!messageListener) throw new Error('message listener not registered')

    messageListener(createLivePayload(createWebQQMessage({ id: 'first', sequence: 'first', time: 1, summary: 'first' })))
    messageListener(createLivePayload(createWebQQMessage({ id: 'second', sequence: 'second', time: 2, summary: 'second' })))
    await flushPromises()

    expect(saveCachedMessages).toHaveBeenCalledTimes(2)
    expect(storedMessages.map((message) => message.id)).toEqual(['first', 'second'])
  })

  it('returns a cleanup function for WebQQ live receive listeners', () => {
    const dispose = useWebQQLiveMessages({
      isVisible: () => true,
      currentChat: ref<WebQQChatSelection | undefined>(undefined),
      trackingMessages: ref(true),
      messages: ref<WebQQMessage[]>([]),
      rememberMessageSenderMetadata: () => {},
      updateConversationSummary: () => {},
      increaseUnreadCount: () => {},
      appendMessage: () => {},
      loadCachedMessages: async () => [],
      saveCachedMessages: async () => {},
    })

    expect(receiveState.listeners['onebot-webqq/webqq/message']).toBeDefined()
    expect(receiveState.listeners['onebot-webqq/webqq/recall']).toBeDefined()

    dispose()

    expect(receiveState.disposed).toEqual([
      'onebot-webqq/webqq/message',
      'onebot-webqq/webqq/recall',
    ])
    expect(receiveState.listeners['onebot-webqq/webqq/message']).toBeUndefined()
    expect(receiveState.listeners['onebot-webqq/webqq/recall']).toBeUndefined()
  })
})
