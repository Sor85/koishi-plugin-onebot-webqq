import type { WebQQMessageElement } from './types'
import { callAction, type OneBotBot } from './actions'
import { getActionData, getNumberField, getStringField, isRecord, toOneBotId } from './data'

function resolveRecordUrl(result: unknown, mediaUrlResolver?: (file: string) => string) {
  const source = getActionData(result)
  const url = getStringField(source, ['url', 'temp_url', 'src'])
  if (url) return mediaUrlResolver?.(url) || url
  const file = getStringField(source, ['file', 'path'])
  return file ? mediaUrlResolver?.(file) || file : ''
}

function readRecordDebug(result: unknown) {
  const source = getActionData(result)
  return {
    url: getStringField(source, ['url', 'temp_url', 'src']),
    file: getStringField(source, ['file', 'path']),
  }
}

export async function resolveOneBotRecord(bot: OneBotBot, file: string, mediaUrlResolver?: (file: string) => string) {
  // OneBot 的 record 文件常是 silk/amr；请求 mp3 可以让浏览器端 audio 更稳定地播放。
  const result = await callAction(bot, 'get_record', { file, out_format: 'mp3' })
  return {
    url: resolveRecordUrl(result, mediaUrlResolver),
    debug: readRecordDebug(result),
  }
}

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

export async function transcribeOneBotRecord(bot: OneBotBot, messageId: string) {
  const result = await callAction(bot, 'voice_msg_to_text', { message_id: toOneBotId(messageId) })
  if (typeof result === 'string') return result
  const source = isRecord(result) ? getActionData(result) : {}
  return getStringField(source, ['text']) || ''
}
