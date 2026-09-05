import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/capsule/Capsule.vue', import.meta.url), 'utf8')
const capsuleActivitySelect = await readFile(new URL('../client/capsule/CapsuleActivitySelect.vue', import.meta.url), 'utf8')
const capsuleState = await readFile(new URL('../client/capsule/state.ts', import.meta.url), 'utf8')
const capsuleStyle = await readFile(new URL('../client/capsule/styles.scss', import.meta.url), 'utf8')
const avatarGuideMotion = await readFile(new URL('../client/capsule/avatar-guide.ts', import.meta.url), 'utf8')
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
  it('logs the exact Bot profile chosen for the online badge in debug mode', () => {
    expect(capsuleView).toContain("console.debug('[onebot-webqq][bot-status-debug] capsule-display'")
    expect(capsuleView).toContain('selectedBotSelfId: selectedBotSelfId.value')
    expect(capsuleView).toContain('statusClass: statusClass.value')
    expect(capsuleView).toContain('capsuleBots: capsule.value?.bots?.map')
    expect(capsuleView).toContain('runtimeBots: runtimeBots.value.map')
  })

  it('hides the capsule on configured activity pages', () => {
    expect(capsuleView).toContain("import { Universal, activities, router, store, withProxy } from '@koishijs/client'")
    expect(capsuleView).toContain("import { capsule, capsuleAnchor, hiddenCapsuleActivityIds } from './state'")
    expect(capsuleView).toContain("const currentActivityId = computed(() => router.currentRoute.value.meta?.activity?.id || '')")
    expect(capsuleView).toContain('const isHiddenActivity = computed(() => hiddenCapsuleActivityIds.value.includes(currentActivityId.value))')
    expect(capsuleView).toContain('const shouldShowCapsule = computed(() => isLoggedIn.value && !isHiddenActivity.value)')
    expect(capsuleView).toContain('v-if="shouldShowCapsule"')
    expect(capsuleState).toContain('export const hiddenCapsuleActivityIds = capsuleState.hiddenCapsuleActivityIds')
    expect(capsuleState).toContain('export const capsule = capsuleState.capsule')
  })

  it('hides the capsule before the Koishi console user is logged in', () => {
    expect(capsuleView).toContain("const isLoggedIn = computed(() => !activities.login || ('user' in store && !!store.user))")
    expect(capsuleView).toContain('const shouldShowCapsule = computed(() => isLoggedIn.value && !isHiddenActivity.value)')
    expect(capsuleView).toContain('v-if="shouldShowCapsule"')
  })

  it('registers a capsule settings field for global capsule visibility', () => {
    expect(clientEntry).toContain("import CapsuleActivitySelect from './capsule/CapsuleActivitySelect.vue'")
    expect(clientEntry).toContain("role: 'onebot-webqq-activity-select'")
    expect(clientEntry).toContain('component: CapsuleActivitySelect')
    expect(capsuleActivitySelect).toContain('<SchemaBase>')
    expect(capsuleActivitySelect).toContain('Object.values(ctx.$router.pages)')
    expect(capsuleActivitySelect).toContain("emit('update:modelValue', [...values])")
  })

  it('renders a graphical WebQQ avatar guide without visible instruction text', () => {
    const guideSource = capsuleView.match(/<Transition :css="false" @enter="enterAvatarGuide"[\s\S]*?<\/Transition>/)?.[0] ?? ''
    const missingRequirements = [
      guideSource ? '' : '缺少头像图形引导过渡容器',
      guideSource.includes('webQQAvatarGuideVisible && !webQQOpen')
        ? ''
        : '头像图形引导没有只在 WebQQ 未打开时显示',
      guideSource.includes('class="onebot-webqq__avatar-guide"')
        ? ''
        : '缺少头像图形引导层',
      guideSource.includes(':style="webQQAvatarGuideStyle"')
        ? '头像图形引导不应绑定动态样式'
        : '',
      guideSource.includes('aria-hidden="true"') ? '' : '图形引导应该对读屏隐藏',
      guideSource.includes('class="onebot-webqq__avatar-guide-ring"')
        ? ''
        : '图形引导缺少头像光圈',
      // 运动全部由波纹承担，常驻圈几何静止。少了波纹节点就退回「慢速缩放常驻圈」那套观感缺陷。
      guideSource.includes('v-for="index in avatarGuidePulseCount"')
        && guideSource.includes('class="onebot-webqq__avatar-guide-pulse"')
        ? ''
        : '图形引导缺少扩散波纹节点',
      guideSource.includes('@leave="leaveAvatarGuide"')
        ? ''
        : '头像图形引导的进出场没有交给 Anime.js 钩子',
      guideSource.includes('onebot-webqq__avatar-guide-arrow')
        ? '图形引导不应再显示箭头'
        : '',
      guideSource.includes('点击头像') ? '图形引导不应显示文字说明' : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('drives the avatar guide motion with Anime.js instead of CSS keyframes', () => {
    const missingRequirements = [
      avatarGuideMotion.includes("import { animate, utils, type JSAnimation } from 'animejs'")
        ? ''
        : '头像强调动效没有复用项目已有的 anime.js 依赖',
      // 单节点周期 = 节点数 × 出发间隔，loopDelay 必须由此反推，否则调节点数会出现空档或撞车。
      avatarGuideMotion.includes('const PULSE_LOOP_DELAY = AVATAR_GUIDE_PULSE_COUNT * PULSE_INTERVAL - PULSE_DURATION')
        ? ''
        : '波纹的 loopDelay 没有按节点数反推，扩散节奏会不均匀',
      avatarGuideMotion.includes('loop: true') ? '' : '波纹没有持续循环',
      // 两条都踩过：多目标 delay 只在单轮内错开（循环边界同时重置，出现空拍）；
      // 单目标各带 delay 又会让 Anime.js 在创建时就写入 from 值，未出场的节点静静停在常驻圈上。
      avatarGuideMotion.includes('pulseTimers.push(setTimeout(() => spawnPulse(target), index * PULSE_INTERVAL))')
        && !/animate\(target, \{[\s\S]*?delay:/.test(avatarGuideMotion)
        ? ''
        : '波纹错拍必须靠延后创建，不能用 Anime.js 的 delay',
      avatarGuideMotion.includes('for (const timer of pulseTimers) clearTimeout(timer)')
        ? ''
        : '停止波纹时没有清掉还没出场的待命定时器',
      avatarGuideMotion.includes('scale: [1, PULSE_SCALE_TO]')
        && avatarGuideMotion.includes("opacity: { from: PULSE_OPACITY_FROM, to: 0, ease: 'out(2)' }")
        ? ''
        : '波纹缺少扩散与淡出，或淡出没有比位移更慢收敛（会留下「看得见却几乎不动」的尾巴）',
      // 容器靠 transform: translate(-50%, -50%) 居中，动它的 scale 会把居中的 translate 顶掉。
      /enter\(root, done\) \{[\s\S]*?opacity: \[0, 1\]/.test(avatarGuideMotion)
        && !/animate\(root, \{[\s\S]*?scale:/.test(avatarGuideMotion)
        ? ''
        : '引导容器只能动 opacity，动 scale 会破坏居中',
      avatarGuideMotion.includes("window.matchMedia('(prefers-reduced-motion: reduce)').matches")
        ? ''
        : '头像强调动效没有在 prefers-reduced-motion 下跳过波纹',
      avatarGuideMotion.includes('for (const pulse of pulses) pulse.revert()')
        ? ''
        : '波纹停止时没有抹掉内联样式，下次进场会留半透明残影',
      capsuleView.includes('if (webQQAvatarGuideVisible.value) avatarGuideMotion.restart()')
        ? ''
        : '引导已显示时再次点击没有重跑波纹，点击会像没反应',
      capsuleView.includes('avatarGuideMotion.destroy()')
        ? ''
        : '组件卸载时没有停掉头像强调动效',
      capsuleStyle.includes('animation: onebot-webqq-avatar-guide')
        ? '头像强调动效不应再由 CSS 关键帧驱动'
        : '',
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
      capsuleView.includes('webQQAvatarGuideStyle')
        ? '头像图形引导不应读取额外样式状态'
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

  it('lets the whole capsule be dragged to a new anchor', () => {
    const dragHandleCount = capsuleView.match(/@pointerdown="startCapsuleDrag"/g)?.length ?? 0
    const missingRequirements = [
      capsuleView.includes("import { clampCapsuleAnchor, normalizeCapsuleAnchorPosition, type CapsuleAnchor } from './capsule-anchor'")
        ? ''
        : '拖动没有复用入口锚点的判定模块',
      capsuleView.includes('const CAPSULE_DRAG_THRESHOLD = 4')
        && capsuleView.includes('if (Math.hypot(deltaX, deltaY) < CAPSULE_DRAG_THRESHOLD) return')
        ? ''
        : '拖动缺少位移阈值，阈值内的松手会被当成拖动，头像点不开观察窗',
      // 把手挂在 layout root 与摘要文字上，而不是 host：观察窗是 host 的插槽子节点，
      // 挂在 host 上会让观察窗内部的每一次 pointerdown 都变成拖胶囊。
      dragHandleCount === 2
        && capsuleView.includes('class="onebot-webqq-layout-root" @pointerdown="startCapsuleDrag"')
        && capsuleView.includes('`is-color-${resolvedWebQQColorMode}`]" @pointerdown="startCapsuleDrag"')
        && !capsuleView.includes('class="onebot-webqq-host" @pointerdown')
        ? ''
        : '拖动把手应只覆盖头像区与胶囊摘要文字，不能挂在容纳观察窗的 host 上',
      // 头像是 <img>，原生拖放会在阈值处抢走整个指针序列（dragstart → pointercancel），胶囊只挪
      // 几像素就停住。停用 OneBot 适配器的环境里头像退化成 SVG 图标，这一条永远复现不出来。
      (capsuleView.match(/@dragstart="blockCapsuleNativeDrag"/g)?.length ?? 0) === dragHandleCount
        && capsuleView.includes('function blockCapsuleNativeDrag(event: DragEvent) {\n  event.preventDefault()\n}')
        ? ''
        : '拖动把手没有取消原生拖放，头像上的 dragstart 会让浏览器 pointercancel 掉这次拖动',
      capsuleView.includes('right: session.startAnchor.right - deltaX')
        && capsuleView.includes('bottom: session.startAnchor.bottom - deltaY')
        ? ''
        : '拖动位移方向不对：right/bottom 量的是到视口右缘、下缘的距离',
      capsuleView.includes('function measureCapsuleAnchor(): CapsuleAnchor | undefined')
        && capsuleView.includes('right: window.innerWidth - rect.right')
        && capsuleView.includes('bottom: window.innerHeight - rect.bottom')
        ? ''
        : '拖动起点没有实测当前锚点，窄屏默认值或展开态宽度会被算错',
      capsuleView.includes("window.addEventListener('pointermove', handleCapsuleDragMove)")
        && capsuleView.includes("window.addEventListener('pointerup', stopCapsuleDrag)")
        && capsuleView.includes("window.addEventListener('pointercancel', stopCapsuleDrag)")
        && capsuleView.includes("window.removeEventListener('pointermove', handleCapsuleDragMove)")
        && capsuleView.includes("window.removeEventListener('pointerup', stopCapsuleDrag)")
        && capsuleView.includes("window.removeEventListener('pointercancel', stopCapsuleDrag)")
        ? ''
        : '拖动会话没有在 window 上收发指针事件或没有摘除监听',
      capsuleView.includes("capsuleHost.value?.addEventListener('click', blockCapsuleClick, true)")
        && capsuleView.includes("capsuleHost.value?.removeEventListener('click', blockCapsuleClick, true)")
        && capsuleView.includes('releaseCapsuleClickSuppression()')
        ? ''
        : '拖完那一下的 click 没有在 host 捕获阶段被吃掉，松手会顺带开观察窗或切机器人',
      capsuleView.includes('if (!session.dragging) return\n  suppressCapsuleClickAfterDrag()')
        ? ''
        : '没拖动过的松手不应该拦截点击',
      capsuleView.includes("const capsuleAnchorStorageKey = 'onebot-webqq:capsule-anchor:v1'")
        && capsuleView.includes('JSON.stringify({ right: anchor.right, bottom: anchor.bottom })')
        && capsuleView.includes('normalizeCapsuleAnchorPosition(JSON.parse(localStorage.getItem(capsuleAnchorStorageKey)')
        ? ''
        : '入口位置没有按浏览器记住，或把宽高一起存了进去',
      capsuleView.includes('capsuleAnchor.value = clampCapsuleAnchor({ ...measured, ...stored }, getCapsuleViewport())')
        && capsuleView.includes('if (capsuleAnchor.value) return')
        && capsuleView.includes('void nextTick(restoreCapsuleAnchor)')
        ? ''
        : '恢复存下来的位置时没有夹回当前视口，或隐藏后重新出现时没有补一次恢复',
      capsuleView.includes("window.addEventListener('resize', clampCapsuleAnchorToViewport)")
        && capsuleView.includes("window.removeEventListener('resize', clampCapsuleAnchorToViewport)")
        ? ''
        : '视口变化时没有把已经贴边的入口夹回屏幕内',
      capsuleView.includes("'is-dragging': capsuleDragging")
        ? ''
        : '拖动期间没有输出状态类名，摘要文字会被拖选',
      capsuleView.includes("'--onebot-webqq-capsule-right': `${anchor.right}px`")
        && capsuleView.includes("'--onebot-webqq-capsule-bottom': `${anchor.bottom}px`")
        && capsuleStyle.includes('right: var(--onebot-webqq-capsule-right, 24px)')
        && capsuleStyle.includes('bottom: var(--onebot-webqq-capsule-bottom, 56px)')
        ? ''
        : '拖动结果没有经 host 上的自定义属性下发给胶囊摘要文字',
      capsuleState.includes('capsuleAnchor: Ref<CapsuleAnchor | undefined>')
        && capsuleState.includes('export const capsuleAnchor = capsuleState.capsuleAnchor')
        ? ''
        : '入口锚点没有进小胶囊领域的跨实例状态，观察窗读不到',
      capsuleView.includes('event.preventDefault()\n  // right/bottom 量的是到视口右缘、下缘的距离')
        && !capsuleView.includes('function startCapsuleDrag(event: PointerEvent) {\n  event.preventDefault()')
        ? ''
        : 'pointerdown 不能拦默认行为：头像栈的折叠状态机依赖这次聚焦；阈值之后才拦',
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
    expect(capsuleView).toMatch(/import \{[^}]*\bshowWebQQCapsuleUnread\b[^}]*\bwebQQTotalUnread\b[^}]*\} from '\.\.\/entry-state'/)
    // ADR 0001：client/capsule 不得直接依赖 client/webqq 的状态 module，
    // 配置镜像和观察窗运行时状态都只能经 entry-state 这个组合根拿到。
    expect(capsuleView).not.toContain("from '../webqq/settings'")
    expect(capsuleView).not.toContain("from '../webqq/runtime-state'")
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
      capsuleView.includes("'is-overlapped': index > 0")
        && capsuleView.includes("'is-collapsed-extra': isBotCollapsedExtra(index)")
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
        && capsuleView.indexOf('class="onebot-webqq-layout-root"') < capsuleView.indexOf(':class="[\'onebot-webqq__body\', `is-color-${resolvedWebQQColorMode}`]"')
        && capsuleStyle.includes('.onebot-webqq.is-bot-stack-expanded')
        && capsuleStyle.includes('width: var(--onebot-webqq-shell-width')
        && capsuleStyle.includes('.onebot-webqq__avatar-capsule.is-expanded')
        && capsuleStyle.includes('width: var(--onebot-webqq-avatar-capsule-expanded-width')
        && capsuleStyle.includes('width: var(--onebot-webqq-stack-expanded-width')
        && capsuleStyle.includes('.onebot-webqq__body')
        && capsuleStyle.includes('position: fixed')
        && capsuleStyle.includes('right: var(--onebot-webqq-capsule-right, 24px)')
        && capsuleStyle.includes('width: 157px')
        ? ''
        : '头像展开时胶囊和头像组没有同步向左扩张，或正文没有固定右锚点',
      capsuleView.includes("import { animate, createLayout, type AutoLayout } from 'animejs'")
        && capsuleView.includes('ref="capsuleLayoutRef"')
        && capsuleView.includes('const capsuleLayoutRef = ref<HTMLElement>()')
        && capsuleView.includes('createLayout(capsuleLayoutRef.value')
        && capsuleView.includes('layout?.record()')
        && capsuleView.includes('animateBotStackLayout(layout, fromExpanded, expanded)')
        && capsuleView.includes("layout.animate({ duration: 260, ease: 'out(3)' })")
        && capsuleView.includes("'--onebot-webqq-avatar-overlap-center': [`${fromCenter}px`, `${toCenter}px`]")
        && capsuleView.includes('duration: 260')
        && capsuleView.includes("ease: 'out(3)'")
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
        && capsuleStyle.includes('font-size: var(--onebot-webqq-font-2xs);')
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
      multiBotTemplate.includes('onebot-webqq__avatar-guide')
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
      /import \{[^}]*\bresolvedWebQQColorMode\b[^}]*\} from '\.\.\/entry-state'/.test(capsuleView)
        ? ''
        : '主胶囊没有从 entry-state 读取 resolvedWebQQColorMode',
      capsuleView.includes("['onebot-webqq'") && capsuleView.includes('`is-color-${resolvedWebQQColorMode}`')
        ? ''
        : '主胶囊根节点没有输出解析后的颜色模式类名',
      capsuleView.includes('class="onebot-webqq"')
        ? '主胶囊仍是静态 class，无法随颜色模式切换'
        : '',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('applies the configured capsule frosted glass option to the main capsule', () => {
    const missingRequirements = [
      /import \{[^}]*\benableCapsuleFrostedGlass\b[^}]*\} from '\.\.\/entry-state'/.test(capsuleView)
        ? ''
        : '主胶囊没有从 entry-state 读取 enableCapsuleFrostedGlass',
      capsuleView.includes("enableCapsuleFrostedGlass ? 'is-frosted' : 'is-plain'")
        ? ''
        : '主胶囊根节点没有根据 enableCapsuleFrostedGlass 输出毛玻璃类名',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('applies the configured compact capsule shadow option to the main capsule', () => {
    const missingRequirements = [
      /import \{[^}]*\buseCompactCapsuleShadow\b[^}]*\} from '\.\.\/entry-state'/.test(capsuleView)
        ? ''
        : '主胶囊没有从 entry-state 读取 useCompactCapsuleShadow',
      capsuleView.includes("'is-capsule-shadow-wide': !useCompactCapsuleShadow")
        ? ''
        : '关闭紧凑阴影时主胶囊没有输出旧版宽阴影类名',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('applies the configured WebQQ accent color to the avatar guide halo', () => {
    const missingRequirements = [
      /import \{[^}]*\bwebQQAccentColor\b[^}]*\} from '\.\.\/entry-state'/.test(capsuleView)
        ? ''
        : '头像引导光圈没有从 entry-state 读取 WebQQ 主题色',
      capsuleView.includes("import { getWebQQAccentStyle } from '../webqq/utils/webqq-theme-view'")
        ? ''
        : '头像引导光圈没有复用 WebQQ 主题色样式变量',
      capsuleView.includes(':style="capsuleHostStyle"')
        ? ''
        : 'WebQQ 主题色变量应绑定在小胶囊 host 上，避免被胶囊布局动画覆盖',
      capsuleView.includes('const capsuleHostStyle = computed')
        ? ''
        : '小胶囊 host 缺少响应式主题色样式',
      capsuleView.includes('getWebQQAccentStyle(webQQAccentColor.value)')
        ? ''
        : '主胶囊没有把 WebQQ 主题色写入同一套 WebQQ CSS 变量',
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

  it('loads the configured frosted glass options from console entry data', () => {
    // 配置镜像的类型与取值现在由配置规格派生，因此这里只钉住组合根从哪些领域取 ref、
    // 以及 entry data 什么时候被套用。逐项默认值与空值语义由 tests/config-mirror.test.ts
    // 读运行时 ref 与下发 payload 断言。
    expect(clientEntry).toContain("from './capsule/state'")
    expect(clientEntry).toContain("from './entry-state'")
    expect(clientEntry).toContain("from './onebot/bots'")
    expect(clientEntry).toContain("from './webqq/settings'")
    expect(clientEntry).toContain("from '../src/config/spec'")
    expect(clientEntry).toContain("bots?: OneBotRobotState['bots']")
    expect(clientEntry).toContain('selectedSelfId?: string')
    expect(clientEntry).toContain('function applyClientData(value?: ClientData)')
    expect(clientEntry).toContain('applyClientData(data?.value)')
    expect(clientEntry).toContain('watch(data, (value) => {')
    expect(clientEntry).toContain('applyClientData(value)')
  })

  it('updates WebQQ settings when the console entry data ref changes', () => {
    expect(clientEntry).toContain("import { watch, type Ref } from 'vue'")
    expect(clientEntry).toContain('const stopDataWatch = data')
    expect(clientEntry).toContain('stopDataWatch?.()')
  })
})
