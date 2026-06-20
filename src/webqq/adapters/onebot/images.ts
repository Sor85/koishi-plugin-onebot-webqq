import type { WebQQMessageElement } from '../../types'
import { callAction, type OneBotBot } from '../../../onebot/actions'
import { getStringField, isRecord } from '../../../onebot/data'

function isRemoteUrl(value: string) {
  return /^https?:\/\//.test(value)
}

const unsafeFileScheme = /^[a-z][a-z0-9+.-]*:/i
const windowsAbsolutePath = /^[a-z]:[\\/]/i

export function assertSafeOneBotMediaFile(file: string) {
  const normalized = file.trim().replace(/\\/g, '/')
  if (!normalized ||
    normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.endsWith('/..') ||
    windowsAbsolutePath.test(file) ||
    unsafeFileScheme.test(file)) {
    throw new Error('不安全的 OneBot 媒体文件标识')
  }
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

export async function resolveOneBotImage(bot: OneBotBot, file: string, imageUrlResolver?: (file: string) => string) {
  // get_image 的 file 应该是 OneBot 文件 ID；拒绝路径和 scheme，避免上层输入被适配器当成本地文件读取。
  assertSafeOneBotMediaFile(file)
  const result = await callAction(bot, 'get_image', { file })
  return {
    url: resolveImageUrl(result, imageUrlResolver),
    debug: readImageDebug(result),
  }
}

export async function normalizeImageElement(data: Record<string, unknown>, bot: OneBotBot, imageUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
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
