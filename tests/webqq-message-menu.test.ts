import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@koishijs/client', () => ({
  send: vi.fn(),
  useColorMode: () => ref<'light' | 'dark'>('light'),
}))

import { resetWebQQClientState } from '../client/entry-state'
import { availableBots, selectedBotSelfId } from '../client/onebot/bots'

afterEach(() => {
  availableBots.value = []
  selectedBotSelfId.value = ''
})

describe('webqq message menu identity', () => {
  it('keeps the operator identity after HMR disposal', () => {
    availableBots.value = [{
      platform: 'onebot',
      selfId: '10000',
      status: 1,
      name: 'Bot',
    }]
    selectedBotSelfId.value = '10000'

    resetWebQQClientState()

    // 消息菜单用这个身份决定“贴表情”和“撤回”是否可见；HMR 清理不能把它清空。
    expect(selectedBotSelfId.value || availableBots.value[0]?.selfId).toBe('10000')
  })

  it('shares bot state between duplicated Vite module instances', async () => {
    // `?query` 是 Vite 测试用的模块实例分隔符，TypeScript 的静态解析器不识别该后缀。
    // @ts-expect-error Vite query import intentionally creates a second module instance.
    const entryBots = await import('../client/onebot/bots.ts?message-menu-entry')
    // @ts-expect-error Vite query import intentionally creates a second module instance.
    const messageBots = await import('../client/onebot/bots.ts?message-menu-view')
    entryBots.selectedBotSelfId.value = '10000'

    // portal + Vite @fs 可能让入口和消息组件各自加载一份 bots.ts，二者必须读到同一份 ref。
    expect(messageBots.selectedBotSelfId.value).toBe('10000')
  })
})
