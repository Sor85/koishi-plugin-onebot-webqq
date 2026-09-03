import { describe, expect, it, vi } from 'vitest'
import type { Session } from 'koishi'
import type { Config as PluginConfig } from '../src/config'
import type { DatabaseService } from '../src/plugin-context'
import type { WebQQService } from '../src/webqq/adapters/types'
import type { WebQQLiveMessage, WebQQRecallPayload } from '../src/webqq/types'
import { createWebQQLiveRuntime } from '../src/webqq/message-flow/live-runtime'
import { createFakeContext, emitAll } from './helpers/koishi-context'

// 实时消息落地的接缝就是它自己的 options 对象：九项依赖本来就全是注入的，本文件只是第一次用它。
// 断言一律读外部行为——广播出去的载荷、缓存里的内容、附加到消息上的字段，不读源码文本。

const liveMessageEvent = 'onebot-webqq/webqq/message'
const recallEvent = 'onebot-webqq/webqq/recall'
const selfId = '10000'

type FakeBroadcast = ReturnType<typeof createFakeContext>['broadcast']

function createFakeWebQQService(overrides: Record<string, unknown> = {}) {
  return {
    isSelectedSelfId: vi.fn((_selfId?: string) => true),
    resolveImage: vi.fn(async (file: string) => ({ url: file })),
    resolveRecord: vi.fn(async (file: string) => ({ url: file })),
    resolveQuote: vi.fn(async () => undefined),
    resolveForward: vi.fn(async () => undefined),
    resolveMessage: vi.fn(async (_id: string) => undefined),
    ...overrides,
  } as unknown as WebQQService
}

function createLiveRuntime(options: {
  config?: PluginConfig
  database?: DatabaseService
  isSelectedSelfId?: (selfId?: string) => boolean
  thinkingDurationMs?: number
  storageScope?: string
} = {}) {
  const webqq = createFakeWebQQService({
    ...(options.isSelectedSelfId ? { isSelectedSelfId: vi.fn(options.isSelectedSelfId) } : {}),
  })
  const { ctx, listeners, broadcast } = createFakeContext({
    ...(options.database ? { database: options.database } : {}),
  })
  const runtime = createWebQQLiveRuntime({
    ctx,
    config: options.config ?? {},
    webqq,
    botScope: {},
    imageUrlResolver: (file: string) => file,
    consoleAuthOptions: { authority: 1 },
    getThinkingDurationMs: () => options.thinkingDurationMs ?? 0,
    getStorageScope: () => options.storageScope,
  })
  return { runtime, ctx, listeners, broadcast, webqq }
}

/**
 * 两种事件共用的群会话骨架。
 *
 * 刻意不给 `bot.internal`：给了之后落地的最后一步会去拉群成员元数据并可能再广播一次，
 * 那是另一条行为，混进来会让每条断言都要先筛掉一次额外广播。
 */
function createGroupSessionBase(options: { peerId: string; timestamp: number; hidden?: boolean }) {
  return {
    platform: 'onebot',
    selfId,
    guildId: options.peerId,
    channelId: options.peerId,
    timestamp: options.timestamp,
    bot: {
      platform: 'onebot',
      selfId,
      status: 1,
      ...(options.hidden ? { hidden: true } : {}),
      toJSON: () => ({ user: { name: 'Capsule Bot', avatar: '' } }),
    },
    event: {
      platform: 'onebot',
      timestamp: options.timestamp,
      guild: { id: options.peerId, name: 'Guild Name' },
      channel: { id: options.peerId, name: 'Guild Name' },
    },
  }
}

/** 群消息 session 替身。`userId` 等于机器人 selfId 时落地方向是 outgoing。 */
function createLiveSession(overrides: {
  peerId?: string
  messageId?: string
  userId?: string
  content?: string
  timestamp?: number
  hidden?: boolean
} = {}) {
  const peerId = overrides.peerId ?? '20000'
  const userId = overrides.userId ?? '30000'
  const timestamp = overrides.timestamp ?? 1710000000000
  const senderName = userId === selfId ? 'Capsule Bot' : 'Alice'
  const base = createGroupSessionBase({ peerId, timestamp, ...(overrides.hidden ? { hidden: true } : {}) })
  return {
    ...base,
    userId,
    username: senderName,
    content: overrides.content ?? 'hello',
    ...(overrides.messageId ? { messageId: overrides.messageId } : {}),
    event: {
      ...base.event,
      user: { id: userId, name: senderName },
      ...(overrides.messageId ? { message: { id: overrides.messageId } } : {}),
    },
  } as unknown as Session
}

/** 撤回事件与普通消息事件的形状不同：没有正文，撤回目标在 `_data.message_id`。 */
function createRecallSession(overrides: { peerId?: string; messageId: string; timestamp?: number }) {
  const peerId = overrides.peerId ?? '20000'
  const timestamp = overrides.timestamp ?? 1710000009000
  const base = createGroupSessionBase({ peerId, timestamp })
  return {
    ...base,
    userId: '30000',
    event: {
      ...base.event,
      operator: { id: '30000', name: 'Alice' },
      _data: { message_id: overrides.messageId },
    },
  } as unknown as Session
}

function readLiveBroadcasts(broadcast: FakeBroadcast) {
  return broadcast.mock.calls
    .filter(([event]) => event === liveMessageEvent)
    .map(([, body]) => body as unknown as WebQQLiveMessage)
}

function readLiveMessages(broadcast: FakeBroadcast) {
  return readLiveBroadcasts(broadcast).map((payload) => payload.message)
}

function createModelUsage(source: string, conversationId?: string) {
  return {
    source,
    ...(conversationId ? { context: { conversationId } } : {}),
    usageMetadata: { input_tokens: 120, output_tokens: 34 },
    timing: { totalMs: 1500 },
  }
}

describe('WebQQ 实时消息落地', () => {
  it('非选中 Bot 的会话不被记录', async () => {
    const { runtime, broadcast } = createLiveRuntime({ isSelectedSelfId: () => false })

    await runtime.recordWebQQLiveMessage(createLiveSession())

    expect(readLiveBroadcasts(broadcast)).toEqual([])
    expect(runtime.liveMessages.size).toBe(0)
  })

  it('实时消息按会话键进入缓存', async () => {
    const { runtime, broadcast } = createLiveRuntime()

    await runtime.recordWebQQLiveMessage(createLiveSession({ peerId: '20000', messageId: 'msg-1' }))
    await runtime.recordWebQQLiveMessage(createLiveSession({ peerId: '20001', messageId: 'msg-2', timestamp: 1710000001000 }))

    expect([...runtime.liveMessages.keys()]).toEqual(['group:20000', 'group:20001'])
    expect(runtime.liveMessages.get('group:20000')).toEqual([expect.objectContaining({ id: 'msg-1', summary: 'hello' })])
    expect(readLiveBroadcasts(broadcast).map((payload) => [payload.type, payload.peerId, payload.message.id]))
      .toEqual([['group', '20000', 'msg-1'], ['group', '20001', 'msg-2']])
  })

  it('缓存容量超限时最旧的会话被淘汰', async () => {
    const { runtime } = createLiveRuntime()
    // 上限是 100 个会话。这是全链路唯一会静默丢数据的分支：越界时既不报错也不广播，
    // 只是某个会话的实时缓存突然空了，所以必须有人钉住「淘汰的是最旧那个、当前那个还在」。
    for (let index = 0; index < 101; index++) {
      await runtime.recordWebQQLiveMessage(createLiveSession({
        peerId: `2${String(index).padStart(4, '0')}`,
        messageId: `msg-${index}`,
        timestamp: 1710000000000 + index * 1000,
      }))
    }

    expect(runtime.liveMessages.size).toBe(100)
    expect(runtime.liveMessages.has('group:20000')).toBe(false)
    expect(runtime.liveMessages.has('group:20001')).toBe(true)
    expect(runtime.liveMessages.has('group:20100')).toBe(true)
  })

  it('用量事件记下后，下一条外发消息带上它', async () => {
    const { runtime, listeners, broadcast } = createLiveRuntime()
    const session = createLiveSession({ userId: selfId, messageId: 'out-1' })

    await emitAll(listeners['chatluna/before-chat'], 'conversation-1', { content: '你好' }, {}, {}, session)
    await emitAll(listeners['chatluna/model-usage'], createModelUsage('chatluna', 'conversation-1'))
    await runtime.recordWebQQLiveMessage(session)

    expect(readLiveMessages(broadcast)).toEqual([
      expect.objectContaining({
        id: 'out-1',
        direction: 'outgoing',
        usage: { inputTokens: 120, outputTokens: 34, totalMs: 1500 },
      }),
    ])
  })

  it('用量取用后不再重复附加到第二条消息', async () => {
    const { runtime, listeners, broadcast } = createLiveRuntime()

    await emitAll(listeners['chatluna/before-chat'], 'conversation-1', { content: '你好' }, {}, {}, createLiveSession({ userId: selfId }))
    await emitAll(listeners['chatluna/model-usage'], createModelUsage('chatluna', 'conversation-1'))
    await runtime.recordWebQQLiveMessage(createLiveSession({ userId: selfId, messageId: 'out-1' }))
    await runtime.recordWebQQLiveMessage(createLiveSession({ userId: selfId, messageId: 'out-2', timestamp: 1710000001000 }))

    const [first, second] = readLiveMessages(broadcast)
    expect(first).toMatchObject({ id: 'out-1', usage: { inputTokens: 120, outputTokens: 34 } })
    expect(second?.id).toBe('out-2')
    expect(second?.usage).toBeUndefined()
  })

  it('用量不满足展示条件时不附加', async () => {
    const { runtime, listeners, broadcast } = createLiveRuntime()

    await emitAll(listeners['chatluna/before-chat'], 'conversation-1', { content: '你好' }, {}, {}, createLiveSession({ userId: selfId }))
    // 来源不在可展示集合里：同一条链路照常落地，只是不该带上用量。
    await emitAll(listeners['chatluna/model-usage'], createModelUsage('some-other-plugin', 'conversation-1'))
    await runtime.recordWebQQLiveMessage(createLiveSession({ userId: selfId, messageId: 'out-1' }))

    const [message] = readLiveMessages(broadcast)
    expect(message?.id).toBe('out-1')
    expect(message?.usage).toBeUndefined()
  })

  it('角色思考过程挂到最后一条外发消息上', async () => {
    const { runtime, broadcast } = createLiveRuntime({ thinkingDurationMs: 4200 })

    await runtime.recordWebQQLiveMessage(createLiveSession({ userId: selfId, messageId: 'out-1' }))
    await runtime.recordWebQQLiveMessage(createLiveSession({ messageId: 'in-1', timestamp: 1710000001000 }))
    await runtime.recordWebQQLiveMessage(createLiveSession({ userId: selfId, messageId: 'out-2', timestamp: 1710000002000 }))
    runtime.updateLastOutgoingWebQQThinking({
      session: createLiveSession({ userId: selfId }),
      text: '<think>先看看她今天心情</think>今天也很精神呢',
    })

    const broadcasts = readLiveBroadcasts(broadcast)
    expect(broadcasts.at(-1)?.message).toMatchObject({
      id: 'out-2',
      thinking: { content: '先看看她今天心情', durationMs: 4200 },
    })
    // 挂错一条比不挂更糟：管理员会以为这条回复真的是这么想出来的。
    expect(broadcasts.filter((payload) => payload.message.thinking).map((payload) => payload.message.id)).toEqual(['out-2'])
  })

  it('外发消息还没到时思考过程先存起来，到了再合并', async () => {
    const { runtime, broadcast } = createLiveRuntime({ thinkingDurationMs: 900 })

    runtime.updateLastOutgoingWebQQThinking({
      session: createLiveSession({ userId: selfId }),
      text: '<think>先想好再说</think>好呀',
    })

    expect(readLiveBroadcasts(broadcast)).toEqual([])

    await runtime.recordWebQQLiveMessage(createLiveSession({ userId: selfId, messageId: 'out-1' }))

    expect(readLiveMessages(broadcast)).toEqual([
      expect.objectContaining({
        id: 'out-1',
        thinking: { content: '先想好再说', durationMs: 900 },
      }),
    ])
  })

  it('撤回广播对应载荷，标记撤回模式下另存一份显示缓存', async () => {
    const upsert = vi.fn(async (_table: string, _rows: unknown[]) => {})
    const database: DatabaseService = {
      get: vi.fn(async () => []),
      upsert,
    }
    const marked = createLiveRuntime({ database })

    await marked.runtime.recordWebQQLiveMessage(createLiveSession({ messageId: 'msg-1' }))
    await marked.runtime.recordWebQQRecall(createRecallSession({ messageId: 'msg-1' }))

    const recallPayload = marked.broadcast.mock.calls.find(([event]) => event === recallEvent)?.[1] as unknown as WebQQRecallPayload
    expect(recallPayload).toMatchObject({ type: 'group', peerId: '20000', messageId: 'msg-1', mode: 'mark' })
    expect(recallPayload.eventMessage).toBeUndefined()
    expect(marked.runtime.liveMessages.get('group:20000')).toEqual([expect.objectContaining({ id: 'msg-1', recalled: true })])
    // OneBot 历史接口不会再返回已撤回原消息，后端实时缓存也会随 Koishi 重启丢失；
    // 标记模式下另存的这一份是历史里还能看到它的唯一来源。
    expect(upsert).toHaveBeenCalledWith('onebot_webqq_storage', [
      expect.objectContaining({
        id: 'recalled-messages:group:20000',
        payload: { messages: [expect.objectContaining({ id: 'msg-1', recalled: true })] },
      }),
    ])

    const removeUpsert = vi.fn(async (_table: string, _rows: unknown[]) => {})
    const removed = createLiveRuntime({
      config: { webQQMarkRecalledMessages: false },
      database: { get: vi.fn(async () => []), upsert: removeUpsert },
    })

    await removed.runtime.recordWebQQLiveMessage(createLiveSession({ messageId: 'msg-1' }))
    await removed.runtime.recordWebQQRecall(createRecallSession({ messageId: 'msg-1' }))

    const removePayload = removed.broadcast.mock.calls.find(([event]) => event === recallEvent)?.[1] as unknown as WebQQRecallPayload
    expect(removePayload).toMatchObject({ mode: 'remove', eventMessage: expect.objectContaining({ event: { type: 'recall', targetMessageId: 'msg-1' } }) })
    expect(removeUpsert).not.toHaveBeenCalled()
  })

  it('好感度徽标在配置关闭时不附加', async () => {
    const affinityRows = [{ scopeId: 'scope-1', userId: '30000', affinity: 88, relation: '熟悉' }]
    const createAffinityDatabase = (): DatabaseService => ({
      get: vi.fn(async (table: string) => table === 'chatluna_affinity_v2' ? affinityRows : []),
      upsert: vi.fn(async () => {}),
    })
    const disabledDatabase = createAffinityDatabase()
    const disabled = createLiveRuntime({ database: disabledDatabase })

    await disabled.runtime.recordWebQQLiveMessage(createLiveSession({ messageId: 'msg-1' }))

    const [withoutBadge] = readLiveMessages(disabled.broadcast)
    expect(withoutBadge?.senderAffinity).toBeUndefined()
    expect(withoutBadge?.senderRelationship).toBeUndefined()
    // 两个开关都关时连查都不查：这是「不附加」在数据库侧唯一可观察的形态。
    expect(disabledDatabase.get).not.toHaveBeenCalledWith('chatluna_affinity_v2', expect.anything())

    // 两个开关各自独立生效，否则「关闭时不附加」可以靠另一个开关顺带成立。
    const affinityOnly = createLiveRuntime({ config: { showWebQQAffinity: true }, database: createAffinityDatabase() })
    await affinityOnly.runtime.recordWebQQLiveMessage(createLiveSession({ messageId: 'msg-2' }))
    expect(readLiveMessages(affinityOnly.broadcast)).toEqual([
      expect.objectContaining({ senderAffinity: 88 }),
    ])
    expect(readLiveMessages(affinityOnly.broadcast)[0]?.senderRelationship).toBeUndefined()

    const relationshipOnly = createLiveRuntime({ config: { showWebQQRelationship: true }, database: createAffinityDatabase() })
    await relationshipOnly.runtime.recordWebQQLiveMessage(createLiveSession({ messageId: 'msg-3' }))
    expect(readLiveMessages(relationshipOnly.broadcast)).toEqual([
      expect.objectContaining({ senderRelationship: '熟悉' }),
    ])
    expect(readLiveMessages(relationshipOnly.broadcast)[0]?.senderAffinity).toBeUndefined()
  })
})
