import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/capsule/Capsule.vue', import.meta.url), 'utf8')
const capsuleStyle = await readFile(new URL('../client/capsule/styles.scss', import.meta.url), 'utf8')
const clientEntry = await readFile(new URL('../client/index.ts', import.meta.url), 'utf8')

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) return ''
  const endIndex = source.indexOf(end, startIndex + start.length)
  return endIndex < 0 ? source.slice(startIndex) : source.slice(startIndex, endIndex)
}

function runGetCapsuleUnreadText(count: number) {
  const unreadTextSource = sourceBetween(
    capsuleView,
    'function getCapsuleUnreadText(count: number)',
    'function loadCachedBotProfile',
  )
  const returnExpression = unreadTextSource.match(/return\s+([^\n]+)/)?.[1]
  if (!returnExpression) throw new Error('getCapsuleUnreadText return expression not found')
  return Function('count', `return ${returnExpression}`)(count)
}

const multiBotTemplate = sourceBetween(capsuleView, 'v-if="hasMultipleBots"', '<button\n            v-else')

describe('chat capsule view', () => {
  it('hides the capsule on the logger page', () => {
    expect(capsuleView).toContain("import { Universal, activities, router, store, withProxy } from '@koishijs/client'")
    expect(capsuleView).toContain("const isLoggerRoute = computed(() => router.currentRoute.value.path === '/logs')")
    expect(capsuleView).toContain('const shouldShowCapsule = computed(() => isLoggedIn.value && !isLoggerRoute.value)')
    expect(capsuleView).toContain('v-if="shouldShowCapsule"')
  })

  it('hides the capsule before the Koishi console user is logged in', () => {
    expect(capsuleView).toContain("const isLoggedIn = computed(() => !activities.login || ('user' in store && !!store.user))")
    expect(capsuleView).toContain('const shouldShowCapsule = computed(() => isLoggedIn.value && !isLoggerRoute.value)')
    expect(capsuleView).toContain('v-if="shouldShowCapsule"')
  })

  it('renders a graphical WebQQ avatar guide without visible instruction text', () => {
    const guideSource = capsuleView.match(/<Transition\s+name="onebot-webqq-avatar-guide">[\s\S]*?<\/Transition>/)?.[0] ?? ''
    const missingRequirements = [
      guideSource ? '' : '缺少头像图形引导过渡容器',
      guideSource.includes('webQQAvatarGuideVisible && !webQQOpen')
        ? ''
        : '头像图形引导没有只在 WebQQ 未打开时显示',
      guideSource.includes('class="onebot-webqq__avatar-guide"')
        ? ''
        : '缺少头像图形引导层',
      guideSource.includes(':style="webQQAvatarGuideStyle"')
        ? '头像图形引导不应再绑定 bot 头像主题色'
        : '',
      guideSource.includes('aria-hidden="true"') ? '' : '图形引导应该对读屏隐藏',
      guideSource.includes('class="onebot-webqq__avatar-guide-ring"')
        ? ''
        : '图形引导缺少头像光圈',
      guideSource.includes('onebot-webqq__avatar-guide-arrow')
        ? '图形引导不应再显示箭头'
        : '',
      guideSource.includes('点击头像') ? '图形引导不应显示文字说明' : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('shows the graphical WebQQ avatar guide on first use and capsule body clicks', () => {
    const mountedSource = capsuleView.match(/onMounted\(\(\) => \{[\s\S]*?^}\)/m)?.[0] ?? ''
    const missingRequirements = [
      capsuleView.includes("const webQQAvatarGuideStorageKey = 'onebot-webqq:webqq-avatar-guide:v1'")
        ? ''
        : '缺少头像引导本地存储 key',
      capsuleView.includes('const webQQAvatarGuideVisible = ref(false)')
        ? ''
        : '缺少头像引导显示状态',
      /import \{[^}]*\bcapsule\b[^}]*\} from '\.\/state'/.test(capsuleView)
        ? ''
        : '头像图形引导应读取胶囊共享状态',
      capsuleView.includes('webQQAvatarGuideStyle') || capsuleView.includes('webQQAvatarAccentColor')
        ? '头像图形引导不应读取 bot 头像主题色状态'
        : '',
      capsuleView.includes('function hasSeenWebQQAvatarGuide()')
        ? ''
        : '缺少首次使用判断函数',
      capsuleView.includes('function rememberWebQQAvatarGuide()')
        ? ''
        : '缺少首次使用记录函数',
      capsuleView.includes('function showWebQQAvatarGuide(')
        ? ''
        : '缺少展示头像图形引导函数',
      capsuleView.includes('@click="showWebQQAvatarGuide()"')
        && !capsuleView.includes('@click.self="showWebQQAvatarGuide()"')
        ? ''
        : '头像图形引导应在胶囊非头像区域点击时触发',
      capsuleView.includes('ref="titleRef"')
        && capsuleView.includes('ref="activityRef"')
        && capsuleView.includes('ref="activityUserRef"')
        && capsuleView.includes('class="onebot-webqq__tooltip"')
        && capsuleView.includes('class="onebot-webqq__tooltip-content"')
        && capsuleView.includes('function hasTextOverflow(element?: HTMLElement)')
        && capsuleView.includes("function showCapsuleTextTooltip(target: 'title' | 'activity')")
        && capsuleView.includes("capsuleTooltipTarget.value === 'activity' && activityOverflow.value")
        && capsuleView.includes("return activityTooltipText.value")
        && capsuleView.includes('const activityTooltipText = computed(() => conversationUserName.value || displayActivityText.value)')
        && capsuleView.includes('? hasTextOverflow(activityUserRef.value)')
        && capsuleView.includes('ref="tooltipRef"')
        && capsuleView.includes(':style="tooltipStyle"')
        && capsuleView.includes('const tooltipStyle = computed(() => ({ \'--onebot-webqq-tooltip-left\': `${tooltipLeft.value}px` }))')
        && capsuleView.includes('function updateCapsuleTooltipPosition()')
        && capsuleView.includes('bodyRect.width / 2 - tooltipWidth / 2')
        && capsuleView.includes('window.innerWidth - viewportMargin - bodyRect.left - tooltipWidth')
        && capsuleView.includes('window.addEventListener(\'resize\', updateCapsuleTooltipPosition)')
        && capsuleView.includes('window.removeEventListener(\'resize\', updateCapsuleTooltipPosition)')
        && !capsuleView.includes('onebot-webqq__tooltip-arrow')
        && !capsuleView.includes(':title="titleTooltip"')
        && !capsuleView.includes(':title="metaTooltip"')
        ? ''
        : '胶囊文字应只在被省略内容溢出时显示 HeroUI 风格 tooltip',
      mountedSource.includes('!hasSeenWebQQAvatarGuide()')
        && mountedSource.includes('showWebQQAvatarGuide(true)')
        ? ''
        : '首次使用没有自动展示并记录头像图形引导',
      capsuleView.includes("localStorage.setItem(webQQAvatarGuideStorageKey, 'seen')")
        ? ''
        : '头像图形引导没有写入已展示状态',
      capsuleView.includes('bot.selfId === activeBotSelfId && webQQAvatarGuideVisible && !webQQOpen')
        && !capsuleView.includes('if (hasMultipleBots.value) return')
        ? ''
        : '多机器人场景点击胶囊非头像区域时，应在当前 bot 头像上显示引导光圈',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('splits thinking status and current user into separate lines', () => {
    expect(capsuleView).toContain("const titleStatusText = computed(() => capsule.value?.conversation.activityText === '正在思考' ? '正在思考' : '')")
    expect(capsuleView).toContain("const conversationUserName = computed(() => capsule.value?.conversation.userName || '')")
    expect(capsuleView).toContain('const conversation = capsule.value?.conversation')
    expect(capsuleView).toContain("if (!conversation) return '空闲中'")
    expect(capsuleView).toContain('if (conversationUserName.value) return `正在与 ${conversationUserName.value} 对话`')
    expect(capsuleView).toContain("conversation.activityText !== '正在思考'")
    expect(capsuleView).toContain('v-if="titleStatusText"')
    expect(capsuleView).toContain('{{ titleStatusText }}')
    expect(capsuleView).toContain('v-if="displayActivityText"')
    expect(capsuleView).toContain('{{ displayActivityText }}')
    expect(capsuleView).toContain("'is-conversation': conversationUserName")
    expect(capsuleView).toContain('v-if="conversationUserName"')
    expect(capsuleView).toContain('class="onebot-webqq__activity-prefix">正在与</span>')
    expect(capsuleView).toContain('ref="activityUserRef" class="onebot-webqq__activity-user">{{ conversationUserName }}</span>')
    expect(capsuleView).toContain('class="onebot-webqq__activity-suffix">对话</span>')
  })

  it('does not render token usage in the main capsule', () => {
    expect(capsuleView).not.toContain('const usage = computed')
    expect(capsuleView).not.toContain('const hasUsage = computed')
    expect(capsuleView).not.toContain('const usageTitle = computed')
    expect(capsuleView).not.toContain('class="onebot-webqq__usage"')
    expect(capsuleView).not.toContain('class="onebot-webqq__usage-icon is-input"')
    expect(capsuleView).not.toContain('class="onebot-webqq__usage-icon is-output"')
    expect(capsuleView).not.toContain('{{ usage!.inputTokens }}')
    expect(capsuleView).not.toContain('{{ usage!.outputTokens }}')
    expect(capsuleView).not.toContain('输入 ${usage.inputTokens}')
  })

  it('does not render completed thinking duration in the main capsule meta', () => {
    expect(capsuleView).not.toContain("return `已思考 ${seconds} s`")
    expect(capsuleView).not.toContain('v-if="thinkingDurationText"')
    expect(capsuleView).not.toContain('{{ thinkingDurationText }}')
  })

  it('uses cached bot avatar and name before live capsule data arrives', () => {
    expect(capsuleView).toContain("const capsuleProfileStorageKey = 'onebot-webqq:bot-profile:v1'")
    expect(capsuleView).toContain('const cachedBotProfile = ref(loadCachedBotProfile())')
    expect(capsuleView).toContain('const displayBotName = computed(() => displayBotProfile.value?.name || cachedBotProfile.value.name ||')
    expect(capsuleView).toContain('const displayBotAvatar = computed(() => displayBotProfile.value?.avatar || cachedBotProfile.value.avatar ||')
    expect(capsuleView).toContain('watch(displayBotProfile')
    expect(capsuleView).toContain('cacheBotProfile(bot.name, bot.avatar)')
    expect(capsuleView).toContain('v-if="displayBotAvatar"')
    expect(capsuleView).toContain(':src="withProxy(displayBotAvatar)"')
    expect(capsuleView).toContain(':alt="displayBotName"')
    expect(capsuleView).toContain('ref="titleRef"')
    expect(capsuleView).not.toContain(':title="displayBotName"')
    expect(capsuleView).toContain('{{ displayBotName }}')
  })

  it('renders total WebQQ unread count on the bot avatar when enabled', () => {
    expect(capsuleView).toMatch(/import \{[^}]*\bshowWebQQCapsuleUnread\b[^}]*\bwebQQTotalUnread\b[^}]*\} from '\.\.\/webqq\/settings'/)
    expect(capsuleView).toContain('class="onebot-webqq__avatar-unread"')
    expect(capsuleView).toContain('v-if="showWebQQCapsuleUnread && webQQTotalUnread"')
    expect(capsuleView).toContain('{{ capsuleUnreadText }}')
    expect(capsuleView).toContain('const capsuleUnreadText = computed(() => getCapsuleUnreadText(webQQTotalUnread.value))')
  })

  it('renders a hover-expandable onebot robot avatar group', () => {
    const missingRequirements = [
      capsuleView.includes('const availableBots = computed(() => capsule.value?.bots?.length ? capsule.value.bots : runtimeBots.value)')
        ? ''
        : '胶囊没有读取可用 OneBot 机器人列表',
      capsuleView.includes('const hasMultipleBots = computed(() => availableBots.value.length > 1)')
        ? ''
        : '胶囊没有区分单机器人和多机器人场景',
      capsuleView.includes("['onebot-webqq__bot-stack', {")
        && capsuleView.includes("'is-expanded': botStackVisualExpanded")
        && capsuleView.includes("'is-overflow-expanding': botStackOverflowMotion === 'expanding'")
        && capsuleView.includes("'is-overflow-collapsing': botStackOverflowMotion === 'collapsing'")
        ? ''
        : '缺少多机器人头像堆叠容器或头像余量徽标动效状态',
      capsuleView.includes('const collapsedBotVisibleCount = computed(() => Math.min(botStackBots.value.length, 3))')
        ? ''
        : '折叠态没有限制最多显示 3 个机器人头像',
      capsuleView.includes('const hasBotStackOverflow = computed(() => collapsedBotOverflowCount.value > 0)')
        && capsuleView.includes('const botStackVisualExpanded = computed(() => botStackExpanded.value || !hasBotStackOverflow.value)')
        ? ''
        : '3 个以内的头像栈应直接使用展开态样式，只有出现头像余量徽标时才进入折叠状态机',
      capsuleView.includes('v-if="collapsedBotOverflowCount"') && capsuleView.includes('class="onebot-webqq__bot-overflow"')
        ? ''
        : '折叠态没有用数字显示多余机器人数量',
      capsuleView.includes('const botOverflowPreview = computed(() => botStackBots.value[collapsedBotVisibleCount.value])')
        && capsuleView.includes('v-if="botOverflowPreview" class="onebot-webqq__bot-overflow-avatar"')
        && capsuleView.includes('v-if="botOverflowPreview.avatar" :src="withProxy(botOverflowPreview.avatar)"')
        ? ''
        : '头像余量徽标缺少用于擦除替换的头像预览层',
      capsuleView.includes('class="onebot-webqq__bot-overflow-label"')
        && capsuleView.includes('class="onebot-webqq__bot-overflow-plus">+</span>')
        && capsuleView.includes('class="onebot-webqq__bot-overflow-count">{{ collapsedBotOverflowCount }}</span>')
        ? ''
        : '折叠态多余机器人数量应在可擦除的 label 层显示加号',
      capsuleView.includes("'is-collapsed-extra': isBotCollapsedExtra(index)")
        && capsuleView.includes('? collapsedBotVisibleCount.value * 24')
        && !capsuleView.includes('? Math.max(0, collapsedBotVisibleCount.value - 1) * 24')
        ? ''
        : '折叠态没有把超过上限的机器人头像收拢到头像余量徽标位置',
      capsuleView.includes("'--onebot-webqq-shell-collapsed-width': `${162 + collapsedBotStackWidth.value}px`")
        && capsuleView.includes("'--onebot-webqq-shell-width': `${162 + expandedBotStackWidth.value}px`")
        && capsuleView.includes("'--onebot-webqq-avatar-capsule-collapsed-width': `${collapsedBotStackWidth.value + 8}px`")
        && capsuleView.includes("'--onebot-webqq-avatar-capsule-expanded-width': `${expandedBotStackWidth.value + 8}px`")
        && capsuleView.includes("'--onebot-webqq-stack-collapsed-width': `${collapsedBotStackWidth.value}px`")
        && capsuleView.includes("'--onebot-webqq-stack-expanded-width': `${expandedBotStackWidth.value}px`")
        && !capsuleView.includes("'--onebot-webqq-capsule-width'")
        && !capsuleView.includes("'--onebot-webqq-stack-width'")
        ? ''
        : '多机器人胶囊不应预留展开宽度，应折叠和展开同步计算宽度',
      capsuleStyle.includes('right: var(--onebot-webqq-bot-collapsed-right, 0);')
        && capsuleStyle.includes('right: var(--onebot-webqq-bot-expanded-right, 0);')
        ? ''
        : '多机器人头像没有从右侧锚定向左展开',
      capsuleView.includes(':class="[\'onebot-webqq__avatar-capsule\', { \'has-bot-stack\': hasMultipleBots, \'is-expanded\': botStackVisualExpanded }]"')
        && capsuleView.includes(':class="[\'onebot-webqq__bot-stack\', {')
        && capsuleView.includes("'is-bot-stack-expanded': botStackVisualExpanded")
        && capsuleView.indexOf('class="onebot-webqq-layout-root"') < capsuleView.indexOf(':class="[\'onebot-webqq__body\', `is-color-${webQQColorMode}`]"')
        && capsuleStyle.includes('.onebot-webqq.is-bot-stack-expanded')
        && capsuleStyle.includes('width: var(--onebot-webqq-shell-width')
        && capsuleStyle.includes('.onebot-webqq__avatar-capsule.is-expanded')
        && capsuleStyle.includes('width: var(--onebot-webqq-avatar-capsule-expanded-width')
        && capsuleStyle.includes('width: var(--onebot-webqq-stack-expanded-width')
        && capsuleStyle.includes('.onebot-webqq__body')
        && capsuleStyle.includes('position: fixed')
        && capsuleStyle.includes('right: 24px')
        && capsuleStyle.includes('width: 157px')
        ? ''
        : '头像展开时胶囊和头像组没有同步向左扩张，或正文没有固定右锚点',
      capsuleView.includes("import { createLayout, type AutoLayout } from 'animejs'")
        && capsuleView.includes('ref="capsuleLayoutRef"')
        && capsuleView.includes('const capsuleLayoutRef = ref<HTMLElement>()')
        && capsuleView.includes('createLayout(capsuleLayoutRef.value')
        && capsuleView.includes('layout?.record()')
        && capsuleView.includes("layout.animate({ duration: 260, ease: 'out(3)' })")
        && capsuleView.includes("children: ['.onebot-webqq', '.onebot-webqq__avatar-capsule', '.onebot-webqq__bot-stack', '.onebot-webqq__bot-switch', '.onebot-webqq__bot-overflow']")
        && !capsuleView.includes("'.onebot-webqq__body'")
        && !capsuleView.includes("'.onebot-webqq__avatar-guide'")
        ? ''
        : '机器人头像组应直接使用 Anime.js layout record/animate，且 layout root 只能包含外层胶囊和头像容器，不能动画右侧正文或头像引导层；bot-switch 必须参与 FLIP 才能固定当前头像',
      capsuleView.includes('collapsedBotOverflowCount.value ? 24 : 0')
        && capsuleView.includes('const collapsedRight = collapsedBotVisibleCount.value * 24')
        && capsuleView.includes('const expandedRight = collapsedBotVisibleCount.value * 31')
        && capsuleView.includes("const isCoveredByExpandedAvatar = botStackExpanded.value || botStackOverflowMotion.value === 'expanding'")
        && capsuleView.includes('const overflowZIndex = botStackBots.value.length - collapsedBotVisibleCount.value - (isCoveredByExpandedAvatar ? 1 : 0)')
        && capsuleView.includes("'--onebot-webqq-bot-overflow-right': `${collapsedRight}px`")
        && capsuleView.includes("'--onebot-webqq-bot-overflow-expanded-right': `${expandedRight}px`")
        && capsuleView.includes("'--onebot-webqq-bot-overflow-z-index': `${overflowZIndex}`")
        && !capsuleView.includes('--onebot-webqq-bot-overflow-expanded-offset')
        && !capsuleView.includes("zIndex: '0'")
        && capsuleStyle.includes('justify-content: center;')
        && capsuleStyle.includes('padding-right: 18px;')
        && capsuleStyle.includes('.onebot-webqq__bot-overflow-plus')
        && capsuleStyle.includes('.onebot-webqq__bot-overflow-count')
        && capsuleStyle.includes('align-items: center;')
        && capsuleStyle.includes('font-size: 10px;')
        ? ''
        : '多余机器人数字没有和头像保持相同大小、宽度与折叠步进，或头像余量徽标没有按头像槽位同步计算展开位',
      capsuleView.includes("type BotStackOverflowMotion = 'idle' | 'expanding' | 'collapsing'")
        && capsuleView.includes("const botStackOverflowMotion = ref<BotStackOverflowMotion>('idle')")
        && capsuleView.includes('if (!hasMultipleBots.value || !hasBotStackOverflow.value) return')
        && capsuleView.includes("botStackOverflowMotion.value = expanded ? 'expanding' : 'collapsing'")
        && capsuleView.includes("botStackOverflowMotion.value = 'idle'")
        && capsuleView.includes('if (botStackOverflowMotionTimer) clearTimeout(botStackOverflowMotionTimer)')
        ? ''
        : '头像余量徽标展开/折叠没有独立动效阶段，可能退回静态背景板',
      capsuleView.includes('v-if="bot.selfId === activeBotSelfId"')
        && !capsuleStyle.includes('.onebot-webqq__status {\n    opacity: 0;')
        && !capsuleStyle.includes('&:focus-visible,\n  &.is-active')
        && !capsuleStyle.includes('&.is-active .onebot-webqq__avatar')
        ? ''
        : '多机器人状态点应只显示在当前 bot 头像上，且 active 头像不应有额外强调样式',
      multiBotTemplate.includes('onebot-webqq-avatar-guide')
        && multiBotTemplate.includes('bot.selfId === activeBotSelfId && webQQAvatarGuideVisible && !webQQOpen')
        && !capsuleView.includes('if (hasMultipleBots.value) return')
        ? ''
        : '多 bot 折叠态当前头像应能渲染正文点击触发的头像引导光圈',
      capsuleView.includes("['onebot-webqq__bot-switch'")
        ? ''
        : '缺少机器人头像切换按钮',
      capsuleView.includes('@click.stop="selectBot(bot.selfId)"')
        ? ''
        : '点击头像没有切换到对应机器人',
      capsuleView.includes('async function selectBot(selfId: string)')
        ? ''
        : '缺少机器人切换函数',
      capsuleView.includes('await selectWebQQBot(selfId)')
        ? ''
        : '机器人切换没有调用后端 WebQQ 切换接口',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('sizes the capsule avatar as an evenly inset inner circle', () => {
    const shellSource = sourceBetween(capsuleStyle, '.onebot-webqq {', '.onebot-webqq::before')
    const avatarCapsuleSource = sourceBetween(
      capsuleStyle,
      '.onebot-webqq__avatar-capsule {',
      '.onebot-webqq__avatar-capsule.is-expanded',
    )
    const avatarSource = sourceBetween(capsuleStyle, '.onebot-webqq__avatar {', '  img {')
    const missingRequirements = [
      shellSource.includes('height: 50px;') ? '' : '胶囊高度应匹配 42px 头像加上下各 4px 留白',
      capsuleStyle.includes('border: 1px solid rgba(255, 255, 255, 0.62);') ? '' : '胶囊边框应保持 1px',
      avatarCapsuleSource.includes('width: var(--onebot-webqq-avatar-capsule-collapsed-width, 50px);')
        ? ''
        : '头像胶囊默认宽度应与主胶囊内容盒对齐',
      avatarCapsuleSource.includes('height: 50px;') && avatarCapsuleSource.includes('padding: 4px;')
        ? ''
        : '头像应在胶囊内容盒中等距内缩',
      avatarSource.includes('width: 42px;') && avatarSource.includes('height: 42px;')
        ? ''
        : '头像直径应等于 50px 小胶囊扣除上下 4px 留白后的内切圆',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('applies the configured WebQQ color mode to the main capsule', () => {
    const missingRequirements = [
      /import \{[^}]*\bwebQQColorMode\b[^}]*\} from '\.\.\/webqq\/settings'/.test(capsuleView)
        ? ''
        : '主胶囊没有从 webqq/settings 读取 webQQColorMode',
      capsuleView.includes("['onebot-webqq'") && capsuleView.includes('`is-color-${webQQColorMode}`')
        ? ''
        : '主胶囊根节点没有输出 is-color-${webQQColorMode} 类名',
      capsuleView.includes('class="onebot-webqq"')
        ? '主胶囊仍是静态 class，无法随颜色模式切换'
        : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('applies the configured compact capsule shadow option to the main capsule', () => {
    const missingRequirements = [
      /import \{[^}]*\buseCompactCapsuleShadow\b[^}]*\} from '\.\.\/webqq\/settings'/.test(capsuleView)
        ? ''
        : '主胶囊没有从 webqq/settings 读取 useCompactCapsuleShadow',
      capsuleView.includes("'is-capsule-shadow-wide': !useCompactCapsuleShadow")
        ? ''
        : '关闭紧凑阴影时主胶囊没有输出旧版宽阴影类名',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('caps the capsule total unread badge at 99999+ only above 99999', () => {
    expect([
      runGetCapsuleUnreadText(9999),
      runGetCapsuleUnreadText(99999),
      runGetCapsuleUnreadText(100000),
    ]).toEqual(['9999', '99999', '99999+'])
  })

  it('loads the configured WebQQ theme from console entry data', () => {
    expect(clientEntry).toContain("from './capsule/state'")
    expect(clientEntry).toContain("from './entry-state'")
    expect(clientEntry).toContain("from './onebot/bots'")
    expect(clientEntry).toContain("from './webqq/settings'")
    expect(clientEntry).toContain('webQQTheme?: WebQQTheme')
    expect(clientEntry).toContain("bots?: OneBotRobotState['bots']")
    expect(clientEntry).toContain('selectedSelfId?: string')
    expect(clientEntry).toContain('webQQChatStyle?: WebQQChatStyle')
    expect(clientEntry).toContain('webQQTimBubbleTail?: boolean')
    expect(clientEntry).toContain('webQQColorMode?: WebQQColorMode')
    expect(clientEntry).toContain('webQQStorageBackend?: WebQQStorageBackend')
    expect(clientEntry).toContain('webQQMessageCacheLimit?: number')
    expect(clientEntry).toContain('useCompactCapsuleShadow?: boolean')
    expect(clientEntry).toContain('hideWebQQGroupLevel?: boolean')
    expect(clientEntry).toContain('showWebQQAffinity?: boolean')
    expect(clientEntry).toContain('showWebQQRelationship?: boolean')
    expect(clientEntry).toContain('showWebQQCapsuleUnread?: boolean')
    expect(clientEntry).toContain("webQQTheme.value = data?.value?.webQQTheme || 'fresh'")
    expect(clientEntry).toContain("webQQChatStyle.value = data?.value?.webQQChatStyle || 'telegram'")
    expect(clientEntry).toContain('webQQTimBubbleTail.value = data?.value?.webQQTimBubbleTail ?? true')
    expect(clientEntry).toContain("webQQColorMode.value = data?.value?.webQQColorMode || 'auto'")
    expect(clientEntry).toContain("webQQStorageBackend.value = data?.value?.webQQStorageBackend || 'koishi'")
    expect(clientEntry).toContain('webQQMessageCacheLimit.value = data?.value?.webQQMessageCacheLimit ?? 100')
    expect(clientEntry).toContain("webQQAccentColor.value = data?.value?.webQQAccentColor || '#2563eb'")
    expect(clientEntry).toContain('useBotAvatarThemeColor.value = data?.value?.useBotAvatarThemeColor ?? false')
    expect(clientEntry).toContain('useCompactCapsuleShadow.value = data?.value?.useCompactCapsuleShadow ?? true')
    expect(clientEntry).toContain('hideWebQQGroupLevel.value = data?.value?.hideWebQQGroupLevel ?? true')
    expect(clientEntry).toContain('showWebQQAffinity.value = data?.value?.showWebQQAffinity ?? false')
    expect(clientEntry).toContain('showWebQQRelationship.value = data?.value?.showWebQQRelationship ?? false')
    expect(clientEntry).toContain('showWebQQCapsuleUnread.value = data?.value?.showWebQQCapsuleUnread ?? true')
  })

  it('checks and caches bot avatar theme colors in the browser', () => {
    expect(clientEntry).toContain("import { Context, receive, withProxy } from '@koishijs/client'")
    expect(clientEntry).toContain("const webQQAvatarThemeStorageKey = 'onebot-webqq:webqq-avatar-theme:v1'")
    expect(clientEntry).toContain('function loadCachedAvatarThemeColor(avatar: string)')
    expect(clientEntry).toContain('function cacheAvatarThemeColor(avatar: string, color: string)')
    expect(clientEntry).toContain('function extractDominantAvatarColor(avatar: string)')
    expect(clientEntry).toContain('function updateWebQQAvatarThemeColor(data?: CapsuleData)')
    expect(clientEntry).toContain('webQQAvatarAccentColor.value = cached ||')
    expect(clientEntry).toContain('localStorage.getItem(webQQAvatarThemeStorageKey)')
    expect(clientEntry).toContain('localStorage.setItem(webQQAvatarThemeStorageKey')
    expect(clientEntry).toContain('image.src = withProxy(avatar)')
    expect(clientEntry).toContain('updateWebQQAvatarThemeColor(capsule.value)')
  })
})
