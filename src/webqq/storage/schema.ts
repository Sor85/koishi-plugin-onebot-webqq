import type { WebQQMessage } from '../types'

export interface WebQQStoragePayload {
  conversationSummaries?: Record<string, { summary: string; time: number }>
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

export interface WebQQStorageContext {
  database?: WebQQDatabase
}

export const chatCapsuleStorageTable = 'onebot_webqq_storage'

export function getWebQQDatabase(ctx: WebQQStorageContext) {
  if (!ctx.database) throw new Error('Koishi 数据库服务不可用')
  return ctx.database
}
