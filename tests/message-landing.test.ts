import { describe, expect, it, vi } from 'vitest'
import type { Session } from 'koishi'
import { createMessageLanding } from '../src/message-landing'

// **消息落地**的次序由这里的假实现按调用与完成两类事件证明，生产代码不返回步骤清单（ADR 0009）。
//
// 只记调用抓不到真正的回归：前两步是同步调用、后两步是 `await`，删掉其中一个 `await` 不会改变
// 调用次序数组，而那恰恰是最可能出的错。记下完成之后，删 `await` 会让后一步的开始跑到前一步的
// 完成之前，事件序列立刻不同。

const landingEvents = {
  gate: 'gate',
  diagnostics: 'diagnostics',
  noteBotActivity: 'note-bot-activity',
  recordIncomingMessage: 'record-incoming-message',
  liveMessageStart: 'live-message:start',
  liveMessageDone: 'live-message:done',
  idleScheduleStart: 'idle-schedule:start',
  idleScheduleDone: 'idle-schedule:done',
} as const

function createDeferred() {
  let resolve = () => {}
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/**
 * 会话替身。
 *
 * `hidden` 做成 getter 是为了记下门禁那一步：门禁不是注入的依赖，它唯一的可观察痕迹就是
 * 读这个字段（`isVisibleBotSession` 两条分支都先读 `hidden`）。
 */
function createLandingSession(options: {
  events: string[]
  selfId?: string
  hidden?: boolean
  platform?: string
}) {
  const selfId = options.selfId ?? '10000'
  return {
    selfId,
    bot: {
      platform: options.platform ?? 'onebot',
      selfId,
      get hidden() {
        options.events.push(landingEvents.gate)
        return options.hidden === true
      },
    },
  } as unknown as Session
}

function createLandingHarness(options: { includeVirtualBots?: boolean; withDiagnostics?: boolean } = {}) {
  const events: string[] = []
  const liveMessage = createDeferred()
  const idleSchedule = createDeferred()
  const noteBotActivity = vi.fn((_selfId: string) => {
    events.push(landingEvents.noteBotActivity)
  })
  const recordIncomingMessage = vi.fn((_session: Session) => {
    events.push(landingEvents.recordIncomingMessage)
  })
  const recordWebQQLiveMessage = vi.fn(async (_session: Session) => {
    events.push(landingEvents.liveMessageStart)
    await liveMessage.promise
    events.push(landingEvents.liveMessageDone)
  })
  const refreshIdleScheduleActivity = vi.fn(async (_source: string, _session: Session) => {
    events.push(landingEvents.idleScheduleStart)
    await idleSchedule.promise
    events.push(landingEvents.idleScheduleDone)
  })
  const logMessageObserved = vi.fn((_session: Session) => {
    events.push(landingEvents.diagnostics)
  })
  const landMessage = createMessageLanding({
    botScope: options.includeVirtualBots ? { includeVirtualBots: true } : {},
    noteBotActivity,
    recordIncomingMessage,
    recordWebQQLiveMessage,
    refreshIdleScheduleActivity,
    ...(options.withDiagnostics === false ? {} : { logMessageObserved }),
  })
  return {
    events,
    landMessage,
    liveMessage,
    idleSchedule,
    noteBotActivity,
    recordIncomingMessage,
    recordWebQQLiveMessage,
    refreshIdleScheduleActivity,
    logMessageObserved,
  }
}

/** 让已经排好的微任务跑完，但不推进任何 deferred。 */
async function settle() {
  for (let index = 0; index < 8; index++) await Promise.resolve()
}

describe('消息落地扇出', () => {
  it('按门禁、诊断日志、四步的次序落地，且上一步完成后才开始下一步', async () => {
    const probe = createLandingHarness()
    const events = probe.events
    let landed = false

    const landing = probe.landMessage(createLandingSession({ events })).then(() => {
      landed = true
    })
    await settle()

    // 后两步都还挂在 deferred 上：此刻停下来正好证明第四步没有和第三步并发开始。
    expect(events).toEqual([
      landingEvents.gate,
      landingEvents.diagnostics,
      landingEvents.noteBotActivity,
      landingEvents.recordIncomingMessage,
      landingEvents.liveMessageStart,
    ])
    expect(probe.refreshIdleScheduleActivity).not.toHaveBeenCalled()

    probe.liveMessage.resolve()
    await settle()

    expect(events).toEqual([
      landingEvents.gate,
      landingEvents.diagnostics,
      landingEvents.noteBotActivity,
      landingEvents.recordIncomingMessage,
      landingEvents.liveMessageStart,
      landingEvents.liveMessageDone,
      landingEvents.idleScheduleStart,
    ])
    // 最后一步没有下一步可以观察，因此这条不变量落在返回的 promise 上：它必须等第四步做完。
    expect(landed).toBe(false)

    probe.idleSchedule.resolve()
    await landing

    expect(landed).toBe(true)
    expect(events).toEqual([
      landingEvents.gate,
      landingEvents.diagnostics,
      landingEvents.noteBotActivity,
      landingEvents.recordIncomingMessage,
      landingEvents.liveMessageStart,
      landingEvents.liveMessageDone,
      landingEvents.idleScheduleStart,
      landingEvents.idleScheduleDone,
    ])
  })

  it('第一步拿到的是会话的 selfId，空闲日程拿到的是消息来源', async () => {
    const probe = createLandingHarness()
    const session = createLandingSession({ events: probe.events, selfId: '10086' })

    probe.liveMessage.resolve()
    probe.idleSchedule.resolve()
    const result = await probe.landMessage(session)

    expect(probe.noteBotActivity).toHaveBeenCalledWith('10086')
    expect(probe.recordIncomingMessage).toHaveBeenCalledWith(session)
    expect(probe.recordWebQQLiveMessage).toHaveBeenCalledWith(session)
    expect(probe.refreshIdleScheduleActivity).toHaveBeenCalledWith('message-schedule', session)
    // ADR 0009：落地不对外交代「我依次做了什么」。次序由上面那条事件序列断言承担。
    expect(result).toBeUndefined()
  })

  it('隐藏 Bot 的会话被门禁挡掉，四步一个都不执行', async () => {
    const probe = createLandingHarness()

    probe.liveMessage.resolve()
    probe.idleSchedule.resolve()
    await probe.landMessage(createLandingSession({ events: probe.events, hidden: true }))

    expect(probe.events).toEqual([landingEvents.gate])
    expect(probe.logMessageObserved).not.toHaveBeenCalled()
    expect(probe.noteBotActivity).not.toHaveBeenCalled()
    expect(probe.recordIncomingMessage).not.toHaveBeenCalled()
    expect(probe.recordWebQQLiveMessage).not.toHaveBeenCalled()
    expect(probe.refreshIdleScheduleActivity).not.toHaveBeenCalled()
  })

  it('纳入虚拟机器人时判据反转：只有虚拟机器人的事件能进', async () => {
    const virtual = createLandingHarness({ includeVirtualBots: true })
    virtual.liveMessage.resolve()
    virtual.idleSchedule.resolve()
    await virtual.landMessage(createLandingSession({ events: virtual.events, hidden: true }))

    expect(virtual.noteBotActivity).toHaveBeenCalledTimes(1)
    expect(virtual.refreshIdleScheduleActivity).toHaveBeenCalledTimes(1)

    // 真实群的消息不进模拟环境，否则一边只列虚拟机器人、一边继续把真实消息推进观察窗。
    const real = createLandingHarness({ includeVirtualBots: true })
    real.liveMessage.resolve()
    real.idleSchedule.resolve()
    await real.landMessage(createLandingSession({ events: real.events }))

    expect(real.events).toEqual([landingEvents.gate])
    expect(real.noteBotActivity).not.toHaveBeenCalled()
  })

  it('诊断回调未提供时四步照常执行', async () => {
    const probe = createLandingHarness({ withDiagnostics: false })

    probe.liveMessage.resolve()
    probe.idleSchedule.resolve()
    await probe.landMessage(createLandingSession({ events: probe.events }))

    expect(probe.events).toEqual([
      landingEvents.gate,
      landingEvents.noteBotActivity,
      landingEvents.recordIncomingMessage,
      landingEvents.liveMessageStart,
      landingEvents.liveMessageDone,
      landingEvents.idleScheduleStart,
      landingEvents.idleScheduleDone,
    ])
  })
})
