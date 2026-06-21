import { callAction, type OneBotBot } from '../actions'
import { getActionData, getStringField, isRecord, toOneBotId } from '../data'
import { assertSafeOneBotMediaFile } from './images'

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
  assertSafeOneBotMediaFile(file)
  const result = await callAction(bot, 'get_record', { file, out_format: 'mp3' })
  return {
    url: resolveRecordUrl(result, mediaUrlResolver),
    debug: readRecordDebug(result),
  }
}

export async function transcribeOneBotRecord(bot: OneBotBot, messageId: string) {
  const result = await callAction(bot, 'voice_msg_to_text', { message_id: toOneBotId(messageId) })
  if (typeof result === 'string') return result
  const source = isRecord(result) ? getActionData(result) : {}
  return getStringField(source, ['text']) || ''
}
