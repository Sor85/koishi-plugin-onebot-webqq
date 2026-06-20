import type { WebQQMessageElement } from '../../types'
import type { OneBotBot } from '../../../onebot/actions'
import { getNumberField, getStringField } from '../../../onebot/data'
import { resolveOneBotRecord, transcribeOneBotRecord } from '../../../onebot/media/records'

export async function normalizeRecordElement(data: Record<string, unknown>, bot: OneBotBot, mediaUrlResolver?: (file: string) => string): Promise<WebQQMessageElement> {
  const duration = getNumberField(data, ['duration', 'time', 'seconds'])
  const transcript = getStringField(data, ['text', 'transcript'])
  const base = {
    type: 'record' as const,
    text: '[语音]',
    ...(duration ? { duration } : {}),
    ...(transcript ? { transcript } : {}),
  }
  const url = getStringField(data, ['url', 'temp_url', 'src'])
  if (url) return { ...base, url: mediaUrlResolver?.(url) || url }
  const file = getStringField(data, ['file', 'file_id', 'resource_id', 'path'])
  if (!file) return base
  try {
    return { ...base, url: (await resolveOneBotRecord(bot, file, mediaUrlResolver)).url }
  } catch {
    return base
  }
}

export { transcribeOneBotRecord }
