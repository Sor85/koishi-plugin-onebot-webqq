import { isRecord } from '../shared/record'
import { readStructuredText } from './structured-text'

export interface ChatLunaCharacterAfterChatPayload {
  session?: unknown
  lastResponseMessage?: unknown
  completionMessages?: unknown
  text?: unknown
}

function isAssistantMessageSnapshot(value: unknown) {
  if (!isRecord(value)) return false
  const role = String(value.role ?? value.type ?? '').trim().toLowerCase()
  if (role === 'assistant' || role === 'ai') return true
  const id = Array.isArray(value.id) ? value.id.map(String).join(':').toLowerCase() : ''
  return id.includes('aimessage') || id.includes('assistantmessage')
}

function readCompletionMessagesText(value: unknown) {
  if (!Array.isArray(value)) return ''
  for (let index = value.length - 1; index >= 0; index--) {
    const message = value[index]
    if (!isAssistantMessageSnapshot(message)) continue
    const text = readStructuredText(message)
    if (text) return text
  }
  return ''
}

export function readCharacterAfterChatText(payload: ChatLunaCharacterAfterChatPayload) {
  const candidates = [
    readStructuredText(payload.lastResponseMessage),
    readStructuredText(payload.text),
    readCompletionMessagesText(payload.completionMessages),
  ].filter(Boolean)
  // chatluna-character 的 lastResponseMessage 有时是已发送的清理后文本，
  // `<think>` 仍保留在 completionMessages 快照里；不能被第一个非空候选提前截断。
  return candidates.find((text) => parseThinkContent(text)) || candidates[0] || ''
}

export function parseThinkContent(text: string) {
  const thoughts = Array.from(text.matchAll(/<think\b[^>]*>([\s\S]*?)<\/think\s*>/gi))
    .map((match) => (match[1] ?? '').trim())
    .filter(Boolean)
  return thoughts.join('\n\n')
}
