import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { consoleBroadcastNames, consoleRequestNames } from '../src/shared/console-contract'
import { createFakeContext, emitAll } from './helpers/koishi-context'

// 与 tests/config-mirror.test.ts 同理：koishi 的包入口在 vitest 的 ESM 环境里加载不起来，
// 但服务端只从 koishi 取 Schema 这一个运行时值，而 koishi.Schema 就是 schemastery 本身。
vi.mock('koishi', async () => ({ Schema: (await import('schemastery')).default }))

const plugin = await import('../src')

// 编译期能抓住「注册了但契约里没有」，抓不住反方向：addListener 的类型参数只约束「你注册的名字
// 必须在契约里」，不约束「契约里的名字你都得注册」。多写一条声明就变成一个死名字——今天完全静默。
// 这一格由本文件填。
//
// 每一端独立读取，不从契约派生两边：注册那一端从实际注册调用读，广播那一端从实际广播调用读。
// 两边都从权威取键集会让断言变成同义反复（配置镜像那份四端守卫的注释里写着这条教训）。
describe('控制台契约的请求端', () => {
  function readRegisteredRequestNames() {
    const { ctx, addListener } = createFakeContext()
    plugin.apply(ctx)
    return addListener.mock.calls.map(([event]) => event as string)
  }

  it('契约声明的每条请求都被注册，且没有注册契约之外的名字', () => {
    const registered = readRegisteredRequestNames()

    expect(consoleRequestNames.length).toBeGreaterThan(0)
    expect([...registered].sort()).toEqual([...consoleRequestNames].sort())
  })

  it('同一条请求不会被注册两次', () => {
    const registered = readRegisteredRequestNames()

    expect(registered).toHaveLength(new Set(registered).size)
  })

  it('注册点不在常规注册 module 里的那条请求也被覆盖', () => {
    // 选择机器人注册在 WebQQ 装配 module 而不是常规的注册 module，因为它要用那里的读状态与
    // 广播状态两个局部函数。守卫走的是完整 apply，因此两个 module 的注册都会被记下；漏掉这个
    // 唯一的例外就等于没守，而那正是这类断言最容易骗过自己的地方。
    expect(readRegisteredRequestNames()).toContain('onebot-webqq/webqq/bot/select')
  })

  it('广播名不出现在请求注册里', () => {
    // 请求与广播是两个方向，方向由契约的两个 interface 表达。任一个广播名被当成请求注册，
    // 说明有人把方向搞反了——那条广播随后就再也不会到达前端。
    const registered = new Set(readRegisteredRequestNames())

    for (const name of consoleBroadcastNames) {
      expect(registered.has(name), `${name} 是广播，不该被注册成请求`).toBe(false)
    }
  })
})

// 驱动广播用的最小 OneBot 群会话骨架。webqq-live-runtime.test.ts 里那份**刻意**不给 bot.internal
// （见它自己的注释：给了之后落地最后一步会去拉群成员元数据并可能再广播一次）；这里正相反，走的是
// 完整 apply，缺了 internal 联系人与历史那两条路就跑不起来。两份的差异是有意的，不要合并。
function createOneBotBot() {
  return {
    platform: 'onebot',
    selfId: '10000',
    status: 1,
    internal: {
      get_group_list: vi.fn(async () => []),
      get_group_msg_history: vi.fn(async () => ({ messages: [] })),
    },
    toJSON: () => ({ user: { name: '彩虹猫', avatar: 'https://example.com/avatar.png' } }),
  }
}

function createGroupSession(bot: unknown, timestamp: number, event: Record<string, unknown>) {
  return {
    platform: 'onebot',
    selfId: '10000',
    channelId: '20000',
    userId: '30000',
    username: 'Alice',
    timestamp,
    bot,
    event: {
      platform: 'onebot',
      timestamp,
      guild: { id: '20000', name: 'Guild Name' },
      channel: { id: '20000', name: 'Guild Name' },
      ...event,
    },
  }
}

describe('控制台契约的广播端', () => {
  it('契约声明的每条广播都有 broadcaster', async () => {
    const bot = createOneBotBot()
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    // 四条广播分别挂在不同的运行时路径上：Bot 生命周期事件推小胶囊快照与机器人状态，
    // 消息落地推实时消息，撤回事件推撤回。全部走真实事件，不直接调用任何 broadcaster。
    await emitAll(listeners['login-added'])
    await emitAll(listeners.message, createGroupSession(bot, 1710000001000, {
      user: { id: '30000', name: 'Alice' },
      message: { id: 'new-1', elements: [{ type: 'text', attrs: { content: 'hello' } }] },
    }))
    await emitAll(listeners['message-deleted'], createGroupSession(bot, 1710000002000, {
      operator: { id: '30000', name: 'Alice' },
      message: { id: 'new-1' },
    }))

    // 从实际广播调用读，不从契约反推。少一条 broadcaster 时前端那一头完全静默：没有报错也没有
    // 失败提示，只是实时消息不再出现、小胶囊计数停在旧值，看起来像机器人掉线了。
    const broadcasted = new Set(broadcast.mock.calls.map(([event]) => event))

    expect(consoleBroadcastNames.length).toBeGreaterThan(0)
    for (const name of consoleBroadcastNames) {
      expect(broadcasted.has(name), `${name} 声明在契约里但没有 broadcaster`).toBe(true)
    }
  })

  it('没有广播契约之外的名字', async () => {
    const bot = createOneBotBot()
    const { ctx, listeners, broadcast } = createFakeContext({ bots: [bot] })

    plugin.apply(ctx)
    await emitAll(listeners['login-added'])
    await emitAll(listeners.message, createGroupSession(bot, 1710000001000, {
      user: { id: '30000', name: 'Alice' },
      message: { id: 'new-1', elements: [{ type: 'text', attrs: { content: 'hello' } }] },
    }))

    const broadcasted = [...new Set(broadcast.mock.calls.map(([event]) => event))]

    expect(broadcasted.filter((name) => !(consoleBroadcastNames as readonly string[]).includes(name))).toEqual([])
  })
})

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const moduleSourceExtensions = ['.ts', '.d.ts', '.vue']
// 整行注释先去掉再抽 import：领域注释里会提到相对路径，留着就可能把注释里的路径当成真实的边。
// 只去整行注释，不去行尾注释——后者会误伤 'https://…' 这类字符串，抽不到真实的边比多抽一条更糟。
const commentLinePattern = /^\s*(?:\/\/|\/\*|\*)/
// `from '…'`、`import '…'`、`import('…')` 与 import 类型四种写法都要抽到；引号是必需的，
// 所以「import 边」这样的中文注释即使漏过上一步也不会被当成一条边。
const importPattern = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g
// ADR 0003：跨端 module 及其闭包不得引用 koishi。破坏这条规矩时构建不报错，只能靠翻产物发现——
// 前端 vite 构建的 external 不含 koishi，也不含 @koishijs/console，两者都会被整包打进浏览器产物。
const forbiddenCrossEndImportPattern = /^(?:koishi(?:\/|$)|@koishijs\/(?!client))/

function readSourceWithoutCommentLines(file: string) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !commentLinePattern.test(line))
    .join('\n')
}

function readImportSpecifiers(file: string) {
  return [...readSourceWithoutCommentLines(file).matchAll(importPattern)].map((match) => match[1])
}

function resolveModuleFile(fromFile: string, specifier: string) {
  const base = resolve(dirname(fromFile), specifier.replace(/\?.*$/, ''))
  // 目录名必须落到 index.ts 上：`'../config'` 这种写法的 base 本身是个存在的目录，按存在与否取
  // 就会把目录当成模块文件，读它会直接抛 EISDIR，闭包连一条边都走不完。
  const candidates = [base, ...moduleSourceExtensions.map((ext) => base + ext), join(base, 'index.ts')]
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = join(dir, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(child)
    return moduleSourceExtensions.some((ext) => entry.name.endsWith(ext)) ? [child] : []
  })
}

const serverDir = join(repoRoot, 'src')

/** 客户端指向 src 的那些 import 边——跨端共享 module 的入口就是它们。 */
function readCrossEndRoots() {
  const roots = new Set<string>()
  for (const file of collectSourceFiles(join(repoRoot, 'client'))) {
    for (const specifier of readImportSpecifiers(file)) {
      if (!specifier.startsWith('.')) continue
      const target = resolveModuleFile(file, specifier)
      if (target?.startsWith(serverDir)) roots.add(target)
    }
  }
  return [...roots]
}

/** 从这些 module 出发做 import 闭包，顺带记下每个非相对 import 是谁引的。 */
function readCrossEndClosure(roots: string[]) {
  const visited = new Set<string>()
  const externalEdges: Array<{ file: string; specifier: string }> = []
  const queue = [...roots]
  while (queue.length) {
    const file = queue.pop()!
    if (visited.has(file)) continue
    visited.add(file)
    for (const specifier of readImportSpecifiers(file)) {
      if (!specifier.startsWith('.')) {
        externalEdges.push({ file: relative(repoRoot, file), specifier })
        continue
      }
      const target = resolveModuleFile(file, specifier)
      // 解析不了就当成一条未知的边报出来，而不是静默跳过：静默跳过等于闭包漏了一块。
      expect(target, `${relative(repoRoot, file)} 的 import ${specifier} 解析不到文件`).toBeDefined()
      if (target) queue.push(target)
    }
  }
  return { files: [...visited].map((file) => relative(repoRoot, file)).sort(), externalEdges }
}

// 全部跨端 import 边的目标。清单写在这里而不是只挑几条断言：门面哪天不再 re-export，那条根就
// 会从闭包里无声消失，守卫覆盖的范围随之缩小而测试照样通过——正是本轮在消灭的那类静默失效。
// 增删这份清单等于动 ADR 0003 那条明线，应当是一次自觉的决定，所以按相等而不是包含来断言。
const expectedCrossEndRoots = [
  'src/capsule/state/types.ts',
  'src/config/spec.ts',
  'src/onebot/types.ts',
  'src/shared/console-contract.ts',
  'src/webqq/message-search.ts',
  'src/webqq/types.ts',
]

describe('跨端共享 module 的 import 闭包不沾 koishi', () => {
  const roots = readCrossEndRoots()
  const closure = readCrossEndClosure(roots)

  it('跨端 import 边就是清单里那几条', () => {
    // 找不到根就等于什么都没守，这条断言让「守卫悄悄退化成空集」变成一次失败。
    expect(roots.map((file) => relative(repoRoot, file)).sort()).toEqual(expectedCrossEndRoots)
  })

  it('闭包里没有 koishi 边', () => {
    // 读源码而不是读构建产物：读产物要求先跑 yarn build，`yarn test` 单跑时产物可能是旧的或
    // 干脆不存在，做成「产物不存在就跳过」等于在最需要它的时候静默失效。
    expect(closure.files.length).toBeGreaterThan(roots.length)
    expect(closure.externalEdges.filter(({ specifier }) => forbiddenCrossEndImportPattern.test(specifier)))
      .toEqual([])
  })
})
