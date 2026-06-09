export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function readRecordText(source: unknown, keys: string[]) {
  if (!isRecord(source)) return ''
  for (const key of keys) {
    const value = source[key]
    if (value != null && String(value).trim()) return String(value)
  }
  return ''
}

export function getStringField(source: Record<string, unknown>, keys: string[]) {
  return readRecordText(source, keys)
}

export function readRecordNumber(source: unknown, key: string): number | undefined {
  if (!isRecord(source)) return
  const value = source[key]
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || !value.trim()) return
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export function getNumberField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = Number(source[key])
    if (Number.isFinite(value)) return value
  }
  return 0
}

export function getBooleanField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (value === true || value === 'true' || value === 1) return true
    if (value === false || value === 'false' || value === 0) return false
  }
  return undefined
}

export function toOneBotId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value
}

export function toTimestampMs(value: unknown) {
  const time = Number(value) || 0
  return time > 100000000000 ? time : time * 1000
}

export function toArrayResult(result: unknown, key: string) {
  if (Array.isArray(result)) return result
  if (!isRecord(result)) return []
  if (Array.isArray(result[key])) return result[key]
  if (isRecord(result.data) && Array.isArray(result.data[key])) return result.data[key]
  if (Array.isArray(result.data)) return result.data
  return []
}

export function getActionData(result: unknown) {
  const item = isRecord(result) ? result : {}
  return isRecord(item.data) ? item.data : item
}

export function readStructuredText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(readStructuredText).join('')
  if (!isRecord(value)) return ''
  if (value.content !== undefined && value.content !== value) return readStructuredText(value.content)
  if (value.text !== undefined) return readStructuredText(value.text)
  if (Array.isArray(value.children)) return readStructuredText(value.children)
  if (isRecord(value.attrs)) return readRecordText(value.attrs, ['content', 'text'])
  if (isRecord(value.kwargs)) return readStructuredText(value.kwargs)
  if (isRecord(value.lc_kwargs)) return readStructuredText(value.lc_kwargs)
  return ''
}
