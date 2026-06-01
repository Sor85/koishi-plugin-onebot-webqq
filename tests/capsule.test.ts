import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/Capsule.vue', import.meta.url), 'utf8')

describe('chat capsule view', () => {
  it('splits thinking status and current user into separate lines', () => {
    expect(capsuleView).toContain("const titleStatusText = computed(() => isThinking.value ? activityText.value : '')")
    expect(capsuleView).toContain("const userActivityText = computed(() => userName.value ? `正在与 ${userName.value} 对话` : '')")
    expect(capsuleView).toContain("const displayActivityText = computed(() => userActivityText.value || '空闲中')")
    expect(capsuleView).toContain('v-if="titleStatusText"')
    expect(capsuleView).toContain('{{ titleStatusText }}')
    expect(capsuleView).toContain('v-if="displayActivityText"')
    expect(capsuleView).toContain('{{ displayActivityText }}')
  })
})
