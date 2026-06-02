import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/Capsule.vue', import.meta.url), 'utf8')

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

  it('splits thinking status and current user into separate lines', () => {
    expect(capsuleView).toContain("const titleStatusText = computed(() => isThinking.value ? activityText.value : '')")
    expect(capsuleView).toContain("const userActivityText = computed(() => userName.value ? `正在与 ${userName.value} 对话` : '')")
    expect(capsuleView).toContain('if (userActivityText.value) return userActivityText.value')
    expect(capsuleView).toContain("return thinkingDurationText.value || hasUsage.value ? '' : '空闲中'")
    expect(capsuleView).toContain('v-if="titleStatusText"')
    expect(capsuleView).toContain('{{ titleStatusText }}')
    expect(capsuleView).toContain('v-if="displayActivityText"')
    expect(capsuleView).toContain('{{ displayActivityText }}')
  })

  it('renders usage and completed thinking duration as meta details', () => {
    expect(capsuleView).toContain('const usageTitle = computed(() => {')
    expect(capsuleView).toContain("return `输入 ${usage.inputTokens} / 输出 ${usage.outputTokens}`")
    expect(capsuleView).toContain('const thinkingDurationText = computed(() => {')
    expect(capsuleView).toContain("return `已思考 ${seconds} s`")
    expect(capsuleView).toContain('v-if="hasUsage"')
    expect(capsuleView).toContain('class="chat-capsule__usage"')
    expect(capsuleView).toContain('class="chat-capsule__usage-icon is-input"')
    expect(capsuleView).toContain('class="chat-capsule__usage-icon is-output"')
    expect(capsuleView).toContain('d="M12 20V8"')
    expect(capsuleView).toContain('d="M12 4v12"')
    expect(capsuleView).toContain('{{ usage!.inputTokens }}')
    expect(capsuleView).toContain('{{ usage!.outputTokens }}')
    expect(capsuleView).toContain('v-if="thinkingDurationText"')
    expect(capsuleView).toContain('{{ thinkingDurationText }}')
  })
})
