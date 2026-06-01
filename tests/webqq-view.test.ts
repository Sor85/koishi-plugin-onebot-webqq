import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const capsuleView = await readFile(new URL('../client/Capsule.vue', import.meta.url), 'utf8')
const webqqView = await readFile(new URL('../client/WebQQObserver.vue', import.meta.url), 'utf8')

describe('webqq observer view', () => {
  it('opens a read-only WebQQ panel from the capsule avatar', () => {
    expect(capsuleView).toContain('import WebQQObserver from')
    expect(capsuleView).toContain('const webqqOpen = ref(false)')
    expect(capsuleView).toContain('@click="webqqOpen = !webqqOpen"')
    expect(capsuleView).toContain('<WebQQObserver v-if="webqqOpen" />')
  })

  it('renders contacts, groups, message history, and no send input', () => {
    expect(webqqView).toContain("send('chat-capsule/webqq/contacts')")
    expect(webqqView).toContain("send('chat-capsule/webqq/messages'")
    expect(webqqView).toContain("activeTab = 'friends'")
    expect(webqqView).toContain("activeTab = 'groups'")
    expect(webqqView).toContain('v-for="message in messages"')
    expect(webqqView).not.toContain('textarea')
    expect(webqqView).not.toContain("send('chat-capsule/webqq/send'")
  })

  it('keeps tabs at the top without the WebQQ profile block', () => {
    expect(webqqView).not.toContain('chat-capsule-webqq__profile')
    expect(webqqView).not.toContain('chat-capsule-webqq__profile-avatar')

    const sidebarIndex = webqqView.indexOf('class="chat-capsule-webqq__sidebar"')
    const tabsIndex = webqqView.indexOf('class="chat-capsule-webqq__tabs-row"')
    const listIndex = webqqView.indexOf('class="chat-capsule-webqq__list"')

    expect(tabsIndex).toBeGreaterThan(sidebarIndex)
    expect(tabsIndex).toBeLessThan(listIndex)
  })
})
