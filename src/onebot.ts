export type WebQQChatType = 'friend' | 'group'

// WebQQ 只读面板支持的 OneBot 实现协议。
export type WebQQProtocol = 'napcat' | 'llbot'

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
  type: 'text' | 'image' | 'quote' | 'face' | 'file' | 'record' | 'video' | 'unknown'
  title?: string
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
  senderAvatar: string
  senderRole?: string
  senderLevel?: string
  senderTitle?: string
  direction: 'incoming' | 'outgoing'
  summary: string
  elements: WebQQMessageElement[]
}

export interface WebQQLiveMessage {
  type: WebQQChatType
  peerId: string
  message: WebQQMessage
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
  beforeSequence?: string
}

export interface OneBotWebQQOptions {
  selfId?: string
  protocol?: WebQQProtocol
  imageUrlResolver?: (file: string) => string
}

interface OneBotContext {
  bots?: unknown[]
}

interface OneBotBot {
  platform?: string
  selfId?: string
  internal: OneBotInternal
}

interface OneBotInternal extends Record<string, unknown> {
  _request?: (action: string, params: Record<string, unknown>) => Promise<unknown>
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

function normalizeGroupRole(role: string) {
  if (role === 'owner') return '群主'
  if (role === 'admin' || role === 'administrator') return '管理员'
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

function getActionData(result: unknown) {
  const item = isRecord(result) ? result : {}
  return isRecord(item.data) ? item.data : item
}

function getOneBotBots(ctx: OneBotContext) {
  return (ctx.bots ?? []).filter((bot): bot is OneBotBot => {
    return isRecord(bot) && isRecord(bot.internal)
  })
}

function supportsOneBotAction(bot: OneBotBot) {
  return typeof bot.internal._request === 'function' ||
    typeof bot.internal.get_friend_list === 'function' ||
    typeof bot.internal.get_group_list === 'function'
}

function selectBot(ctx: OneBotContext, options: OneBotWebQQOptions) {
  const bots = getOneBotBots(ctx)
  const selected = options.selfId
    ? bots.find((bot) => bot.selfId === options.selfId)
    : bots.find(supportsOneBotAction)
  if (!selected) throw new Error(options.selfId ? `未找到 selfId 为 ${options.selfId} 的 OneBot 机器人` : '未找到可用的 OneBot 机器人')
  return selected
}

async function callAction(bot: OneBotBot, action: string, params?: Record<string, unknown>) {
  if (typeof bot.internal._request === 'function') {
    return bot.internal._request(action, params ?? {})
  }
  const method = bot.internal[action]
  if (typeof method !== 'function') throw new Error(`当前 OneBot 实现不支持 ${action}`)
  return method.call(bot.internal, params)
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

function isRemoteUrl(value: string) {
  return /^https?:\/\//.test(value)
}

function resolveImageUrl(result: unknown, imageUrlResolver?: (file: string) => string) {
  const item = isRecord(result) ? result : {}
  const source = isRecord(item.data) ? item.data : item
  const url = getStringField(source, ['url'])
  if (url) return imageUrlResolver?.(url) || url
  const file = getStringField(source, ['file', 'path'])
  if (!file) return ''
  return imageUrlResolver?.(file) || ''
}

function readImageDebug(result: unknown) {
  const item = isRecord(result) ? result : {}
  if (isRecord(item.data)) {
    return {
      url: getStringField(item.data, ['url']),
      file: getStringField(item.data, ['file', 'path']),
    }
  }
  return {
    url: getStringField(item, ['url']),
    file: getStringField(item, ['file', 'path']),
  }
}

async function resolveOneBotImage(bot: OneBotBot, file: string, imageUrlResolver?: (file: string) => string) {
  const result = await callAction(bot, 'get_image', { file })
  return {
    url: resolveImageUrl(result, imageUrlResolver),
    debug: readImageDebug(result),
  }
}

async function resolveOneBotQuote(bot: OneBotBot, id: string, imageUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
  const item = getActionData(await callAction(bot, 'get_msg', { message_id: toOneBotId(id) }))
  const sender = isRecord(item.sender) ? item.sender : {}
  const elements = await normalizeMessageElements(item.message, bot, imageUrlResolver)
  const title = getStringField(sender, ['nickname', 'card', 'name'])
  return {
    type: 'quote',
    ...(title ? { title } : {}),
    text: summarizeElements(elements),
  }
}

async function normalizeSegment(raw: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
  if (typeof raw === 'string') return { type: 'text', text: raw }
  if (!isRecord(raw)) return { type: 'unknown', text: '[消息]' }
  const type = getStringField(raw, ['type'])
  const data = isRecord(raw.data) ? raw.data : raw
  if (type === 'text') return { type: 'text', text: getStringField(data, ['text', 'content']) }
  if (type === 'image') {
    const url = getStringField(data, ['url'])
    if (url) return { type: 'image', url: imageUrlResolver?.(url) || url }
    const file = getStringField(data, ['file', 'file_id'])
    if (!file) return { type: 'image' }
    if (isRemoteUrl(file)) return { type: 'image', url: imageUrlResolver?.(file) || file }
    try {
      return { type: 'image', url: (await resolveOneBotImage(bot, file, imageUrlResolver)).url }
    } catch {
      return { type: 'image' }
    }
  }
  if (type === 'face') return { type: 'face', text: `[表情 ${getStringField(data, ['id'])}]` }
  if (type === 'reply' || type === 'quote') {
    const id = getStringField(data, ['id', 'message_id', 'messageId'])
    if (id) {
      try {
        return await resolveOneBotQuote(bot, id, imageUrlResolver)
      } catch {
        return { type: 'quote', text: '[引用消息]' }
      }
    }
    const sender = isRecord(data.sender) ? data.sender : data
    const title = getStringField(sender, ['nickname', 'card', 'name', 'senderName', 'sender_name'])
    const text = getStringField(data, ['text', 'content', 'message', 'sourceMsgText'])
    return {
      type: 'quote',
      ...(title ? { title } : {}),
      text: text || '[引用消息]',
    }
  }
  if (type === 'file') return { type: 'file', text: getStringField(data, ['name', 'file']) || '[文件]' }
  if (type === 'record') return { type: 'record', text: '[语音]' }
  if (type === 'video') return { type: 'video', text: '[视频]' }
  return { type: 'unknown', text: '[消息]' }
}

async function normalizeMessageElements(message: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string) {
  if (typeof message === 'string') return [{ type: 'text' as const, text: message }]
  if (Array.isArray(message)) return Promise.all(message.map((segment) => normalizeSegment(segment, bot, imageUrlResolver)))
  return [{ type: 'unknown' as const, text: '[消息]' }]
}

function summarizeElements(elements: WebQQMessageElement[]) {
  const summary = elements.map((element) => {
    if (element.type === 'text') return element.text
    if (element.type === 'image') return '[图片]'
    if (element.type === 'quote') return ''
    if (element.type === 'face') return element.text || '[表情]'
    return element.text || '[消息]'
  }).filter(Boolean).join('').replace(/\s+/g, ' ').trim()
  return summary || '[消息]'
}

async function normalizeMessage(raw: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string): Promise<WebQQMessage> {
  const item = isRecord(raw) ? raw : {}
  const sender = isRecord(item.sender) ? item.sender : {}
  const senderId = getStringField(sender, ['user_id', 'uin', 'uid']) || getStringField(item, ['user_id'])
  const elements = await normalizeMessageElements(item.message, bot, imageUrlResolver)
  const senderRole = normalizeGroupRole(getStringField(sender, ['role']))
  const senderLevel = getStringField(sender, ['level', 'sender_level', 'senderLevel'])
  const senderTitle = getStringField(sender, ['title', 'special_title', 'specialTitle'])
  return {
    id: getStringField(item, ['message_id', 'msg_id', 'id']),
    sequence: getStringField(item, ['message_seq', 'msg_seq', 'seq', 'message_id']),
    time: toTimestampMs(item.time),
    senderId,
    senderName: getStringField(sender, ['card', 'nickname', 'name']) || senderId,
    senderAvatar: senderId ? getUserAvatar(senderId) : '',
    ...(senderRole ? { senderRole } : {}),
    ...(senderLevel ? { senderLevel } : {}),
    ...(senderTitle ? { senderTitle } : {}),
    direction: senderId && senderId === bot.selfId ? 'outgoing' : 'incoming',
    summary: summarizeElements(elements),
    elements,
  }
}

// 创建通过 OneBot action 读取 WebQQ 数据的只读服务。
export function createOneBotWebQQService(ctx: OneBotContext, options: OneBotWebQQOptions = {}) {
  const getBot = () => selectBot(ctx, options)
  const protocol = options.protocol ?? 'napcat'
  const { imageUrlResolver } = options
  return {
    async resolveQuote(id: string) {
      return resolveOneBotQuote(getBot(), id, imageUrlResolver)
    },

    async resolveImage(file: string) {
      return resolveOneBotImage(getBot(), file, imageUrlResolver)
    },

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
      const baseParams = {
        message_seq: query.beforeSequence ? toOneBotId(query.beforeSequence) : 0,
        count: query.limit ?? 30,
        ...(protocol === 'llbot' ? { reverseOrder: false } : {}),
      }
      const params = query.type === 'group'
        ? { group_id: toOneBotId(query.peerId), ...baseParams }
        : { user_id: toOneBotId(query.peerId), ...baseParams }
      const result = await callAction(bot, action, params)
      return Promise.all(toArrayResult(result, 'messages').map((message) => normalizeMessage(message, bot, imageUrlResolver)))
    },
  }
}
