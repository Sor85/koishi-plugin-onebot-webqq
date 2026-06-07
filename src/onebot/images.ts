import type { WebQQMessageElement } from './types'
import { callAction, type OneBotBot } from './actions'
import { getStringField, isRecord } from './data'

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

export async function resolveOneBotImage(bot: OneBotBot, file: string, imageUrlResolver?: (file: string) => string) {
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
