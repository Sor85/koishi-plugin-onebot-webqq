import type { WebQQMessage } from './onebot'
import { readRecordText } from './structured-text'

export interface WebQQSenderMetadata {
  senderRole?: string
  senderLevel?: string
  senderTitle?: string
}

function normalizeGroupRole(role: string) {
  if (role === 'owner') return '群主'
  if (role === 'admin' || role === 'administrator') return '管理员'
  return ''
}

export function readWebQQSenderMetadata(source: unknown): WebQQSenderMetadata {
  const role = normalizeGroupRole(readRecordText(source, ['role']))
  const level = readRecordText(source, ['level', 'sender_level', 'senderLevel'])
  const title = readRecordText(source, ['title', 'special_title', 'specialTitle'])
  return {
    ...(role ? { senderRole: role } : {}),
    ...(level ? { senderLevel: level } : {}),
    ...(title ? { senderTitle: title } : {}),
  }
}

export function hasWebQQSenderMetadata(metadata: WebQQSenderMetadata) {
  return !!(metadata.senderRole || metadata.senderLevel || metadata.senderTitle)
}

export function readWebQQMessageSenderMetadata(message: WebQQMessage): WebQQSenderMetadata {
  return {
    ...(message.senderRole ? { senderRole: message.senderRole } : {}),
    ...(message.senderLevel ? { senderLevel: message.senderLevel } : {}),
    ...(message.senderTitle ? { senderTitle: message.senderTitle } : {}),
  }
}

export function isSameWebQQSenderMetadata(left: WebQQSenderMetadata | undefined, right: WebQQSenderMetadata) {
  return !!left &&
    left.senderRole === right.senderRole &&
    left.senderLevel === right.senderLevel &&
    left.senderTitle === right.senderTitle
}

export function fillWebQQMessageSenderMetadata(message: WebQQMessage, metadata?: WebQQSenderMetadata) {
  if (!metadata) return message
  return {
    ...message,
    ...(!message.senderRole && metadata.senderRole ? { senderRole: metadata.senderRole } : {}),
    ...(!message.senderLevel && metadata.senderLevel ? { senderLevel: metadata.senderLevel } : {}),
    ...(!message.senderTitle && metadata.senderTitle ? { senderTitle: metadata.senderTitle } : {}),
  }
}

export function replaceWebQQMessageSenderMetadata(message: WebQQMessage, metadata: WebQQSenderMetadata) {
  const { senderRole: _senderRole, senderLevel: _senderLevel, senderTitle: _senderTitle, ...next } = message
  return {
    ...next,
    ...metadata,
  }
}
