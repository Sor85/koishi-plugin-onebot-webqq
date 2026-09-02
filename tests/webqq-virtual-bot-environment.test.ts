import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createOneBotWebQQService } from '../src/webqq/adapters/onebot/service'

const runtimeSource = await readFile(new URL('../src/runtime/create-runtime.ts', import.meta.url), 'utf8')
const consoleSource = await readFile(new URL('../src/webqq/console.ts', import.meta.url), 'utf8')
const adapterTypesSource = await readFile(new URL('../src/webqq/adapters/types.ts', import.meta.url), 'utf8')
const messageListSource = await readFile(new URL('../client/webqq/components/WebQQMessageList.vue', import.meta.url), 'utf8')
const adaptersDir = new URL('../src/webqq/adapters/', import.meta.url)
// 刻意不写出被删目录的完整路径：写全会让本文件自己成为「引用了内存实现」的那个 module。
const deletedAdapterName = 'mock'
const moduleDirectories = ['src/', 'client/', 'tests/']

function listModuleFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((file) => moduleDirectories.some((directory) => file.startsWith(directory)))
    .filter((file) => existsSync(file))
}

describe('webqq virtual bot environment', () => {
  it('keeps the developer mock environment on the real WebQQ service and the real affinity path', () => {
    // create-runtime 与 console.ts 读哪个配置项、怎么兜底，由 tests/plugin.test.ts 通过
    // 插件 apply + 内存 Console 替身断言运行时行为；这里只钉住模块归属与前端渲染契约。
    // 装配层永远创建真实实现，开关只作为「是否纳入虚拟机器人」的选项传进去。
    expect(runtimeSource).toContain('createOneBotWebQQService(ctx, {')
    expect(runtimeSource).toContain("includeVirtualBots: readConfigValue(config, 'webQQMockEnvironment')")
    // 好感度徽标不再按模拟环境整体跳过：虚拟机器人在 ChatLuna 库里查不到记录时徽标为空，那是正确答案而不是缺陷。
    expect(consoleSource).toContain('attachWebQQAffinityBadges')
    expect(consoleSource).not.toContain('webQQMockEnvironment')
    expect(messageListSource).toContain('message.senderId !== currentOperatorId && message.senderAffinity != null')
    expect(messageListSource).toContain('message.senderId !== currentOperatorId && message.senderRelationship')
  })

  it('stops deriving extra mock robot profiles while the developer mock environment is enabled', () => {
    const virtualBot = {
      platform: 'onebot',
      selfId: '90001',
      name: '虚拟机器人',
      status: 1,
      hidden: true,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
    }
    const realBot = {
      platform: 'onebot',
      selfId: '10001',
      name: '真实机器人',
      status: 1,
      internal: {
        get_friend_list: vi.fn(async () => []),
        get_group_list: vi.fn(async () => []),
      },
    }
    const bots = [virtualBot, realBot]

    // 模拟环境下不再派生假画像：提供方插件里可以真的建多台虚拟机器人，走真实 action。
    expect(createOneBotWebQQService({ bots }, {
      includeVirtualBots: true,
      mockBotCount: 2,
    }).listBots().map((bot) => bot.selfId)).toEqual(['90001'])

    // 真实环境下这个配置项的行为一字不变。
    expect(createOneBotWebQQService({ bots }, { mockBotCount: 2 }).listBots().map((bot) => bot.selfId)).toEqual([
      '10001',
      '10001:mock:1',
      '10001:mock:2',
    ])
  })

  // 内存实现一旦以任何形式回来，「两份实现必须同构」这条约束也一起回来：漏改它不报错，
  // 只会在某天表现成「模拟环境好用、真机不对」。
  it('keeps the in-memory WebQQ implementation deleted', async () => {
    const adapters = (await readdir(adaptersDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    expect(adapters).toEqual(['onebot'])

    const needle = ['adapters', deletedAdapterName].join('/')
    const offenders = listModuleFiles().filter((file) => readFileSync(file, 'utf8').includes(needle))
    expect(offenders).toEqual([])
  })

  it('keeps the WebQQ service type a single shape instead of a union', () => {
    const declaration = /export type WebQQService =([\s\S]*?)(?:\n\n|$)/.exec(adapterTypesSource)?.[1] ?? ''
    expect(declaration.trim()).toBeTruthy()
    expect(declaration).not.toContain('|')
    expect(declaration).toContain('ReturnType<typeof createOneBotWebQQService>')
  })
})
