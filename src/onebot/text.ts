import { isRecord } from './data'

const mentionAttributeKeys = ['name', 'nickname', 'nick', 'card', 'text', 'display', 'qq', 'id', 'user_id', 'uin']

function decodeTextEntity(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  }
  return value
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (entity: string) => namedEntities[entity.slice(1, -1)] || entity)
    .replace(/&#(\d+);/g, (_entity: string, code: string) => decodeTextCodePoint(code, 10))
    .replace(/&#x([0-9a-f]+);/gi, (_entity: string, code: string) => decodeTextCodePoint(code, 16))
}

function decodeTextCodePoint(value: string, radix: number) {
  const code = Number.parseInt(value, radix)
  if (!Number.isInteger(code)) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

function readMarkupAttribute(source: string, keys: string[]) {
  for (const key of keys) {
    const match = new RegExp(`(?:^|[\\s,])${key}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s,>\\]]+))`, 'i').exec(source)
    const value = match?.[2] ?? match?.[3] ?? match?.[4]
    if (value && value.trim()) return decodeTextEntity(value).trim()
  }
  return ''
}

// 部分 OneBot 实现会把引用里的 @ 以 CQ/XML 文本返回，只在命中 @ 标记时转换。
export function normalizeMentionMarkupText(value: string) {
  const text = value.trim()
  if (!text) return ''
  const decodedText = decodeTextEntity(text)
  const source = /\[CQ:at,[^\]]+\]/i.test(text) || /<(?:[\w-]+:)?(?:at|qqbot-at-user)\b/i.test(text)
    ? text
    : decodedText
  const hasMentionMarkup = /\[CQ:at,[^\]]+\]/i.test(source) || /<(?:[\w-]+:)?(?:at|qqbot-at-user)\b/i.test(source)
  if (!hasMentionMarkup) return text
  const normalized = source
    .replace(/\[CQ:at,([^\]]+)\]/gi, (_source: string, attrs: string) => {
      const target = readMarkupAttribute(attrs, mentionAttributeKeys)
      return target ? `@${target}` : ''
    })
    .replace(/<(?:[\w-]+:)?(?:at|qqbot-at-user)\b[^>]*\/?>/gi, (tag: string) => {
      const target = readMarkupAttribute(tag, mentionAttributeKeys)
      return target ? `@${target}` : ''
    })
    .replace(/<[^>]+>/g, '')
  return decodeTextEntity(normalized).replace(/\s+/g, ' ').trim()
}

export function getTextValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return normalizeMentionMarkupText(String(value))
  if (Array.isArray(value)) return value.map(getTextValue).filter(Boolean).join('\n')
  if (!isRecord(value)) return ''
  for (const key of ['text', 'content', 'message', 'data']) {
    const text = getTextValue(value[key])
    if (text) return text
  }
  return ''
}
