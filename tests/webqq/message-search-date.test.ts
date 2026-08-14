import { describe, expect, it } from 'vitest'
import { localDateToMessageSearchRange } from '../../client/webqq/utils/message-search-date'

describe('WebQQ message search date', () => {
  it('converts a local calendar day to a half-open ISO range', () => {
    const range = localDateToMessageSearchRange('2026-08-14')

    expect(range).toBeDefined()
    const start = new Date(range!.createdAtStart)
    const end = new Date(range!.createdAtEnd)
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(7)
    expect(start.getDate()).toBe(14)
    expect(start.getHours()).toBe(0)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(7)
    expect(end.getDate()).toBe(15)
    expect(end.getHours()).toBe(0)
  })

  it('rejects invalid calendar dates', () => {
    expect(localDateToMessageSearchRange('2026-02-30')).toBeUndefined()
    expect(localDateToMessageSearchRange('2026/08/14')).toBeUndefined()
  })
})
