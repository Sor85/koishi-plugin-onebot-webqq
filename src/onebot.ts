export type WebQQChatType = 'friend' | 'group'

// WebQQ 只读面板支持的 OneBot 实现协议。
export type WebQQProtocol = 'napcat' | 'llbot'

// WebQQ 只读面板使用的好友数据。
export interface WebQQFriend {
  userId: string
  name: string
  nickname: string
  avatar: string
  categoryId?: string
  categoryName?: string
}

// WebQQ 只读面板使用的群数据。
export interface WebQQGroup {
  groupId: string
  name: string
  memberCount: number
  avatar: string
}

// WebQQ 只读面板使用的合并转发节点。
export interface WebQQForwardItem {
  title?: string
  senderId?: string
  senderAvatar?: string
  elements: WebQQMessageElement[]
}

// WebQQ 只读面板使用的消息片段。
export interface WebQQMessageElement {
  type: 'text' | 'image' | 'quote' | 'forward' | 'card' | 'face' | 'file' | 'record' | 'video' | 'unknown'
  title?: string
  text?: string
  url?: string
  imageUrl?: string
  source?: string
  items?: WebQQForwardItem[]
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
  senderAffinity?: number
  senderRelationship?: string
  direction: 'incoming' | 'outgoing'
  summary: string
  thinking?: {
    content: string
    durationMs: number
    usage?: {
      inputTokens: number
      outputTokens: number
    }
  }
  elements: WebQQMessageElement[]
}

export interface WebQQLiveMessage {
  type: WebQQChatType
  peerId: string
  message: WebQQMessage
}

export interface WebQQNotice {
  id: string
  type: 'friend-request' | 'group-notice'
  title: string
  subtitle: string
  avatar: string
  status: 'pending' | 'approved' | 'rejected'
  time: number
  flag?: string
  subType?: string
  requesterId?: string
  requesterName?: string
  groupId?: string
  groupName?: string
  comment?: string
}

export interface WebQQNoticeAction {
  id: string
  type: WebQQNotice['type']
  flag: string
  subType?: string
  approve: boolean
}

export interface WebQQGroupAnnouncement {
  id: string
  title: string
  content: string
  time?: number
}

export interface WebQQGroupMember {
  userId: string
  nickname: string
  card: string
  avatar: string
  role?: string
}

export interface WebQQGroupInfo {
  announcements: WebQQGroupAnnouncement[]
  members: WebQQGroupMember[]
}

export interface WebQQFriendCategory {
  id: string
  name: string
  friends: WebQQFriend[]
}

export interface WebQQRecentContact {
  type: WebQQChatType
  peerId: string
  name: string
  subtitle: string
  avatar: string
  summary: string
  time: number
}

export interface WebQQGroupInfoQuery {
  groupId: string
}

// WebQQ 只读面板一次加载的联系人数据。
export interface WebQQContacts {
  friends: WebQQFriend[]
  groups: WebQQGroup[]
  friendCategories?: WebQQFriendCategory[]
  recent?: WebQQRecentContact[]
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
  status?: number
  internal: OneBotInternal
}

interface OneBotInternal extends Record<string, unknown> {
  _request?: (action: string, params: Record<string, unknown>) => Promise<unknown>
}

const oneBotOnlineStatus = 1

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

const mentionAttributeKeys = ['name', 'nickname', 'nick', 'card', 'text', 'display', 'qq', 'id', 'user_id', 'uin']

function decodeTextEntity(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  }
  return value
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (entity: string) => namedEntities[entity.slice(1, -1)] || entity)
    .replace(/&#(\d+);/g, (_entity: string, code: string) => decodeTextCodePoint(code, 10))
    .replace(/&#x([0-9a-f]+);/gi, (_entity: string, code: string) => decodeTextCodePoint(code, 16))
}

function decodeTextCodePoint(value: string, radix: number) {
  const code = Number.parseInt(value, radix)
  if (!Number.isInteger(code)) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

function readMarkupAttribute(source: string, keys: string[]) {
  for (const key of keys) {
    const match = new RegExp(`(?:^|[\\s,])${key}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s,>\\]]+))`, 'i').exec(source)
    const value = match?.[2] ?? match?.[3] ?? match?.[4]
    if (value && value.trim()) return decodeTextEntity(value).trim()
  }
  return ''
}

// 部分 OneBot 实现会把引用里的 @ 以 CQ/XML 文本返回，只在命中 @ 标记时转换。
function normalizeMentionMarkupText(value: string) {
  const text = value.trim()
  if (!text) return ''
  const decodedText = decodeTextEntity(text)
  const source = /\[CQ:at,[^\]]+\]/i.test(text) || /<(?:[\w-]+:)?(?:at|qqbot-at-user)\b/i.test(text)
    ? text
    : decodedText
  const hasMentionMarkup = /\[CQ:at,[^\]]+\]/i.test(source) || /<(?:[\w-]+:)?(?:at|qqbot-at-user)\b/i.test(source)
  if (!hasMentionMarkup) return text
  const normalized = source
    .replace(/\[CQ:at,([^\]]+)\]/gi, (_source: string, attrs: string) => {
      const target = readMarkupAttribute(attrs, mentionAttributeKeys)
      return target ? `@${target}` : ''
    })
    .replace(/<(?:[\w-]+:)?(?:at|qqbot-at-user)\b[^>]*\/?>/gi, (tag: string) => {
      const target = readMarkupAttribute(tag, mentionAttributeKeys)
      return target ? `@${target}` : ''
    })
    .replace(/<[^>]+>/g, '')
  return decodeTextEntity(normalized).replace(/\s+/g, ' ').trim()
}

function getTextValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return normalizeMentionMarkupText(String(value))
  if (Array.isArray(value)) return value.map(getTextValue).filter(Boolean).join('\n')
  if (!isRecord(value)) return ''
  for (const key of ['text', 'content', 'message', 'data']) {
    const text = getTextValue(value[key])
    if (text) return text
  }
  return ''
}

function parseJsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value
  if (typeof value !== 'string') return
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function getCardMeta(payload: Record<string, unknown>) {
  const meta = isRecord(payload.meta) ? payload.meta : undefined
  if (!meta) return undefined
  const view = getStringField(payload, ['view'])
  if (view && isRecord(meta[view])) return meta[view]
  return Object.values(meta).find(isRecord)
}

function normalizeCardElement(data: Record<string, unknown>): WebQQMessageElement {
  const payload = parseJsonRecord(data.data) ||
    parseJsonRecord(data.content) ||
    parseJsonRecord(data.json) ||
    parseJsonRecord(data)
  const meta = payload ? getCardMeta(payload) : undefined
  const card = meta ?? payload ?? data
  const title = getStringField(card, ['title']) ||
    (payload ? getStringField(payload, ['title', 'prompt']) : '') ||
    '卡片消息'
  const text = getStringField(card, ['desc', 'summary', 'content']) ||
    (payload ? getStringField(payload, ['desc', 'prompt']) : '') ||
    '[卡片消息]'
  const url = getStringField(card, ['jumpUrl', 'jump_url', 'url', 'source_url'])
  const imageUrl = getStringField(card, ['preview', 'image', 'imageUrl', 'image_url', 'picUrl', 'pic_url', 'icon', 'source_icon'])
  const source = getStringField(card, ['tag', 'source', 'app'])
  return {
    type: 'card',
    title,
    text,
    ...(url ? { url } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(source ? { source } : {}),
  }
}

function normalizeFaceElement(data: Record<string, unknown>) {
  const summary = getStringField(data, ['summary', 'text', 'name'])
  if (summary) return { type: 'face' as const, text: summary }
  const id = getStringField(data, ['emoji_id', 'emojiId', 'id'])
  return { type: 'face' as const, text: id ? `[表情 ${id}]` : '[表情]' }
}

async function normalizeImageElement(data: Record<string, unknown>, bot: OneBotBot, imageUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
  const url = getStringField(data, ['url', 'src'])
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

function getBooleanField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (value === true || value === 'true' || value === 1) return true
    if (value === false || value === 'false' || value === 0) return false
  }
  return undefined
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
    typeof bot.internal.get_group_list === 'function' ||
    typeof bot.internal.get_group_member_list === 'function' ||
    typeof bot.internal.get_group_system_msg === 'function' ||
    typeof bot.internal.set_friend_add_request === 'function' ||
    typeof bot.internal.set_group_add_request === 'function'
}

function isOneBotReady(bot: OneBotBot) {
  return (typeof bot.status !== 'number' || bot.status === oneBotOnlineStatus) && supportsOneBotAction(bot)
}

function selectBot(ctx: OneBotContext, options: OneBotWebQQOptions) {
  const bots = getOneBotBots(ctx)
  const selected = options.selfId
    ? bots.find((bot) => bot.selfId === options.selfId && isOneBotReady(bot))
    : bots.find(isOneBotReady)
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

function normalizeFriend(raw: unknown, category?: { id: string; name: string }): WebQQFriend {
  const item = isRecord(raw) ? raw : {}
  const userId = getStringField(item, ['user_id', 'uin', 'uid'])
  const nickname = getStringField(item, ['nickname', 'nick', 'name']) || userId
  const remark = getStringField(item, ['remark', 'card'])
  return {
    userId,
    name: remark || nickname,
    nickname,
    avatar: getUserAvatar(userId),
    ...(category ? { categoryId: category.id, categoryName: category.name } : {}),
  }
}

function normalizeFriendCategory(raw: unknown, index: number): WebQQFriendCategory {
  const item = isRecord(raw) ? raw : {}
  const id = getStringField(item, ['categoryId', 'category_id', 'id']) || String(index)
  const name = getStringField(item, ['categoryName', 'category_name', 'name']) || '未分组'
  const friends = toArrayResult(item, 'buddyList').map((friend) => normalizeFriend(friend, { id, name }))
  return { id, name, friends }
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

function getRecentPeerType(raw: Record<string, unknown>, peerId: string, friends: WebQQFriend[], groups: WebQQGroup[]): WebQQChatType {
  const chatType = getStringField(raw, ['chatType', 'chat_type', 'type'])
  if (chatType === '2' || chatType === 'group') return 'group'
  if (chatType === '1' || chatType === 'friend' || chatType === 'private') return 'friend'
  if (groups.some((group) => group.groupId === peerId)) return 'group'
  return 'friend'
}

async function normalizeRecentContact(raw: unknown, bot: OneBotBot, friends: WebQQFriend[], groups: WebQQGroup[], imageUrlResolver?: (file: string) => string): Promise<WebQQRecentContact | undefined> {
  const item = isRecord(raw) ? raw : {}
  const peerId = getStringField(item, ['peerUin', 'peer_uin', 'uin', 'user_id', 'group_id'])
  if (!peerId) return
  const type = getRecentPeerType(item, peerId, friends, groups)
  const friend = type === 'friend' ? friends.find((value) => value.userId === peerId) : undefined
  const group = type === 'group' ? groups.find((value) => value.groupId === peerId) : undefined
  const rawName = getStringField(item, ['remark', 'peerName', 'peer_name', 'name', 'nick', 'nickname'])
  const message = isRecord(item.lastestMsg) ? item.lastestMsg : isRecord(item.latestMsg) ? item.latestMsg : undefined
  const elements = message ? await normalizeMessageElements(message.message, bot, imageUrlResolver) : []
  const summary = elements.length ? summarizeElements(elements) : getTextValue(item.lastestMsg) || getTextValue(item.latestMsg)
  const time = toTimestampMs(getStringField(item, ['msgTime', 'msg_time', 'time', 'timestamp']) || (message ? message.time : 0))
  return {
    type,
    peerId,
    name: friend?.name || group?.name || rawName || peerId,
    subtitle: friend?.nickname || (group ? getGroupSubtitle(group) : rawName || peerId),
    avatar: type === 'friend' ? getUserAvatar(peerId) : getGroupAvatar(peerId),
    summary,
    time,
  }
}

function getGroupSubtitle(group: WebQQGroup) {
  return `群聊 ${group.groupId} · ${group.memberCount} 人`
}

function normalizeGroupMember(raw: unknown): WebQQGroupMember {
  const item = isRecord(raw) ? raw : {}
  const userId = getStringField(item, ['user_id', 'userId', 'uin', 'uid'])
  const nickname = getStringField(item, ['nickname', 'nick', 'name']) || userId
  const card = getStringField(item, ['card', 'group_card', 'groupCard'])
  const role = normalizeGroupRole(getStringField(item, ['role']))
  return {
    userId,
    nickname,
    card,
    avatar: getUserAvatar(userId),
    ...(role ? { role } : {}),
  }
}

function normalizeGroupAnnouncement(raw: unknown, index: number): WebQQGroupAnnouncement {
  const item = isRecord(raw) ? raw : {}
  const id = getStringField(item, ['fid', 'id', 'notice_id', 'noticeId']) || String(index)
  const title = getStringField(item, ['title']) || '群公告'
  const content = getTextValue(item.text) || getTextValue(item.content) || getTextValue(item.message) || title
  const time = toTimestampMs(getStringField(item, ['publish_time', 'publishTime', 'time', 'timestamp']))
  return {
    id,
    title,
    content,
    ...(time ? { time } : {}),
  }
}

async function loadGroupAnnouncements(bot: OneBotBot, groupId: string) {
  for (const action of ['_get_group_notice', 'get_group_notice']) {
    try {
      const result = await callAction(bot, action, { group_id: toOneBotId(groupId) })
      return toArrayResult(result, 'notices').map(normalizeGroupAnnouncement)
    } catch {}
  }
  return []
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

// 不同 OneBot 实现对合并转发详情参数命名不一致，优先标准 id，再兼容 message_id。
async function callForwardMessage(bot: OneBotBot, id: string) {
  try {
    return await callAction(bot, 'get_forward_msg', { id })
  } catch (error) {
    try {
      return await callAction(bot, 'get_forward_msg', { message_id: id })
    } catch {
      throw error
    }
  }
}

function readForwardNodes(result: unknown) {
  const message = toArrayResult(result, 'message')
  if (message.length) return message
  const messages = toArrayResult(result, 'messages')
  if (messages.length) return messages
  return toArrayResult(result, 'nodes')
}

async function normalizeForwardNode(raw: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string) {
  const item = isRecord(raw) ? raw : {}
  const data = isRecord(item.data) ? item.data : item
  const sender = isRecord(data.sender)
    ? data.sender
    : isRecord(item.sender)
      ? item.sender
      : data
  const senderId = getStringField(sender, ['user_id', 'uin', 'uid'])
  const title = getStringField(sender, ['nickname', 'card', 'name', 'senderName', 'sender_name', 'user_id', 'uin'])
  const content = data.content ?? data.message ?? item.message
  const elements = content == null ? [] : await normalizeMessageElements(content, bot, imageUrlResolver)
  const normalizedElements = elements.length ? elements : [{ type: 'unknown' as const, text: '[消息]' }]
  const summary = summarizeElements(normalizedElements) || getTextValue(content) || '[消息]'
  return {
    item: {
      ...(title ? { title } : {}),
      ...(senderId ? { senderId } : {}),
      senderAvatar: senderId ? getUserAvatar(senderId) : getUserAvatar('0'),
      elements: normalizedElements,
    },
    text: title ? `${title}：${summary}` : summary,
  }
}

// 读取合并转发详情并压缩成 WebQQ 可展示的多行摘要。
async function resolveOneBotForward(bot: OneBotBot, id: string, imageUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
  const nodes = readForwardNodes(await callForwardMessage(bot, id))
  const nodesData = await Promise.all(nodes.map((node) => normalizeForwardNode(node, bot, imageUrlResolver)))
  const lines = nodesData.map((node) => node.text)
  return {
    type: 'forward',
    title: '合并转发',
    text: lines.join('\n') || '[合并转发]',
    items: nodesData.map((node) => node.item),
  }
}

async function normalizeSegment(raw: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
  if (typeof raw === 'string') return { type: 'text', text: normalizeMentionMarkupText(raw) }
  if (!isRecord(raw)) return { type: 'unknown', text: '[消息]' }
  const type = getStringField(raw, ['type'])
  const data = isRecord(raw.data) ? raw.data : raw
  if (type === 'text') return { type: 'text', text: normalizeMentionMarkupText(getStringField(data, ['text', 'content'])) }
  if (type === 'at') {
    const target = getStringField(data, ['name', 'nickname', 'card', 'text', 'qq', 'id', 'user_id', 'uin'])
    return target ? { type: 'text', text: `@${target}` } : { type: 'unknown', text: '[消息]' }
  }
  if (type === 'image') return normalizeImageElement(data, bot, imageUrlResolver)
  if (type === 'mface') {
    if (getStringField(data, ['url', 'src', 'file', 'file_id'])) return normalizeImageElement(data, bot, imageUrlResolver)
    return normalizeFaceElement(data)
  }
  if (type === 'face') return normalizeFaceElement(data)
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
    const inlineElements = data.message != null ? await normalizeMessageElements(data.message, bot, imageUrlResolver) : []
    const text = getTextValue(data.text) || getTextValue(data.content) || getTextValue(data.sourceMsgText) || (inlineElements.length ? summarizeElements(inlineElements) : '')
    return {
      type: 'quote',
      ...(title ? { title } : {}),
      text: text || '[引用消息]',
    }
  }
  if (type === 'forward') {
    const id = getStringField(data, ['id', 'message_id', 'messageId', 'resid'])
    if (!id) return { type: 'forward', title: '合并转发', text: '[合并转发]' }
    try {
      return await resolveOneBotForward(bot, id, imageUrlResolver)
    } catch {
      return { type: 'forward', title: '合并转发', text: '[合并转发]' }
    }
  }
  if (type === 'json' || type === 'lightapp' || type === 'xml') return normalizeCardElement(data)
  if (type === 'file') return { type: 'file', text: getStringField(data, ['name', 'file']) || '[文件]' }
  if (type === 'record') return { type: 'record', text: '[语音]' }
  if (type === 'video') return { type: 'video', text: '[视频]' }
  return { type: 'unknown', text: '[消息]' }
}

async function normalizeMessageElements(message: unknown, bot: OneBotBot, imageUrlResolver?: (file: string) => string) {
  if (typeof message === 'string') return [{ type: 'text' as const, text: normalizeMentionMarkupText(message) }]
  if (Array.isArray(message)) return Promise.all(message.map((segment) => normalizeSegment(segment, bot, imageUrlResolver)))
  return [{ type: 'unknown' as const, text: '[消息]' }]
}

function summarizeElements(elements: WebQQMessageElement[]) {
  const summary = elements.map((element) => {
    if (element.type === 'text') return element.text
    if (element.type === 'image') return '[图片]'
    if (element.type === 'quote') return ''
    if (element.type === 'forward') return '[合并转发]'
    if (element.type === 'card') return element.title && element.title !== '卡片消息' ? element.title : element.text || '[卡片消息]'
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

function isHandledGroupNotice(raw: unknown) {
  if (!isRecord(raw)) return false
  const checked = raw.checked
  return checked === true || checked === 1 || checked === 'true'
}

function normalizeGroupRequestSubType(value: string, bucket: string) {
  const normalizedBucket = bucket.toLowerCase()
  if (value === 'leave' || value === 'decrease' || value === 'quit' || normalizedBucket.includes('leave') || normalizedBucket.includes('decrease')) return 'leave'
  if (value === 'invite' || value === 'invited') return 'invite'
  if (value === 'add' || value === 'join') return 'add'
  return normalizedBucket.includes('invited') ? 'invite' : 'add'
}

function getGroupNoticeStatus(item: Record<string, unknown>): WebQQNotice['status'] {
  if (!isHandledGroupNotice(item)) return 'pending'
  const approved = getBooleanField(item, ['approved', 'approve', 'accepted'])
  return approved === false ? 'rejected' : 'approved'
}

function normalizeGroupNotice(raw: unknown, bucket: string, index: number): WebQQNotice {
  const item = isRecord(raw) ? raw : {}
  const requestId = getStringField(item, ['request_id', 'requestId', 'notice_id', 'noticeId', 'flag', 'seq', 'id']) || String(index)
  const groupId = getStringField(item, ['group_id', 'groupId', 'group_code', 'groupCode'])
  const groupName = getStringField(item, ['group_name', 'groupName']) || groupId
  const requesterId = getStringField(item, ['requester_uin', 'requester_id', 'requesterId', 'user_id', 'userId', 'member_uin', 'memberUin', 'uin'])
  const requesterName = getStringField(item, ['requester_nick', 'requesterNick', 'nickname', 'nick', 'user_name', 'name']) || requesterId
  const comment = getStringField(item, ['message', 'comment', 'reason'])
  const subType = normalizeGroupRequestSubType(getStringField(item, ['sub_type', 'subType', 'request_type', 'type']), bucket)
  const actionText = subType === 'leave'
    ? '退出群聊'
    : subType === 'invite'
      ? '邀请入群'
      : '申请加入群聊'
  return {
    id: subType === 'leave' ? `group:leave:${requestId}` : `group:${requestId}`,
    type: 'group-notice',
    title: groupName || '群通知',
    subtitle: requesterName ? `${requesterName} ${actionText}` : actionText,
    avatar: groupId ? getGroupAvatar(groupId) : '',
    status: subType === 'leave' ? 'approved' : getGroupNoticeStatus(item),
    time: toTimestampMs(getStringField(item, ['time', 'timestamp', 'request_time', 'requestTime', 'create_time', 'createTime'])),
    subType,
    ...(subType !== 'leave' ? { flag: requestId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(groupName ? { groupName } : {}),
    ...(requesterId ? { requesterId } : {}),
    ...(requesterName ? { requesterName } : {}),
    ...(comment ? { comment } : {}),
  }
}

function normalizeGroupNotices(result: unknown) {
  const notices: WebQQNotice[] = []
  for (const bucket of ['join_requests', 'JoinRequest', 'invited_requests', 'InvitedRequest', 'requests', 'notices', 'leave_notices', 'leave_notifications', 'decrease_notices']) {
    const items = toArrayResult(result, bucket)
    items.forEach((item, index) => {
      notices.push(normalizeGroupNotice(item, bucket, index))
    })
  }
  return notices
}

async function loadFriendCategories(bot: OneBotBot) {
  try {
    return toArrayResult(await callAction(bot, 'get_friends_with_category'), 'categories').map(normalizeFriendCategory)
  } catch {
    return []
  }
}

async function loadRecentContacts(bot: OneBotBot, friends: WebQQFriend[], groups: WebQQGroup[], imageUrlResolver?: (file: string) => string) {
  try {
    const result = await callAction(bot, 'get_recent_contact', { count: 50 })
    const recent = await Promise.all(toArrayResult(result, 'contacts').map((item) => normalizeRecentContact(item, bot, friends, groups, imageUrlResolver)))
    return recent.filter((item): item is WebQQRecentContact => !!item)
  } catch {
    return []
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

    async resolveForward(id: string) {
      return resolveOneBotForward(getBot(), id, imageUrlResolver)
    },

    async resolveImage(file: string) {
      return resolveOneBotImage(getBot(), file, imageUrlResolver)
    },

    async loadContacts(): Promise<WebQQContacts> {
      const bot = getBot()
      const [friendCategories, groupsResult] = await Promise.all([
        loadFriendCategories(bot),
        callAction(bot, 'get_group_list'),
      ])
      const friends = friendCategories.length
        ? friendCategories.flatMap((category) => category.friends)
        : toArrayResult(await callAction(bot, 'get_friend_list'), 'friends').map((friend) => normalizeFriend(friend))
      const groups = toArrayResult(groupsResult, 'groups').map(normalizeGroup)
      const recent = await loadRecentContacts(bot, friends, groups, imageUrlResolver)
      return {
        friends,
        groups,
        ...(friendCategories.length ? { friendCategories } : {}),
        ...(recent.length ? { recent } : {}),
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

    async loadGroupInfo(query: WebQQGroupInfoQuery): Promise<WebQQGroupInfo> {
      const bot = getBot()
      const membersResult = await callAction(bot, 'get_group_member_list', { group_id: toOneBotId(query.groupId) })
      const announcements = await loadGroupAnnouncements(bot, query.groupId)
      return {
        announcements,
        members: toArrayResult(membersResult, 'members').map(normalizeGroupMember),
      }
    },

    async loadNotices(friendRequests: WebQQNotice[] = []): Promise<WebQQNotice[]> {
      try {
        const result = await callAction(getBot(), 'get_group_system_msg', {})
        return [...friendRequests, ...normalizeGroupNotices(result)]
      } catch {
        return friendRequests
      }
    },

    async handleNotice(action: WebQQNoticeAction) {
      if (action.type === 'friend-request') {
        await callAction(getBot(), 'set_friend_add_request', {
          flag: action.flag,
          approve: action.approve,
        })
        return
      }
      await callAction(getBot(), 'set_group_add_request', {
        flag: action.flag,
        sub_type: action.subType || 'add',
        approve: action.approve,
      })
    },
  }
}
