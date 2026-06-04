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

  it('keeps the main capsule compact without usage rows', () => {
    expect(ruleBody('.chat-capsule')).toContain('width: 220px')
    expect(style).not.toContain('.chat-capsule__usage')
    expect(style).not.toContain('.chat-capsule__usage-row')
    expect(style).not.toContain('.chat-capsule__usage-icon')
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

  it('renders WebQQ image-only messages without bubble background', () => {
    expect(ruleBody('.chat-capsule-webqq__message-media')).toContain('display: flex')
    expect(ruleBody('.chat-capsule-webqq__message-media img')).toContain('max-width: min(220px, 100%)')
    expect(ruleBody('.chat-capsule-webqq__message-media img')).toContain('border-radius: 8px')
  })

  it('does not keep the removed WebQQ readonly bar styles', () => {
    expect(style).not.toContain('chat-capsule-webqq__readonly-bar')
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

  it('keeps WebQQ sender metadata away from the first message bubble', () => {
    expect(ruleBody('.chat-capsule-webqq__sender-line + .chat-capsule-webqq__message-body')).toContain('margin-top: 6px')
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

  it('shows QQ-style WebQQ message times beside bubbles on hover', () => {
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-qq .chat-capsule-webqq__message-body')).toContain('flex-direction: row')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-qq .chat-capsule-webqq__message-body')).toContain('align-items: flex-end')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-qq .chat-capsule-webqq__message-body')).toContain('gap: 6px')
    expect(style).toContain(`.chat-capsule-webqq.is-chat-style-telegram .chat-capsule-webqq__message.is-outgoing .chat-capsule-webqq__message-body,
.chat-capsule-webqq.is-chat-style-qq .chat-capsule-webqq__message.is-outgoing .chat-capsule-webqq__message-body {
  flex-direction: row-reverse;
}`)
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-qq .chat-capsule-webqq__message-time')).toContain('opacity: 0')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-qq .chat-capsule-webqq__message-time')).toContain('white-space: nowrap')
    expect(ruleBody('.chat-capsule-webqq.is-chat-style-qq .chat-capsule-webqq__message:hover .chat-capsule-webqq__message-time')).toContain('opacity: 1')
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

  it('uses iOS-like material blur on WebQQ glass surfaces', () => {
    expect(ruleBody('.chat-capsule-webqq')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.chat-capsule-webqq__sidebar')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.chat-capsule-webqq__tabs-row')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.chat-capsule-webqq__notice-menu')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.chat-capsule-webqq__chat')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.chat-capsule-webqq__group-info')).toContain('backdrop-filter: saturate(180%) blur(20px)')
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
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__chat')).toContain('background: #f1f5f9')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__bubble')).toContain('background: #ffffff')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__message.is-outgoing .chat-capsule-webqq__bubble')).toContain('background: var(--chat-capsule-webqq-accent)')
  })

  it('makes the frosted WebQQ theme a blurred fresh-style surface', () => {
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted')).toContain('background: rgba(244, 246, 248, 0.86)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted')).toContain('border: 1px solid rgba(217, 225, 234, 0.78)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted')).toContain('border-radius: 18px')
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted')).toContain('-webkit-backdrop-filter: saturate(180%) blur(20px)')
    expect(style).toContain(`.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__sidebar,
.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__tabs-row {
  background: rgba(244, 246, 248, 0.86)`)
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__chat')).toContain('background: rgba(241, 245, 249, 0.86)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__chat')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__chat-header')).toContain('background: rgba(248, 250, 252, 0.86)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__group-info')).toContain('background: rgba(248, 250, 252, 0.86)')
    expect(style).toContain(`.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__notice-menu,
.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__notice-card,
.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__group-announcement {
  background: rgba(255, 255, 255, 0.86)`)
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__bubble')).toContain('background: rgba(255, 255, 255, 0.9)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-frosted .chat-capsule-webqq__message.is-outgoing .chat-capsule-webqq__bubble')).toContain('background: var(--chat-capsule-webqq-accent)')
  })

  it('overlays the fresh WebQQ chat header with live backdrop blur', () => {
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__chat-main')).toContain('position: relative')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__chat-header')).toContain('position: absolute')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__chat-header')).toContain('inset: 0 0 auto')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__chat-header')).toContain('z-index: 2')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__chat-header')).toContain('background: rgba(248, 250, 252, 0.86)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__chat-header')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__chat-header')).toContain('-webkit-backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.chat-capsule-webqq.is-theme-fresh .chat-capsule-webqq__messages')).toContain('padding: 84px 22px 20px')
  })

  it('uses WebQQ accent variables for theme-colored controls', () => {
    expect(ruleBody('.chat-capsule-webqq')).toContain('--chat-capsule-webqq-accent: #2563eb')
    expect(style).toContain('color: var(--chat-capsule-webqq-accent)')
    expect(style).toContain('background: var(--chat-capsule-webqq-accent-soft)')
    expect(ruleBody('.chat-capsule-webqq__message.is-outgoing .chat-capsule-webqq__bubble')).toContain('background: var(--chat-capsule-webqq-accent)')
  })

  it('keeps quoted text readable inside dark outgoing WebQQ bubbles', () => {
    expect(style).toContain(`.chat-capsule-webqq__bubble {
      color: #ffffff;
      background: var(--chat-capsule-webqq-accent);
      box-shadow: 0 8px 18px var(--chat-capsule-webqq-accent-shadow);

      .chat-capsule-webqq__quote {
        border-left-color: rgba(255, 255, 255, 0.62);
        background: rgba(255, 255, 255, 0.16);
        color: rgba(255, 255, 255, 0.82);
      }

      .chat-capsule-webqq__quote-title {
        color: #ffffff;
      }
    }`)
  })

  it('keeps the WebQQ thinking indicator compact with six-pixel dots', () => {
    expect(ruleBody('.chat-capsule-webqq__thinking-dots')).not.toContain('min-width: 58px')
    expect(ruleBody('.chat-capsule-webqq__thinking-dots')).toMatch(/(?:min-)?width:\s*4[24]px/)
    expect(ruleBody('.chat-capsule-webqq__thinking-dot')).toContain('width: 6px')
    expect(ruleBody('.chat-capsule-webqq__thinking-dot')).toContain('height: 6px')
    expect(style).toContain('@media (prefers-reduced-motion: reduce)')
    expect(ruleBody('@media (prefers-reduced-motion: reduce)')).toContain('animation: none')
  })

  it('keeps completed WebQQ thinking disclosure clickable and readable', () => {
    expect(ruleBody('.chat-capsule-webqq__thinking-toggle')).toContain('cursor: pointer')
    expect(ruleBody('.chat-capsule-webqq__thinking-toggle')).toContain('border: 0')
    expect(ruleBody('.chat-capsule-webqq__thinking-toggle')).toContain('background: transparent')
    expect(ruleBody('.chat-capsule-webqq__thinking-content')).toContain('white-space: pre-wrap')
    expect(ruleBody('.chat-capsule-webqq__thinking-content')).toContain('overflow-wrap: anywhere')
  })

  it('reveals completed WebQQ thinking usage only while the thinking toggle is hovered or focused', () => {
    expect(ruleBody('.chat-capsule-webqq__thinking-usage')).toContain('opacity: 0')
    expect(ruleBody('.chat-capsule-webqq__thinking-usage')).toContain('visibility: hidden')
    expect(ruleBody('.chat-capsule-webqq__thinking-usage')).toContain('pointer-events: none')
    expect(style).toContain(`.chat-capsule-webqq__thinking-toggle:hover .chat-capsule-webqq__thinking-usage,
.chat-capsule-webqq__thinking-toggle:focus-visible .chat-capsule-webqq__thinking-usage {
  opacity: 1;
  visibility: visible;
}`)
    expect(ruleBody('.chat-capsule-webqq__thinking-usage')).not.toContain(' / ')
  })

  it('keeps completed WebQQ thinking usage groups spaced from each other and the duration', () => {
    expect(ruleBody('.chat-capsule-webqq__thinking-usage-icon.is-output')).toContain('margin-left: 4px')
    expect(ruleBody('.chat-capsule-webqq__thinking-usage')).toContain('margin-right: 8px')
  })

  it('aligns completed WebQQ thinking after outgoing bubbles instead of the avatar edge', () => {
    expect(ruleBody('.chat-capsule-webqq__message')).toContain('gap: 8px')
    expect(ruleBody('.chat-capsule-webqq__message')).toContain('flex-direction: row-reverse')
    expect(ruleBody('.chat-capsule-webqq__message-avatar')).toContain('width: 32px')
    expect(ruleBody('.chat-capsule-webqq__thinking-row')).toContain('margin: -12px 40px 16px auto')
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
