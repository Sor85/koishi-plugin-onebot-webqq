import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  allStyles,
  declarationValue,
  hasRule,
  ruleBlock,
  ruleDeclarations,
  sourceBetween,
  styleSources,
} from './helpers/style-query'

const {
  entry: styleEntry,
  capsule: capsuleStyle,
  shell: webqqShellStyle,
  chat: webqqChatStyle,
  groupInfo: webqqGroupInfoStyle,
  messages: webqqMessagesStyle,
  messageEffects: webqqMessageEffectsStyle,
  themeColors: themeColorsStyle,
  interactions: webqqInteractionsStyle,
  boxModel: webqqBoxModelStyle,
} = styleSources

// 全部样式源按层叠顺序拼接。整文件断言（跨规则模式与全文禁令）用它，规则级查询用样式查询 module。
const style = allStyles

const dialogContentView = await readFile(new URL('../client/components/ui/dialog/DialogContent.vue', import.meta.url), 'utf8')
const webqqEmojiPickerView = await readFile(new URL('../client/webqq/components/WebQQEmojiPicker.vue', import.meta.url), 'utf8')
const webqqProfileCardView = await readFile(new URL('../client/webqq/components/WebQQProfileCard.vue', import.meta.url), 'utf8')
const webqqSidebarView = await readFile(new URL('../client/webqq/components/WebQQSidebar.vue', import.meta.url), 'utf8')
const webqqForwardTargetDialogView = await readFile(new URL('../client/webqq/components/WebQQForwardTargetDialog.vue', import.meta.url), 'utf8')
const contextMenuContentView = await readFile(new URL('../client/components/ui/context-menu/ContextMenuContent.vue', import.meta.url), 'utf8')
const contextMenuSubContentView = await readFile(new URL('../client/components/ui/context-menu/ContextMenuSubContent.vue', import.meta.url), 'utf8')

// —— 同一个选择器在同一文件里有多处定义时，先把来源收窄到目标那一处 ——
// 浮层样式给 Teleport 面板先写了一个只放主题令牌的同选择器块（文件开头），真规则写在后面；
// 另有几处把一整段子规则包在同选择器的第二个块里。本轮不合并这些块——合并会改变声明顺序，
// 进而可能改层叠结果，就得上浏览器验证，也会失掉「样式一行没改」这张安全网。
//
// 下面的右边界用的是紧邻的下一条规则，所以这批收窄依赖那两条规则在文件里前后相邻。这是有意的：
// 边界字面量一旦消失，sourceBetween 会当场报错，而不是像序号参数那样静默取到另一处定义。
// 重复块合并掉之后，这些收窄连同注释都该跟着删。
const contextMenuRules = sourceBetween('.webqq-context-menu-content.is-color-dark {', '.webqq-context-menu-item {', webqqInteractionsStyle)
const dialogLayerRule = sourceBetween('.webqq-dialog-layer {', '.webqq-dialog-overlay {', webqqInteractionsStyle)
const dialogContentRule = sourceBetween('.webqq-dialog-content {', '.webqq-dialog-close {', webqqInteractionsStyle)
const secondaryPortalPageRule = sourceBetween(
  '.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page {',
  '.onebot-webqq-webqq__portal-page[popover]',
  webqqInteractionsStyle,
)
// 机器人余量徽标在小胶囊样式里有两处定义：一处嵌在 .onebot-webqq__bot-stack.is-expanded 里只改位移，
// 一处是画出徽标本身的顶层规则。断言要的是顶层那一处。
const botOverflowRule = sourceBetween(
  '.onebot-webqq__bot-stack.is-expanded .onebot-webqq__bot-switch.is-overlapped .onebot-webqq__avatar {',
  '.onebot-webqq__bot-overflow-avatar,',
  capsuleStyle,
)
// 下面几条同样是「同一文件里同选择器写了两块」：一块是与兄弟选择器共用的通用形态，
// 另一块是自己的专属覆盖。收窄到断言真正要量的那一块。
const avatarRule = sourceBetween('\n.onebot-webqq__avatar {', '\n.onebot-webqq__avatar-button {', capsuleStyle)
const titleRule = sourceBetween('\n.onebot-webqq__title {', '\n.onebot-webqq__title-status {', capsuleStyle)
const botSwitchRule = sourceBetween(
  '\n.onebot-webqq__bot-switch {',
  '\n.onebot-webqq__bot-stack.is-expanded .onebot-webqq__bot-switch.is-collapsed-extra {',
  capsuleStyle,
)
const botOverflowAvatarRule = sourceBetween(
  '\n.onebot-webqq__bot-overflow-avatar {',
  '\n.onebot-webqq__bot-overflow-label {',
  capsuleStyle,
)
const bubbleRule = sourceBetween(
  '\n.onebot-webqq-webqq__bubble {',
  '\n.onebot-webqq-webqq__quote.onebot-webqq-webqq__forward {',
  webqqMessagesStyle,
)
const searchIconRule = sourceBetween('.onebot-webqq-webqq__search-icon {', '.onebot-webqq-webqq__search {', webqqShellStyle)
// 附件预览的 video 有两条规则：一条和 img 共用尺寸，一条只给视频加黑底与禁点。这里量的是尺寸那条。
const previewMediaRule = sourceBetween(
  '.onebot-webqq-webqq__send-image-preview img,',
  '\n\n.onebot-webqq-webqq__send-image-preview video {',
  webqqChatStyle,
)
const darkChatHeaderRule = sourceBetween(
  '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__chat-header {',
  '.onebot-webqq-webqq.is-plain.is-color-dark',
  themeColorsStyle,
)

describe('chat capsule styles', () => {
  it('never overrides the mouse cursor in WebQQ styles', () => {
    expect(style).not.toMatch(/cursor\s*:/)
  })

  it('declares its own border-box baseline instead of borrowing a host reset', () => {
    // 宿主 Koishi 控制台不提供 `* { box-sizing }` reset（app/index.scss 只给 body 设 margin 与字体）。
    // 缺少这份基线时 min-height 与 padding 改为相加：右键菜单项从 36px 撑到 52px（实测 ×1.44），
    // width: 100% 的项再横向溢出 20px 被菜单的 overflow: hidden 裁掉。
    const bodyLevelSurfaceRoots = [
      '.onebot-webqq-host',
      '.webqq-context-menu-content',
      '.webqq-dialog-layer',
      '.onebot-webqq-webqq__portal-page',
      '.onebot-webqq-webqq__notice-menu',
      '.onebot-webqq-webqq__scrollbar-overlay',
    ]
    const baselineRoots = sourceBetween('.onebot-webqq-host', '{', webqqBoxModelStyle)
      .split(',').map((item) => item.trim()).filter(Boolean)

    // 基线必须最先输出：它与各处规则同特异性，排在后面会盖掉规则自己声明的 box-sizing。
    expect(styleEntry.match(/@use\s+'([^']+)'/)?.[1]).toBe('./webqq/styles/webqq-box-model')
    // 逐个登记 body 级浮层根：Portal/Teleport 出去的子树不在胶囊根的后代里，漏一个就静默退回 content-box。
    expect(baselineRoots).toEqual(bodyLevelSurfaceRoots)
    // 根自身与整棵子树都要覆盖，浮层内层元素同样拿不到宿主 reset。
    expect(webqqBoxModelStyle).toMatch(/&,\s*\n\s*\*,\s*\n\s*\*::before,\s*\n\s*\*::after\s*\{\s*\n\s*box-sizing:\s*border-box/)
    // 新增 body 级浮层时必须同步登记进上面的清单，这两条计数守卫会在漏登记时失败。
    expect(
      [dialogContentView, webqqEmojiPickerView, webqqProfileCardView, webqqSidebarView]
        .join('\n')
        .match(/<Teleport to="body">/g)?.length,
    ).toBe(4)
    expect(
      [contextMenuContentView, contextMenuSubContentView].join('\n').match(/<ContextMenuPortal>/g)?.length,
    ).toBe(2)
  })

  it('uses the standard dark border color below notification tabs', () => {
    const noticeTabsBody = ruleDeclarations(
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__notice-tabs',
      themeColorsStyle,
    )

    expect(noticeTabsBody).toContain('border-color: var(--webqq-border)')
  })

  it('matches the notification selection shape to the contact tabs', () => {
    expect(
      ruleDeclarations('.onebot-webqq-webqq__notify', webqqShellStyle),
    ).toContain('border-radius: 8px 8px 0 0')
  })

  it('renders pending video thumbnails inside the attachment preview frame', () => {
    const mediaBody = ruleDeclarations('.onebot-webqq-webqq__send-image-preview video', previewMediaRule)

    expect(mediaBody).toContain('width: 100%')
    expect(mediaBody).toContain('height: 100%')
    expect(mediaBody).toContain('object-fit: cover')
    expect(webqqChatStyle).toMatch(/\.onebot-webqq-webqq__send-image-preview video\s*\{[\s\S]*?pointer-events:\s*none/)
  })

  it('portals the submenu beyond the root menu backdrop boundary', () => {
    const menuBody = ruleDeclarations('.webqq-context-menu-content', contextMenuRules)

    expect(contextMenuSubContentView).toContain("import { ContextMenuPortal, ContextMenuSubContent, useForwardPropsEmits } from 'reka-ui'")
    expect(contextMenuSubContentView).toContain('<ContextMenuPortal>')
    expect(menuBody).toContain('overflow: hidden')
  })

  it('keeps portalled context menus above the WebQQ shell', () => {
    const shellZIndex = Number(declarationValue('.onebot-webqq-webqq', 'z-index', webqqShellStyle))
    const menuZIndex = Number(declarationValue('.webqq-context-menu-content', 'z-index', contextMenuRules))
    expect(shellZIndex).toBe(10001)
    expect(menuZIndex).toBeGreaterThan(shellZIndex)
  })

  it('keeps teleported secondary pages above the WebQQ shell', () => {
    const shellZIndex = Number(declarationValue('.onebot-webqq-webqq', 'z-index', webqqShellStyle))
    const secondaryPageZIndex = Number(declarationValue('.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page', 'z-index', secondaryPortalPageRule))

    expect(shellZIndex).toBe(10001)
    expect(secondaryPageZIndex).toBeGreaterThan(shellZIndex)
  })

  it('carries the resolved dark theme into every portalled interaction surface', () => {
    const darkPortalTokens = ruleDeclarations(
      '.onebot-webqq-webqq__portal-page.is-color-dark',
      webqqInteractionsStyle,
    )
    const headerBody = ruleDeclarations('.onebot-webqq-webqq__portal-page > .onebot-webqq-webqq__secondary-page-header', webqqInteractionsStyle)

    expect(webqqInteractionsStyle).not.toMatch(/(?:^|\n)\.onebot-webqq-webqq__secondary-page\s*(?:,|\{)/)
    expect(webqqInteractionsStyle).not.toMatch(/(?:^|\n)\.onebot-webqq-webqq__secondary-page-header\s*\{/)
    expect(darkPortalTokens).toContain('--webqq-bg: #2c2c30')
    expect(darkPortalTokens).toContain('--webqq-panel: #333338')
    expect(darkPortalTokens).toContain('--webqq-border: #45454c')
    expect(headerBody).toContain('background: color-mix(in srgb, var(--webqq-surface) 92%, transparent)')
    expect(headerBody).toContain('border-bottom: 1px solid color-mix(in srgb, var(--webqq-border) 72%, transparent)')
    expect(hasRule('.onebot-webqq-webqq__notice-menu--desktop', webqqInteractionsStyle)).toBe(true)
    expect(hasRule('.onebot-webqq-webqq__notice-menu--desktop.is-color-dark', webqqInteractionsStyle)).toBe(true)
    expect(webqqProfileCardView).toContain('`is-color-${resolvedWebQQColorMode}`')
    expect(webqqEmojiPickerView).toContain('`is-color-${resolvedWebQQColorMode}`')
    expect(contextMenuContentView).toContain('`is-color-${resolvedWebQQColorMode}`')
    expect(contextMenuSubContentView).toContain('`is-color-${resolvedWebQQColorMode}`')
    expect(dialogContentView).toContain('`is-color-${resolvedWebQQColorMode}`')
  })

  it('gives secondary pages one subtle outline and shadow while hiding every scrollbar', () => {
    const pageBody = ruleDeclarations(
      '.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page',
      secondaryPortalPageRule,
    )
    const scrollbarBody = ruleDeclarations(
      '.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page *',
      webqqInteractionsStyle,
    )

    expect(pageBody).toContain('border: 1px solid color-mix(in srgb, var(--webqq-border) 42%, transparent)')
    expect(pageBody).toContain('box-shadow: 0 16px 38px rgb(0 0 0 / 16%)')
    expect(scrollbarBody).toContain('scrollbar-width: none')
    expect(webqqInteractionsStyle).toMatch(/\.onebot-webqq-webqq__secondary-page\.onebot-webqq-webqq__portal-page \*::\-webkit-scrollbar\s*\{[\s\S]*?display:\s*none/)
    expect(webqqProfileCardView).not.toContain('v-webqq-scrollbar')
    expect(webqqEmojiPickerView).not.toContain('v-webqq-scrollbar')
  })

  it('keeps every portalled dialog layer and dialog scrollbar above the WebQQ shell', () => {
    const shellZIndex = Number(declarationValue('.onebot-webqq-webqq', 'z-index', webqqShellStyle))
    const secondaryPageZIndex = Number(declarationValue('.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page', 'z-index', secondaryPortalPageRule))
    const menuZIndex = Number(declarationValue('.webqq-context-menu-content', 'z-index', contextMenuRules))
    const dialogLayerZIndex = Number(declarationValue('.webqq-dialog-layer', 'z-index', dialogLayerRule))
    const contentZIndex = Number(declarationValue('.webqq-dialog-content', 'z-index', dialogContentRule))
    const dialogScrollbarZIndex = Number(dialogContentView.match(/zIndex:\s*(\d+)/)?.[1])
    const forwardScrollbarZIndex = Number(webqqForwardTargetDialogView.match(/zIndex:\s*(\d+)/)?.[1])

    expect(shellZIndex).toBe(10001)
    expect(secondaryPageZIndex).toBeGreaterThan(shellZIndex)
    expect(menuZIndex).toBeGreaterThan(secondaryPageZIndex)
    expect(dialogLayerZIndex).toBeGreaterThan(menuZIndex)
    expect(contentZIndex).toBeGreaterThan(0)
    expect(dialogScrollbarZIndex).toBeGreaterThan(dialogLayerZIndex)
    expect(forwardScrollbarZIndex).toBeGreaterThan(dialogLayerZIndex)
    const dialogTemplate = dialogContentView.slice(dialogContentView.indexOf('<template>'))
    expect(dialogContentView).not.toContain("from 'reka-ui'")
    expect(dialogTemplate).toContain('<Teleport to="body">')
    expect(dialogTemplate).toContain('v-if="isOpen"')
    expect(dialogTemplate).toContain('class="webqq-dialog-layer webqq-dialog-overlay"')
    expect(dialogTemplate).toContain('data-slot="dialog-content"')
    expect(dialogTemplate).toContain('role="dialog"')
    expect(dialogTemplate).toContain('@click.self="dialog.setOpen(false)"')
    expect(dialogTemplate).toContain('@keydown.esc.stop.prevent="dialog.setOpen(false)"')
  })

  it('keeps the teleported profile card above the WebQQ shell while dragging', () => {
    const shellZIndex = Number(declarationValue('.onebot-webqq-webqq', 'z-index', webqqShellStyle))
    const profileZIndex = Number(declarationValue('.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page.onebot-webqq-webqq__profile-card-page', 'z-index', webqqInteractionsStyle))

    expect(shellZIndex).toBe(10001)
    expect(profileZIndex).toBeGreaterThan(shellZIndex)
    expect(webqqProfileCardView).toContain('onebot-webqq-webqq__secondary-page onebot-webqq-webqq__portal-page onebot-webqq-webqq__profile-card-page')
    expect(webqqEmojiPickerView).toContain('onebot-webqq-webqq__secondary-page onebot-webqq-webqq__portal-page onebot-webqq-webqq__emoji-picker-page')
    expect(webqqProfileCardView).toContain('popover="manual"')
    expect(webqqEmojiPickerView).toContain('popover="manual"')
    expect(webqqProfileCardView).toContain("enableWebQQFrostedGlass ? 'is-frosted' : 'is-plain'")
    expect(webqqEmojiPickerView).toContain("enableWebQQFrostedGlass ? 'is-frosted' : 'is-plain'")
    expect(hasRule('.onebot-webqq-webqq__portal-page[popover]', webqqInteractionsStyle)).toBe(true)
    expect(dialogContentView).toContain('popover="manual"')
  })

  it('centers the profile avatar above field sections and styles inline edit actions', () => {
    const heroBody = ruleDeclarations('.onebot-webqq-webqq__portal-page .onebot-webqq-webqq__profile-card-hero', webqqInteractionsStyle)
    const avatarFrameBody = ruleDeclarations('.onebot-webqq-webqq__portal-page .onebot-webqq-webqq__profile-card-avatar-frame', webqqInteractionsStyle)
    const avatarBody = ruleDeclarations('.onebot-webqq-webqq__portal-page .onebot-webqq-webqq__profile-card-avatar', webqqInteractionsStyle)
    const fieldRowBody = ruleDeclarations('.onebot-webqq-webqq__portal-page .onebot-webqq-webqq__profile-card-fields > div', webqqInteractionsStyle)
    const fieldActionBody = ruleDeclarations('.onebot-webqq-webqq__portal-page .onebot-webqq-webqq__profile-card-field-action', webqqInteractionsStyle)
    const headerBody = ruleDeclarations('.onebot-webqq-webqq__portal-page > .onebot-webqq-webqq__secondary-page-header', webqqInteractionsStyle)
    const selectTriggerBody = ruleDeclarations('.onebot-webqq-webqq__portal-page .onebot-webqq-webqq__profile-card-select-trigger', webqqInteractionsStyle)

    expect(heroBody).toContain('flex-direction: column')
    expect(heroBody).toContain('align-items: center')
    expect(avatarFrameBody).toContain('width: 96px')
    expect(avatarFrameBody).toContain('height: 96px')
    expect(avatarFrameBody).toContain('overflow: hidden')
    expect(avatarFrameBody).toContain('border: 0')
    expect(avatarFrameBody).toContain('border-radius: 50%')
    expect(avatarFrameBody).toContain('-webkit-mask-image: none')
    expect(avatarFrameBody).toContain('mask-image: none')
    expect(avatarBody).toContain('width: 100%')
    expect(avatarBody).toContain('height: 100%')
    expect(avatarBody).toContain('border-radius: inherit')
    expect(avatarBody).toContain('object-fit: cover')
    expect(avatarBody).toContain('-webkit-mask-image: none')
    expect(avatarBody).toContain('mask-image: none')
    expect(fieldRowBody).toContain('grid-template-columns: max-content minmax(0, 1fr) auto')
    expect(fieldActionBody).toContain('width: 28px')
    expect(fieldActionBody).toContain('height: 28px')
    // 二级页顶栏对齐聊天顶栏：悬浮 + 半透明 + 高斯模糊。
    expect(headerBody).toContain('position: absolute')
    expect(headerBody).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(headerBody).toContain('-webkit-backdrop-filter: saturate(180%) blur(20px)')
    expect(headerBody).toContain('background: color-mix(in srgb, var(--webqq-surface) 92%, transparent)')
    expect(selectTriggerBody).toContain('min-height: 32px')
    // 这条留在整文件 toContain：那个类名在样式源里只作为后代选择器的一节出现，没有自己的规则，
    // 收紧成存在性就得给参数加上祖先前缀，而改断言参数在这一票的 Out of Scope 里。
    expect(webqqInteractionsStyle).toContain('.onebot-webqq-webqq__profile-card-select-menu')
    // 资料卡内容相对 48px 顶栏再下沉，避免头像贴边。
    expect(hasRule('.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page.onebot-webqq-webqq__profile-card-page > .onebot-webqq-webqq__profile-card', webqqInteractionsStyle)).toBe(true)
    expect(webqqInteractionsStyle).toContain('padding-top: 72px')
    expect(webqqInteractionsStyle).not.toContain('.onebot-webqq-webqq__profile-card-edit-actions')
  })

  it('keeps the emoji search field separated from the floating header', () => {
    const pickerBody = ruleDeclarations(
      '.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page.onebot-webqq-webqq__emoji-picker-page > .onebot-webqq-webqq__emoji-picker',
      webqqInteractionsStyle,
    )

    expect(pickerBody).toContain('padding-top: 64px')
  })

  it('fully styles the selection cancel button without inherited theme tokens', () => {
    const selector = ".onebot-webqq-webqq__selection-bar .onebot-webqq-webqq__selection-bar-button[data-variant='outline']"
    const buttonBody = ruleDeclarations(selector, webqqInteractionsStyle)
    const focusBody = ruleDeclarations(`${selector}:focus-visible`, webqqInteractionsStyle)

    expect(buttonBody).toContain('border: 1px solid rgba(217, 225, 234, 0.9)')
    expect(buttonBody).toContain('color: #202938')
    expect(buttonBody).toContain('background: #fff')
    expect(buttonBody).toContain('outline: none')
    expect(focusBody).toContain('border-color:')
    expect(focusBody).toContain('box-shadow: 0 0 0 3px')
  })

  it('keeps the status dot visible outside the avatar curve', () => {
    // 头像图片圆角来自嵌套的 img 子规则，所以这里要整块内容而不是本级声明。
    expect(ruleBlock('.onebot-webqq__avatar', avatarRule)).not.toContain('overflow: hidden')
    expect(ruleBlock('.onebot-webqq__avatar', avatarRule).match(/img\s*{[\s\S]*border-radius:\s*inherit/)).toBeTruthy()
  })

  it('places the capsule total unread badge on the bot avatar corner', () => {
    const unreadBody = ruleDeclarations('.onebot-webqq__avatar-unread')
    expect(ruleDeclarations('.onebot-webqq__avatar', avatarRule)).toContain('position: relative')
    expect(unreadBody).toContain('position: absolute')
    expect(unreadBody).toContain('top: -5px')
    expect(unreadBody).toContain('right: -10px')
    expect(unreadBody).toContain('min-width: 18px')
    expect(unreadBody).toContain('background: #ef4444')
  })

  it('styles the WebQQ avatar guide as an elegant theme-colored halo', () => {
    const guideBody = ruleDeclarations('.onebot-webqq__avatar-guide')
    const ringBody = ruleDeclarations('.onebot-webqq__avatar-guide-ring', capsuleStyle)
    const transitionBody = ruleDeclarations('.onebot-webqq-avatar-guide-enter-active', capsuleStyle)
    const reducedMotionBody = ruleBlock('@media (prefers-reduced-motion: reduce)')
    const missingRequirements = [
      ruleDeclarations('.onebot-webqq__body', capsuleStyle).includes('pointer-events: auto')
        ? ''
        : '胶囊主体空白处不可点击',
      guideBody.includes('position: absolute') ? '' : '头像图形引导没有绝对定位到胶囊内',
      guideBody.includes('pointer-events: none') ? '' : '头像图形引导不应拦截点击头像',
      guideBody.includes('z-index: 1') ? '' : '头像图形引导应该位于在线状态和消息计数下方',
      ruleDeclarations('.onebot-webqq__status').includes('z-index: 2') ? '' : '在线状态应该覆盖头像图形引导',
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
      ringBody.includes('var(--onebot-webqq-webqq-accent, #2563eb)')
        ? ''
        : '头像光圈没有使用 WebQQ 主题色变量',
      ringBody.includes('box-shadow: 0 0 12px')
        ? ''
        : '头像光圈阴影仍按旧头像尺寸扩散过宽',
      ringBody.includes('var(--onebot-webqq-webqq-accent-shadow, rgba(37, 99, 235, 0.24))')
        ? ''
        : '头像光圈阴影没有使用 WebQQ 主题色阴影变量',
      ringBody.includes('border-radius: 50%') ? '' : '头像图形引导缺少圆形光圈',
      ringBody.includes('animation: onebot-webqq-avatar-guide-ring 2.4s cubic-bezier')
        ? ''
        : '头像光圈动画不够柔和',
      style.includes('.onebot-webqq__avatar-guide-ring::after')
        && style.includes('@keyframes onebot-webqq-avatar-guide-halo')
        ? ''
        : '头像光圈缺少柔和外扩 halo',
      style.includes('.onebot-webqq__avatar-guide-ring::after')
        && ruleDeclarations('.onebot-webqq__avatar-guide-ring::after', capsuleStyle).includes('inset: -5px')
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
    const body = ruleDeclarations('.onebot-webqq__body', capsuleStyle)
    const conversationActivity = ruleDeclarations('.onebot-webqq__activity.is-conversation')
    const activityAffix = ruleDeclarations('.onebot-webqq__activity-prefix')
    const activityUser = ruleDeclarations('.onebot-webqq__activity-user')
    const tooltip = ruleDeclarations('.onebot-webqq__tooltip')
    const content = ruleDeclarations('.onebot-webqq__tooltip-content')
    const transition = ruleDeclarations('.onebot-webqq-tooltip-enter-active')

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
    expect(content).toContain('font-size: var(--onebot-webqq-font-xs)')
    expect(content).toContain('line-height: 16px')
    expect(content).toContain('white-space: nowrap')
    expect(content).toContain('overflow: hidden')
    expect(content).not.toContain('text-overflow: ellipsis')
    expect(style).not.toContain('onebot-webqq__tooltip-arrow')
    expect(transition).toContain('transition: opacity')
    expect(transition).toContain('transform')
  })

  it('centers the capsule summary text vertically', () => {
    const body = ruleDeclarations('.onebot-webqq__body', capsuleStyle)
    const title = ruleDeclarations('.onebot-webqq__title', titleRule)

    expect(body).toContain('position: fixed')
    expect(body).toContain('right: 24px')
    expect(body).toContain('bottom: 56px')
    expect(body).toContain('width: 157px')
    expect(body).toContain('height: 50px')
    expect(body).toContain('padding: 7px 12px')
    expect(body).toContain('justify-content: flex-start')
    expect(title).toContain('font-size: var(--onebot-webqq-font-md)')
    expect(title).toContain('line-height: 18px')
    expect(style).toContain(`.onebot-webqq__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--onebot-webqq-font-sm);
  line-height: 18px`)
  })

  it('keeps the current bot avatar anchored while folded avatars expand left', () => {
    const avatarCapsule = ruleDeclarations('.onebot-webqq__avatar-capsule')
    const stack = ruleBlock('.onebot-webqq__bot-stack')
    const overflow = ruleDeclarations('.onebot-webqq__bot-overflow', botOverflowRule)
    const overflowExpanding = ruleDeclarations('.onebot-webqq__bot-stack.is-overflow-expanding .onebot-webqq__bot-overflow')
    const overflowAvatar = ruleBlock('.onebot-webqq__bot-overflow-avatar', botOverflowAvatarRule)
    const overflowLabel = sourceBetween(
      '.onebot-webqq__bot-overflow-label {',
      '.onebot-webqq__bot-overflow-plus',
      capsuleStyle,
    )
    const overflowMotionAvatars = sourceBetween(
      '.onebot-webqq__bot-stack.is-overflow-expanding .onebot-webqq__bot-switch.is-collapsed-extra,',
      '.onebot-webqq__bot-stack.is-overflow-collapsing .onebot-webqq__bot-overflow',
      capsuleStyle,
    )
    // 撤回动画的两条 animation 写在子规则里，所以这里要整块内容而不是本级声明。
    const overflowCollapsing = ruleBlock('.onebot-webqq__bot-stack.is-overflow-collapsing .onebot-webqq__bot-overflow')
    const narrowBody = ruleBlock('@media screen and (max-width: 768px)')
    const host = ruleDeclarations('.onebot-webqq-host', capsuleStyle)
    const shell = ruleDeclarations('.onebot-webqq')
    const botSwitch = ruleBlock('.onebot-webqq__bot-switch', botSwitchRule)

    expect(host).toContain('position: fixed')
    expect(host).toContain('right: 24px')
    expect(host).toContain('bottom: 56px')
    expect(host).toContain('height: 50px')
    expect(host).toContain('line-height: 0')
    expect(ruleDeclarations('.onebot-webqq-layout-root')).toContain('position: relative')
    expect(ruleDeclarations('.onebot-webqq-layout-root')).toContain('display: block')
    expect(ruleDeclarations('.onebot-webqq-layout-root')).toContain('height: 50px')
    expect(shell).toContain('position: relative')
    expect(shell).not.toContain('position: fixed')
    expect(shell).toContain('width: var(--onebot-webqq-shell-collapsed-width, 204px)')
    expect(shell).toContain('height: 50px')
    expect(shell).not.toContain('max-width: calc(100vw - 32px)')
    expect(shell).toContain('transition: width 0.18s ease')
    expect(ruleDeclarations('.onebot-webqq.is-bot-stack-expanded')).toContain('width: var(--onebot-webqq-shell-width')
    expect(avatarCapsule).toContain('position: relative')
    expect(avatarCapsule).not.toContain('position: absolute')
    expect(avatarCapsule).not.toContain('right: 164px')
    expect(avatarCapsule).toContain('width: var(--onebot-webqq-avatar-capsule-collapsed-width, 50px)')
    expect(avatarCapsule).toContain('height: 50px')
    expect(avatarCapsule).toContain('padding: 4px')
    expect(avatarCapsule).toContain('transition: width 0.18s ease')
    expect(ruleDeclarations('.onebot-webqq__avatar-capsule.is-expanded')).toContain('width: var(--onebot-webqq-avatar-capsule-expanded-width, var(--onebot-webqq-avatar-capsule-collapsed-width, 50px))')
    expect(stack).toContain('width: var(--onebot-webqq-stack-collapsed-width, 42px)')
    expect(stack).toContain('width: var(--onebot-webqq-stack-expanded-width, var(--onebot-webqq-stack-collapsed-width, 42px))')
    expect(stack).toContain('transition: width 0.18s ease')
    expect(botSwitch).toContain('right: var(--onebot-webqq-bot-collapsed-right, 0)')
    expect(botSwitch).toContain('-webkit-tap-highlight-color: transparent')
    expect(botSwitch).toContain('content: none')
    expect(botSwitch).toContain('display: none')
    expect(stack.includes('right: var(--onebot-webqq-bot-expanded-right, 0)')).toBe(true)
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
    expect(hasRule('@keyframes onebot-webqq-bot-overflow-avatar-erase')).toBe(true)
    expect(hasRule('@keyframes onebot-webqq-bot-overflow-label-reveal')).toBe(true)
    expect(ruleBlock('@keyframes onebot-webqq-bot-overflow-avatar-erase')).toContain('clip-path: inset(0 100% 0 0 round 999px)')
    expect(ruleBlock('@keyframes onebot-webqq-bot-overflow-label-reveal')).toContain('clip-path: inset(0 0 0 0 round 999px)')
    expect(style).not.toContain('@keyframes onebot-webqq-bot-overflow-avatar-reveal')
    expect(style).not.toContain('@keyframes onebot-webqq-bot-overflow-label-erase')
    expect(style).not.toContain('--onebot-webqq-bot-overflow-expanded-offset')
    expect(style).not.toContain('--onebot-webqq-bot-overflow-z-index: 20')
    expect(ruleBlock('@media (prefers-reduced-motion: reduce)')).not.toContain('.onebot-webqq__bot-stack.is-overflow-expanding .onebot-webqq__bot-overflow-avatar')
    expect(ruleBlock('@media (prefers-reduced-motion: reduce)')).toContain('.onebot-webqq__bot-stack.is-overflow-collapsing .onebot-webqq__bot-overflow-label')
    expect(narrowBody).not.toContain('.onebot-webqq {\n    right: 16px;\n    bottom: 52px;')
    expect(narrowBody).toContain('.onebot-webqq-host,\n  .onebot-webqq__body')
    expect(narrowBody).toContain('right: 16px')
    expect(narrowBody).toContain('bottom: 52px')
  })

  it('keeps the main capsule compact without usage rows', () => {
    expect(ruleDeclarations('.onebot-webqq')).toContain('width: var(--onebot-webqq-shell-collapsed-width, 204px)')
    expect(style).not.toContain('.onebot-webqq__usage')
    expect(style).not.toContain('.onebot-webqq__usage-row')
    expect(style).not.toContain('.onebot-webqq__usage-icon')
  })

  it('renders the main capsule with a frosted glass surface', () => {
    const capsule = ruleDeclarations('.onebot-webqq')
    const capsuleSurface = ruleDeclarations('.onebot-webqq::before')
    const plainCapsuleSurface = ruleDeclarations('.onebot-webqq.is-plain::before')
    const avatarCapsule = ruleDeclarations('.onebot-webqq__avatar-capsule')
    const body = ruleDeclarations('.onebot-webqq__body', capsuleStyle)
    const darkSurface = ruleDeclarations('.onebot-webqq.is-color-dark::before')
    const wideCapsuleSurface = ruleDeclarations('.onebot-webqq.is-capsule-shadow-wide::before')
    const darkWideSurface = ruleDeclarations('.onebot-webqq.is-color-dark.is-capsule-shadow-wide::before')
    const overlappedAvatar = ruleDeclarations('.onebot-webqq__bot-switch.is-overlapped .onebot-webqq__avatar')
    const overflowAvatar = ruleDeclarations('.onebot-webqq__bot-overflow', botOverflowRule)
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
      plainCapsuleSurface.includes('backdrop-filter: none')
        && plainCapsuleSurface.includes('-webkit-backdrop-filter: none')
        ? ''
        : '关闭小胶囊毛玻璃时没有取消背景模糊',
      overlappedAvatar.includes('radial-gradient(circle 23px at var(--onebot-webqq-avatar-overlap-center) 21px, transparent 98%, #000 100%)')
        && overlappedAvatar.includes('box-shadow: none')
        && !overlappedAvatar.includes('transition: --onebot-webqq-avatar-overlap-center')
        && overlappedAvatar.includes('-webkit-mask-image: var(--onebot-webqq-avatar-overlap-cutout)')
        && overlappedAvatar.includes('mask-image: var(--onebot-webqq-avatar-overlap-cutout)')
        ? ''
        : '头像堆叠没有通过兼容遮罩裁掉被前方头像覆盖的区域',
      overflowAvatar.includes('box-shadow: none')
        && overflowAvatar.includes('-webkit-mask-image: var(--onebot-webqq-avatar-overlap-cutout)')
        && overflowAvatar.includes('mask-image: var(--onebot-webqq-avatar-overlap-cutout)')
        ? ''
        : '机器人余量徽标没有复用头像堆叠裁切',
      !avatarCapsule.includes('background:')
        && !avatarCapsule.includes('border:')
        && !avatarCapsule.includes('box-shadow:')
        && !body.includes('background:')
        && !body.includes('border:')
        && !body.includes('box-shadow:')
        ? ''
        : '左右结构不能各自画成两个胶囊表面或阴影',
      darkSurface.includes('background: rgba(44, 44, 48, 0.82)')
        ? ''
        : '主胶囊暗色背景没有使用 Sandbox 中性表面色',
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
    expect(ruleBlock('@keyframes onebot-webqq-thinking-shimmer')).toContain('background-position: 120% 0')
    expect(ruleBlock('@keyframes onebot-webqq-thinking-shimmer')).toContain('background-position: -160% 0')
    expect(ruleBlock('@keyframes onebot-webqq-thinking-shimmer')).not.toContain('background-position: 100% 0')
  })

  it('allows the WebQQ chat message pane to scroll inside the fixed panel', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__chat', webqqChatStyle)).toContain('min-height: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-body', webqqChatStyle)).toContain('display: flex')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-body', webqqChatStyle)).toContain('min-height: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq__messages')).toContain('overflow-y: auto')
  })

  it('keeps the WebQQ shell aspect ratio while fitting the viewport', () => {
    const webQQShellBody = ruleDeclarations('.onebot-webqq-webqq', webqqShellStyle)
    expect(webQQShellBody).toContain('grid-template-rows: minmax(0, 1fr)')
    expect(webQQShellBody).toContain('width: min(calc(100vw - 32px), calc(158.536585vh - 247.317073px))')
    expect(webQQShellBody).toContain('height: auto')
    expect(webQQShellBody).toContain('aspect-ratio: 1040 / 656')
    expect(webQQShellBody).not.toContain('width: min(980px')
    expect(webQQShellBody).not.toContain('height: min(680px')
  })

  it('uses invisible top and left edge zones for optional WebQQ resizing', () => {
    const resizeZoneBody = ruleDeclarations('.onebot-webqq-webqq__resize-zone')
    expect(resizeZoneBody).toContain('position: absolute')
    expect(resizeZoneBody).toContain('background: transparent')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-resizing')).toContain('user-select: none')
  })

  it('styles the WebQQ return-to-bottom button as a clickable bottom overlay', () => {
    const scrollBottomBody = ruleDeclarations('.onebot-webqq-webqq__scroll-bottom')
    const missingRequirements = [
      /position:\s*(absolute|fixed)\s*;/.test(scrollBottomBody)
        ? ''
        : '返回底部按钮没有固定或绝对定位',
      /bottom:\s*[^;]+;/.test(scrollBottomBody) ? '' : '返回底部按钮没有定位到聊天主体底部附近',
      /display:\s*(inline-flex|flex)\s*;/.test(scrollBottomBody)
        ? ''
        : '返回底部按钮没有使用 flex 对齐按钮内容',
      /z-index:\s*[^;]+;/.test(scrollBottomBody) ? '' : '返回底部按钮缺少覆盖在消息区域上的层级',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('uses glass bubble colors for the WebQQ return-to-bottom button in light and dark modes', () => {
    const scrollBottomBody = ruleDeclarations('.onebot-webqq-webqq__scroll-bottom')
    const darkScrollBottomBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__scroll-bottom')
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
      darkScrollBottomBody.includes('background: var(--webqq-panel)')
        ? ''
        : '返回底部按钮强制暗色模式没有使用 Sandbox 面板色',
      darkScrollBottomBody.includes('backdrop-filter: saturate(180%) blur(20px)')
        ? ''
        : '返回底部按钮强制暗色模式缺少毛玻璃效果',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('animates the WebQQ return-to-bottom button without ignoring reduced motion', () => {
    const transitionBody = ruleDeclarations('.webqq-scroll-bottom-enter-active', webqqChatStyle)
    const hiddenBody = ruleDeclarations('.webqq-scroll-bottom-enter-from')
    const reducedMotionBody = ruleBlock('@media (prefers-reduced-motion: reduce)')
    const missingRequirements = [
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
    expect(ruleDeclarations('.onebot-webqq-webqq__message')).toContain('display: flex')
    expect(ruleDeclarations('.onebot-webqq-webqq__message')).toContain('--onebot-webqq-webqq-message-avatar-size: 32px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-avatar-wrap')).toContain('position: relative')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-avatar-wrap')).toContain('width: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-avatar-wrap')).toContain('height: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-avatar')).toContain('width: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-avatar')).toContain('height: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-avatar')).toContain('border-radius: 50%')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-avatar-context', webqqInteractionsStyle)).toContain('display: contents')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity')).toContain('position: absolute')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity')).toContain('top: -10px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity')).toContain('right: -12px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity')).toContain('min-width: 15px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity')).toContain('height: 15px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity')).toContain('background: #ec4899')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity')).toContain('box-shadow: 0 2px 6px rgba(190, 24, 93, 0.24)')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity-icon')).toContain('fill: currentColor')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity-sign')).toContain('margin-right: 1px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-affinity-sign')).toContain('transform: translateY(-1px)')
  })

  it('keeps WebQQ reaction avatars compact inside reaction pills', () => {
    const avatarBody = ruleDeclarations('.onebot-webqq-webqq__message-reaction-avatar')
    const avatarImageBody = ruleDeclarations('.onebot-webqq-webqq__message-reaction-avatar-image')

    expect(ruleDeclarations('.onebot-webqq-webqq__message-reaction')).toContain('--onebot-webqq-webqq-reaction-avatar-size: 26px')
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
    expect(ruleDeclarations('.onebot-webqq-webqq__message-reaction-users')).toContain('display: inline-flex')
    expect(style).toContain(`.onebot-webqq-webqq__message-reaction-avatar {
  position: relative`)
    expect(ruleDeclarations('.onebot-webqq-webqq__message-reaction-users .onebot-webqq-webqq__message-reaction-avatar + .onebot-webqq-webqq__message-reaction-avatar')).toContain('margin-left: -6px')
  })

  it('renders WebQQ reaction emoji images at a stable inline size', () => {
    const emojiBody = ruleDeclarations('.onebot-webqq-webqq__message-reaction-emoji')

    expect(emojiBody).toContain('width: 18px')
    expect(emojiBody).toContain('height: 18px')
    expect(emojiBody).toContain('object-fit: contain')
  })

  it('stacks WebQQ rich message elements vertically inside the bubble', () => {
    expect(style).toContain('.onebot-webqq-webqq__bubble {\n  display: flex')
    expect(style).toContain('.onebot-webqq-webqq__bubble {\n  display: flex;\n  max-width: 100%;\n  flex-direction: column')
    expect(style).not.toContain('.onebot-webqq-webqq__bubble {\n  display: inline-flex')
  })

  it('preserves user line breaks inside WebQQ text bubbles', () => {
    expect(style).toMatch(/\n\.onebot-webqq-webqq__inline-run\s*{[\s\S]*?\n  white-space:\s*pre-line/)
    expect(ruleDeclarations('.onebot-webqq-webqq__bubble', bubbleRule)).toContain('word-break: break-word')
    expect(ruleDeclarations('.onebot-webqq-webqq__bubble', bubbleRule)).not.toContain('white-space: pre-wrap')
  })

  it('shrinks WebQQ text bubbles to their own message content', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__message-content')).toContain('display: flex')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-content')).toContain('flex-direction: column')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-content')).toContain('align-items: flex-start')
    expect(ruleDeclarations('.onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-content')).toContain('align-items: flex-end')
  })

  it('renders WebQQ image-only messages without bubble background', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__message-body.is-image-only')).toContain('width: fit-content')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-media-stack')).toContain('width: fit-content')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-media-stack')).toContain('max-width: min(220px, 100%)')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-media')).toContain('display: flex')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-media img')).toContain('max-width: min(220px, 100%)')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-media img')).toContain('border-radius: 8px')
  })

  it('styles WebQQ message images as clickable previews', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__message-image')).toContain('background: transparent')
    expect(ruleDeclarations('.onebot-webqq-webqq__image-preview')).toContain('position: fixed')
    expect(ruleDeclarations('.onebot-webqq-webqq__image-preview')).toContain('inset: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq__image-preview')).toContain('z-index: 10002')
    expect(ruleDeclarations('.onebot-webqq-webqq__image-preview')).toContain('background: rgba(15, 23, 42, 0.78)')
    expect(ruleDeclarations('.onebot-webqq-webqq__image-preview img')).toContain('max-width: min(1120px, calc(100vw - 64px))')
    expect(ruleDeclarations('.onebot-webqq-webqq__image-preview img')).toContain('max-height: calc(100vh - 64px)')
    expect(ruleDeclarations('.onebot-webqq-webqq__image-preview-close')).toContain('position: fixed')
  })

  it('does not keep the removed WebQQ readonly bar styles', () => {
    expect(style).not.toContain('onebot-webqq-webqq__readonly-bar')
  })

  it('styles WebQQ friend category headings in the friend list', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__friend-category-title', webqqShellStyle)).toContain('font-size: var(--onebot-webqq-font-sm)')
    expect(ruleDeclarations('.onebot-webqq-webqq__friend-category-title', webqqShellStyle)).toContain('color: #9ca3af')
  })

  it('renders WebQQ sender metadata as compact badges', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__sender-line')).toContain('display: flex')
    expect(ruleDeclarations('.onebot-webqq-webqq__sender-line')).toContain('gap: 4px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__sender-line')).toContain('justify-content: flex-end')
    expect(ruleDeclarations('.onebot-webqq-webqq__sender-badge')).toContain('border-radius: 5px')
    expect(ruleDeclarations('.onebot-webqq-webqq__sender-badge.is-owner')).toContain('background: #fff3cf')
    expect(ruleDeclarations('.onebot-webqq-webqq__sender-badge.is-admin')).toContain('background: #e9f8ef')
    expect(ruleDeclarations('.onebot-webqq-webqq__sender-badge.is-level')).toContain('background: rgba(148, 163, 184, 0.24)')
    expect(ruleDeclarations('.onebot-webqq-webqq__sender-badge.is-title')).toContain('background: rgba(18, 183, 245, 0.1)')
    expect(ruleDeclarations('.onebot-webqq-webqq__sender-badge.is-relationship')).toContain('background: rgba(99, 102, 241, 0.12)')
  })

  it('keeps WebQQ sender metadata away from the first message bubble', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__sender-line + .onebot-webqq-webqq__message-body')).toContain('margin-top: 6px')
  })

  it('hides repeated avatars on merged TIM-style WebQQ messages', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__message.is-merged')).toContain('margin-top: -14px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message.is-merged .onebot-webqq-webqq__message-avatar-wrap')).toContain('visibility: hidden')
  })

  it('rounds TIM-style WebQQ message clusters like stacked capsules', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__bubble')).toContain('margin: 1px 0')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message.is-cluster-first:not(.is-outgoing) .onebot-webqq-webqq__bubble')).toContain('border-bottom-left-radius: 3px')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message.is-cluster-middle:not(.is-outgoing) .onebot-webqq-webqq__bubble')).toContain('border-radius: 3px 18px 18px 3px')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message.is-cluster-last:not(.is-outgoing) .onebot-webqq-webqq__bubble')).toContain('border-top-left-radius: 3px')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message.is-outgoing.is-cluster-middle .onebot-webqq-webqq__bubble')).toContain('border-radius: 18px 3px 3px 18px')
  })

  it('gates TIM-style WebQQ bubble tails behind the enabled option class', () => {
    const baseTailSelector = '.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message:not(.is-merged) .onebot-webqq-webqq__bubble::before'
    const enabledTailSelector = '.onebot-webqq-webqq.is-chat-style-tim.has-tim-bubble-tail .onebot-webqq-webqq__message:not(.is-merged) .onebot-webqq-webqq__bubble::before'

    // 「不该存在这条规则」用存在性表达：切不出内容返回空串这种判据一旦选择器改名就静默变成永真。
    expect(hasRule(baseTailSelector)).toBe(false)
    expect(ruleDeclarations(enabledTailSelector)).toContain("content: ''")
    expect(ruleDeclarations(enabledTailSelector)).toContain('background: inherit')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim.has-tim-bubble-tail .onebot-webqq-webqq__message:not(.is-outgoing):not(.is-merged) .onebot-webqq-webqq__bubble')).toContain('border-top-left-radius: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim.has-tim-bubble-tail .onebot-webqq-webqq__message.is-outgoing:not(.is-merged) .onebot-webqq-webqq__bubble')).toContain('border-top-right-radius: 0')
  })

  it('shows TIM-style WebQQ message times outside bubbles on hover', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__message-body')).toContain('display: flex')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message-body')).toContain('flex-direction: row')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message-time')).toContain('align-self: flex-end')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message-time')).toContain('flex: 0 0 auto')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message-time')).toContain('opacity: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message:hover .onebot-webqq-webqq__message-time')).toContain('opacity: 1')
  })

  it('places TIM-style WebQQ reactions inside message bubbles', () => {
    const bubbleBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__bubble')
    const reactionBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__bubble .onebot-webqq-webqq__message-reactions')

    expect(bubbleBody).toContain('gap: 2px')
    expect(reactionBody).toContain('margin-top: 0')
    expect(reactionBody).toContain('margin-bottom: -5px')
    expect(reactionBody).toContain('align-self: flex-start')
  })

  it('makes TIM-style WebQQ reaction pills compact and bubble-tinted', () => {
    const bubbleBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__bubble')
    const outgoingBubbleBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .is-outgoing .onebot-webqq-webqq__bubble')
    const outgoingReactionBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .is-outgoing .onebot-webqq-webqq__bubble .onebot-webqq-webqq__message-reaction')
    const reactionBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__bubble .onebot-webqq-webqq__message-reaction')
    const usersBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__bubble .onebot-webqq-webqq__message-reaction-users')

    expect(bubbleBody).toContain('gap: 2px')
    expect(bubbleBody).toContain('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-bubble-bg) 88%, #64748b 12%)')
    expect(outgoingBubbleBody).toContain('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-bubble-bg) 88%, #0f172a 12%)')
    expect(reactionBody).toContain('background: var(--onebot-webqq-webqq-reaction-bg)')
    expect(outgoingReactionBody).toContain('background: var(--onebot-webqq-webqq-reaction-bg)')
    expect(outgoingReactionBody).not.toContain('background: color-mix')
    expect(reactionBody).toContain('gap: 4px')
    expect(reactionBody).toContain('min-height: unset')
    expect(reactionBody).toContain('padding: 0 0 0 2px')
    expect(usersBody).toContain('margin-right: 0')
  })

  it('keeps TIM-style WebQQ image reactions below images with bubble reaction styling', () => {
    const stackBody = ruleDeclarations('.onebot-webqq-webqq__message-media-stack')
    const outgoingStackBody = ruleDeclarations('.onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-media-stack')
    const reactionsBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions')
    const outgoingReactionsBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .is-outgoing .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions')
    const reactionBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions .onebot-webqq-webqq__message-reaction')
    const usersBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions .onebot-webqq-webqq__message-reaction-users')
    const avatarBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions .onebot-webqq-webqq__message-reaction-avatar')

    expect(stackBody).toContain('flex-direction: column')
    expect(stackBody).toContain('align-items: flex-start')
    expect(outgoingStackBody).toContain('align-items: flex-end')
    expect(reactionsBody).toContain('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-bubble-bg) 88%, #64748b 12%)')
    expect(reactionsBody).toContain('align-self: flex-start')
    expect(reactionsBody).toContain('margin-top: 0')
    expect(outgoingReactionsBody).toContain('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-bubble-bg) 88%, #0f172a 12%)')
    expect(outgoingReactionsBody).toContain('align-self: flex-end')
    expect(reactionBody).toContain('--onebot-webqq-webqq-reaction-avatar-size: 18px')
    expect(reactionBody).toContain('background: var(--onebot-webqq-webqq-reaction-bg)')
    expect(reactionBody).toContain('padding: 0 0 0 2px')
    expect(usersBody).toContain('margin-right: 0')
    expect(avatarBody).toContain('box-shadow: none')
  })

  it('shows QQ-style WebQQ message times beside bubbles on hover', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-body')).toContain('flex-direction: row')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-body')).toContain('align-items: flex-end')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-body')).toContain('gap: 6px')
    expect(style).toContain(`.onebot-webqq-webqq.is-chat-style-tim .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-body,
.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-body {
  flex-direction: row-reverse;
}`)
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-time')).toContain('align-self: flex-end')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-time')).toContain('flex: 0 0 auto')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-time')).toContain('opacity: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-time')).toContain('white-space: nowrap')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message:hover .onebot-webqq-webqq__message-time')).toContain('opacity: 1')
  })

  it('places QQ-style WebQQ reactions outside bubbles without user avatars', () => {
    const reactionsBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-reactions')
    const reactionBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-reaction')
    const usersBody = ruleDeclarations('.onebot-webqq-webqq.is-chat-style-qq .onebot-webqq-webqq__message-reaction-users')

    expect(reactionsBody).toContain('align-self: flex-end')
    expect(reactionsBody).toContain('margin-top: 0')
    expect(reactionBody).toContain('min-height: 22px')
    expect(reactionBody).toContain('padding: 1px 7px')
    expect(reactionBody).toContain('gap: 2px')
    expect(usersBody).toContain('display: none')
  })

  it('shows compact WebQQ recall status and event capsules', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__message-event')).toContain('width: fit-content')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-event')).toContain('max-width: 74%')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-recall-status')).toContain('opacity: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-recall-status')).toContain('visibility: hidden')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-recall-status')).toContain('white-space: nowrap')
    expect(ruleDeclarations('.onebot-webqq-webqq__message.is-recalled:hover .onebot-webqq-webqq__message-recall-status')).toContain('opacity: 1')
    expect(ruleDeclarations('.onebot-webqq-webqq__message.is-recalled:hover .onebot-webqq-webqq__message-recall-status')).toContain('visibility: visible')
  })

  it('draws recalled WebQQ text strikethrough on each wrapped line', () => {
    const recalledTextBody = ruleDeclarations('.onebot-webqq-webqq__message.is-recalled .onebot-webqq-webqq__inline-run')
    const recalledBubbleBody = ruleDeclarations('.onebot-webqq-webqq__message.is-recalled .onebot-webqq-webqq__bubble')

    expect(recalledTextBody).toContain('text-decoration-line: line-through')
    expect(recalledTextBody).toContain('text-decoration-thickness: 2px')
    expect(recalledTextBody).toContain('text-decoration-skip-ink: none')
    expect(recalledBubbleBody).toContain('opacity: 0.62')
    expect(recalledBubbleBody).not.toContain('top: 50%')
  })

  it('keeps WebQQ contact message times in the top-right corner', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__contact', webqqShellStyle)).toContain('position: relative')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact', webqqShellStyle)).toContain('padding: 10px 58px 10px 12px')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-time', webqqShellStyle)).toContain('position: absolute')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-time', webqqShellStyle)).toContain('top: 10px')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-time', webqqShellStyle)).toContain('right: 12px')
  })

  it('places WebQQ unread badges on the contact avatar corner', () => {
    // contact-avatar 是 span：必须 block + 固定正方形，否则 width/height 不生效，头像会随源图比例变成椭圆。
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-avatar', webqqShellStyle)).toContain('position: relative')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-avatar', webqqShellStyle)).toContain('display: block')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-avatar', webqqShellStyle)).toContain('width: 38px')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-avatar', webqqShellStyle)).toContain('height: 38px')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-avatar', webqqShellStyle)).toContain('min-width: 38px')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-avatar', webqqShellStyle)).toContain('min-height: 38px')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-avatar', webqqShellStyle)).not.toContain('overflow: hidden')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-unread')).toContain('position: absolute')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-unread')).toContain('top: -6px')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-unread')).toContain('right: -6px')
    expect(ruleDeclarations('.onebot-webqq-webqq__contact-unread')).toContain('min-width: 18px')
  })

  it('keeps the WebQQ chat header avatar square against the 32px header button rule', () => {
    // 顶栏通用 button { width: 32px } 会压扁头像触发器；触发器必须显式锁 38px 正方形。
    expect(ruleBlock('.onebot-webqq-webqq__chat-header', webqqChatStyle)).toContain('button {')
    expect(ruleBlock('.onebot-webqq-webqq__chat-header', webqqChatStyle)).toContain('width: 32px')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__chat-avatar-trigger')).toContain('width: 38px')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__chat-avatar-trigger')).toContain('height: 38px')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__chat-avatar-trigger')).toContain('flex: 0 0 38px')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__chat-avatar-trigger')).toContain('overflow: hidden')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__chat-avatar')).toContain('display: block')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__chat-avatar')).toContain('width: 38px')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__chat-avatar')).toContain('height: 38px')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__chat-avatar')).toContain('max-width: none')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__chat-avatar')).toContain('object-fit: cover')
  })

  it('centers the WebQQ notice menu under the bell button', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__sidebar', webqqShellStyle)).toContain('position: relative')
    expect(ruleDeclarations('.onebot-webqq-webqq__sidebar', webqqShellStyle)).toContain('z-index: 4')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-menu', webqqShellStyle)).toContain('left: 50%')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-menu', webqqShellStyle)).toContain('z-index: 5')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-menu', webqqShellStyle)).toContain('transform: translateX(-50%)')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-menu--desktop', webqqShellStyle)).toContain('position: fixed')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-menu--desktop', webqqShellStyle)).toContain('z-index: 10120')
  })

  it('keeps material blur on floating WebQQ surfaces only', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-menu', webqqShellStyle)).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleDeclarations('.onebot-webqq-webqq__scroll-bottom')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(hasRule('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__send::before', webqqChatStyle)).toBe(true)
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__send::before', webqqChatStyle)).toContain('backdrop-filter: saturate(180%) blur(22px)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__mention-menu', webqqChatStyle)).toContain('backdrop-filter: saturate(180%) blur(20px)')
  })

  it('does not declare backdrop-filter on the window host or primary regions', () => {
    // 外壳本体或一级区域出现 backdrop-filter 会成为 Backdrop Root，
    // 静默杀死其内部控件与其上浮层的全部毛玻璃（ADR 0002）。
    // 观察窗对控制台的模糊必须写在 is-frosted::before，不能写在宿主上。
    const primaryRegions = {
      '窗口外壳': ruleDeclarations('.onebot-webqq-webqq', webqqShellStyle),
      '毛玻璃外壳': ruleDeclarations('.onebot-webqq-webqq.is-frosted'),
      '清爽外壳': ruleDeclarations('.onebot-webqq-webqq.is-plain'),
      '侧栏': ruleDeclarations('.onebot-webqq-webqq__sidebar', webqqShellStyle),
      '侧栏顶栏': ruleDeclarations('.onebot-webqq-webqq__tabs-row', webqqShellStyle),
      '聊天区': ruleDeclarations('.onebot-webqq-webqq__chat', webqqChatStyle),
      '毛玻璃侧栏': ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__sidebar'),
      '毛玻璃聊天顶栏': ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__chat-header'),
      '毛玻璃群信息': ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__group-info'),
    }

    for (const [name, body] of Object.entries(primaryRegions)) {
      // 这一组全是负向断言：先确认访问器真的切出了本级声明，否则空串会让下一条静默变成永真。
      expect(body, `${name} 没有切出任何本级声明`).toMatch(/\S/)
      expect(body, `${name} 不应声明 backdrop-filter`).not.toMatch(/backdrop-filter\s*:/)
    }
    expect(webqqGroupInfoStyle).not.toMatch(/backdrop-filter\s*:/)
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted::before')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__chat-header::before')).toContain('backdrop-filter: saturate(180%) blur(20px)')
  })

  it('frosts teleported menus and dialogs from the body flag', () => {
    const frostedSurfaceRule = sourceBetween('body[data-onebot-webqq-frosted] :is(', '}', webqqInteractionsStyle)
    const solidSecondaryPageRule = sourceBetween('.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page.is-plain {', '}', webqqInteractionsStyle)

    expect(frostedSurfaceRule).toContain('background: color-mix(in srgb, var(--webqq-panel) 72%, transparent)')
    expect(frostedSurfaceRule).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(frostedSurfaceRule).toContain('.webqq-dialog-content')
    expect(frostedSurfaceRule).toContain('.webqq-context-menu-content')
    expect(frostedSurfaceRule).toContain('[data-slot="onebot-webqq-context-menu-content"]')
    expect(hasRule('body[data-onebot-webqq-frosted] .webqq-dialog-overlay', webqqInteractionsStyle)).toBe(true)
    expect(solidSecondaryPageRule).toContain('border-color: var(--webqq-secondary-outline)')
    expect(solidSecondaryPageRule).toContain('background: var(--webqq-panel)')
    expect(solidSecondaryPageRule).toContain('backdrop-filter: none')
    expect(hasRule('&.is-frosted .onebot-webqq-webqq__message-search-date-popover', webqqInteractionsStyle)).toBe(true)
    expect(hasRule('.onebot-webqq-webqq__message-search-date-popover.is-frosted', webqqInteractionsStyle)).toBe(true)
    expect(hasRule('.onebot-webqq-webqq__message-search-date-popover[popover]', webqqInteractionsStyle)).toBe(true)
    expect(ruleDeclarations('&.is-frosted .onebot-webqq-webqq__message-search-date-popover', webqqInteractionsStyle)).toContain('backdrop-filter: saturate(180%) blur(20px)')
  })

  it('uses inline SVG for WebQQ tab icons instead of pseudo elements', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__tab-icon', webqqShellStyle)).toContain('stroke: currentColor')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon::before')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon::after')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon.is-clock')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon.is-user')
    expect(style).not.toContain('.onebot-webqq-webqq__tab-icon.is-group')
  })

  it('uses inline SVG for the WebQQ search icon instead of pseudo elements', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__search-icon', searchIconRule)).toContain('stroke: currentColor')
    expect(ruleDeclarations('.onebot-webqq-webqq__search-icon', searchIconRule)).toContain('stroke-width: 2')
    expect(style).not.toContain('.onebot-webqq-webqq__search-icon::before')
    expect(style).not.toContain('.onebot-webqq-webqq__search-icon::after')
  })

  it('lets the WebQQ tab header use the panel background with a rounded top-left corner', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__sidebar', webqqShellStyle)).toContain('background: transparent')
    expect(ruleDeclarations('.onebot-webqq-webqq__sidebar', webqqShellStyle)).not.toContain('rgba(255, 255, 255, 0.58)')
    expect(ruleDeclarations('.onebot-webqq-webqq__tabs-row', webqqShellStyle)).toContain('border-radius: 24px 0 0 0')
    expect(ruleDeclarations('.onebot-webqq-webqq__tabs-row', webqqShellStyle)).toContain('background: transparent')
    expect(ruleDeclarations('.onebot-webqq-webqq__tabs-row', webqqShellStyle)).not.toContain('rgba(255, 255, 255, 0.68)')
  })

  it('keeps WebQQ as a floating single-left-rail panel on narrow screens', () => {
    const narrowBody = ruleBlock('@media screen and (max-width: 768px)')
    const panelBody = ruleDeclarations('.onebot-webqq-webqq', narrowBody)

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
    const nativeBody = ruleDeclarations('.onebot-webqq-webqq [data-onebot-webqq-scrollbar="true"]')
    const webkitBody = ruleDeclarations('.onebot-webqq-webqq [data-onebot-webqq-scrollbar="true"]::-webkit-scrollbar')
    const webkitButtonBody = ruleDeclarations('.onebot-webqq-webqq [data-onebot-webqq-scrollbar="true"]::-webkit-scrollbar-button')
    const narrowBody = ruleBlock('@media screen and (max-width: 768px)')
    const overlayBody = ruleDeclarations('.onebot-webqq-webqq__scrollbar-overlay', webqqShellStyle)
    const visibleBody = ruleDeclarations('.onebot-webqq-webqq__scrollbar-overlay.is-visible')
    const thumbBody = ruleDeclarations('.onebot-webqq-webqq__scrollbar-thumb')
    const wideThumbBody = ruleDeclarations('.onebot-webqq-webqq__scrollbar-overlay.is-wide .onebot-webqq-webqq__scrollbar-thumb')
    const narrowHiddenOverlayBody = ruleDeclarations('.onebot-webqq-webqq__scrollbar-overlay.is-hidden-on-narrow', narrowBody)

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
    expect(thumbBody).toContain('top: var(--onebot-webqq-webqq-scrollbar-thumb-top)')
    expect(thumbBody).toContain('height: var(--onebot-webqq-webqq-scrollbar-thumb-height)')
    expect(wideThumbBody).toContain('right: 2px')
    expect(wideThumbBody).toContain('width: 6px')
    expect(narrowHiddenOverlayBody).toContain('display: none')
  })

  it('shows the mobile notification page instead of the sidebar dropdown on narrow screens', () => {
    const narrowBody = ruleBlock('@media screen and (max-width: 768px)')

    expect(narrowBody).toContain('.onebot-webqq-webqq__mobile-notice-page')
    expect(narrowBody).toContain('display: flex')
    expect(narrowBody).toContain('.onebot-webqq-webqq__mobile-notice-content')
    expect(narrowBody).toContain('.onebot-webqq-webqq__sidebar .onebot-webqq-webqq__notice-menu')
    expect(narrowBody).toContain('.onebot-webqq-webqq__notice-menu--desktop')
    expect(narrowBody).toContain('display: none')
    expect(narrowBody).toContain('.onebot-webqq-webqq__chat-content')
    expect(narrowBody).toContain('min-width: 0')
  })

  it('moves the group info toggle into the narrow group info header', () => {
    const narrowBody = ruleBlock('@container onebot-webqq (max-width: 780px)')
    expect(webqqShellStyle).toContain('container: onebot-webqq / inline-size')
    expect(hasRule('@container onebot-webqq (max-width: 780px)', styleEntry)).toBe(true)
    expect(narrowBody).toContain('.onebot-webqq-webqq__chat.is-mobile-group-info-open')
    expect(narrowBody).toContain('.onebot-webqq-webqq__chat-content')
    expect(narrowBody).toContain('position: absolute')
    expect(narrowBody).toContain('pointer-events: none')
    expect(narrowBody).toContain('.onebot-webqq-webqq__group-info')
    expect(narrowBody).toContain('width: 100%')
    expect(narrowBody).toContain('border-left: 0')
    expect(narrowBody).toContain('.onebot-webqq-webqq__chat-header')
    expect(narrowBody).toContain('justify-content: flex-end')
    expect(narrowBody).toContain('button')
    expect(narrowBody).toContain('pointer-events: auto')
    expect(narrowBody).toContain('.onebot-webqq-webqq__chat-title')
    expect(narrowBody).toContain('display: none')
    expect(narrowBody).toContain('.onebot-webqq-webqq__chat-body')
  })

  it('uses plain gray-white WebQQ surfaces when frosted glass is disabled', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain')).toContain('background: #f4f6f8')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain')).toContain('border: 1px solid #d9e1ea')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__chat')).toContain('background: #f1f5f9')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__bubble')).toContain('background: #ffffff')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble')).toContain('background: var(--onebot-webqq-webqq-accent-surface)')
  })

  it('makes the default WebQQ surface frosted glass', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted')).toContain('background: transparent')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted')).toContain('border: 1px solid rgba(217, 225, 234, 0.78)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted')).toContain('border-radius: 18px')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted')).not.toMatch(/backdrop-filter\s*:/)
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted::before')).toContain('background: rgba(244, 246, 248, 0.78)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted::before')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted::before')).toContain('-webkit-backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__sidebar', themeColorsStyle)).toContain('background: rgba(244, 246, 248, 0.02)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__sidebar', themeColorsStyle)).not.toMatch(/backdrop-filter\s*:/)
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__chat')).toContain('background: transparent')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__chat')).toContain('backdrop-filter: none')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__chat-header')).toContain('background: transparent')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__chat-header::before')).toContain('background: rgba(248, 250, 252, 0.92)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__chat-header::before')).toContain('backdrop-filter: saturate(180%) blur(20px)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__group-info')).toContain('background: rgba(248, 250, 252, 0.34)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__notice-menu')).toContain('background: rgba(255, 255, 255, 0.92)')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-menu.is-frosted')).toContain('background: rgba(255, 255, 255, 0.92)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__notice-card', themeColorsStyle)).toContain('background: rgba(255, 255, 255, 0.72)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__notice-card', themeColorsStyle)).not.toMatch(/backdrop-filter\s*:/)
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__bubble')).toContain('background: rgba(255, 255, 255, 0.9)')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble')).toContain('background: var(--onebot-webqq-webqq-accent-surface)')
  })

  it('renders an opaque plain WebQQ chat header without backdrop blur', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__chat-main')).toContain('position: relative')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__chat-header')).toContain('position: absolute')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__chat-header')).toContain('inset: 0 0 auto')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__chat-header')).toContain('z-index: 2')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__chat-header')).toContain('background: #f8fafc')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__chat-header')).toContain('backdrop-filter: none')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__chat-header')).toContain('-webkit-backdrop-filter: none')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__messages')).toContain('padding: 84px 22px 20px')
    expect(ruleDeclarations('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__scroll-bottom')).toContain('backdrop-filter: none')
  })

  it('uses WebQQ accent variables for theme-colored controls', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq', webqqShellStyle)).toContain('--onebot-webqq-webqq-accent: #2563eb')
    expect(ruleDeclarations('.onebot-webqq-webqq', webqqShellStyle)).toContain('--onebot-webqq-webqq-accent-surface: var(--onebot-webqq-webqq-accent)')
    expect(style).toContain('color: var(--onebot-webqq-webqq-accent)')
    expect(style).toContain('background: var(--onebot-webqq-webqq-accent-soft)')
    // 基础发出气泡在 SCSS 里是 .onebot-webqq-webqq__message 的 &.is-outgoing 子规则，
    // 所以先取父规则的块再往里查；直接查扁平选择器会命中 .is-plain 那条主题覆盖。
    expect(
      ruleDeclarations(
        '.onebot-webqq-webqq__bubble',
        ruleBlock('&.is-outgoing', ruleBlock('.onebot-webqq-webqq__message')),
      ),
    ).toContain('background: var(--onebot-webqq-webqq-accent-surface)')
  })

  it('uses the resolved dark class as the single source of WebQQ dark styles', () => {
    const forcedRootBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark')
    const forcedBubbleBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__bubble')
    const forcedOutgoingBubbleBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble')
    const forcedMediaReactionsBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions')
    const forcedOutgoingMediaReactionsBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions')
    const forcedCapsuleBody = ruleDeclarations('.onebot-webqq.is-color-dark')
    const forcedCapsuleSurfaceBody = ruleDeclarations('.onebot-webqq.is-color-dark::before')
    const forcedSidebarBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__sidebar')
    const forcedTabsRowBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__tabs-row')
    const forcedHeaderBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__chat-header', darkChatHeaderRule)
    const forcedPlainHeaderBody = ruleDeclarations('.onebot-webqq-webqq.is-plain.is-color-dark .onebot-webqq-webqq__chat-header')
    const darkSelectors = [
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__chat',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__search input',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__notify',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__notice-menu',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__bubble',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions',
      '.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__message-media-stack .onebot-webqq-webqq__message-reactions',
    ]
    const missingRequirements = [
      forcedRootBody.includes('--webqq-bg: #2c2c30')
        && forcedRootBody.includes('--webqq-rail: #252529')
        && forcedRootBody.includes('--webqq-surface-muted: #323238')
        && forcedRootBody.includes('--webqq-border: #45454c')
        && forcedRootBody.includes('--webqq-text: #edf2f7')
        && forcedRootBody.includes('--webqq-muted: #a1a1aa')
        && forcedRootBody.includes('--webqq-hover: #39393f')
        && forcedRootBody.includes('--webqq-panel: #333338')
        && forcedRootBody.includes('--webqq-reaction: rgb(47 47 52)')
        ? ''
        : '暗色根选择器没有复用 Sandbox 的完整中性主题令牌与贴表情层级色',
      forcedRootBody.includes('background: var(--webqq-bg)') ? '' : '暗色根选择器没有使用 Sandbox 背景令牌',
      forcedRootBody.includes('radial-gradient') || forcedRootBody.includes('linear-gradient') ? '暗色根选择器仍包含渐变背景' : '',
      forcedRootBody.includes('--onebot-webqq-webqq-accent-surface: color-mix(in srgb, var(--onebot-webqq-webqq-accent) 72%, var(--webqq-bg) 28%)')
        ? ''
        : '暗色根选择器没有基于 Sandbox 背景派生柔和主题色表面',
      forcedRootBody.includes('color: var(--webqq-text)') ? '' : '暗色根选择器没有使用 Sandbox 正文令牌',
      forcedSidebarBody.includes('background: var(--webqq-rail)') ? '' : '暗色侧栏没有使用 Sandbox 侧栏令牌',
      forcedTabsRowBody.includes('background: var(--webqq-rail)') ? '' : '暗色侧栏顶栏没有使用 Sandbox 侧栏令牌',
      ...darkSelectors.map((selector) => style.includes(selector) ? '' : `缺少暗色关键选择器 ${selector}`),
      forcedBubbleBody.includes('--onebot-webqq-webqq-reaction-bg: var(--webqq-reaction)')
        ? ''
        : '暗色普通气泡没有使用 47,47,52 的贴表情背景层级',
      forcedOutgoingBubbleBody.includes('--onebot-webqq-webqq-bubble-bg: var(--onebot-webqq-webqq-accent-surface)')
        && forcedOutgoingBubbleBody.includes('background: var(--onebot-webqq-webqq-accent-surface)')
        && forcedOutgoingBubbleBody.includes('box-shadow: 0 2px 8px rgb(15 23 42 / 16%)')
        ? ''
        : '暗色发出气泡没有使用柔和主题色表面或 Sandbox 发出消息阴影',
      forcedOutgoingBubbleBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-bubble-bg) 88%, var(--webqq-bg) 12%)')
        ? ''
        : '暗色发出气泡没有基于 Sandbox 背景覆盖 TIM 贴表情变量',
      forcedMediaReactionsBody.includes('--onebot-webqq-webqq-reaction-bg: var(--webqq-reaction)')
        ? ''
        : '暗色其他用户图片贴表情没有使用 47,47,52 的背景层级',
      forcedOutgoingMediaReactionsBody.includes('--onebot-webqq-webqq-reaction-bg: color-mix(in srgb, var(--onebot-webqq-webqq-bubble-bg) 88%, var(--webqq-bg) 12%)')
        ? ''
        : '暗色发出图片贴表情没有基于 Sandbox 背景覆盖 TIM 贴表情变量',
      forcedCapsuleSurfaceBody.includes('background:') ? '' : '暗色主胶囊没有覆盖背景',
      forcedCapsuleSurfaceBody.includes('border') ? '' : '暗色主胶囊没有覆盖边框',
      themeColorsStyle.includes('.onebot-webqq.is-color-dark .onebot-webqq__bot-switch .onebot-webqq__avatar')
        ? '暗色主题仍用实色阴影描边分隔多机器人头像'
        : '',
      ruleDeclarations('.onebot-webqq.is-color-dark .onebot-webqq__bot-overflow').includes('box-shadow')
        ? '暗色主题仍用实色阴影描边分隔机器人余量徽标'
        : '',
      ruleDeclarations('.onebot-webqq.is-color-dark .onebot-webqq__bot-overflow').includes('color: #edf2f7')
        && ruleDeclarations('.onebot-webqq.is-color-dark .onebot-webqq__bot-overflow').includes('background: #39393f')
        ? ''
        : '暗色机器人余量胶囊没有使用 Sandbox 正文色与悬停表面色',
      ruleDeclarations('.onebot-webqq.is-color-dark .onebot-webqq__avatar-unread').includes('border-color: #2c2c30')
        ? ''
        : '暗色头像未读角标没有使用 Sandbox 背景色边框',
      forcedHeaderBody.includes('background:') ? '' : '暗色聊天顶栏没有覆盖背景',
      forcedPlainHeaderBody.includes('background: var(--webqq-bg)') ? '' : '关闭毛玻璃时暗色聊天顶栏没有使用 Sandbox 不透明背景',
      themeColorsStyle.includes('is-color-auto') ? '主题样式仍保留 is-color-auto 分支，可能绕过 Koishi 最终主题' : '',
      themeColorsStyle.includes('@media (prefers-color-scheme: dark)') ? '主题样式仍直接读取系统颜色偏好' : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('keeps quoted text readable inside dark outgoing WebQQ bubbles', () => {
    expect(style).toContain(`.onebot-webqq-webqq__bubble {
      color: #ffffff;
      background: var(--onebot-webqq-webqq-accent-surface);
      // 蓝色气泡会削弱与左侧相同透明度的投影视觉，沿用 Sandbox 的几何参数并提高对比度。
      box-shadow: 0 2px 8px rgb(15 23 42 / 16%);

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
    const previewLineBody = ruleDeclarations('.onebot-webqq-webqq__forward > span:not(.onebot-webqq-webqq__forward-entry)')

    expect(previewLineBody).toContain('display: block')
    expect(previewLineBody).toContain('width: 100%')
    expect(previewLineBody).toContain('min-width: 0')
    expect(previewLineBody).toContain('max-width: 100%')
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
      // 两条候选选择器只需要有一条写了覆盖规则，所以先问哪条真的存在。
      .filter((selector) => hasRule(selector))
      .map((selector) => ruleDeclarations(selector))
      .find((body) => body.includes('max-width: 100%'))

    expect(
      forwardWidthOverrideBody,
      'forward 宽度规则选择器优先级不足，会被 quote 的 width:100% 覆盖',
    ).toBeTruthy()
    expect(forwardWidthOverrideBody, 'forward 卡片宽度还没有缩到 260px').toContain('width: 260px')
    expect(forwardWidthOverrideBody).toContain('max-width: 100%')
  })

  it('styles WebQQ record messages as compact playable voice bubbles', () => {
    const recordBody = ruleDeclarations('.onebot-webqq-webqq__record')
    const audioBody = ruleDeclarations('.onebot-webqq-webqq__record-audio')
    const playerBody = ruleDeclarations('.onebot-webqq-webqq__record-player')
    const waveBody = ruleDeclarations('.onebot-webqq-webqq__record-wave')
    const durationBody = ruleDeclarations('.onebot-webqq-webqq__record-duration')
    const transcriptBody = ruleDeclarations('.onebot-webqq-webqq__record-transcript')

    expect(recordBody, '缺少语音消息容器样式').toContain('display: flex')
    expect(recordBody).toContain('gap:')
    expect(audioBody, '语音 audio 应作为隐藏播放源存在').toContain('display: none')
    expect(playerBody, '缺少自定义语音播放条样式').toContain('min-width: 128px')
    expect(playerBody).toContain('max-width: 220px')
    expect(playerBody).toContain('height: 19px')
    expect(playerBody).toContain('gap: 6px')
    expect(playerBody).toContain('color: inherit')
    expect(playerBody).toContain('background: transparent')
    expect(waveBody, '缺少语音波形样式').toContain('fill:')
    expect(waveBody).toContain('fill: currentColor')
    expect(waveBody).toContain('height: 18px')
    expect(waveBody).toContain('flex: 1 1 auto')
    expect(durationBody).toContain('min-width: 18px')
    expect(durationBody).toContain('margin-left: 4px')
    expect(durationBody).toContain('text-align: left')
    expect(transcriptBody, '缺少语音转文字结果样式').toContain('font-size:')
    expect(webqqMessagesStyle).not.toContain('is-record-only')
    expect(webqqMessagesStyle).not.toContain('record-divider')
    expect(themeColorsStyle).not.toContain('is-record-only')
  })

  it('highlights the WebQQ message targeted by a clicked quote', () => {
    const targetBody = ruleDeclarations('.onebot-webqq-webqq__message.is-quote-target .onebot-webqq-webqq__bubble')
    const clickableQuoteBody = ruleDeclarations('.onebot-webqq-webqq__quote.is-clickable')

    expect(targetBody, '缺少被引用消息的高亮气泡样式').toContain('animation:')
    expect(targetBody).toContain('onebot-webqq-webqq-quote-target')
    expect(clickableQuoteBody).toContain('text-align: left')
  })

  it('centers the WebQQ forward entry as a fixed bottom row without top-heavy padding', () => {
    const entryBody = ruleDeclarations('.onebot-webqq-webqq__forward-entry')

    expect(entryBody).toContain('display: flex')
    expect(entryBody).toContain('align-items: center')
    expect.soft(entryBody).toMatch(/(?:^|\n)\s*(?:min-height|height):\s*\d+(?:px|rem|em)\s*;/)
    expect.soft(entryBody).not.toMatch(/(?:^|\n)\s*padding:\s*[1-9]\d*(?:\.\d+)?px\s+[^;]*\s+0\b/)
    expect.soft(entryBody).not.toMatch(/(?:^|\n)\s*padding-top:\s*[1-9]\d*(?:\.\d+)?px\s*;/)
  })

  it('left-aligns and recolors the WebQQ forward entry with its containing bubble', () => {
    const entryBody = ruleDeclarations('.onebot-webqq-webqq__forward-entry')

    expect(entryBody).toContain('text-align: left')
    expect(entryBody).toContain('justify-content: space-between')
    expect(entryBody).toContain('color: inherit')
    expect(entryBody).not.toContain('var(--k-text-light')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-entry::after')).toContain('content:')
  })

  it('styles WebQQ chat history search as an inline expanding field with calendar and result popovers', () => {
    const scopedSearchStyles = ruleBlock('.onebot-webqq-webqq', webqqInteractionsStyle)
    expect(scopedSearchStyles).toContain('.onebot-webqq-webqq__chat-search-shell')
    expect(scopedSearchStyles).toContain('.onebot-webqq-webqq__message-search-date-popover')
    expect(scopedSearchStyles).toContain('.onebot-webqq-webqq__message-search-results')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-search-shell', webqqInteractionsStyle)).toContain('width: 32px')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-search-shell.is-expanded', webqqInteractionsStyle)).toContain('width: clamp(220px, 32vw, 320px)')
    const searchField = ruleDeclarations('.onebot-webqq-webqq__message-search-field', webqqInteractionsStyle)
    expect(searchField).toContain('grid-template-columns: 18px minmax(0, 1fr) 28px 28px')
    expect(searchField).toContain('transition: background-color 120ms ease')
    expect(searchField).not.toContain('transition: border-color')
    expect(searchField).not.toContain('box-shadow 120ms')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-search-field.is-focused', webqqInteractionsStyle)).toContain('box-shadow: 0 0 0 3px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-search-date-popover', webqqInteractionsStyle)).toContain('width: 250px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-search-date-popover', webqqInteractionsStyle)).toContain('position: absolute')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-search-calendar-header', webqqInteractionsStyle)).toContain('margin-bottom: 16px')
    const calendarSelectorButton = ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__message-search-calendar-selectors > button', webqqInteractionsStyle)
    expect(calendarSelectorButton).toContain('font-size: var(--onebot-webqq-font-lg)')
    expect(calendarSelectorButton).toContain('font-weight: 500')
    expect(calendarSelectorButton).toContain('line-height: 20px')
    expect(calendarSelectorButton).toContain('white-space: nowrap')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-search-calendar-selectors', webqqInteractionsStyle)).toContain('gap: 4px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-search-calendar-selectors svg', webqqInteractionsStyle)).toContain('flex: none')
    expect(webqqInteractionsStyle).toContain(`.onebot-webqq-webqq__message-search-calendar-grid {
  row-gap: 8px;
  margin-top: 8px;
}`)
    const calendarDay = ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__message-search-calendar-grid > button', webqqInteractionsStyle)
    expect(calendarDay).toContain('width: 32px')
    expect(calendarDay).toContain('height: 32px')
    expect(calendarDay).toContain('font-size: var(--onebot-webqq-font-lg)')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-search-results', webqqInteractionsStyle)).toContain('overflow-y: auto')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-header .onebot-webqq-webqq__message-search-hit', webqqInteractionsStyle)).toContain('text-align: left')
    expect(style).not.toContain('.onebot-webqq-webqq__message-search-backdrop')
    expect(style).not.toMatch(/(?<!onebot-webqq-webqq__)webqq-message-search/)
    expect(style).not.toContain('webqq-chat-search-trigger')
  })

  it('styles WebQQ forward message details as an LLBot-style centered modal', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal-backdrop')).toContain('position: fixed')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal-backdrop')).toContain('inset: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal-backdrop')).toContain('align-items: center')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal')).toContain('width: min(480px, calc(100vw - 32px))')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal')).toContain('max-height: min(80vh, 620px)')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal-body')).not.toContain('display: flex')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal-body')).not.toContain('flex-direction: column')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal-body')).not.toContain('align-items: flex-start')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal-body')).toContain('overflow-y: auto')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal .onebot-webqq-webqq__message')).toContain('max-width: 74%')
    expect(ruleDeclarations('.onebot-webqq-webqq__forward-modal .onebot-webqq-webqq__message')).not.toContain('margin-bottom')
    expect(style).not.toContain('.onebot-webqq-webqq__forward-modal .onebot-webqq-webqq__message.is-merged')
    expect(style).not.toContain('onebot-webqq-webqq__forward-popover')
    expect(style).not.toContain('onebot-webqq-webqq__forward-page')
  })

  it('styles WebQQ card message previews as compact block cards', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__card')).toContain('display: flex')
    expect(ruleDeclarations('.onebot-webqq-webqq__card')).toContain('border-radius: 8px')
    expect(ruleDeclarations('.onebot-webqq-webqq__card')).toContain('text-decoration: none')
    expect(ruleDeclarations('.onebot-webqq-webqq__card-cover')).toContain('width: 42px')
    expect(ruleDeclarations('.onebot-webqq-webqq__card-cover')).toContain('object-fit: cover')
    expect(ruleDeclarations('.onebot-webqq-webqq__card-title')).toContain('font-weight: 600')
    expect(ruleDeclarations('.onebot-webqq-webqq__card-desc')).toContain('overflow-wrap: anywhere')
    expect(ruleDeclarations('.onebot-webqq-webqq__card-source')).toContain('font-size: var(--onebot-webqq-font-xs)')
  })

  it('keeps the WebQQ thinking indicator compact with six-pixel dots', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-dots')).not.toContain('min-width: 58px')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-dots')).toMatch(/(?:min-)?width:\s*4[24]px/)
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-dot', webqqMessageEffectsStyle)).toContain('width: 6px')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-dot', webqqMessageEffectsStyle)).toContain('height: 6px')
    expect(hasRule('@media (prefers-reduced-motion: reduce)')).toBe(true)
    expect(ruleBlock('@media (prefers-reduced-motion: reduce)')).toContain('animation: none')
  })

  it('keeps completed WebQQ thinking disclosure clickable and readable', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-toggle')).toContain('border: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-toggle')).toContain('background: transparent')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-chevron', webqqMessagesStyle)).toContain('transition: transform 0.16s ease')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-chevron.is-expanded')).toContain('transform: rotate(90deg)')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-panel')).toContain('transform-origin: top right')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-panel')).not.toContain('grid-template-rows')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-content')).toContain('overflow: hidden')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-content')).toContain('white-space: pre-wrap')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-content')).toContain('overflow-wrap: anywhere')
  })

  it('animates completed WebQQ thinking disclosure expansion without ignoring reduced motion', () => {
    const transitionBody = ruleDeclarations('.onebot-webqq-webqq-thinking-enter-active', webqqMessagesStyle)
    const hiddenBody = ruleDeclarations('.onebot-webqq-webqq-thinking-enter-from')
    const reducedMotionBody = ruleBlock('@media (prefers-reduced-motion: reduce)')

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
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage')).toContain('opacity: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage')).toContain('visibility: hidden')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage')).toContain('pointer-events: none')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage')).toContain('font-size: var(--onebot-webqq-font-sm)')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage')).toContain('line-height: 18px')
    expect(style).toContain(`.onebot-webqq-webqq__thinking-toggle:hover .onebot-webqq-webqq__thinking-usage,
.onebot-webqq-webqq__thinking-toggle:focus-visible .onebot-webqq-webqq__thinking-usage {
  opacity: 1;
  visibility: visible;
}`)
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage')).not.toContain(' / ')
  })

  it('keeps fallback WebQQ usage visible below the last outgoing message', () => {
    const fallbackUsageBody = ruleDeclarations('.onebot-webqq-webqq__thinking-row.is-usage-only .onebot-webqq-webqq__thinking-usage')

    expect(fallbackUsageBody).toContain('margin-right: 0')
    expect(fallbackUsageBody).toContain('opacity: 1')
    expect(fallbackUsageBody).toContain('visibility: visible')
  })

  it('keeps completed WebQQ thinking usage groups spaced from each other and the duration', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage-icon.is-output')).toContain('margin-left: 4px')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage')).toContain('margin-right: 8px')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage')).toContain('gap: 6px')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage-group')).toContain('gap: 2px')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-usage-group.is-timing')).toContain('gap: 6px')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-metric')).toContain('white-space: nowrap')
    expect(style).not.toContain('.onebot-webqq-webqq__thinking-metric strong')
  })

  it('aligns completed WebQQ thinking after outgoing bubbles instead of the avatar edge', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__message')).toContain('gap: 8px')
    // 行方向写在 &.is-outgoing 子规则里，用嵌套查询而不是整块：整块会让「写在任何子规则里都算通过」。
    expect(
      ruleDeclarations('&.is-outgoing', ruleBlock('.onebot-webqq-webqq__message')),
    ).toContain('flex-direction: row-reverse')
    expect(ruleDeclarations('.onebot-webqq-webqq__message')).toContain('--onebot-webqq-webqq-message-avatar-size: 32px')
    expect(ruleDeclarations('.onebot-webqq-webqq__message-avatar')).toContain('width: var(--onebot-webqq-webqq-message-avatar-size)')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-row')).toContain('position: relative')
    expect(ruleDeclarations('.onebot-webqq-webqq__thinking-row')).toContain('margin: -12px 40px 16px auto')
  })

  it('wraps WebQQ notice comments instead of truncating them', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-comment')).toContain('white-space: normal')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-comment')).toContain('overflow-wrap: anywhere')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-comment')).toContain('overflow: visible')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-comment')).toContain('text-overflow: clip')
  })

  it('shows full WebQQ notice titles without truncation', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-title')).toContain('white-space: normal')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-title')).toContain('overflow-wrap: anywhere')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-title')).toContain('overflow: visible')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-title')).toContain('text-overflow: clip')
  })

  it('places WebQQ notice status and time in the right side column', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-side')).toContain('align-self: stretch')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-time')).toContain('margin-top: auto')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-time')).toContain('white-space: nowrap')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-time')).toContain('text-align: right')
    expect(ruleDeclarations('.onebot-webqq-webqq__notice-side .onebot-webqq-webqq__notice-result')).toContain('width: max-content')
  })

  it('lays out the WebQQ group info panel as an in-flow right strip', () => {
    expect(ruleDeclarations('.onebot-webqq-webqq__chat', webqqChatStyle)).toContain('display: flex')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat', webqqChatStyle)).toContain('flex-direction: row')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-main')).toContain('flex: 1')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-main')).toContain('min-width: 0')
    expect(ruleDeclarations('.onebot-webqq-webqq__chat-main')).toContain('flex-direction: column')
    expect(ruleDeclarations('.onebot-webqq-webqq__group-info', webqqGroupInfoStyle)).toContain('width: 260px')
    expect(ruleDeclarations('.onebot-webqq-webqq__group-info', webqqGroupInfoStyle)).toContain('border-left: 1px solid rgba(229, 231, 235, 0.58)')
    expect(ruleDeclarations('.onebot-webqq-webqq__group-info', webqqGroupInfoStyle)).not.toContain('position: absolute')
    expect(ruleDeclarations('.onebot-webqq-webqq__group-info-header')).toContain('align-items: center')
    expect(ruleDeclarations('.onebot-webqq-webqq__group-info-header')).not.toContain('justify-content: space-between')
    expect(ruleDeclarations('.onebot-webqq-webqq__group-announcements')).toContain('flex: 0 0 25%')
    expect(ruleDeclarations('.onebot-webqq-webqq__group-announcements')).toContain('gap: 12px')
    expect(ruleDeclarations('.onebot-webqq-webqq__group-members')).toContain('flex: 1')
    expect(ruleDeclarations('.onebot-webqq-webqq__group-member-list')).toContain('overflow-y: auto')
  })

  it('renders the group info toggle as a bare SVG icon button', () => {
    // 顶栏按钮的激活态写成 SCSS 的 &.is-active 嵌套，所以要整块内容。
    const headerButtonBody = ruleBlock('button', ruleBlock('.onebot-webqq-webqq__chat-header', webqqChatStyle))
    const darkHeaderButtonBody = ruleDeclarations('.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__chat-header button')
    const missingRequirements = [
      headerButtonBody.includes('background: transparent')
        ? ''
        : '群信息按钮默认不应有卡片背景',
      headerButtonBody.includes('border-radius: 0')
        ? ''
        : '群信息按钮不应保留卡片圆角',
      // 这一条量的是 SCSS 的嵌套写法本身，换成访问器会把它要测的东西抹掉，所以保留正则。
      /&\.is-active\s*\{[\s\S]*background:\s*transparent/.test(headerButtonBody)
        ? ''
        : '群信息按钮激活时不应有卡片背景',
      // 这两条是「这条规则不该存在」，用存在性表达而不是靠切不出内容。
      hasRule('.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__chat-header button') ? '清爽主题不应给群信息按钮加卡片背景' : '',
      hasRule('.onebot-webqq-webqq.is-frosted .onebot-webqq-webqq__chat-header button') ? '毛玻璃主题不应给群信息按钮加卡片背景' : '',
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
