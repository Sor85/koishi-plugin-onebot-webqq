import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/Capsule.vue', import.meta.url), 'utf8')
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
      guideSource.includes('v-if="webQQAvatarGuideVisible && !webqqOpen"')
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
        ? ''
        : '胶囊主体点击没有触发头像图形引导',
      mountedSource.includes('!hasSeenWebQQAvatarGuide()')
        && mountedSource.includes('showWebQQAvatarGuide(true)')
        ? ''
        : '首次使用没有自动展示并记录头像图形引导',
      capsuleView.includes("localStorage.setItem(webQQAvatarGuideStorageKey, 'seen')")
        ? ''
        : '头像图形引导没有写入已展示状态',
    ].filter(Boolean)

    expect(missingRequirements).toEqual([])
  })

  it('splits thinking status and current user into separate lines', () => {
    expect(capsuleView).toContain("const titleStatusText = computed(() => isThinking.value ? activityText.value : '')")
    expect(capsuleView).toContain("const userActivityText = computed(() => userName.value ? `正在与 ${userName.value} 对话` : '')")
    expect(capsuleView).toContain("const idleActivityText = computed(() => !isThinking.value && !userName.value ? activityText.value : '')")
    expect(capsuleView).toContain('if (userActivityText.value) return userActivityText.value')
    expect(capsuleView).toContain("return idleActivityText.value || '空闲中'")
    expect(capsuleView).toContain('v-if="titleStatusText"')
    expect(capsuleView).toContain('{{ titleStatusText }}')
    expect(capsuleView).toContain('v-if="displayActivityText"')
    expect(capsuleView).toContain('{{ displayActivityText }}')
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
    expect(capsuleView).toContain('const displayBotName = computed(() => capsule.value?.bot.name || cachedBotProfile.value.name ||')
    expect(capsuleView).toContain('const displayBotAvatar = computed(() => capsule.value?.bot.avatar || cachedBotProfile.value.avatar ||')
    expect(capsuleView).toContain('watch(() => capsule.value?.bot')
    expect(capsuleView).toContain('cacheBotProfile(bot.name, bot.avatar)')
    expect(capsuleView).toContain('v-if="displayBotAvatar"')
    expect(capsuleView).toContain(':src="withProxy(displayBotAvatar)"')
    expect(capsuleView).toContain(':alt="displayBotName"')
    expect(capsuleView).toContain(':title="displayBotName"')
    expect(capsuleView).toContain('{{ displayBotName }}')
  })

  it('renders total WebQQ unread count on the bot avatar when enabled', () => {
    expect(capsuleView).toContain("import { capsule, showWebQQCapsuleUnread, webQQColorMode, webQQTotalUnread } from './state'")
    expect(capsuleView).toContain('class="onebot-webqq__avatar-unread"')
    expect(capsuleView).toContain('v-if="showWebQQCapsuleUnread && webQQTotalUnread"')
    expect(capsuleView).toContain('{{ capsuleUnreadText }}')
    expect(capsuleView).toContain('const capsuleUnreadText = computed(() => getCapsuleUnreadText(webQQTotalUnread.value))')
  })

  it('applies the configured WebQQ color mode to the main capsule', () => {
    const missingRequirements = [
      /import \{[^}]*\bwebQQColorMode\b[^}]*\} from '\.\/state'/.test(capsuleView)
        ? ''
        : '主胶囊没有从 state 读取 webQQColorMode',
      capsuleView.includes("['onebot-webqq'") && capsuleView.includes('`is-color-${webQQColorMode}`')
        ? ''
        : '主胶囊根节点没有输出 is-color-${webQQColorMode} 类名',
      capsuleView.includes('class="onebot-webqq"')
        ? '主胶囊仍是静态 class，无法随颜色模式切换'
        : '',
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
    expect(clientEntry).toContain("import { capsule, debug, hideWebQQGroupLevel, showWebQQAffinity, showWebQQCapsuleUnread, showWebQQRelationship, useBotAvatarThemeColor, webQQAccentColor, webQQAvatarAccentColor, webQQChatStyle, webQQColorMode, webQQMessageCacheLimit, webQQStorageBackend, webQQTheme, type CapsuleData, type WebQQChatStyle, type WebQQColorMode, type WebQQStorageBackend, type WebQQTheme } from './state'")
    expect(clientEntry).toContain('webQQTheme?: WebQQTheme')
    expect(clientEntry).toContain('webQQChatStyle?: WebQQChatStyle')
    expect(clientEntry).toContain('webQQColorMode?: WebQQColorMode')
    expect(clientEntry).toContain('webQQStorageBackend?: WebQQStorageBackend')
    expect(clientEntry).toContain('webQQMessageCacheLimit?: number')
    expect(clientEntry).toContain('hideWebQQGroupLevel?: boolean')
    expect(clientEntry).toContain('showWebQQAffinity?: boolean')
    expect(clientEntry).toContain('showWebQQRelationship?: boolean')
    expect(clientEntry).toContain('showWebQQCapsuleUnread?: boolean')
    expect(clientEntry).toContain("webQQTheme.value = data?.value?.webQQTheme || 'fresh'")
    expect(clientEntry).toContain("webQQChatStyle.value = data?.value?.webQQChatStyle || 'qq'")
    expect(clientEntry).toContain("webQQColorMode.value = data?.value?.webQQColorMode || 'auto'")
    expect(clientEntry).toContain("webQQStorageBackend.value = data?.value?.webQQStorageBackend || 'browser'")
    expect(clientEntry).toContain('webQQMessageCacheLimit.value = data?.value?.webQQMessageCacheLimit ?? 100')
    expect(clientEntry).toContain("webQQAccentColor.value = data?.value?.webQQAccentColor || '#2563eb'")
    expect(clientEntry).toContain('useBotAvatarThemeColor.value = data?.value?.useBotAvatarThemeColor ?? false')
    expect(clientEntry).toContain('hideWebQQGroupLevel.value = data?.value?.hideWebQQGroupLevel ?? false')
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
