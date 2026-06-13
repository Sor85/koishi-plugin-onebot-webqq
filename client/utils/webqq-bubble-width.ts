function getInlineRuns(bubble: HTMLElement) {
  return [...bubble.querySelectorAll<HTMLElement>('.onebot-webqq-webqq__inline-run')]
}

function readPixelValue(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getRenderedLineWidths(node: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(node)
  try {
    return [...range.getClientRects()].map((rect) => rect.width).filter((width) => width > 0)
  } finally {
    range.detach()
  }
}

function getBubbleBoxInset(bubble: HTMLElement) {
  const computedStyle = typeof window === 'undefined' ? undefined : window.getComputedStyle(bubble)
  if (!computedStyle || computedStyle.boxSizing !== 'border-box') return 0
  return (
    readPixelValue(computedStyle.paddingLeft) +
    readPixelValue(computedStyle.paddingRight) +
    readPixelValue(computedStyle.borderLeftWidth) +
    readPixelValue(computedStyle.borderRightWidth)
  )
}

function getMaxLineWidth(widths: number[]) {
  return widths.reduce((width, item) => Math.max(width, item), 0)
}

function setBubbleContentWidth(bubble: HTMLElement, contentWidth: number, horizontalInset: number) {
  bubble.style.width = `${Math.ceil(contentWidth + horizontalInset)}px`
}

function measureInlineLineWidths(inlineRuns: HTMLElement[]) {
  return inlineRuns.flatMap(getRenderedLineWidths)
}

export function fitWebQQBubbleToInlineLines(bubble: HTMLElement) {
  const inlineRuns = getInlineRuns(bubble)
  if (!inlineRuns.length) {
    bubble.style.width = ''
    return
  }

  bubble.style.width = ''
  const horizontalInset = getBubbleBoxInset(bubble)
  const lineWidths = measureInlineLineWidths(inlineRuns)
  const maxLineWidth = getMaxLineWidth(lineWidths)
  if (!maxLineWidth) return

  setBubbleContentWidth(bubble, maxLineWidth, horizontalInset)
}
