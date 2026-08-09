import type { WebQQMessage, WebQQMessageSearchQuery, WebQQMessageSearchResult } from './types'

function getMessageSearchText(message: WebQQMessage) {
  return [
    message.senderName,
    message.summary,
    ...message.elements.flatMap((element) => [element.title, element.text, element.transcript, element.source]),
  ].filter(Boolean).join('\n').toLocaleLowerCase()
}

export async function searchWebQQMessageHistory(
  query: WebQQMessageSearchQuery,
  options: {
    pageSize: number
    maxPages: number
    loadMessages: (query: { type: WebQQMessageSearchQuery['type']; peerId: string; limit: number; beforeSequence?: string }) => Promise<WebQQMessage[]>
  },
): Promise<WebQQMessageSearchResult> {
  const keyword = query.keyword.trim().toLocaleLowerCase()
  if (!keyword) return { messages: [], scannedCount: 0, exhausted: true }

  const messages: WebQQMessage[] = []
  const seenMessageKeys = new Set<string>()
  let scannedCount = 0
  let beforeSequence = query.beforeSequence
  let exhausted = false

  for (let pageIndex = 0; pageIndex < options.maxPages; pageIndex++) {
    const page = await options.loadMessages({
      type: query.type,
      peerId: query.peerId,
      limit: options.pageSize,
      ...(beforeSequence ? { beforeSequence } : {}),
    })
    if (!page.length) {
      exhausted = true
      break
    }

    let freshCount = 0
    for (const message of page) {
      const key = message.id || message.sequence
      if (key && seenMessageKeys.has(key)) continue
      if (key) seenMessageKeys.add(key)
      freshCount++
      scannedCount++
      if (getMessageSearchText(message).includes(keyword)) messages.push(message)
    }

    const nextBeforeSequence = page[0]?.sequence
    // 部分 OneBot 实现会重复返回边界消息；游标不前进或整页重复时必须停止，避免搜索请求无限循环。
    if (!nextBeforeSequence || nextBeforeSequence === beforeSequence || freshCount === 0) {
      exhausted = true
      break
    }
    beforeSequence = nextBeforeSequence
    if (page.length < options.pageSize) {
      exhausted = true
      break
    }
  }

  return {
    messages,
    scannedCount,
    exhausted,
    ...(!exhausted && beforeSequence ? { nextBeforeSequence: beforeSequence } : {}),
  }
}
