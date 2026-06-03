import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const style = await readFile(new URL('../client/style.scss', import.meta.url), 'utf8')

function ruleBody(selector: string) {
  const start = style.indexOf(`${selector} {`)
  if (start < 0) return ''
  const bodyStart = style.indexOf('{', start) + 1
  let depth = 1
  for (let index = bodyStart; index < style.length; index++) {
    if (style[index] === '{') depth++
    if (style[index] === '}') depth--
    if (depth === 0) return style.slice(bodyStart, index)
  }
  return ''
}

describe('chat capsule styles', () => {
  it('keeps the status dot visible outside the avatar curve', () => {
    expect(ruleBody('.chat-capsule__avatar')).not.toContain('overflow: hidden')
    expect(ruleBody('.chat-capsule__avatar').match(/img\s*{[\s\S]*border-radius:\s*inherit/)).toBeTruthy()
  })

  it('keeps the bot name smaller and anchored near the top', () => {
    expect(ruleBody('.chat-capsule__body')).toContain('align-self: stretch')
    expect(ruleBody('.chat-capsule__body')).toContain('justify-content: flex-start')
    expect(ruleBody('.chat-capsule__body')).toContain('padding-top: 4px')
    expect(ruleBody('.chat-capsule__title')).toContain('font-size: 13px')
    expect(ruleBody('.chat-capsule__title')).toContain('line-height: 18px')
  })

  it('stacks usage rows vertically beside the activity text', () => {
    expect(ruleBody('.chat-capsule')).toContain('width: 286px')
    expect(ruleBody('.chat-capsule__usage')).toContain('flex-direction: column')
    expect(ruleBody('.chat-capsule__usage')).toContain('align-self: stretch')
    expect(ruleBody('.chat-capsule__usage')).toContain('justify-content: space-around')
    expect(ruleBody('.chat-capsule__usage-row')).toContain('align-items: center')
    expect(ruleBody('.chat-capsule__usage-row')).toContain('justify-content: flex-start')
    expect(ruleBody('.chat-capsule__usage-icon')).toContain('width: 13px')
    expect(ruleBody('.chat-capsule__usage-icon')).toContain('stroke: currentColor')
  })

  it('allows the WebQQ chat message pane to scroll inside the fixed panel', () => {
    expect(ruleBody('.chat-capsule-webqq__chat')).toContain('min-height: 0')
    expect(ruleBody('.chat-capsule-webqq__chat-body')).toContain('display: flex')
    expect(ruleBody('.chat-capsule-webqq__chat-body')).toContain('min-height: 0')
    expect(ruleBody('.chat-capsule-webqq__messages')).toContain('overflow-y: auto')
  })

  it('sizes WebQQ message avatars beside bubbles', () => {
    expect(ruleBody('.chat-capsule-webqq__message')).toContain('display: flex')
    expect(ruleBody('.chat-capsule-webqq__message-avatar')).toContain('width: 32px')
    expect(ruleBody('.chat-capsule-webqq__message-avatar')).toContain('border-radius: 50%')
  })

  it('stacks WebQQ rich message elements vertically inside the bubble', () => {
    expect(style).toContain('.chat-capsule-webqq__bubble {\n  display: flex')
    expect(style).toContain('.chat-capsule-webqq__bubble {\n  display: flex;\n  max-width: 100%;\n  flex-direction: column')
    expect(style).not.toContain('.chat-capsule-webqq__bubble {\n  display: inline-flex')
  })

  it('shrinks WebQQ text bubbles to their own message content', () => {
    expect(ruleBody('.chat-capsule-webqq__message-content')).toContain('display: flex')
    expect(ruleBody('.chat-capsule-webqq__message-content')).toContain('flex-direction: column')
    expect(ruleBody('.chat-capsule-webqq__message-content')).toContain('align-items: flex-start')
    expect(ruleBody('.chat-capsule-webqq__message.is-outgoing .chat-capsule-webqq__message-content')).toContain('align-items: flex-end')
  })

  it('styles WebQQ friend category headings in the friend list', () => {
    expect(ruleBody('.chat-capsule-webqq__friend-category-title')).toContain('font-size: 12px')
    expect(ruleBody('.chat-capsule-webqq__friend-category-title')).toContain('color: #9ca3af')
  })

  it('renders WebQQ sender metadata as compact badges', () => {
    expect(ruleBody('.chat-capsule-webqq__sender-line')).toContain('display: flex')
    expect(ruleBody('.chat-capsule-webqq__sender-line')).toContain('gap: 4px')
    expect(ruleBody('.chat-capsule-webqq__message.is-outgoing .chat-capsule-webqq__sender-line')).toContain('justify-content: flex-end')
    expect(ruleBody('.chat-capsule-webqq__sender-badge')).toContain('border-radius: 5px')
    expect(ruleBody('.chat-capsule-webqq__sender-badge.is-owner')).toContain('background: #fff3cf')
    expect(ruleBody('.chat-capsule-webqq__sender-badge.is-admin')).toContain('background: #e9f8ef')
    expect(ruleBody('.chat-capsule-webqq__sender-badge.is-level')).toContain('background: rgba(148, 163, 184, 0.24)')
    expect(ruleBody('.chat-capsule-webqq__sender-badge.is-title')).toContain('background: rgba(18, 183, 245, 0.1)')
  })

  it('hides repeated avatars on merged Telegram-style WebQQ messages', () => {
    expect(ruleBody('.chat-capsule-webqq__message.is-merged')).toContain('margin-top: -14px')
    expect(ruleBody('.chat-capsule-webqq__message.is-merged .chat-capsule-webqq__message-avatar')).toContain('visibility: hidden')
  })

  it('rounds Telegram-style WebQQ message clusters like stacked capsules', () => {
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-telegram .chat-capsule-webqq__bubble')).toContain('margin: 1px 0')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-telegram .chat-capsule-webqq__message.is-cluster-first:not(.is-outgoing) .chat-capsule-webqq__bubble')).toContain('border-bottom-left-radius: 3px')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-telegram .chat-capsule-webqq__message.is-cluster-middle:not(.is-outgoing) .chat-capsule-webqq__bubble')).toContain('border-radius: 3px 18px 18px 3px')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-telegram .chat-capsule-webqq__message.is-cluster-last:not(.is-outgoing) .chat-capsule-webqq__bubble')).toContain('border-top-left-radius: 3px')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-telegram .chat-capsule-webqq__message.is-outgoing.is-cluster-middle .chat-capsule-webqq__bubble')).toContain('border-radius: 18px 3px 3px 18px')
  })

  it('shows Telegram-style WebQQ message times outside bubbles on hover', () => {
    expect(ruleBody('.chat-capsule-webqq__message-body')).toContain('display: flex')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-telegram .chat-capsule-webqq__message-body')).toContain('flex-direction: row')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-telegram .chat-capsule-webqq__message-time')).toContain('opacity: 0')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-telegram .chat-capsule-webqq__message:hover .chat-capsule-webqq__message-time')).toContain('opacity: 1')
  })

  it('keeps WebQQ contact message times in the top-right corner', () => {
    expect(ruleBody('.chat-capsule-webqq__contact')).toContain('position: relative')
    expect(ruleBody('.chat-capsule-webqq__contact')).toContain('padding: 10px 58px 10px 12px')
    expect(ruleBody('.chat-capsule-webqq__contact-time')).toContain('position: absolute')
    expect(ruleBody('.chat-capsule-webqq__contact-time')).toContain('top: 10px')
    expect(ruleBody('.chat-capsule-webqq__contact-time')).toContain('right: 12px')
  })

  it('places WebQQ unread badges on the contact avatar corner', () => {
    expect(ruleBody('.chat-capsule-webqq__contact-avatar')).toContain('position: relative')
    expect(ruleBody('.chat-capsule-webqq__contact-avatar')).toContain('width: 38px')
    expect(ruleBody('.chat-capsule-webqq__contact-avatar')).toContain('height: 38px')
    expect(ruleBody('.chat-capsule-webqq__contact-unread')).toContain('position: absolute')
    expect(ruleBody('.chat-capsule-webqq__contact-unread')).toContain('top: -6px')
    expect(ruleBody('.chat-capsule-webqq__contact-unread')).toContain('right: -6px')
    expect(ruleBody('.chat-capsule-webqq__contact-unread')).toContain('min-width: 18px')
  })

  it('centers the WebQQ notice menu under the bell button', () => {
    expect(ruleBody('.chat-capsule-webqq__sidebar')).toContain('position: relative')
    expect(ruleBody('.chat-capsule-webqq__sidebar')).toContain('z-index: 2')
    expect(ruleBody('.chat-capsule-webqq__notice-menu')).toContain('left: 50%')
    expect(ruleBody('.chat-capsule-webqq__notice-menu')).toContain('z-index: 3')
    expect(ruleBody('.chat-capsule-webqq__notice-menu')).toContain('transform: translateX(-50%)')
  })

  it('uses inline SVG for WebQQ tab icons instead of pseudo elements', () => {
    expect(ruleBody('.chat-capsule-webqq__tab-icon')).toContain('stroke: currentColor')
    expect(style).not.toContain('.chat-capsule-webqq__tab-icon::before')
    expect(style).not.toContain('.chat-capsule-webqq__tab-icon::after')
    expect(style).not.toContain('.chat-capsule-webqq__tab-icon.is-clock')
    expect(style).not.toContain('.chat-capsule-webqq__tab-icon.is-user')
    expect(style).not.toContain('.chat-capsule-webqq__tab-icon.is-group')
  })

  it('lets the WebQQ tab header use the panel background with a rounded top-left corner', () => {
    expect(ruleBody('.chat-capsule-webqq__sidebar')).toContain('background: transparent')
    expect(ruleBody('.chat-capsule-webqq__sidebar')).not.toContain('rgba(255, 255, 255, 0.58)')
    expect(ruleBody('.chat-capsule-webqq__tabs-row')).toContain('border-radius: 24px 0 0 0')
    expect(ruleBody('.chat-capsule-webqq__tabs-row')).toContain('background: transparent')
    expect(ruleBody('.chat-capsule-webqq__tabs-row')).not.toContain('rgba(255, 255, 255, 0.68)')
  })

  it('adds a fresh WebQQ theme with plain gray-white surfaces and blue accents', () => {
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh')).toContain('background: #f4f6f8')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh')).toContain('border: 1px solid #d9e1ea')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__chat')).toContain('background: #ffffff')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__bubble')).toContain('background: #ffffff')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__message.is-outgoing .chat-capsule-webqq__bubble')).toContain('background: var(--chat-capsule-webqq-accent)')
  })

  it('uses WebQQ accent variables for theme-colored controls', () => {
    expect(ruleBody('.chat-capsule-webqq')).toContain('--chat-capsule-webqq-accent: #2563eb')
    expect(style).toContain('color: var(--chat-capsule-webqq-accent)')
    expect(style).toContain('background: var(--chat-capsule-webqq-accent-soft)')
    expect(ruleBody('.chat-capsule-webqq__message.is-outgoing .chat-capsule-webqq__bubble')).toContain('background: var(--chat-capsule-webqq-accent)')
  })

  it('wraps WebQQ notice comments instead of truncating them', () => {
    expect(ruleBody('.chat-capsule-webqq__notice-comment')).toContain('white-space: normal')
    expect(ruleBody('.chat-capsule-webqq__notice-comment')).toContain('overflow-wrap: anywhere')
    expect(ruleBody('.chat-capsule-webqq__notice-comment')).toContain('overflow: visible')
    expect(ruleBody('.chat-capsule-webqq__notice-comment')).toContain('text-overflow: clip')
  })

  it('shows full WebQQ notice titles without truncation', () => {
    expect(ruleBody('.chat-capsule-webqq__notice-title')).toContain('white-space: normal')
    expect(ruleBody('.chat-capsule-webqq__notice-title')).toContain('overflow-wrap: anywhere')
    expect(ruleBody('.chat-capsule-webqq__notice-title')).toContain('overflow: visible')
    expect(ruleBody('.chat-capsule-webqq__notice-title')).toContain('text-overflow: clip')
  })

  it('places WebQQ notice status and time in the right side column', () => {
    expect(ruleBody('.chat-capsule-webqq__notice-side')).toContain('align-self: stretch')
    expect(ruleBody('.chat-capsule-webqq__notice-time')).toContain('margin-top: auto')
    expect(ruleBody('.chat-capsule-webqq__notice-time')).toContain('white-space: nowrap')
    expect(ruleBody('.chat-capsule-webqq__notice-time')).toContain('text-align: right')
    expect(ruleBody('.chat-capsule-webqq__notice-side .chat-capsule-webqq__notice-result')).toContain('width: max-content')
  })

  it('lays out the WebQQ group info panel as an in-flow right strip', () => {
    expect(ruleBody('.chat-capsule-webqq__chat')).toContain('display: flex')
    expect(ruleBody('.chat-capsule-webqq__chat')).toContain('flex-direction: row')
    expect(ruleBody('.chat-capsule-webqq__chat-main')).toContain('flex: 1')
    expect(ruleBody('.chat-capsule-webqq__chat-main')).toContain('min-width: 0')
    expect(ruleBody('.chat-capsule-webqq__chat-main')).toContain('flex-direction: column')
    expect(ruleBody('.chat-capsule-webqq__group-info')).toContain('width: 260px')
    expect(ruleBody('.chat-capsule-webqq__group-info')).toContain('border-left: 1px solid rgba(229, 231, 235, 0.58)')
    expect(ruleBody('.chat-capsule-webqq__group-info')).not.toContain('position: absolute')
    expect(ruleBody('.chat-capsule-webqq__group-info-header')).toContain('justify-content: space-between')
    expect(ruleBody('.chat-capsule-webqq__group-announcements')).toContain('flex: 0 0 25%')
    expect(ruleBody('.chat-capsule-webqq__group-announcements')).toContain('gap: 12px')
    expect(ruleBody('.chat-capsule-webqq__group-members')).toContain('flex: 1')
    expect(ruleBody('.chat-capsule-webqq__group-member-list')).toContain('overflow-y: auto')
  })
})
