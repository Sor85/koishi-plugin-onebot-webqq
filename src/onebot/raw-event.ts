import { getNumberField, getStringField, isRecord } from './data'

// NapCat / LLOneBot 的贴表情通过 OneBot11 通知 `group_msg_emoji_like` 上报，
// 但 koishi-plugin-adapter-onebot 没有对应的事件映射，会在 dispatch 前丢弃，
// 因此 `reaction-added` / `internal/session` 都收不到。这里直接挂到底层 WebSocket
// 上拦截原始事件。仅支持 ws / ws-reverse；http webhook 模式没有 socket，跳过。

export interface WebQQRawReaction {
  groupId: string
  userId: string
  messageId: string
  messageSeq?: string
  emojiId: string
  count: number
  isAdd: boolean
}

interface RawEventContext {
  bots?: unknown[]
  setInterval(callback: () => void, delay: number): unknown
  on(event: string, listener: (...args: any[]) => void): unknown
}

interface SocketLike {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
}

const SOCKET_RESCAN_INTERVAL = 10000

function isSocketLike(value: unknown): value is SocketLike {
  return isRecord(value) && typeof value.addEventListener === 'function'
}

// 正向 ws 的 socket 在 satori WsClientBase 的 `bot.adapter.socket`；
// 反向 ws-reverse 的 socket 存在 adapter 模块的私有 Symbol `bot[kSocket]` 上。
function findBotSocket(bot: Record<string, unknown>): SocketLike | undefined {
  const adapter = bot.adapter
  if (isRecord(adapter) && isSocketLike(adapter.socket)) return adapter.socket
  for (const symbol of Object.getOwnPropertySymbols(bot)) {
    if (symbol.description !== 'socket') continue
    const socket = (bot as Record<symbol, unknown>)[symbol]
    if (isSocketLike(socket)) return socket
  }
  return undefined
}

function parseReaction(raw: unknown): WebQQRawReaction | undefined {
  if (!isRecord(raw)) return
  if (raw.post_type !== 'notice') return
  if (getStringField(raw, ['notice_type']) !== 'group_msg_emoji_like') return
  const groupId = getStringField(raw, ['group_id'])
  const messageId = getStringField(raw, ['message_id'])
  if (!groupId || !messageId) return
  // LLBot 内部原始通知有 target.sequence，但翻译成 OneBot 事件后通常只剩 message_id；
  // 这里兼容少数实现透出的序号，后续可优先用它命中 WebQQ 消息。
  const target = isRecord(raw.target) ? raw.target : undefined
  const messageSeq = getStringField(raw, ['message_seq', 'messageSeq', 'msg_seq', 'msgSeq', 'seq']) ||
    (target ? getStringField(target, ['sequence']) : '')
  const likes = Array.isArray(raw.likes) ? raw.likes : []
  const like = likes.find(isRecord)
  const emojiId = like ? getStringField(like, ['emoji_id']) : ''
  if (!emojiId) return
  const isAdd = raw.is_add !== false
  return {
    groupId,
    userId: getStringField(raw, ['user_id', 'operator_id']),
    messageId,
    ...(messageSeq ? { messageSeq } : {}),
    emojiId,
    count: like ? getNumberField(like, ['count']) : 0,
    isAdd,
  }
}

export function registerWebQQReactionInterceptor(ctx: RawEventContext, onReaction: (reaction: WebQQRawReaction) => void) {
  const bound = new WeakSet<SocketLike>()

  const bindSocket = (socket: SocketLike) => {
    if (bound.has(socket)) return
    bound.add(socket)
    socket.addEventListener('message', (event) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String((event as { data: unknown }).data))
      } catch {
        return
      }
      const reaction = parseReaction(parsed)
      if (reaction) onReaction(reaction)
    })
  }

  const scan = () => {
    for (const bot of ctx.bots ?? []) {
      if (!isRecord(bot) || bot.platform !== 'onebot') continue
      const socket = findBotSocket(bot)
      if (socket) bindSocket(socket)
    }
  }

  // 立即扫描一次，并周期性重扫以覆盖正向 ws 重连后 socket 实例被替换的情况。
  scan()
  ctx.setInterval(scan, SOCKET_RESCAN_INTERVAL)
}
