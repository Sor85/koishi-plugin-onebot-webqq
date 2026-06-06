import type { Config } from './config'
import type { WebQQChatType, WebQQMessage } from './onebot'

export interface WebQQConversationSummary {
  summary: string
  time: number
}

export interface WebQQStoredState {
  conversationSummaries: Record<string, WebQQConversationSummary>
  conversationUnreadCounts: Record<string, number>
}

export interface WebQQMessageCacheQuery {
  type: WebQQChatType
  peerId: string
}

export interface WebQQMessageCachePayload extends WebQQMessageCacheQuery {
  messages: WebQQMessage[]
}

export interface WebQQStoragePayload {
  conversationSummaries?: Record<string, WebQQConversationSummary>
  conversationUnreadCounts?: Record<string, number>
  messages?: WebQQMessage[]
}

export interface ChatCapsuleStorageRow {
  id: string
  payload: WebQQStoragePayload
  updatedAt: Date
}

interface WebQQDatabase {
  get(table: string, query: Record<string, unknown>): Promise<unknown[]>
  upsert(table: string, rows: unknown[]): Promise<unknown>
}

interface WebQQStorageContext {
  database?: WebQQDatabase
}

export const chatCapsuleStorageTable = 'onebot_webqq_storage'

const webQQStateStorageId = 'state:webqq'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function createEmptyWebQQStoredState(): WebQQStoredState {
  return {
    conversationSummaries: {},
    conversationUnreadCounts: {},
  }
}

function readWebQQStoredConversationSummaries(value: unknown) {
  const summaries: Record<string, WebQQConversationSummary> = {}
  if (!isRecord(value)) return summaries
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue
    if (typeof raw.summary === 'string' && typeof raw.time === 'number') summaries[key] = {
      summary: raw.summary,
      time: raw.time,
    }
  }
  return summaries
}

function readWebQQStoredUnreadCounts(value: unknown) {
  const counts: Record<string, number> = {}
  if (!isRecord(value)) return counts
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number' && count > 0) counts[key] = count
  }
  return counts
}

function readWebQQStoredState(value: unknown): WebQQStoredState {
  const empty = createEmptyWebQQStoredState()
  if (!isRecord(value)) return empty
  return {
    conversationSummaries: readWebQQStoredConversationSummaries(value.conversationSummaries),
    conversationUnreadCounts: readWebQQStoredUnreadCounts(value.conversationUnreadCounts),
  }
}

function getWebQQDatabase(ctx: WebQQStorageContext) {
  if (!ctx.database) throw new Error('Koishi 数据库服务不可用')
  return ctx.database
}

async function loadKoishiWebQQStorage(ctx: WebQQStorageContext) {
  const database = getWebQQDatabase(ctx)
  const [row] = await database.get(chatCapsuleStorageTable, { id: webQQStateStorageId })
  return readWebQQStoredState(isRecord(row) ? row.payload : undefined)
}

async function saveKoishiWebQQStorage(ctx: WebQQStorageContext, state: WebQQStoredState) {
  const database = getWebQQDatabase(ctx)
  await database.upsert(chatCapsuleStorageTable, [{
    id: webQQStateStorageId,
    payload: state,
    updatedAt: new Date(),
  }])
}

function getWebQQMessageStorageId(query: WebQQMessageCacheQuery) {
  return `messages:${query.type}:${query.peerId}`
}

function readWebQQStoredMessages(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.messages)) return []
  return value.messages.filter(isRecord) as unknown as WebQQMessage[]
}

export async function loadWebQQStorage(ctx: WebQQStorageContext, config: Config): Promise<WebQQStoredState> {
  if (config.webQQStorageBackend === 'koishi') return loadKoishiWebQQStorage(ctx)
  return createEmptyWebQQStoredState()
}

export async function saveWebQQStorage(ctx: WebQQStorageContext, config: Config, state: WebQQStoredState): Promise<void> {
  const normalized = readWebQQStoredState(state)
  if (config.webQQStorageBackend === 'koishi') {
    await saveKoishiWebQQStorage(ctx, normalized)
    return
  }
}

export async function loadKoishiWebQQMessageCache(ctx: WebQQStorageContext, config: Config, query: WebQQMessageCacheQuery) {
  if (config.webQQStorageBackend !== 'koishi') return []
  const database = getWebQQDatabase(ctx)
  const [row] = await database.get(chatCapsuleStorageTable, { id: getWebQQMessageStorageId(query) })
  return readWebQQStoredMessages(isRecord(row) ? row.payload : undefined)
}

export async function saveKoishiWebQQMessageCache(ctx: WebQQStorageContext, config: Config, payload: WebQQMessageCachePayload) {
  if (config.webQQStorageBackend !== 'koishi') return
  const database = getWebQQDatabase(ctx)
  await database.upsert(chatCapsuleStorageTable, [{
    id: getWebQQMessageStorageId(payload),
    payload: { messages: payload.messages },
    updatedAt: new Date(),
  }])
}
