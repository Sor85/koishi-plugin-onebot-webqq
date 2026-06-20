import type { WebQQMessageElement } from '../../types'
import type { OneBotBot } from '../../../onebot/actions'
import { getStringField } from '../../../onebot/data'
import { resolveOneBotImage } from '../../../onebot/media/images'

function isRemoteUrl(value: string) {
  return /^https?:\/\//.test(value)
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
