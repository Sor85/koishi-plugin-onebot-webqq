import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const styleEntry = await readFile(new URL('../client/style.scss', import.meta.url), 'utf8')
const capsuleStyle = await readFile(new URL('../client/styles/capsule.scss', import.meta.url), 'utf8')
const webqqShellStyle = await readFile(new URL('../client/styles/webqq-shell.scss', import.meta.url), 'utf8')
const webqqChatStyle = await readFile(new URL('../client/styles/webqq-chat.scss', import.meta.url), 'utf8')
const webqqGroupInfoStyle = await readFile(new URL('../client/styles/webqq-group-info.scss', import.meta.url), 'utf8')
const webqqNoticesStyle = await readFile(new URL('../client/styles/webqq-notices.scss', import.meta.url), 'utf8')
const webqqMessagesStyle = await readFile(new URL('../client/styles/webqq-messages.scss', import.meta.url), 'utf8')
const webqqMessageCardsStyle = await readFile(new URL('../client/styles/webqq-message-cards.scss', import.meta.url), 'utf8')
const webqqMessageOverlaysStyle = await readFile(new URL('../client/styles/webqq-message-overlays.scss', import.meta.url), 'utf8')
const webqqMessageEffectsStyle = await readFile(new URL('../client/styles/webqq-message-effects.scss', import.meta.url), 'utf8')
const themeColorsStyle = await readFile(new URL('../client/styles/theme-colors.scss', import.meta.url), 'utf8')
const style = `${capsuleStyle}\n${webqqShellStyle}\n${webqqChatStyle}\n${webqqGroupInfoStyle}\n${webqqNoticesStyle}\n${webqqMessagesStyle}\n${webqqMessageCardsStyle}\n${webqqMessageOverlaysStyle}\n${webqqMessageEffectsStyle}\n${themeColorsStyle}\n${styleEntry}`

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) return ''
  const endIndex = source.indexOf(end, startIndex + start.length)
  return endIndex < 0 ? source.slice(startIndex) : source.slice(startIndex, endIndex)
}

function mediaBody(query: string) {
  const start = style.indexOf(query)
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

function topLevelRuleBody(selector: string) {
  return ruleBodyIncluding(selector, capsuleStyle.slice(capsuleStyle.indexOf(`\n${selector} {`) + 1))
}

function ruleBodyIncluding(selector: string, source = style) {
  let searchFrom = 0
  while (searchFrom < source.length) {
    const selectorIndex = source.indexOf(selector, searchFrom)
    if (selectorIndex < 0) return ''
    const bodyStart = source.indexOf('{', selectorIndex)
    if (bodyStart < 0) return ''
    const preludeStart = Math.max(source.lastIndexOf('}', selectorIndex), source.lastIndexOf('{', selectorIndex)) + 1
    const prelude = source.slice(preludeStart, bodyStart)
    const selectors = prelude.split(',').map((item) => item.trim())
    if (selectors.includes(selector)) {
      let depth = 1
      for (let index = bodyStart + 1; index < source.length; index++) {
        if (source[index] === '{') depth++
        if (source[index] === '}') depth--
        if (depth === 0) return source.slice(bodyStart + 1, index)
      }
      return ''
    }
    searchFrom = selectorIndex + selector.length
  }
  return ''
}

describe('chat capsule styles', () => {
  it('keeps the status dot visible outside the avatar curve', () => {
    expect(ruleBody('.onebot-webqq__avatar')).not.toContain('overflow: hidden')
    expect(ruleBody('.onebot-webqq__avatar').match(/img\s*{[\s\S]*border-radius:\s*inherit/)).toBeTruthy()
  })

  it('places the capsule total unread badge on the bot avatar corner', () => {
    const unreadBody = ruleBody('.onebot-webqq__avatar-unread')
    expect(ruleBody('.onebot-webqq__avatar')).toContain('position: relative')
    expect(unreadBody).toContain('position: absolute')
    expect(unreadBody).toContain('top: -5px')
    expect(unreadBody).toContain('right: -10px')
    expect(unreadBody).toContain('min-width: 18px')
    expect(unreadBody).toContain('background: #ef4444')
  })

  it('styles the WebQQ avatar guide as an elegant theme-colored halo', () => {
    const guideBody = ruleBody('.onebot-webqq__avatar-guide')
    const ringBody = ruleBody('.onebot-webqq__avatar-guide-ring')
    const transitionBody = ruleBody(`.onebot-webqq-avatar-guide-enter-active,
.onebot-webqq-avatar-guide-leave-active`)
    const reducedMotionBody = ruleBody('@media (prefers-reduced-motion: reduce)')
    const missingRequirements = [
      ruleBody('.onebot-webqq__body').includes('pointer-events: auto')
        ? ''
        : '胶囊主体空白处不可点击',
      guideBody.includes('position: absolute') ? '' : '头像图形引导没有绝对定位到胶囊内',
      guideBody.includes('pointer-events: none') ? '' : '头像图形引导不应拦截点击头像',
      guideBody.includes('z-index: 1') ? '' : '头像图形引导应该位于在线状态和消息计数下方',
      ruleBody('.onebot-webqq__status').includes('z-index: 2') ? '' : '在线状态应该覆盖头像图形引导',
      guideBody.includes('width: 46px')
        && guideBody.includes('height: 46px')
        ? ''
        : '头像图形引导外框没有贴合当前 42px 头像',
      ringBody.includes('left: 1px')
        && ringBody.includes('top: 1px')
        && ringBody.includes('width: 44px')
        && ringBody.includes('height: 44px')
        ? ''
        : '头像光圈没有围绕当前 42px 头像外缘',
      ringBody.includes('var(--k-color-primary, #409eff)')
        ? ''
        : '头像光圈没有使用当前主题主色',
      ringBody.includes('box-shadow: 0 0 12px')
        ? ''
        : '头像光圈阴影仍按旧头像尺寸扩散过宽',
      style.includes('--onebot-webqq-avatar-guide-color')
        ? '头像光圈不应再依赖 bot 头像主题色 CSS 变量'
        : '',
      ringBody.includes('border-radius: 50%') ? '' : '头像图形引导缺少圆形光圈',
      ringBody.includes('animation: onebot-webqq-avatar-guide-ring 2.4s cubic-bezier')
        ? ''
        : '头像光圈动画不够柔和',
      style.includes('.onebot-webqq__avatar-guide-ring::after')
        && style.includes('@keyframes onebot-webqq-avatar-guide-halo')
        ? ''
        : '头像光圈缺少柔和外扩 halo',
      style.includes('.onebot-webqq__avatar-guide-ring::after')
        && ruleBody('.onebot-webqq__avatar-guide-ring::after').includes('inset: -5px')
        ? ''
        : '头像光圈外扩 halo 没有按当前头像尺寸收窄',
      transitionBody.includes('transition: opacity')
        && transitionBody.includes('transform')
        ? ''
        : '头像图形引导缺少出现/消失过渡',
      style.includes('@keyframes onebot-webqq-avatar-guide-ring')
        ? ''
        : '头像图形引导缺少关键帧动画',
      reducedMotionBody.includes('.onebot-webqq__avatar-guide-ring')
        && reducedMotionBody.includes('animation: none')
        ? ''
        : '头像图形引导没有在 prefers-reduced-motion 下关闭动画',
      style.includes('onebot-webqq__avatar-guide-arrow')
        ? '头像图形引导不应包含箭头样式'
        : '',
      style.includes('onebot-webqq__avatar-guide-text')
        ? '头像图形引导不应包含文字样式'
        : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('uses a HeroUI-style tooltip for overflowing capsule text', () => {
    const body = ruleBody('.onebot-webqq__body')
    const conversationActivity = ruleBody('.onebot-webqq__activity.is-conversation')
    const activityAffix = ruleBody(`.onebot-webqq__activity-prefix,
.onebot-webqq__activity-suffix`)
    const activityUser = ruleBody('.onebot-webqq__activity-user')
    const tooltip = ruleBody('.onebot-webqq__tooltip')
    const content = ruleBody('.onebot-webqq__tooltip-content')
    const transition = ruleBody(`.onebot-webqq-tooltip-enter-active,
.onebot-webqq-tooltip-leave-active`)

    expect(body).toContain('position: fixed')
    expect(body).toContain('right: 24px')
    expect(conversationActivity).toContain('display: flex')
    expect(conversationActivity).toContain('align-items: center')
    expect(activityAffix).toContain('flex-shrink: 0')
    expect(activityUser).toContain('min-width: 0')
    expect(activityUser).toContain('overflow: hidden')
    expect(activityUser).toContain('text-overflow: ellipsis')
    expect(activityUser).toContain('white-space: nowrap')
    expect(tooltip).toContain('position: absolute')
    expect(tooltip).toContain('left: var(--onebot-webqq-tooltip-left, 0)')
    expect(tooltip).toContain('bottom: calc(100% + 6px)')
    expect(tooltip).toContain('width: max-content')
    expect(tooltip).toContain('max-width: calc(100vw - 24px)')
    expect(tooltip).toContain('pointer-events: none')
    expect(tooltip).toContain('color: var(--k-text-dark')
    expect(content).toContain('border-radius: 8px')
    expect(content).toContain('background: rgba(255, 255, 255, 0.78)')
    expect(content).toContain('border: 1px solid rgba(255, 255, 255, 0.62)')
    expect(content).toContain('backdrop-filter: saturate(180%) blur(18px)')
    expect(content).toContain('-webkit-backdrop-filter: saturate(180%) blur(18px)')
    expect(content).toContain('font-size: 11px')
    expect(content).toContain('line-height: 16px')
    expect(content).toContain('white-space: nowrap')
    expect(content).toContain('overflow: hidden')
    expect(content).not.toContain('text-overflow: ellipsis')
    expect(style).not.toContain('onebot-webqq__tooltip-arrow')
    expect(transition).toContain('transition: opacity')
    expect(transition).toContain('transform')
  })

  it('centers the capsule summary text vertically', () => {
    expect(ruleBody('.onebot-webqq__body')).toContain('position: fixed')
    expect(ruleBody('.onebot-webqq__body')).toContain('right: 24px')
    expect(ruleBody('.onebot-webqq__body')).toContain('bottom: 56px')
    expect(ruleBody('.onebot-webqq__body')).toContain('width: 157px')
    expect(ruleBody('.onebot-webqq__body')).toContain('height: 50px')
    expect(ruleBody('.onebot-webqq__body')).toContain('padding: 7px 12px')
    expect(ruleBody('.onebot-webqq__body')).toContain('justify-content: flex-start')
    expect(ruleBody('.onebot-webqq__title')).toContain('font-size: 13px')
    expect(ruleBody('.onebot-webqq__title')).toContain('line-height: 18px')
    expect(style).toContain(`.onebot-webqq__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  line-height: 18px`)
  })

  it('keeps the current bot avatar anchored while folded avatars expand left', () => {
    const avatarCapsule = ruleBody('.onebot-webqq__avatar-capsule')
    const stack = ruleBody('.onebot-webqq__bot-stack')
    const overflow = topLevelRuleBody('.onebot-webqq__bot-overflow')
    const overflowExpanding = ruleBodyIncluding('.onebot-webqq__bot-stack.is-overflow-expanding .onebot-webqq__bot-overflow')
    const overflowAvatar = ruleBody('.onebot-webqq__bot-overflow-avatar')
    const overflowLabel = sourceBetween(
      capsuleStyle,
      '.onebot-webqq__bot-overflow-label {',
      '.onebot-webqq__bot-overflow-plus',
    )
    const overflowMotionAvatars = sourceBetween(
      capsuleStyle,
      '.onebot-webqq__bot-stack.is-overflow-expanding .onebot-webqq__bot-switch.is-collapsed-extra,',
      '.onebot-webqq__bot-stack.is-overflow-collapsing .onebot-webqq__bot-overflow',
    )
    const overflowCollapsing = ruleBodyIncluding('.onebot-webqq__bot-stack.is-overflow-collapsing .onebot-webqq__bot-overflow')
    const narrowBody = mediaBody('@media screen and (max-width: 768px)')

    expect(ruleBody('.onebot-webqq-host')).toContain('position: fixed')
    expect(ruleBody('.onebot-webqq-host')).toContain('right: 24px')
    expect(ruleBody('.onebot-webqq-host')).toContain('bottom: 56px')
    expect(ruleBody('.onebot-webqq-host')).toContain('height: 50px')
    expect(ruleBody('.onebot-webqq-host')).toContain('line-height: 0')
    expect(ruleBody('.onebot-webqq-layout-root')).toContain('position: relative')
    expect(ruleBody('.onebot-webqq-layout-root')).toContain('display: block')
    expect(ruleBody('.onebot-webqq-layout-root')).toContain('height: 50px')
    expect(ruleBody('.onebot-webqq')).toContain('position: relative')
    expect(ruleBody('.onebot-webqq')).not.toContain('position: fixed')
    expect(ruleBody('.onebot-webqq')).toContain('width: var(--onebot-webqq-shell-collapsed-width, 204px)')
    expect(ruleBody('.onebot-webqq')).toContain('height: 50px')
    expect(ruleBody('.onebot-webqq')).not.toContain('max-width: calc(100vw - 32px)')
    expect(ruleBody('.onebot-webqq')).toContain('transition: width 0.18s ease')
    expect(ruleBody('.onebot-webqq.is-bot-stack-expanded')).toContain('width: var(--onebot-webqq-shell-width')
    expect(avatarCapsule).toContain('position: relative')
    expect(avatarCapsule).not.toContain('position: absolute')
    expect(avatarCapsule).not.toContain('right: 164px')
    expect(avatarCapsule).toContain('width: var(--onebot-webqq-avatar-capsule-collapsed-width, 50px)')
    expect(avatarCapsule).toContain('height: 50px')
    expect(avatarCapsule).toContain('padding: 4px')
    expect(avatarCapsule).toContain('transition: width 0.18s ease')
    expect(ruleBody('.onebot-webqq__avatar-capsule.is-expanded')).toContain('width: var(--onebot-webqq-avatar-capsule-expanded-width, var(--onebot-webqq-avatar-capsule-collapsed-width, 50px))')
    expect(stack).toContain('width: var(--onebot-webqq-stack-collapsed-width, 42px)')
    expect(stack).toContain('width: var(--onebot-webqq-stack-expanded-width, var(--onebot-webqq-stack-collapsed-width, 42px))')
    expect(stack).toContain('transition: width 0.18s ease')
    expect(ruleBodyIncluding('.onebot-webqq__bot-switch')).toContain('right: var(--onebot-webqq-bot-collapsed-right, 0)')
    expect(ruleBodyIncluding('.onebot-webqq__bot-switch')).toContain('-webkit-tap-highlight-color: transparent')
    expect(ruleBodyIncluding('.onebot-webqq__bot-switch')).toContain('content: none')
    expect(ruleBodyIncluding('.onebot-webqq__bot-switch')).toContain('display: none')
    expect(ruleBody('.onebot-webqq__bot-stack').includes('right: var(--onebot-webqq-bot-expanded-right, 0)')).toBe(true)
    expect(overflow).toContain('right: var(--onebot-webqq-bot-overflow-right, 0)')
    expect(overflow).toContain('z-index: var(--onebot-webqq-bot-overflow-z-index, 0)')
    expect(overflow).toContain('overflow: hidden')
    expect(overflow).toContain('transition: opacity 0.12s ease')
    expect(overflow).toContain('will-change: opacity')
    expect(overflowAvatar).toContain('opacity: 0')
    expect(overflowAvatar).toContain('clip-path: inset(0 100% 0 0 round 999px)')
    expect(overflowAvatar).toContain('object-fit: cover')
    expect(overflowLabel).toContain('background: inherit')
    expect(overflowLabel).toContain('clip-path: inset(0 0 0 0 round 999px)')
    expect(stack).toContain('.onebot-webqq__bot-overflow')
    expect(stack).toContain('right: var(--onebot-webqq-bot-overflow-expanded-right, var(--onebot-webqq-bot-overflow-right, 0))')
    expect(stack).toContain('opacity: 0')
    expect(overflowExpanding).not.toContain('--onebot-webqq-bot-overflow-z-index')
    expect(overflowExpanding).toContain('opacity: 1')
    expect(overflowExpanding).not.toContain('animation:')
    expect(overflowMotionAvatars).toContain('opacity: 1')
    expect(overflowMotionAvatars).toContain('pointer-events: none')
    expect(overflowMotionAvatars).toContain('transition: none')
    expect(overflowCollapsing).not.toContain('--onebot-webqq-bot-overflow-z-index')
    expect(overflowCollapsing).toContain('opacity: 1')
    expect(overflowCollapsing).toContain('animation: onebot-webqq-bot-overflow-avatar-erase 190ms cubic-bezier')
    expect(overflowCollapsing).toContain('animation: onebot-webqq-bot-overflow-label-reveal 190ms cubic-bezier')
    expect(style).toContain('@keyframes onebot-webqq-bot-overflow-avatar-erase')
    expect(style).toContain('@keyframes onebot-webqq-bot-overflow-label-reveal')
    expect(ruleBody('@keyframes onebot-webqq-bot-overflow-avatar-erase')).toContain('clip-path: inset(0 100% 0 0 round 999px)')
    expect(ruleBody('@keyframes onebot-webqq-bot-overflow-label-reveal')).toContain('clip-path: inset(0 0 0 0 round 999px)')
    expect(style).not.toContain('@keyframes onebot-webqq-bot-overflow-avatar-reveal')
    expect(style).not.toContain('@keyframes onebot-webqq-bot-overflow-label-erase')
    expect(style).not.toContain('--onebot-webqq-bot-overflow-expanded-offset')
    expect(style).not.toContain('--onebot-webqq-bot-overflow-z-index: 20')
    expect(ruleBody('@media (prefers-reduced-motion: reduce)')).not.toContain('.onebot-webqq__bot-stack.is-overflow-expanding .onebot-webqq__bot-overflow-avatar')
    expect(ruleBody('@media (prefers-reduced-motion: reduce)')).toContain('.onebot-webqq__bot-stack.is-overflow-collapsing .onebot-webqq__bot-overflow-label')
    expect(narrowBody).not.toContain('.onebot-webqq {\n    right: 16px;\n    bottom: 52px;')
    expect(narrowBody).toContain('.onebot-webqq-host,\n  .onebot-webqq__body')
    expect(narrowBody).toContain('right: 16px')
    expect(narrowBody).toContain('bottom: 52px')
  })

  it('keeps the main capsule compact without usage rows', () => {
    expect(ruleBody('.onebot-webqq')).toContain('width: var(--onebot-webqq-shell-collapsed-width, 204px)')
    expect(style).not.toContain('.onebot-webqq__usage')
    expect(style).not.toContain('.onebot-webqq__usage-row')
    expect(style).not.toContain('.onebot-webqq__usage-icon')
  })

  it('renders the main capsule with a frosted glass surface', () => {
    const capsule = ruleBody('.onebot-webqq')
    const capsuleSurface = ruleBody('.onebot-webqq::before')
    const avatarCapsule = ruleBody('.onebot-webqq__avatar-capsule')
    const body = ruleBody('.onebot-webqq__body')
    const autoDarkSurface = ruleBody('.onebot-webqq.is-color-auto::before')
    const darkSurface = ruleBody('.onebot-webqq.is-color-dark::before')
    const wideCapsuleSurface = ruleBody('.onebot-webqq.is-capsule-shadow-wide::before')
    const autoWideDarkSurface = ruleBody('.onebot-webqq.is-color-auto.is-capsule-shadow-wide::before')
    const darkWideSurface = ruleBody('.onebot-webqq.is-color-dark.is-capsule-shadow-wide::before')
    const missingRequirements = [
      capsule.includes('isolation: isolate')
        ? ''
        : '主胶囊没有隔离表面层和溢出的头像角标',
      !capsule.includes('background:')
        && !capsule.includes('box-shadow:')
        && !capsule.includes('backdrop-filter:')
        && !capsule.includes('-webkit-backdrop-filter:')
        ? ''
        : '主胶囊本体不应直接绘制表面，否则溢出的未读计数会参与表面合成范围',
      capsuleSurface.includes("content: ''")
        && capsuleSurface.includes('position: absolute')
        && capsuleSurface.includes('inset: 0')
        && capsuleSurface.includes('border-radius: inherit')
        ? ''
        : '主胶囊表面没有固定在独立伪元素层',
      capsuleSurface.includes('background: rgba(255, 255, 255, 0.78)')
        ? ''
        : '主胶囊浅色背景不是半透明毛玻璃',
      capsuleSurface.includes('border: 1px solid rgba(255, 255, 255, 0.62)')
        ? ''
        : '主胶囊浅色边框没有使用半透明高光',
      capsuleSurface.includes('box-shadow: 0 2px 8px rgba(15, 23, 42, 0.16)')
        ? ''
        : '主胶囊浅色阴影没有收窄到统一表面层',
      wideCapsuleSurface.includes('box-shadow: 0 8px 22px rgba(15, 23, 42, 0.16)')
        ? ''
        : '关闭紧凑阴影后没有恢复旧版浅色宽阴影',
      capsuleSurface.includes('backdrop-filter: saturate(180%) blur(18px)')
        ? ''
        : '主胶囊缺少毛玻璃背景模糊',
      capsuleSurface.includes('-webkit-backdrop-filter: saturate(180%) blur(18px)')
        ? ''
        : '主胶囊缺少 Safari 毛玻璃前缀',
      !avatarCapsule.includes('background:')
        && !avatarCapsule.includes('border:')
        && !avatarCapsule.includes('box-shadow:')
        && !body.includes('background:')
        && !body.includes('border:')
        && !body.includes('box-shadow:')
        ? ''
        : '左右结构不能各自画成两个胶囊表面或阴影',
      autoDarkSurface.includes('background: rgba(15, 23, 42, 0.72)')
        ? ''
        : '主胶囊自动暗色背景不是半透明毛玻璃',
      autoDarkSurface.includes('box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24)')
        ? ''
        : '主胶囊自动暗色阴影没有收窄到统一表面层',
      autoWideDarkSurface.includes('box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28)')
        ? ''
        : '关闭紧凑阴影后没有恢复旧版自动暗色宽阴影',
      darkSurface.includes('background: rgba(15, 23, 42, 0.72)')
        ? ''
        : '主胶囊暗色背景不是半透明毛玻璃',
      darkSurface.includes('box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24)')
        ? ''
        : '主胶囊暗色阴影没有收窄到统一表面层',
      darkWideSurface.includes('box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28)')
        ? ''
        : '关闭紧凑阴影后没有恢复旧版暗色宽阴影',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('starts the main capsule thinking shimmer outside the visible text on the first loop', () => {
    expect(style).toContain('animation-delay: -0.01s')
    expect(ruleBody('@keyframes onebot-webqq-thinking-shimmer')).toContain('background-position: 120% 0')
    expect(ruleBody('@keyframes onebot-webqq-thinking-shimmer')).toContain('background-position: -160% 0')
    expect(ruleBody('@keyframes onebot-webqq-thinking-shimmer')).not.toContain('background-position: 100% 0')
  })

  it('allows the WebQQ chat message pane to scroll inside the fixed panel', () => {
    expect(ruleBody('.onebot-webqq-webqq__chat')).toContain('min-height: 0')
    expect(ruleBody('.onebot-webqq-webqq__chat-body')).toContain('display: flex')
    expect(ruleBody('.onebot-webqq-webqq__chat-body')).toContain('min-height: 0')
    expect(ruleBody('.onebot-webqq-webqq__messages')).toContain('overflow-y: auto')
  })

  it('styles the WebQQ return-to-bottom button as a clickable bottom overlay', () => {
    const scrollBottomBody = ruleBody('.onebot-webqq-webqq__scroll-bottom')
    const missingRequirements = [
      scrollBottomBody ? '' : '缺少 .onebot-webqq-webqq__scroll-bottom 样式',
      /position:\s*(absolute|fixed)\s*;/.test(scrollBottomBody)
        ? ''
        : '返回底部按钮没有固定或绝对定位',
      /bottom:\s*[^;]+;/.test(scrollBottomBody) ? '' : '返回底部按钮没有定位到聊天主体底部附近',
      scrollBottomBody.includes('cursor: pointer') ? '' : '返回底部按钮缺少可点击控件样式',
      /display:\s*(inline-flex|flex)\s*;/.test(scrollBottomBody)
        ? ''
        : '返回底部按钮没有使用 flex 对齐按钮内容',
      /z-index:\s*[^;]+;/.test(scrollBottomBody) ? '' : '返回底部按钮缺少覆盖在消息区域上的层级',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('uses glass bubble colors for the WebQQ return-to-bottom button in light and dark modes', () => {
    const scrollBottomBody = ruleBody('.onebot-webqq-webqq__scroll-bottom')
    const darkScrollBottomBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__scroll-bottom')
    const autoDarkScrollBottomBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-auto .onebot-webqq-webqq__scroll-bottom')
    const missingRequirements = [
      scrollBottomBody.includes('background: rgba(255, 255, 255, 0.9)')
        ? ''
        : '返回底部按钮亮色模式没有使用白色毛玻璃气泡背景',
      scrollBottomBody.includes('backdrop-filter: saturate(180%) blur(20px)')
        ? ''
        : '返回底部按钮亮色模式缺少毛玻璃效果',
      scrollBottomBody.includes('-webkit-backdrop-filter: saturate(180%) blur(20px)')
        ? ''
        : '返回底部按钮亮色模式缺少 Safari 毛玻璃效果',
      darkScrollBottomBody.includes('background: rgba(30, 41, 59, 0.96)')
        ? ''
        : '返回底部按钮强制暗色模式没有使用黑色气泡背景',
      darkScrollBottomBody.includes('backdrop-filter: saturate(180%) blur(20px)')
        ? ''
        : '返回底部按钮强制暗色模式缺少毛玻璃效果',
      autoDarkScrollBottomBody.includes('background: rgba(30, 41, 59, 0.96)')
        ? ''
        : '返回底部按钮自动暗色模式没有使用黑色气泡背景',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('animates the WebQQ return-to-bottom button without ignoring reduced motion', () => {
    const transitionBody = ruleBody(`.webqq-scroll-bottom-enter-active,
.webqq-scroll-bottom-leave-active`)
    const hiddenBody = ruleBody(`.webqq-scroll-bottom-enter-from,
.webqq-scroll-bottom-leave-to`)
    const reducedMotionBody = ruleBody('@media (prefers-reduced-motion: reduce)')
    const missingRequirements = [
      transitionBody ? '' : '缺少返回底部按钮 enter/leave active 过渡样式',
      transitionBody.includes('transition: opacity')
        ? ''
        : '返回底部按钮过渡没有包含 opacity',
      transitionBody.includes('transform')
        ? ''
        : '返回底部按钮过渡没有包含 transform',
      hiddenBody.includes('opacity: 0') ? '' : '返回底部按钮进入/离开状态没有淡入淡出',
      /translateY\([^)]*px\)/.test(hiddenBody)
        ? ''
        : '返回底部按钮进入/离开状态没有纵向位移',
      reducedMotionBody.includes('.webqq-scroll-bottom-enter-active')
        && reducedMotionBody.includes('.webqq-scroll-bottom-leave-active')
        && reducedMotionBody.includes('transition: none')
        ? ''
        : '返回底部按钮过渡没有在 prefers-reduced-motion 下关闭',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('sizes WebQQ message avatars beside bubbles', () => {
    expect(ruleBody('.onebot-webqq-webqq__message')).toContain('display: flex')
    expect(ruleBody('.onebot-webqq-webqq__message')).toContain('--onebot-webqq-webqq-message-avatar-size: 32px')
    expect(ruleBody('.onebot-webqq-webqq__message-avatar-wrap')).toContain('position: relative')
    expect(ruleBody('.onebot-webqq-webqq__message-avatar-wrap')).toContain('width: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleBody('.onebot-webqq-webqq__message-avatar-wrap')).toContain('height: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleBody('.onebot-webqq-webqq__message-avatar')).toContain('width: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleBody('.onebot-webqq-webqq__message-avatar')).toContain('height: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleBodyIncluding('.onebot-webqq-webqq__message-avatar')).toContain('border-radius: 50%')
    expect(ruleBody('.onebot-webqq-webqq__message-affinity')).toContain('position: absolute')
    expect(ruleBody('.onebot-webqq-webqq__message-affinity')).toContain('top: -10px')
    expect(ruleBody('.onebot-webqq-webqq__message-affinity')).toContain('right: -12px')
    expect(ruleBody('.onebot-webqq-webqq__message-affinity')).toContain('min-width: 15px')
    expect(ruleBody('.onebot-webqq-webqq__message-affinity')).toContain('height: 15px')
    expect(ruleBody('.onebot-webqq-webqq__message-affinity')).toContain('background: #ec4899')
    expect(ruleBody('.onebot-webqq-webqq__message-affinity')).toContain('box-shadow: 0 2px 6px rgba(190, 24, 93, 0.24)')
    expect(ruleBody('.onebot-webqq-webqq__message-affinity-icon')).toContain('fill: currentColor')
  })

  it('keeps WebQQ reaction avatars compact inside reaction pills', () => {
    const avatarBody = ruleBody('.onebot-webqq-webqq__message-reaction-avatar')
    const avatarImageBody = ruleBody('.onebot-webqq-webqq__message-reaction-avatar-image')

    expect(ruleBody('.onebot-webqq-webqq__message-reaction')).toContain('--onebot-webqq-webqq-reaction-avatar-size: 26px')
    expect(style).toContain('width: var(--onebot-webqq-webqq-reaction-avatar-size)')
    expect(style).toContain('height: var(--onebot-webqq-webqq-reaction-avatar-size)')
    expect(avatarBody).toContain('aspect-ratio: 1 / 1')
    expect(avatarBody).toContain('overflow: hidden')
    expect(avatarBody).toContain('border-radius: 50%')
    expect(avatarImageBody).toContain('width: 100%')
    expect(avatarImageBody).toContain('height: 100%')
    expect(avatarImageBody).toContain('border-radius: inherit')
    expect(avatarImageBody).toContain('object-fit: cover')
    expect(style).toContain('img:not(.onebot-webqq-webqq__message-reaction-avatar-image)')
    expect(style).toContain('box-sizing: border-box')
    expect(style).toContain('box-shadow: 0 0 0 2px var(--onebot-webqq-webqq-reaction-bg')
  })

  it('stacks multiple WebQQ reaction user avatars', () => {
    expect(ruleBody('.onebot-webqq-webqq__message-reaction-users')).toContain('display: inline-flex')
    expect(style).toContain(`.onebot-webqq-webqq__message-reaction-avatar {
  position: relative`)
    expect(ruleBody('.onebot-webqq-webqq__message-reaction-users .onebot-webqq-webqq__message-reaction-avatar + .onebot-webqq-webqq__message-reaction-avatar')).toContain('margin-left: -6px')
  })

  it('renders WebQQ reaction emoji images at a stable inline size', () => {
    const emojiBody = ruleBody('.onebot-webqq-webqq__message-reaction-emoji')

    expect(emojiBody).toContain('width: 18px')
    expect(emojiBody).toContain('height: 18px')
    expect(emojiBody).toContain('object-fit: contain')
  })

  it('stacks WebQQ rich message elements vertically inside the bubble', () => {
    expect(style).toContain('.onebot-webqq-webqq__bubble {\n  display: flex')
    expect(style).toContain('.onebot-webqq-webqq__bubble {\n  display: flex;\n  max-width: 100%;\n  flex-direction: column')
    expect(style).not.toContain('.onebot-webqq-webqq__bubble {\n  display: inline-flex')
  })

  it('shrinks WebQQ text bubbles to their own message content', () => {
    expect(ruleBody('.onebot-webqq-webqq__message-content')).toContain('display: flex')
    expect(ruleBody('.onebot-webqq-webqq__message-content')).toContain('flex-direction: column')
    expect(ruleBody('.onebot-webqq-webqq__message-content')).toContain('align-items: flex-start')
    expect(ruleBody('.onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-content')).toContain('align-items: flex-end')
  })

  it('renders WebQQ image-only messages without bubble background', () => {
    expect(ruleBody('.onebot-webqq-webqq__message-media')).toContain('display: flex')
    expect(ruleBody('.onebot-webqq-webqq__message-media img')).toContain('max-width: min(220px, 100%)')
    expect(ruleBody('.onebot-webqq-webqq__message-media img')).toContain('border-radius: 8px')
  })

  it('styles WebQQ message images as clickable previews', () => {
    expect(ruleBody('.onebot-webqq-webqq__message-image')).toContain('cursor: pointer')
    expect(ruleBody('.onebot-webqq-webqq__message-image')).toContain('background: transparent')
    expect(ruleBody('.onebot-webqq-webqq__image-preview')).toContain('position: fixed')
    expect(ruleBody('.onebot-webqq-webqq__image-preview')).toContain('inset: 0')
    expect(ruleBody('.onebot-webqq-webqq__image-preview')).toContain('z-index: 10002')
    expect(ruleBody('.onebot-webqq-webqq__image-preview')).toContain('background: rgba(15, 23, 42, 0.78)')
    expect(ruleBody('.onebot-webqq-webqq__image-preview')).toContain('cursor: default')
    expect(ruleBody('.onebot-webqq-webqq__image-preview img')).toContain('max-width: min(1120px, calc(100vw - 64px))')
    expect(ruleBody('.onebot-webqq-webqq__image-preview img')).toContain('max-height: calc(100vh - 64px)')
    expect(ruleBody('.onebot-webqq-webqq__image-preview-close')).toContain('position: fixed')
  })

  it('does not keep the removed WebQQ readonly bar styles', () => {
    expect(style).not.toContain('onebot-webqq-webqq__readonly-bar')
  })

  it('styles WebQQ friend category headings in the friend list', () => {
    expect(ruleBody('.onebot-webqq-webqq__friend-category-title')).toContain('font-size: 12px')
    expect(ruleBody('.onebot-webqq-webqq__friend-category-title')).toContain('color: #9ca3af')
  })

  it('renders WebQQ sender metadata as compact badges', () => {
    expect(ruleBody('.onebot-webqq-webqq__sender-line')).toContain('display: flex')
    expect(ruleBody('.onebot-webqq-webqq__sender-line')).toContain('gap: 4px')
    expect(ruleBody('.onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__sender-line')).toContain('justify-content: flex-end')
    expect(ruleBody('.onebot-webqq-webqq__sender-badge')).toContain('border-radius: 5px')
    expect(ruleBody('.onebot-webqq-webqq__sender-badge.is-owner')).toContain('background: #fff3cf')
    expect(ruleBody('.onebot-webqq-webqq__sender-badge.is-admin')).toContain('background: #e9f8ef')
    expect(ruleBody('.onebot-webqq-webqq__sender-badge.is-level')).toContain('background: rgba(148, 163, 184, 0.24)')
    expect(ruleBody('.onebot-webqq-webqq__sender-badge.is-title')).toContain('background: rgba(18, 183, 245, 0.1)')
    expect(ruleBody('.onebot-webqq-webqq__sender-badge.is-relationship')).toContain('background: rgba(99, 102, 241, 0.12)')
  })

  it('keeps WebQQ sender metadata away from the first message bubble', () => {
    expect(ruleBody('.onebot-webqq-webqq__sender-line + .onebot-webqq-webqq__message-body')).toContain('margin-top: 6px')
  })

  it('hides repeated avatars on merged Telegram-style WebQQ messages', () => {
    expect(ruleBody('.onebot-webqq-webqq__message.is-merged')).toContain('margin-top: -14px')
    expect(ruleBody('.onebot-webqq-webqq__message.is-merged .onebot-webqq-webqq__message-avatar-wrap')).toContain('visibility: hidden')
  })

  it('rounds Telegram-style WebQQ message clusters like stacked capsules', () => {
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__bubble')).toContain('margin: 1px 0')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message.is-cluster-first:not(.is-outgoing) .onebot-webqq-webqq__bubble')).toContain('border-bottom-left-radius: 3px')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message.is-cluster-middle:not(.is-outgoing) .onebot-webqq-webqq__bubble')).toContain('border-radius: 3px 18px 18px 3px')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message.is-cluster-last:not(.is-outgoing) .onebot-webqq-webqq__bubble')).toContain('border-top-left-radius: 3px')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message.is-outgoing.is-cluster-middle .onebot-webqq-webqq__bubble')).toContain('border-radius: 18px 3px 3px 18px')
  })

  it('gates TIM-style WebQQ bubble tails behind the enabled option class', () => {
    const baseTailSelector = '.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message:not(.is-merged) .onebot-webqq-webqq__bubble:not(.is-record-only)::before'
    const enabledTailSelector = '.onebot-webqq-webqq.is-chat-style-telegram.has-tim-bubble-tail .onebot-webqq-webqq__message:not(.is-merged) .onebot-webqq-webqq__bubble:not(.is-record-only)::before'

    expect(ruleBody(baseTailSelector)).toBe('')
    expect(ruleBody(enabledTailSelector)).toContain("content: ''")
    expect(ruleBody(enabledTailSelector)).toContain('background: inherit')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram.has-tim-bubble-tail .onebot-webqq-webqq__message:not(.is-outgoing):not(.is-merged) .onebot-webqq-webqq__bubble:not(.is-record-only)')).toContain('border-top-left-radius: 0')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram.has-tim-bubble-tail .onebot-webqq-webqq__message.is-outgoing:not(.is-merged) .onebot-webqq-webqq__bubble:not(.is-record-only)')).toContain('border-top-right-radius: 0')
  })

  it('shows Telegram-style WebQQ message times outside bubbles on hover', () => {
    expect(ruleBody('.onebot-webqq-webqq__message-body')).toContain('display: flex')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message-body')).toContain('flex-direction: row')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message-time')).toContain('opacity: 0')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message:hover .onebot-webqq-webqq__message-time')).toContain('opacity: 1')
  })

  it('places Telegram-style WebQQ reactions inside message bubbles', () => {
    const bubbleBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__bubble')
    const reactionBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__bubble .onebot-webqq-webqq__message-reactions')

    expect(bubbleBody).toContain('gap: 2px')
    expect(reactionBody).toContain('margin-top: 0')
    expect(reactionBody).toContain('margin-bottom: -5px')
    expect(reactionBody).toContain('align-self: flex-start')
  })

  it('makes Telegram-style WebQQ reaction pills compact and bubble-tinted', () => {
    const bubbleBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__bubble')
    const outgoingBubbleBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .is-outgoing .onebot-webqq-webqq__bubble')
    const outgoingReactionBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .is-outgoing .onebot-webqq-webqq__bubble .onebot-webqq-webqq__message-reaction')
    const reactionBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__bubble .onebot-webqq-webqq__message-reaction')
    const usersBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__bubble .onebot-webqq-webqq__message-reaction-users')

    expect(bubbleBody).toContain('gap: 2px')
    expect(bubbleBody).toContain('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, #ffffff 88%, #0f172a 12%)')
    expect(outgoingBubbleBody).toContain('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-accent) 88%, #0f172a 12%)')
    expect(reactionBody).toContain('background: var(--onebot-webqq-webqq-reaction-bg)')
    expect(outgoingReactionBody).not.toContain('background: color-mix')
    expect(reactionBody).toContain('gap: 4px')
    expect(reactionBody).toContain('min-height: unset')
    expect(reactionBody).toContain('padding: 0 0 0 4px')
    expect(usersBody).toContain('margin-right: 0')
  })

  it('keeps Telegram-style WebQQ image reactions below images with bubble reaction styling', () => {
    const stackBody = ruleBody('.onebot-webqq-webqq__message-media-stack')
    const outgoingStackBody = ruleBody('.onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-media-stack')
    const reactionsBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions')
    const outgoingReactionsBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .is-outgoing .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions')
    const reactionBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions .onebot-webqq-webqq__message-reaction')
    const usersBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions .onebot-webqq-webqq__message-reaction-users')
    const avatarBody = ruleBody('.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions .onebot-webqq-webqq__message-reaction-avatar')

    expect(stackBody).toContain('flex-direction: column')
    expect(stackBody).toContain('align-items: flex-start')
    expect(outgoingStackBody).toContain('align-items: flex-end')
    expect(reactionsBody).toContain('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, #ffffff 88%, #0f172a 12%)')
    expect(reactionsBody).toContain('align-self: flex-start')
    expect(reactionsBody).toContain('margin-top: 0')
    expect(outgoingReactionsBody).toContain('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-accent) 88%, #0f172a 12%)')
    expect(outgoingReactionsBody).toContain('align-self: flex-end')
    expect(reactionBody).toContain('--onebot-webqq-webqq-reaction-avatar-size: 18px')
    expect(reactionBody).toContain('background: var(--onebot-webqq-webqq-reaction-bg)')
    expect(reactionBody).toContain('padding: 0 0 0 4px')
    expect(usersBody).toContain('margin-right: 0')
    expect(avatarBody).toContain('box-shadow: none')
  })

  it('shows QQ-style WebQQ message times beside bubbles on hover', () => {
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-body')).toContain('flex-direction: row')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-body')).toContain('align-items: flex-end')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-body')).toContain('gap: 6px')
    expect(style).toContain(`.onebot-webqq-webqq.is-chat-style-telegram .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-body,
.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-body {
  flex-direction: row-reverse;
}`)
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-time')).toContain('opacity: 0')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-time')).toContain('white-space: nowrap')
    expect(ruleBody('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message:hover .onebot-webqq-webqq__message-time')).toContain('opacity: 1')
  })

  it('places QQ-style WebQQ reactions outside bubbles without user avatars', () => {
    const reactionsBody = ruleBody('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-reactions')
    const reactionBody = ruleBody('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-reaction')
    const usersBody = ruleBody('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-reaction-users')

    expect(reactionsBody).toContain('align-self: flex-end')
    expect(reactionsBody).toContain('margin-top: 0')
    expect(reactionBody).toContain('min-height: 22px')
    expect(reactionBody).toContain('padding: 1px 7px')
    expect(reactionBody).toContain('gap: 2px')
    expect(usersBody).toContain('display: none')
  })

  it('shows compact WebQQ recall status and event capsules', () => {
    expect(ruleBody('.onebot-webqq-webqq__message-event')).toContain('width: fit-content')
    expect(ruleBody('.onebot-webqq-webqq__message-event')).toContain('max-width: 74%')
    expect(ruleBody('.onebot-webqq-webqq__message-recall-status')).toContain('opacity: 0')
    expect(ruleBody('.onebot-webqq-webqq__message-recall-status')).toContain('visibility: hidden')
    expect(ruleBody('.onebot-webqq-webqq__message-recall-status')).toContain('white-space: nowrap')
    expect(ruleBodyIncluding('.onebot-webqq-webqq__message.is-recalled:hover .onebot-webqq-webqq__message-recall-status')).toContain('opacity: 1')
    expect(ruleBodyIncluding('.onebot-webqq-webqq__message.is-recalled:hover .onebot-webqq-webqq__message-recall-status')).toContain('visibility: visible')
  })

  it('draws recalled WebQQ text strikethrough on each wrapped line', () => {
    const recalledTextBody = ruleBody('.onebot-webqq-webqq__message.is-recalled .onebot-webqq-webqq__inline-run')
    const recalledBubbleBody = ruleBody('.onebot-webqq-webqq__message.is-recalled .onebot-webqq-webqq__bubble')

    expect(recalledTextBody).toContain('text-decoration-line: line-through')
    expect(recalledTextBody).toContain('text-decoration-thickness: 2px')
    expect(recalledTextBody).toContain('text-decoration-skip-ink: none')
    expect(recalledBubbleBody).not.toContain('top: 50%')
  })

  it('keeps WebQQ contact message times in the top-right corner', () => {
    expect(ruleBody('.onebot-webqq-webqq__contact')).toContain('position: relative')
    expect(ruleBody('.onebot-webqq-webqq__contact')).toContain('padding: 10px 58px 10px 12px')
    expect(ruleBody('.onebot-webqq-webqq__contact-time')).toContain('position: absolute')
    expect(ruleBody('.onebot-webqq-webqq__contact-time')).toContain('top: 10px')
    expect(ruleBody('.onebot-webqq-webqq__contact-time')).toContain('right: 12px')
  })

  it('places WebQQ unread badges on the contact avatar corner', () => {
    expect(ruleBody('.onebot-webqq-webqq__contact-avatar')).toContain('position: relative')
    expect(ruleBody('.onebot-webqq-webqq__contact-avatar')).toContain('width: 38px')
    expect(ruleBody('.onebot-webqq-webqq__contact-avatar')).toContain('height: 38px')
    expect(ruleBody('.onebot-webqq-webqq__contact-unread')).toContain('position: absolute')
    expect(ruleBody('.onebot-webqq-webqq__contact-unread')).toContain('top: -6px')
    expect(ruleBody('.onebot-webqq-webqq__contact-unread')).toContain('right: -6px')
    expect(ruleBody('.onebot-webqq-webqq__contact-unread')).toContain('min-width: 18px')
  })

  it('centers the WebQQ notice menu under the bell button', () => {
    expect(ruleBody('.onebot-webqq-webqq__sidebar')).toContain('position: relative')
    expect(ruleBody('.onebot-webqq-webqq__sidebar')).toContain('z-index: 4')
    expect(ruleBody('.onebot-webqq-webqq__notice-menu')).toContain('left: 50%')
    expect(ruleBody('.onebot-webqq-webqq__notice-menu')).toContain('z-index: 5')
    expect(ruleBody('.onebot-webqq-webqq__notice-menu')).toContain('transform: translateX(-50%)')
  })

  it('uses iOS-like material blur on WebQQ glass surfaces', () => {
    expect(ruleBody('.onebot-webqq-webqq')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.onebot-webqq-webqq__sidebar')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.onebot-webqq-webqq__tabs-row')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.onebot-webqq-webqq__notice-menu')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.onebot-webqq-webqq__chat')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.onebot-webqq-webqq__group-info')).toContain('backdrop-filter: saturate(180%) blur(20px)')
  })

  it('uses inline SVG for WebQQ tab icons instead of pseudo elements', () => {
    expect(ruleBody('.onebot-webqq-webqq__tab-icon')).toContain('stroke: currentColor')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon::before')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon::after')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon.is-clock')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon.is-user')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon.is-group')
  })

  it('uses inline SVG for the WebQQ search icon instead of pseudo elements', () => {
    expect(ruleBody('.onebot-webqq-webqq__search-icon')).toContain('stroke: currentColor')
    expect(ruleBody('.onebot-webqq-webqq__search-icon')).toContain('stroke-width: 2')
    expect(style).not.toContain('.onebot-webqq-webqq__search-icon::before')
    expect(style).not.toContain('.onebot-webqq-webqq__search-icon::after')
  })

  it('lets the WebQQ tab header use the panel background with a rounded top-left corner', () => {
    expect(ruleBody('.onebot-webqq-webqq__sidebar')).toContain('background: transparent')
    expect(ruleBody('.onebot-webqq-webqq__sidebar')).not.toContain('rgba(255, 255, 255, 0.58)')
    expect(ruleBody('.onebot-webqq-webqq__tabs-row')).toContain('border-radius: 24px 0 0 0')
    expect(ruleBody('.onebot-webqq-webqq__tabs-row')).toContain('background: transparent')
    expect(ruleBody('.onebot-webqq-webqq__tabs-row')).not.toContain('rgba(255, 255, 255, 0.68)')
  })

  it('keeps WebQQ as a floating single-left-rail panel on narrow screens', () => {
    const narrowBody = mediaBody('@media screen and (max-width: 768px)')
    const panelStart = narrowBody.indexOf('.onebot-webqq-webqq {')
    const panelBody = narrowBody.slice(panelStart, narrowBody.indexOf('}', panelStart))

    expect(narrowBody).toContain('.onebot-webqq-webqq')
    expect(panelBody).toContain('right: 16px')
    expect(panelBody).toContain('bottom: 112px')
    expect(panelBody).toContain('grid-template-columns: 70px minmax(0, 1fr)')
    expect(panelBody).not.toContain('inset: 0')
    expect(panelBody).not.toContain('width: 100vw')
    expect(panelBody).not.toContain('height: 100vh')
    expect(panelBody).not.toContain('border-radius: 0')
    expect(narrowBody).toContain('.onebot-webqq-webqq__sidebar')
    expect(narrowBody).toContain('grid-template-rows: auto minmax(0, 1fr)')
    expect(narrowBody).toContain('.onebot-webqq-webqq__tabs-row')
    expect(narrowBody).toContain('flex-direction: column')
    expect(narrowBody).toContain('.onebot-webqq-webqq__tabs')
    expect(narrowBody).toContain('grid-template-columns: 1fr')
    expect(narrowBody).toContain('.onebot-webqq-webqq__list')
    expect(narrowBody).toContain('.onebot-webqq-webqq__contact')
    expect(narrowBody).toContain('grid-template-columns: 38px')
    expect(narrowBody).toContain('.onebot-webqq-webqq__contact-info')
    expect(narrowBody).toContain('display: none')
    expect(narrowBody).toContain('.onebot-webqq-webqq__contact-time')
    expect(narrowBody).toContain('.onebot-webqq-webqq__friend-category-title')
    expect(narrowBody).toContain('.onebot-webqq-webqq__search')
  })

  it('hides native WebQQ scrollbars and uses the same overlay scrollbar across engines', () => {
    const nativeBody = ruleBody('.onebot-webqq-webqq [data-webqq-scrollbar="true"]')
    const webkitBody = ruleBody('.onebot-webqq-webqq [data-webqq-scrollbar="true"]::-webkit-scrollbar')
    const webkitButtonBody = ruleBody('.onebot-webqq-webqq [data-webqq-scrollbar="true"]::-webkit-scrollbar-button')
    const narrowBody = mediaBody('@media screen and (max-width: 768px)')
    const overlayBody = ruleBody('.onebot-webqq-webqq__scrollbar-overlay')
    const visibleBody = ruleBody('.onebot-webqq-webqq__scrollbar-overlay.is-visible')
    const thumbBody = ruleBody('.onebot-webqq-webqq__scrollbar-thumb')
    const wideThumbBody = ruleBodyIncluding('.onebot-webqq-webqq__scrollbar-overlay.is-wide .onebot-webqq-webqq__scrollbar-thumb')
    const narrowHiddenOverlayBody = ruleBodyIncluding('.onebot-webqq-webqq__scrollbar-overlay.is-hidden-on-narrow', narrowBody)

    expect(nativeBody).toContain('scrollbar-width: none')
    expect(nativeBody).toContain('scrollbar-color: transparent transparent')
    expect(webkitBody).toContain('width: 0')
    expect(webkitBody).toContain('height: 0')
    expect(webkitButtonBody).toContain('display: none')
    expect(webkitButtonBody).toContain('width: 0')
    expect(webkitButtonBody).toContain('height: 0')
    expect(overlayBody).toContain('position: fixed')
    expect(overlayBody).toContain('opacity: 0')
    expect(overlayBody).toContain('pointer-events: none')
    expect(visibleBody).toContain('opacity: 1')
    expect(thumbBody).toContain('width: 4px')
    expect(thumbBody).toContain('min-height: 28px')
    expect(thumbBody).toContain('border-radius: 999px')
    expect(thumbBody).toContain('cursor: default')
    expect(thumbBody).not.toContain('cursor: grab')
    expect(thumbBody).toContain('top: var(--onebot-webqq-webqq-scrollbar-thumb-top)')
    expect(thumbBody).toContain('height: var(--onebot-webqq-webqq-scrollbar-thumb-height)')
    expect(wideThumbBody).toContain('right: 2px')
    expect(wideThumbBody).toContain('width: 6px')
    expect(narrowHiddenOverlayBody).toContain('display: none')
    expect(ruleBody('.onebot-webqq-webqq__scrollbar-thumb.is-dragging')).toContain('cursor: default')
  })

  it('shows the mobile notification page instead of the sidebar dropdown on narrow screens', () => {
    const narrowBody = mediaBody('@media screen and (max-width: 768px)')

    expect(narrowBody).toContain('.onebot-webqq-webqq__mobile-notice-page')
    expect(narrowBody).toContain('display: flex')
    expect(narrowBody).toContain('.onebot-webqq-webqq__mobile-notice-content')
    expect(narrowBody).toContain('.onebot-webqq-webqq__sidebar .onebot-webqq-webqq__notice-menu')
    expect(narrowBody).toContain('display: none')
    expect(narrowBody).toContain('.onebot-webqq-webqq__chat-content')
    expect(narrowBody).toContain('min-width: 0')
  })

  it('adds a fresh WebQQ theme with plain gray-white surfaces and blue accents', () => {
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh')).toContain('background: #f4f6f8')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh')).toContain('border: 1px solid #d9e1ea')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__chat')).toContain('background: #f1f5f9')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__bubble')).toContain('background: #ffffff')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble')).toContain('background: var(--onebot-webqq-webqq-accent)')
  })

  it('makes the frosted WebQQ theme a blurred fresh-style surface', () => {
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted')).toContain('background: rgba(244, 246, 248, 0.86)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted')).toContain('border: 1px solid rgba(217, 225, 234, 0.78)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted')).toContain('border-radius: 18px')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted')).toContain('-webkit-backdrop-filter: saturate(180%) blur(20px)')
    expect(style).toContain(`.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__sidebar,
.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__tabs-row {
  background: rgba(244, 246, 248, 0.86)`)
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__chat')).toContain('background: rgba(241, 245, 249, 0.86)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__chat')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__chat-header')).toContain('background: rgba(248, 250, 252, 0.86)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__group-info')).toContain('background: rgba(248, 250, 252, 0.86)')
    expect(style).toContain(`.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__notice-menu,
.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__notice-card,
.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__group-announcement {
  background: rgba(255, 255, 255, 0.86)`)
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__bubble')).toContain('background: rgba(255, 255, 255, 0.9)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble')).toContain('background: var(--onebot-webqq-webqq-accent)')
  })

  it('overlays the fresh WebQQ chat header with live backdrop blur', () => {
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__chat-main')).toContain('position: relative')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__chat-header')).toContain('position: absolute')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__chat-header')).toContain('inset: 0 0 auto')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__chat-header')).toContain('z-index: 2')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__chat-header')).toContain('background: rgba(248, 250, 252, 0.86)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__chat-header')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__chat-header')).toContain('-webkit-backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleBody('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__messages')).toContain('padding: 84px 22px 20px')
  })

  it('uses WebQQ accent variables for theme-colored controls', () => {
    expect(ruleBody('.onebot-webqq-webqq')).toContain('--onebot-webqq-webqq-accent: #2563eb')
    expect(style).toContain('color: var(--onebot-webqq-webqq-accent)')
    expect(style).toContain('background: var(--onebot-webqq-webqq-accent-soft)')
    expect(ruleBody('.onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble')).toContain('background: var(--onebot-webqq-webqq-accent)')
  })

  it('adds dark WebQQ color mode overrides for forced dark and automatic dark panels', () => {
    const forcedRootBody = ruleBody('.onebot-webqq-webqq.is-color-dark')
    const autoDarkBody = ruleBody('@media (prefers-color-scheme: dark)')
    const forcedBubbleBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__bubble')
    const forcedOutgoingBubbleBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble')
    const forcedMediaReactionsBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions')
    const forcedOutgoingMediaReactionsBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions')
    const autoBubbleBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-auto .onebot-webqq-webqq__bubble', autoDarkBody)
    const autoOutgoingBubbleBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-auto .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble', autoDarkBody)
    const autoMediaReactionsBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-auto .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions', autoDarkBody)
    const autoOutgoingMediaReactionsBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-auto .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions', autoDarkBody)
    const forcedSelectors = [
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__chat',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__search input',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__notify',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__notice-menu',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__bubble',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions',
    ]
    const autoSelectors = forcedSelectors.map((selector) => selector.replace('is-color-dark', 'is-color-auto'))
    const missingRequirements = [
      forcedRootBody ? '' : '缺少强制暗色根选择器 .onebot-webqq-webqq.is-color-dark',
      forcedRootBody.includes('background:')
        ? ''
        : '强制暗色根选择器没有覆盖面板背景',
      forcedRootBody.includes('color:')
        ? ''
        : '强制暗色根选择器没有覆盖面板文本',
      ...forcedSelectors.map((selector) => style.includes(selector) ? '' : `缺少强制暗色关键选择器 ${selector}`),
      autoDarkBody ? '' : '缺少 prefers-color-scheme: dark 自动暗色媒体查询',
      autoDarkBody.includes('.onebot-webqq-webqq.is-color-auto')
        ? ''
        : '自动暗色媒体查询没有限制到 .onebot-webqq-webqq.is-color-auto',
      ...autoSelectors.map((selector) => autoDarkBody.includes(selector) ? '' : `缺少自动暗色关键选择器 ${selector}`),
      forcedBubbleBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, rgba(30, 41, 59, 0.96) 88%, #ffffff 12%)')
        ? ''
        : '强制暗色普通气泡没有覆盖 Telegram 贴表情背景变量',
      forcedOutgoingBubbleBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-accent) 88%, #ffffff 12%)')
        ? ''
        : '强制暗色发出气泡没有覆盖 Telegram 贴表情背景变量',
      autoBubbleBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, rgba(30, 41, 59, 0.96) 88%, #ffffff 12%)')
        ? ''
        : '自动暗色普通气泡没有覆盖 Telegram 贴表情背景变量',
      autoOutgoingBubbleBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-accent) 88%, #ffffff 12%)')
        ? ''
        : '自动暗色发出气泡没有覆盖 Telegram 贴表情背景变量',
      forcedMediaReactionsBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, rgba(30, 41, 59, 0.96) 88%, #ffffff 12%)')
        ? ''
        : '强制暗色图片贴表情没有覆盖 Telegram 贴表情背景变量',
      forcedOutgoingMediaReactionsBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-accent) 88%, #ffffff 12%)')
        ? ''
        : '强制暗色发出图片贴表情没有覆盖 Telegram 贴表情背景变量',
      autoMediaReactionsBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, rgba(30, 41, 59, 0.96) 88%, #ffffff 12%)')
        ? ''
        : '自动暗色图片贴表情没有覆盖 Telegram 贴表情背景变量',
      autoOutgoingMediaReactionsBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-accent) 88%, #ffffff 12%)')
        ? ''
        : '自动暗色发出图片贴表情没有覆盖 Telegram 贴表情背景变量',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('adds dark color mode overrides for the main capsule and WebQQ chat header', () => {
    const autoDarkBody = ruleBody('@media (prefers-color-scheme: dark)')
    const forcedCapsuleBody = ruleBodyIncluding('.onebot-webqq.is-color-dark')
    const forcedCapsuleSurfaceBody = ruleBodyIncluding('.onebot-webqq.is-color-dark::before')
    const autoCapsuleBody = ruleBodyIncluding('.onebot-webqq.is-color-auto', autoDarkBody)
    const autoCapsuleSurfaceBody = ruleBodyIncluding('.onebot-webqq.is-color-auto::before', autoDarkBody)
    const forcedHeaderBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__chat-header')
    const autoHeaderBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-auto .onebot-webqq-webqq__chat-header', autoDarkBody)
    const missingRequirements = [
      forcedCapsuleBody ? '' : '缺少强制暗色主胶囊选择器 .onebot-webqq.is-color-dark',
      forcedCapsuleSurfaceBody ? '' : '缺少强制暗色主胶囊表面选择器 .onebot-webqq.is-color-dark::before',
      forcedCapsuleSurfaceBody.includes('background:')
        ? ''
        : '强制暗色主胶囊没有覆盖背景',
      forcedCapsuleBody.includes('color:')
        ? ''
        : '强制暗色主胶囊没有覆盖文本',
      forcedCapsuleSurfaceBody.includes('border')
        ? ''
        : '强制暗色主胶囊没有覆盖边框',
      autoDarkBody ? '' : '缺少 prefers-color-scheme: dark 自动暗色媒体查询',
      autoCapsuleBody ? '' : '自动暗色媒体查询缺少 .onebot-webqq.is-color-auto 覆盖',
      autoCapsuleSurfaceBody ? '' : '自动暗色媒体查询缺少 .onebot-webqq.is-color-auto::before 表面覆盖',
      autoCapsuleSurfaceBody.includes('background:')
        ? ''
        : '自动暗色主胶囊没有覆盖背景',
      autoCapsuleBody.includes('color:')
        ? ''
        : '自动暗色主胶囊没有覆盖文本',
      autoCapsuleSurfaceBody.includes('border')
        ? ''
        : '自动暗色主胶囊没有覆盖边框',
      forcedHeaderBody ? '' : '缺少强制暗色聊天顶栏选择器 .onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__chat-header',
      forcedHeaderBody.includes('background:')
        ? ''
        : '强制暗色聊天顶栏没有覆盖背景，会被 fresh 主题浅色背景保留',
      autoHeaderBody ? '' : '自动暗色媒体查询缺少 .onebot-webqq-webqq.is-color-auto .onebot-webqq-webqq__chat-header 覆盖',
      autoHeaderBody.includes('background:')
        ? ''
        : '自动暗色聊天顶栏没有覆盖背景，会被 fresh 主题浅色背景保留',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('keeps quoted text readable inside dark outgoing WebQQ bubbles', () => {
    expect(style).toContain(`.onebot-webqq-webqq__bubble {
      color: #ffffff;
      background: var(--onebot-webqq-webqq-accent);
      box-shadow: 0 8px 18px var(--onebot-webqq-webqq-accent-shadow);

      .onebot-webqq-webqq__quote {
        border-left-color: rgba(255, 255, 255, 0.62);
        background: rgba(255, 255, 255, 0.16);
        color: rgba(255, 255, 255, 0.82);
      }

      .onebot-webqq-webqq__quote-title {
        color: #ffffff;
      }
    }`)
  })

  it('truncates each WebQQ forward preview segment to one line', () => {
    const previewLineBody = ruleBody('.onebot-webqq-webqq__forward > span:not(.onebot-webqq-webqq__forward-entry)')

    expect(previewLineBody).toContain('display: block')
    expect(previewLineBody).toContain('overflow: hidden')
    expect(previewLineBody).toContain('white-space: nowrap')
    expect(previewLineBody).toContain('text-overflow: ellipsis')
  })

  it('shortens WebQQ forward cards with a width rule that overrides quote width', () => {
    expect(style).toMatch(/\n\.onebot-webqq-webqq__bubble\s*{[\s\S]*?\n  \.onebot-webqq-webqq__quote\s*{[\s\S]*?width:\s*100%\s*;/)

    const forwardWidthOverrideBody = [
      '.onebot-webqq-webqq__quote.onebot-webqq-webqq__forward',
      '.onebot-webqq-webqq__bubble .onebot-webqq-webqq__forward',
    ]
      .map((selector) => ruleBody(selector))
      .find((body) => body.includes('max-width: 100%'))

    expect(
      forwardWidthOverrideBody,
      'forward 宽度规则选择器优先级不足，会被 quote 的 width:100% 覆盖',
    ).toBeTruthy()
    expect(forwardWidthOverrideBody, 'forward 卡片宽度还没有缩到 260px').toContain('width: 260px')
    expect(forwardWidthOverrideBody).toContain('max-width: 100%')
  })

  it('styles WebQQ record messages as compact playable voice bubbles', () => {
    const recordBody = ruleBody('.onebot-webqq-webqq__record')
    const audioBody = ruleBody('.onebot-webqq-webqq__record-audio')
    const playerBody = ruleBody('.onebot-webqq-webqq__record-player')
    const waveBody = ruleBody('.onebot-webqq-webqq__record-wave')
    const transcriptBody = ruleBody('.onebot-webqq-webqq__record-transcript')

    expect(recordBody, '缺少语音消息容器样式').toContain('display: flex')
    expect(recordBody).toContain('gap:')
    expect(audioBody, '语音 audio 应作为隐藏播放源存在').toContain('display: none')
    expect(playerBody, '缺少 LLBot 风格语音胶囊样式').toContain('border-radius: 999px')
    expect(playerBody).toContain('min-width: 102px')
    expect(playerBody).toContain('background:')
    expect(waveBody, '缺少语音波形样式').toContain('fill:')
    expect(waveBody).toContain('height: 18px')
    expect(waveBody).toContain('flex: 0 0 24px')
    expect(transcriptBody, '缺少语音转文字结果样式').toContain('font-size:')
  })

  it('highlights the WebQQ message targeted by a clicked quote', () => {
    const targetBody = ruleBody('.onebot-webqq-webqq__message.is-quote-target .onebot-webqq-webqq__bubble')
    const clickableQuoteBody = ruleBody('.onebot-webqq-webqq__quote.is-clickable')

    expect(targetBody, '缺少被引用消息的高亮气泡样式').toContain('animation:')
    expect(targetBody).toContain('onebot-webqq-webqq-quote-target')
    expect(clickableQuoteBody, '可点击引用块缺少按钮式交互样式').toContain('cursor: pointer')
    expect(clickableQuoteBody).toContain('text-align: left')
  })

  it('centers the WebQQ forward entry as a fixed bottom row without top-heavy padding', () => {
    const entryBody = ruleBody('.onebot-webqq-webqq__forward-entry')

    expect(entryBody).toContain('display: flex')
    expect(entryBody).toContain('align-items: center')
    expect.soft(entryBody).toMatch(/(?:^|\n)\s*(?:min-height|height):\s*\d+(?:px|rem|em)\s*;/)
    expect.soft(entryBody).not.toMatch(/(?:^|\n)\s*padding:\s*[1-9]\d*(?:\.\d+)?px\s+[^;]*\s+0\b/)
    expect.soft(entryBody).not.toMatch(/(?:^|\n)\s*padding-top:\s*[1-9]\d*(?:\.\d+)?px\s*;/)
  })

  it('left-aligns the WebQQ forward entry label while leaving the arrow on the right', () => {
    const entryBody = ruleBody('.onebot-webqq-webqq__forward-entry')

    expect(entryBody).toContain('text-align: left')
    expect(entryBody).toContain('justify-content: space-between')
    expect(ruleBody('.onebot-webqq-webqq__forward-entry::after')).toContain('content:')
  })

  it('styles WebQQ forward message details as an LLBot-style centered modal', () => {
    expect(ruleBody('.onebot-webqq-webqq__forward-modal-backdrop')).toContain('position: fixed')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal-backdrop')).toContain('inset: 0')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal-backdrop')).toContain('align-items: center')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal')).toContain('width: min(480px, calc(100vw - 32px))')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal')).toContain('max-height: min(80vh, 620px)')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal-body')).not.toContain('display: flex')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal-body')).not.toContain('flex-direction: column')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal-body')).not.toContain('align-items: flex-start')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal-body')).toContain('overflow-y: auto')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal .onebot-webqq-webqq__message')).toContain('max-width: 74%')
    expect(ruleBody('.onebot-webqq-webqq__forward-modal .onebot-webqq-webqq__message')).not.toContain('margin-bottom')
    expect(style).not.toContain('.onebot-webqq-webqq__forward-modal .onebot-webqq-webqq__message.is-merged')
    expect(style).not.toContain('onebot-webqq-webqq__forward-popover')
    expect(style).not.toContain('onebot-webqq-webqq__forward-page')
  })

  it('styles WebQQ card message previews as compact block cards', () => {
    expect(ruleBody('.onebot-webqq-webqq__card')).toContain('display: flex')
    expect(ruleBody('.onebot-webqq-webqq__card')).toContain('border-radius: 8px')
    expect(ruleBody('.onebot-webqq-webqq__card')).toContain('text-decoration: none')
    expect(ruleBody('.onebot-webqq-webqq__card-cover')).toContain('width: 42px')
    expect(ruleBody('.onebot-webqq-webqq__card-cover')).toContain('object-fit: cover')
    expect(ruleBody('.onebot-webqq-webqq__card-title')).toContain('font-weight: 600')
    expect(ruleBody('.onebot-webqq-webqq__card-desc')).toContain('overflow-wrap: anywhere')
    expect(ruleBody('.onebot-webqq-webqq__card-source')).toContain('font-size: 11px')
  })

  it('keeps the WebQQ thinking indicator compact with six-pixel dots', () => {
    expect(ruleBody('.onebot-webqq-webqq__thinking-dots')).not.toContain('min-width: 58px')
    expect(ruleBody('.onebot-webqq-webqq__thinking-dots')).toMatch(/(?:min-)?width:\s*4[24]px/)
    expect(ruleBody('.onebot-webqq-webqq__thinking-dot')).toContain('width: 6px')
    expect(ruleBody('.onebot-webqq-webqq__thinking-dot')).toContain('height: 6px')
    expect(style).toContain('@media (prefers-reduced-motion: reduce)')
    expect(ruleBody('@media (prefers-reduced-motion: reduce)')).toContain('animation: none')
  })

  it('keeps completed WebQQ thinking disclosure clickable and readable', () => {
    expect(ruleBody('.onebot-webqq-webqq__thinking-toggle')).toContain('cursor: pointer')
    expect(ruleBody('.onebot-webqq-webqq__thinking-toggle')).toContain('border: 0')
    expect(ruleBody('.onebot-webqq-webqq__thinking-toggle')).toContain('background: transparent')
    expect(ruleBody('.onebot-webqq-webqq__thinking-chevron')).toContain('transition: transform 0.16s ease')
    expect(ruleBody('.onebot-webqq-webqq__thinking-chevron.is-expanded')).toContain('transform: rotate(90deg)')
    expect(ruleBody('.onebot-webqq-webqq__thinking-panel')).toContain('transform-origin: top right')
    expect(ruleBody('.onebot-webqq-webqq__thinking-panel')).not.toContain('grid-template-rows')
    expect(ruleBody('.onebot-webqq-webqq__thinking-content')).toContain('overflow: hidden')
    expect(ruleBody('.onebot-webqq-webqq__thinking-content')).toContain('white-space: pre-wrap')
    expect(ruleBody('.onebot-webqq-webqq__thinking-content')).toContain('overflow-wrap: anywhere')
  })

  it('animates completed WebQQ thinking disclosure expansion without ignoring reduced motion', () => {
    const transitionBody = ruleBody(`.onebot-webqq-webqq-thinking-enter-active,
.onebot-webqq-webqq-thinking-leave-active`)
    const hiddenBody = ruleBody(`.onebot-webqq-webqq-thinking-enter-from,
.onebot-webqq-webqq-thinking-leave-to`)
    const reducedMotionBody = ruleBody('@media (prefers-reduced-motion: reduce)')

    expect(transitionBody).not.toContain('grid-template-rows')
    expect(transitionBody).not.toContain('margin-top')
    expect(transitionBody).toContain('opacity')
    expect(transitionBody).toContain('transform')
    expect(hiddenBody).toContain('opacity: 0')
    expect(hiddenBody).toContain('transform: translateY(-4px) scaleY(0.98)')
    expect(reducedMotionBody).toContain('.onebot-webqq-webqq-thinking-enter-active')
    expect(reducedMotionBody).toContain('.onebot-webqq-webqq-thinking-leave-active')
    expect(reducedMotionBody).toContain('.onebot-webqq-webqq__thinking-chevron')
    expect(reducedMotionBody).toContain('transition: none')
  })

  it('reveals completed WebQQ thinking usage only while the thinking toggle is hovered or focused', () => {
    expect(ruleBody('.onebot-webqq-webqq__thinking-usage')).toContain('opacity: 0')
    expect(ruleBody('.onebot-webqq-webqq__thinking-usage')).toContain('visibility: hidden')
    expect(ruleBody('.onebot-webqq-webqq__thinking-usage')).toContain('pointer-events: none')
    expect(style).toContain(`.onebot-webqq-webqq__thinking-toggle:hover .onebot-webqq-webqq__thinking-usage,
.onebot-webqq-webqq__thinking-toggle:focus-visible .onebot-webqq-webqq__thinking-usage {
  opacity: 1;
  visibility: visible;
}`)
    expect(ruleBody('.onebot-webqq-webqq__thinking-usage')).not.toContain(' / ')
  })

  it('keeps completed WebQQ thinking usage groups spaced from each other and the duration', () => {
    expect(ruleBody('.onebot-webqq-webqq__thinking-usage-icon.is-output')).toContain('margin-left: 4px')
    expect(ruleBody('.onebot-webqq-webqq__thinking-usage')).toContain('margin-right: 8px')
  })

  it('aligns completed WebQQ thinking after outgoing bubbles instead of the avatar edge', () => {
    expect(ruleBody('.onebot-webqq-webqq__message')).toContain('gap: 8px')
    expect(ruleBody('.onebot-webqq-webqq__message')).toContain('flex-direction: row-reverse')
    expect(ruleBody('.onebot-webqq-webqq__message')).toContain('--onebot-webqq-webqq-message-avatar-size: 32px')
    expect(ruleBody('.onebot-webqq-webqq__message-avatar')).toContain('width: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleBody('.onebot-webqq-webqq__thinking-row')).toContain('position: relative')
    expect(ruleBody('.onebot-webqq-webqq__thinking-row')).toContain('margin: -12px 40px 16px auto')
  })

  it('wraps WebQQ notice comments instead of truncating them', () => {
    expect(ruleBody('.onebot-webqq-webqq__notice-comment')).toContain('white-space: normal')
    expect(ruleBody('.onebot-webqq-webqq__notice-comment')).toContain('overflow-wrap: anywhere')
    expect(ruleBody('.onebot-webqq-webqq__notice-comment')).toContain('overflow: visible')
    expect(ruleBody('.onebot-webqq-webqq__notice-comment')).toContain('text-overflow: clip')
  })

  it('shows full WebQQ notice titles without truncation', () => {
    expect(ruleBody('.onebot-webqq-webqq__notice-title')).toContain('white-space: normal')
    expect(ruleBody('.onebot-webqq-webqq__notice-title')).toContain('overflow-wrap: anywhere')
    expect(ruleBody('.onebot-webqq-webqq__notice-title')).toContain('overflow: visible')
    expect(ruleBody('.onebot-webqq-webqq__notice-title')).toContain('text-overflow: clip')
  })

  it('places WebQQ notice status and time in the right side column', () => {
    expect(ruleBody('.onebot-webqq-webqq__notice-side')).toContain('align-self: stretch')
    expect(ruleBody('.onebot-webqq-webqq__notice-time')).toContain('margin-top: auto')
    expect(ruleBody('.onebot-webqq-webqq__notice-time')).toContain('white-space: nowrap')
    expect(ruleBody('.onebot-webqq-webqq__notice-time')).toContain('text-align: right')
    expect(ruleBody('.onebot-webqq-webqq__notice-side .onebot-webqq-webqq__notice-result')).toContain('width: max-content')
  })

  it('lays out the WebQQ group info panel as an in-flow right strip', () => {
    expect(ruleBody('.onebot-webqq-webqq__chat')).toContain('display: flex')
    expect(ruleBody('.onebot-webqq-webqq__chat')).toContain('flex-direction: row')
    expect(ruleBody('.onebot-webqq-webqq__chat-main')).toContain('flex: 1')
    expect(ruleBody('.onebot-webqq-webqq__chat-main')).toContain('min-width: 0')
    expect(ruleBody('.onebot-webqq-webqq__chat-main')).toContain('flex-direction: column')
    expect(ruleBody('.onebot-webqq-webqq__group-info')).toContain('width: 260px')
    expect(ruleBody('.onebot-webqq-webqq__group-info')).toContain('border-left: 1px solid rgba(229, 231, 235, 0.58)')
    expect(ruleBody('.onebot-webqq-webqq__group-info')).not.toContain('position: absolute')
    expect(ruleBody('.onebot-webqq-webqq__group-info-header')).not.toContain('justify-content: space-between')
    expect(ruleBody('.onebot-webqq-webqq__group-announcements')).toContain('flex: 0 0 25%')
    expect(ruleBody('.onebot-webqq-webqq__group-announcements')).toContain('gap: 12px')
    expect(ruleBody('.onebot-webqq-webqq__group-members')).toContain('flex: 1')
    expect(ruleBody('.onebot-webqq-webqq__group-member-list')).toContain('overflow-y: auto')
  })

  it('renders the group info toggle as a bare SVG icon button', () => {
    const headerButtonBody = ruleBodyIncluding('button', ruleBody('.onebot-webqq-webqq__chat-header'))
    const freshHeaderButtonBody = ruleBodyIncluding('.onebot-webqq-webqq.is-theme-fresh .onebot-webqq-webqq__chat-header button')
    const frostedHeaderButtonBody = ruleBodyIncluding('.onebot-webqq-webqq.is-theme-frosted .onebot-webqq-webqq__chat-header button')
    const darkHeaderButtonBody = ruleBodyIncluding('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__chat-header button')
    const missingRequirements = [
      headerButtonBody.includes('background: transparent')
        ? ''
        : '群信息按钮默认不应有卡片背景',
      headerButtonBody.includes('border-radius: 0')
        ? ''
        : '群信息按钮不应保留卡片圆角',
      /&\.is-active\s*\{[\s\S]*background:\s*transparent/.test(headerButtonBody)
        ? ''
        : '群信息按钮激活时不应有卡片背景',
      freshHeaderButtonBody ? '清爽主题不应给群信息按钮加卡片背景' : '',
      frostedHeaderButtonBody ? '毛玻璃主题不应给群信息按钮加卡片背景' : '',
      darkHeaderButtonBody.includes('background')
        ? '暗色主题不应给群信息按钮加卡片背景'
        : '',
      style.includes('.onebot-webqq-webqq__header-icon::before') || style.includes('.onebot-webqq-webqq__header-icon::after')
        ? '群信息图标不应使用 CSS 伪元素绘制'
        : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })
})
