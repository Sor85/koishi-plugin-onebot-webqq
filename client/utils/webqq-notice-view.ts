import type { WebQQNotice } from '../state'

export function sortPendingNotices(items: WebQQNotice[]) {
  return items.slice().sort((left, right) => {
    if (left.status === right.status) return 0
    return left.status === 'pending' ? -1 : 1
  })
}

export function formatNoticeComment(comment: string) {
  const match = comment.match(/^(问题[:：].+?)(?:\s+|(?=答案[:：]))(答案[:：].+)$/)
  return match ? [match[1], match[2]] : [comment]
}

export function getHandledNoticeStatusText(notice: WebQQNotice) {
  if (notice.subType === 'leave') return ''
  if (notice.status === 'approved') return '已同意'
  if (notice.status === 'rejected') return '已拒绝'
  return ''
}

export function canHandleNotice(notice: WebQQNotice) {
  return notice.subType !== 'leave' && notice.status === 'pending' && !!notice.flag
}
