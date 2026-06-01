import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/Capsule.vue', import.meta.url), 'utf8')

describe('chat capsule view', () => {
  it('shows an idle activity line when no active status exists', () => {
    expect(capsuleView).toContain("const displayActivityText = computed(() => activityText.value || '空闲中')")
    expect(capsuleView).toContain('v-if="displayActivityText"')
    expect(capsuleView).toContain('{{ displayActivityText }}')
  })
})
