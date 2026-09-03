import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineCrossInstanceState } from '../client/shared/cross-instance-state'

// 这一组断言要重置整个模块图。放进那些在顶层 import 五份共享状态、并依赖它们实例的测试文件里，
// 会引入测试间的顺序耦合，因此单独成文件。
const scope = globalThis as typeof globalThis & Record<string, unknown>
const usedKeys = new Set<string>()

function takeKey(name: string) {
  const key = `__onebot_webqq_cross_instance_state_test_${name}__`
  usedKeys.add(key)
  return key
}

afterEach(() => {
  for (const key of usedKeys) delete scope[key]
  usedKeys.clear()
})

describe('跨模块实例共享状态', () => {
  it('重置模块缓存后重新 import，拿到的引用还是同一个对象', async () => {
    const key = takeKey('reimport')
    const state = defineCrossInstanceState(key, () => ({ value: 'first' }))

    vi.resetModules()
    const reloaded = await import('../client/shared/cross-instance-state')
    // 先确认模块图真的换了实例，否则下一条断言会退化成同一份闭包的自反断言。
    expect(reloaded.defineCrossInstanceState).not.toBe(defineCrossInstanceState)

    expect(reloaded.defineCrossInstanceState(key, () => ({ value: 'second' }))).toBe(state)
  })

  it('同一个键第二次调用不重新执行工厂', () => {
    const key = takeKey('factory-once')
    const create = vi.fn(() => ({ value: 'first' }))

    const first = defineCrossInstanceState(key, create)
    first.value = 'written'
    const second = defineCrossInstanceState(key, create)

    expect(second).toBe(first)
    expect(second.value).toBe('written')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('不同键互不干扰', () => {
    const entryKey = takeKey('entry')
    const capsuleKey = takeKey('capsule')

    const entry = defineCrossInstanceState(entryKey, () => ({ value: 'entry' }))
    const capsule = defineCrossInstanceState(capsuleKey, () => ({ value: 'capsule' }))

    expect(capsule).not.toBe(entry)
    expect(entry.value).toBe('entry')
    expect(capsule.value).toBe('capsule')
  })

  it('键挂在全局对象上，名字与传入的字面量一致', () => {
    const key = takeKey('global-key')
    const state = defineCrossInstanceState(key, () => ({ value: 'global' }))

    // 排查时要能在浏览器里按这个名字直接找到状态，因此 module 不许改写传入的键。
    expect(scope[key]).toBe(state)
  })
})
