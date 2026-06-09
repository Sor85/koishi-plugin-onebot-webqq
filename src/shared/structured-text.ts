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
