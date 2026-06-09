import type { Config } from '../config'
import type { WebQQMessage } from '../onebot'
import { isRecord, readRecordText } from '../shared/structured-text'

interface WebQQAffinityContext {
  database?: {
    get(table: string, query: Record<string, unknown>): Promise<unknown[]>
  }
}

interface WebQQAffinityLogger {
  info(format: string, ...param: unknown[]): unknown
}

interface WebQQAffinityRecord {
  scopeId?: string
  userId: string
  affinity: number
  relation?: string
  specialRelation?: string
}

interface WebQQAffinityBadge {
  senderAffinity?: number
  senderRelationship?: string
}

interface WebQQRelationshipLevel {
  min: number
  max: number
  relation: string
}

const chatLunaAffinityTable = 'chatluna_affinity_v2'
const defaultWebQQRelationshipLevels: WebQQRelationshipLevel[] = [
  { min: -9999, max: 0, relation: '厌恶' },
  { min: 1, max: 50, relation: '陌生' },
  { min: 51, max: 120, relation: '熟悉' },
  { min: 121, max: 180, relation: '友好' },
  { min: 181, max: 9999, relation: '亲密' },
]

function readRecordNumber(source: unknown, key: string): number | undefined {
  if (!isRecord(source)) return
  const value = source[key]
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || !value.trim()) return
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function readWebQQAffinityRecord(source: unknown): WebQQAffinityRecord | undefined {
  const scopeId = readRecordText(source, ['scopeId', 'scope_id'])
  const userId = readRecordText(source, ['userId', 'user_id'])
  const affinity = readRecordNumber(source, 'affinity')
  if (!userId || affinity == null) return
  const relation = readRecordText(source, ['relation'])
  const specialRelation = readRecordText(source, ['specialRelation', 'special_relation'])
  return {
    ...(scopeId ? { scopeId } : {}),
    userId,
    affinity,
    ...(relation ? { relation } : {}),
    ...(specialRelation ? { specialRelation } : {}),
  }
}

function resolveWebQQRelationshipByAffinity(affinity: number) {
  const level = defaultWebQQRelationshipLevels.find((item) => affinity >= item.min && affinity <= item.max)
  return level?.relation || '未知'
}

function createWebQQAffinityBadge(record: WebQQAffinityRecord, config: Config): WebQQAffinityBadge {
  const relationship = record.specialRelation || record.relation || resolveWebQQRelationshipByAffinity(record.affinity)
  return {
    ...(config.showWebQQAffinity ? { senderAffinity: record.affinity } : {}),
    ...(config.showWebQQRelationship && relationship ? { senderRelationship: relationship } : {}),
  }
}

function shouldLoadWebQQAffinity(config: Config) {
  return !!(config.showWebQQAffinity || config.showWebQQRelationship)
}

async function loadWebQQAffinityRecords(
  ctx: WebQQAffinityContext,
  config: Config,
  userIds: string[],
) {
  const scopeId = config.webQQAffinityScopeId?.trim()
  if (scopeId) {
    const rows = await ctx.database?.get(chatLunaAffinityTable, {
      scopeId,
      userId: { $in: userIds },
    }) ?? []
    return rows.map(readWebQQAffinityRecord).filter((record): record is WebQQAffinityRecord => !!record)
  }
  const rows = await ctx.database?.get(chatLunaAffinityTable, {}) ?? []
  const records = rows.map(readWebQQAffinityRecord).filter((record): record is WebQQAffinityRecord => !!record)
  const scopeIds = [...new Set(records.map((record) => record.scopeId).filter(Boolean))]
  if (scopeIds.length !== 1) return []
  const targetUserIds = new Set(userIds)
  return records.filter((record) => record.scopeId === scopeIds[0] && targetUserIds.has(record.userId))
}

async function readWebQQAffinityBadges(
  ctx: WebQQAffinityContext,
  config: Config,
  messages: WebQQMessage[],
  logger?: WebQQAffinityLogger,
) {
  if (!shouldLoadWebQQAffinity(config) || !ctx.database) return new Map<string, WebQQAffinityBadge>()
  const userIds = [...new Set(messages.map((message) => message.senderId).filter(Boolean))]
  if (!userIds.length) return new Map<string, WebQQAffinityBadge>()
  try {
    const rows = await loadWebQQAffinityRecords(ctx, config, userIds)
    const badges = new Map<string, WebQQAffinityBadge>()
    for (const row of rows) {
      const record = readWebQQAffinityRecord(row)
      if (!record) continue
      badges.set(record.userId, createWebQQAffinityBadge(record, config))
    }
    return badges
  } catch (error) {
    logger?.info('webqq affinity load failed %s', error instanceof Error ? error.message : String(error))
    return new Map<string, WebQQAffinityBadge>()
  }
}

export async function attachWebQQAffinityBadges(
  ctx: WebQQAffinityContext,
  config: Config,
  messages: WebQQMessage[],
  logger?: WebQQAffinityLogger,
) {
  const badges = await readWebQQAffinityBadges(ctx, config, messages, logger)
  if (!badges.size) return messages
  let changed = false
  const next = messages.map((message) => {
    const badge = badges.get(message.senderId)
    if (!badge) return message
    changed = true
    return {
      ...message,
      ...badge,
    }
  })
  return changed ? next : messages
}
