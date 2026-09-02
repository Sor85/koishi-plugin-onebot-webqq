import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

// 与 tests/config-panel.test.ts 同理：koishi 的包入口在 vitest 的 ESM 环境里加载不起来，
// 但 koishi.Schema 就是 schemastery 本身，替换后读到的仍是真实 Schema 运行时节点。
// 服务端只从 koishi 取 Schema 这一个运行时值，所以插件 apply 也能在同一个替身上跑起来。
vi.mock('koishi', async () => ({ Schema: (await import('schemastery')).default }))
// 配置镜像 module 只用到控制台的颜色模式，替身足够；本文件不渲染任何组件。
vi.mock('@koishijs/client', () => ({ useColorMode: () => ref<'light' | 'dark'>('light') }))

const { Config, apply } = await import('../src')
const { mirroredConfigKeys, readConfigDefault, readConfigValue } = await import('../src/config/spec')

// 第三个读取点：直接 import 前端配置镜像 module，读 ref 初始值。
// 配置镜像仍按领域归属分布，所以这里也得像组合根那样把三份拼起来。
const webqqSettings = await import('../client/webqq/settings')
const { hiddenCapsuleActivityIds } = await import('../client/capsule/state')
const { debug } = await import('../client/entry-state')

const clientConfigMirror: Record<string, { value: unknown } | undefined> = {
  ...(webqqSettings as unknown as Record<string, { value: unknown }>),
  hiddenCapsuleActivityIds,
  debug,
}

type EntryPayload = Record<string, unknown>

// 主接缝：插件 apply + 内存 Console 替身，取控制台入口回调返回的 payload。
// 这一个接缝覆盖「Schema → 用户配置 → 下发 payload」整条链，不需要为可测性新增任何生产导出。
function readEntryPayload(config: Record<string, unknown> = {}): EntryPayload {
  const entries: Array<() => EntryPayload> = []
  const ctx = {
    on: () => {},
    before: () => {},
    setInterval: () => () => {},
    console: {
      addEntry: (_files: unknown, data?: () => EntryPayload) => {
        if (data) entries.push(data)
      },
      broadcast: () => {},
      addListener: () => {},
    },
    inject(services: Record<string, unknown>, callback: (inner: unknown) => void) {
      if ('console' in services) callback(ctx)
    },
  }

  apply(ctx as never, config as never)
  const payload = entries[0]?.()
  if (!payload) throw new Error('console entry data callback not registered')
  return payload
}

const defaultPayload = readEntryPayload()

// 全部配置项的键集从 Schema 运行时节点读，而不是从配置规格自己读：规格漏一项、Schema 多一项
// 都要能被这条守卫抓到，从规格取键集会让断言变成同义反复。
const schemaConfigKeys = (Config.list ?? []).flatMap((group) => Object.keys(group.dict ?? {}))
const nonMirroredConfigKeys = schemaConfigKeys.filter((key) => !(mirroredConfigKeys as string[]).includes(key))

describe('镜像配置项四端一致', () => {
  // 这条守卫测试就是配置规格存在的理由：在它之前，四端不一致只能靠 review 时人眼比对四个地方。
  it.each(mirroredConfigKeys)('%s 的配置规格、Schema、下发 payload、配置镜像四者一致', (key) => {
    const schemaDefaults = Config({}) as Record<string, unknown>
    const specDefault = readConfigDefault(key)
    const clientRef = clientConfigMirror[key]

    expect(clientRef, `配置镜像里没有 ${key} 这个 ref`).toBeDefined()
    expect(schemaDefaults[key]).toEqual(specDefault)
    expect(defaultPayload[key]).toEqual(specDefault)
    expect(clientRef?.value).toEqual(specDefault)
  })

  it('非镜像配置项既不下发也不出现在配置镜像里', () => {
    expect(nonMirroredConfigKeys.length).toBeGreaterThan(0)
    for (const key of nonMirroredConfigKeys) {
      expect(defaultPayload, `${key} 不是镜像配置项，不该下发`).not.toHaveProperty(key)
      expect(clientConfigMirror[key], `${key} 不是镜像配置项，不该出现在配置镜像里`).toBeUndefined()
    }
  })

  it('配置规格的镜像配置项清单与 Schema 的键集对得上', () => {
    expect(mirroredConfigKeys.every((key) => schemaConfigKeys.includes(key))).toBe(true)
    expect(schemaConfigKeys).toHaveLength(mirroredConfigKeys.length + nonMirroredConfigKeys.length)
  })
})

describe('下发 payload 由配置规格驱动', () => {
  it('好感度 scopeId 即使被显式配置也不下发', () => {
    expect(readEntryPayload({ webQQAffinityScopeId: 'scope-1' })).not.toHaveProperty('webQQAffinityScopeId')
  })

  it('payload 只包含配置镜像与胶囊、Bot 状态', () => {
    expect(Object.keys(defaultPayload).filter((key) => !schemaConfigKeys.includes(key)))
      .toEqual(['capsule', 'bots'])
  })
})

describe('下发 payload 的空值语义', () => {
  it('关掉默认开启的开关后 payload 保持关闭', () => {
    const payload = readEntryPayload({
      enableWebQQFrostedGlass: false,
      webQQTimBubbleTail: false,
      showWebQQCapsuleUnread: false,
      useCompactCapsuleShadow: false,
      hideWebQQGroupLevel: false,
    })

    expect(payload).toMatchObject({
      enableWebQQFrostedGlass: false,
      webQQTimBubbleTail: false,
      showWebQQCapsuleUnread: false,
      useCompactCapsuleShadow: false,
      hideWebQQGroupLevel: false,
    })
  })

  it('打开默认关闭的开关后 payload 保持打开', () => {
    expect(readEntryPayload({ enableWebQQSend: true, allowWebQQResize: true })).toMatchObject({
      enableWebQQSend: true,
      allowWebQQResize: true,
    })
  })

  it('枚举与颜色配置项留空时落各自默认值', () => {
    // 空字符串在服务端曾经被 `??` 保留、在前端被 `||` 兜成默认值，两侧行为不一致。
    // 现在由配置规格上的 blankIsUnset 标记统一规范化。
    const payload = readEntryPayload({
      webQQChatStyle: '',
      webQQColorMode: '',
      webQQAccentColor: '',
      webQQStorageBackend: '',
    })

    expect(payload).toMatchObject({
      webQQChatStyle: 'tim',
      webQQColorMode: 'auto',
      webQQAccentColor: '#2563eb',
      webQQStorageBackend: 'koishi',
    })
  })

  it('数值配置项的边界值不被替换成默认值', () => {
    expect(readEntryPayload({ webQQMessageCacheLimit: 1 })).toMatchObject({ webQQMessageCacheLimit: 1 })
    expect(readEntryPayload({ webQQMessageCacheLimit: 1000 })).toMatchObject({ webQQMessageCacheLimit: 1000 })
  })

  it('数组配置项清空后 payload 是空数组，而不是兜回默认值', () => {
    expect(readEntryPayload({ hiddenCapsuleActivityIds: [] })).toMatchObject({ hiddenCapsuleActivityIds: [] })
  })

  it('下发的数组是副本，改 payload 不会污染配置规格的默认值', () => {
    const payload = readEntryPayload()
    ;(payload.hiddenCapsuleActivityIds as string[]).push('sandbox')
    expect(readConfigDefault('hiddenCapsuleActivityIds')).toEqual(['logs'])
  })
})

// 前端把 payload 写进配置镜像时用的是同一个规格读取函数，因此空值语义在两侧必然一致。
// 这里以 payload 形状为输入直接断言规格的读取行为，不需要拉起组合根与任何组件。
describe('配置镜像写入时的空值语义', () => {
  it('payload 缺字段时落配置规格默认值', () => {
    expect(readConfigValue(undefined, 'webQQChatStyle')).toBe('tim')
    expect(readConfigValue({}, 'enableWebQQFrostedGlass')).toBe(true)
    expect(readConfigValue({ webQQAccentColor: null } as never, 'webQQAccentColor')).toBe('#2563eb')
  })

  it('payload 里的关闭值与边界值原样写入', () => {
    expect(readConfigValue({ enableWebQQFrostedGlass: false }, 'enableWebQQFrostedGlass')).toBe(false)
    expect(readConfigValue({ webQQMessageCacheLimit: 1 }, 'webQQMessageCacheLimit')).toBe(1)
    expect(readConfigValue({ hiddenCapsuleActivityIds: [] }, 'hiddenCapsuleActivityIds')).toEqual([])
  })

  it('标注 blankIsUnset 的配置项把空字符串视为未设置，其余配置项不受影响', () => {
    expect(readConfigValue({ webQQAccentColor: '' }, 'webQQAccentColor')).toBe('#2563eb')
    expect(readConfigValue({ webQQChatStyle: '' } as never, 'webQQChatStyle')).toBe('tim')
    expect(readConfigValue({ webQQColorMode: '' } as never, 'webQQColorMode')).toBe('auto')
    expect(readConfigValue({ webQQStorageBackend: '' } as never, 'webQQStorageBackend')).toBe('koishi')
  })
})
