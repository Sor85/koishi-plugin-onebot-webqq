export type WebQQChatType = 'friend' | 'group'

// WebQQ 只读面板使用的好友数据。
export interface WebQQFriend {
  userId: string
  name: string
  nickname: string
  avatar: string
}

// WebQQ 只读面板使用的群数据。
export interface WebQQGroup {
  groupId: string
  name: string
  memberCount: number
  avatar: string
}

// WebQQ 只读面板使用的消息片段。
export interface WebQQMessageElement {
  type: 'text' | 'image' | 'face' | 'file' | 'record' | 'video' | 'unknown'
  text?: string
  url?: string
}

// WebQQ 只读面板使用的历史消息。
export interface WebQQMessage {
  id: string
  sequence: string
  time: number
  senderId: string
  senderName: string
  direction: 'incoming' | 'outgoing'
  summary: string
  elements: WebQQMessageElement[]
}

// WebQQ 只读面板一次加载的联系人数据。
export interface WebQQContacts {
  friends: WebQQFriend[]
  groups: WebQQGroup[]
}

export interface WebQQMessageQuery {
  type: WebQQChatType
  peerId: string
  limit?: number
}

export interface OneBotWebQQOptions {
  selfId?: string
}

interface OneBotContext {
  bots?: unknown[]
}

interface OneBotBot {
  platform?: string
  selfId?: string
  internal: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function toStringId(value: unknown) {
  return value == null ? '' : String(value)
}

function toOneBotId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value
}

function toTimestampMs(value: unknown) {
  const time = Number(value) || 0
  return time > 100000000000 ? time : time * 1000
}

function getStringField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (value != null && String(value).trim()) return String(value)
  }
  return ''
}

function getNumberField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = Number(source[key])
    if (Number.isFinite(value)) return value
  }
  return 0
}

function toArrayResult(result: unknown, key: string) {
  if (Array.isArray(result)) return result
  if (!isRecord(result)) return []
  if (Array.isArray(result[key])) return result[key]
  if (isRecord(result.data) && Array.isArray(result.data[key])) return result.data[key]
  if (Array.isArray(result.data)) return result.data
  return []
}

function getOneBotBots(ctx: OneBotContext) {
  return (ctx.bots ?? []).filter((bot): bot is OneBotBot => {
    return isRecord(bot) && isRecord(bot.internal)
  })
}

function selectBot(ctx: OneBotContext, options: OneBotWebQQOptions) {
  const bots = getOneBotBots(ctx)
  const selected = options.selfId
    ? bots.find((bot) => bot.selfId === options.selfId)
    : bots.find((bot) => typeof bot.internal.get_friend_list === 'function' || typeof bot.internal.get_group_list === 'function')
  if (!selected) throw new Error(options.selfId ? `未找到 selfId 为 ${options.selfId} 的 OneBot 机器人` : '未找到可用的 OneBot 机器人')
  return selected
}

async function callAction(bot: OneBotBot, action: string, params?: Record<string, unknown>) {
  const method = bot.internal[action]
  if (typeof method !== 'function') throw new Error(`当前 OneBot 实现不支持 ${action}`)
  return method(params)
}

function getUserAvatar(userId: string) {
  return `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
}

function getGroupAvatar(groupId: string) {
  return `https://p.qlogo.cn/gh/${groupId}/${groupId}/640/`
}

function normalizeFriend(raw: unknown): WebQQFriend {
  const item = isRecord(raw) ? raw : {}
  const userId = getStringField(item, ['user_id', 'uin', 'uid'])
  const nickname = getStringField(item, ['nickname', 'nick', 'name']) || userId
  const remark = getStringField(item, ['remark', 'card'])
  return {
    userId,
    name: remark || nickname,
    nickname,
    avatar: getUserAvatar(userId),
  }
}

function normalizeGroup(raw: unknown): WebQQGroup {
  const item = isRecord(raw) ? raw : {}
  const groupId = getStringField(item, ['group_id', 'groupCode', 'group_id_str'])
  return {
    groupId,
    name: getStringField(item, ['group_name', 'groupName', 'name']) || groupId,
    memberCount: getNumberField(item, ['member_count', 'memberCount']),
    avatar: getGroupAvatar(groupId),
  }
}

function normalizeSegment(raw: unknown): WebQQMessageElement {
  if (typeof raw === 'string') return { type: 'text', text: raw }
  if (!isRecord(raw)) return { type: 'unknown', text: '[消息]' }
  const type = getStringField(raw, ['type'])
  const data = isRecord(raw.data) ? raw.data : raw
  if (type === 'text') return { type: 'text', text: getStringField(data, ['text', 'content']) }
  if (type === 'image') return { type: 'image', url: getStringField(data, ['url', 'file']) }
  if (type === 'face') return { type: 'face', text: `[表情 ${getStringField(data, ['id'])}]` }
  if (type === 'file') return { type: 'file', text: getStringField(data, ['name', 'file']) || '[文件]' }
  if (type === 'record') return { type: 'record', text: '[语音]' }
  if (type === 'video') return { type: 'video', text: '[视频]' }
  return { type: 'unknown', text: '[消息]' }
}

function normalizeMessageElements(message: unknown) {
  if (typeof message === 'string') return [{ type: 'text' as const, text: message }]
  if (Array.isArray(message)) return message.map(normalizeSegment)
  return [{ type: 'unknown' as const, text: '[消息]' }]
}

function summarizeElements(elements: WebQQMessageElement[]) {
  const summary = elements.map((element) => {
    if (element.type === 'text') return element.text
    if (element.type === 'image') return '[图片]'
    if (element.type === 'face') return element.text || '[表情]'
    return element.text || '[消息]'
  }).filter(Boolean).join('').replace(/\s+/g, ' ').trim()
  return summary || '[消息]'
}

function normalizeMessage(raw: unknown, bot: OneBotBot): WebQQMessage {
  const item = isRecord(raw) ? raw : {}
  const sender = isRecord(item.sender) ? item.sender : {}
  const senderId = getStringField(sender, ['user_id', 'uin', 'uid']) || getStringField(item, ['user_id'])
  const elements = normalizeMessageElements(item.message)
  return {
    id: getStringField(item, ['message_id', 'msg_id', 'id']),
    sequence: getStringField(item, ['message_seq', 'msg_seq', 'seq', 'message_id']),
    time: toTimestampMs(item.time),
    senderId,
    senderName: getStringField(sender, ['nickname', 'card', 'name']) || senderId,
    direction: senderId && senderId === bot.selfId ? 'outgoing' : 'incoming',
    summary: summarizeElements(elements),
    elements,
  }
}

// 创建通过 OneBot action 读取 WebQQ 数据的只读服务。
export function createOneBotWebQQService(ctx: OneBotContext, options: OneBotWebQQOptions = {}) {
  const getBot = () => selectBot(ctx, options)
  return {
    async loadContacts(): Promise<WebQQContacts> {
      const bot = getBot()
      const [friendsResult, groupsResult] = await Promise.all([
        callAction(bot, 'get_friend_list'),
        callAction(bot, 'get_group_list'),
      ])
      return {
        friends: toArrayResult(friendsResult, 'friends').map(normalizeFriend),
        groups: toArrayResult(groupsResult, 'groups').map(normalizeGroup),
      }
    },

    async loadMessages(query: WebQQMessageQuery): Promise<WebQQMessage[]> {
      const bot = getBot()
      const action = query.type === 'group' ? 'get_group_msg_history' : 'get_friend_msg_history'
      const params = query.type === 'group'
        ? { group_id: toOneBotId(query.peerId), count: query.limit ?? 30 }
        : { user_id: toOneBotId(query.peerId), count: query.limit ?? 30 }
      const result = await callAction(bot, action, params)
      return toArrayResult(result, 'messages').map((message) => normalizeMessage(message, bot))
    },
  }
}
