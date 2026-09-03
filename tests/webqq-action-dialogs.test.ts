import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useWebQQActionDialogs } from '../client/webqq/stores/webqq-action-dialogs'

/** 编排里一次提交要跨一个 await；用微任务轮次推进即可。 */
async function settle(rounds = 4) {
  for (let round = 0; round < rounds; round++) await Promise.resolve()
}

function createDialogsHarness() {
  const errorText = ref('')
  const dialogs = useWebQQActionDialogs({ errorText })
  return { errorText, dialogs }
}

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

function createDeferred(): Deferred {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((resolveAction, rejectAction) => {
    resolve = resolveAction
    reject = rejectAction
  })
  return { promise, resolve, reject }
}

/** 组件那半的完成协议：确认对话框把 resolve / reject 交回编排。 */
function createConfirmChannel() {
  const settled: string[] = []
  return {
    settled,
    resolve: () => { settled.push('resolve') },
    reject: (error: unknown) => { settled.push(`reject:${(error as Error).message}`) },
  }
}

describe('二级面对话框编排', () => {
  it('对外只暴露两份 spec、两个开关、两个打开函数与两个提交函数', () => {
    const { dialogs } = createDialogsHarness()
    expect(Object.keys(dialogs)).toEqual([
      'actionDialogSpec',
      'confirmDialogSpec',
      'actionDialogOpen',
      'confirmDialogOpen',
      'openActionDialog',
      'openConfirmDialog',
      'confirmActionDialog',
      'confirmDestructiveAction',
    ])
  })

  it('打开输入对话框后 spec 在场，开关随之为真', () => {
    const { dialogs } = createDialogsHarness()
    expect(dialogs.actionDialogSpec.value).toBeUndefined()
    expect(dialogs.actionDialogOpen.value).toBe(false)

    dialogs.openActionDialog({
      title: '设置好友备注',
      value: '旧备注',
      submit: () => {},
    })

    expect(dialogs.actionDialogSpec.value?.title).toBe('设置好友备注')
    expect(dialogs.actionDialogSpec.value?.value).toBe('旧备注')
    expect(dialogs.actionDialogOpen.value).toBe(true)
  })

  it('输入型提交把值交给该 spec 的回调，并立刻清空 spec', () => {
    const { dialogs } = createDialogsHarness()
    const submitted: string[] = []
    dialogs.openActionDialog({ title: '修改群名片', submit: (value) => { submitted.push(value) } })

    dialogs.confirmActionDialog('新名片')

    expect(submitted).toEqual(['新名片'])
    expect(dialogs.actionDialogSpec.value).toBeUndefined()
    expect(dialogs.actionDialogOpen.value).toBe(false)
  })

  it('输入型提交后立即关闭，不等回调完成', async () => {
    const { dialogs } = createDialogsHarness()
    const pending = createDeferred()
    dialogs.openActionDialog({ title: '设置专属头衔', submit: () => pending.promise })

    dialogs.confirmActionDialog('群主')

    expect(dialogs.actionDialogOpen.value).toBe(false)
    pending.resolve()
    await settle()
    expect(dialogs.actionDialogOpen.value).toBe(false)
  })

  it('输入型回调抛错时错误落进注入的引用', async () => {
    const harness = createDialogsHarness()
    harness.dialogs.openActionDialog({
      title: '设置好友备注',
      submit: async () => { throw new Error('设置好友备注失败') },
    })

    harness.dialogs.confirmActionDialog('新备注')
    await settle()

    expect(harness.errorText.value).toBe('设置好友备注失败')
  })

  it('回调抛出无文案的错误时兜底为「操作失败」', async () => {
    const harness = createDialogsHarness()
    harness.dialogs.openActionDialog({ title: '修改群名片', submit: async () => { throw new Error('') } })
    harness.dialogs.confirmActionDialog('新名片')
    await settle()
    expect(harness.errorText.value).toBe('操作失败')

    harness.errorText.value = ''
    harness.dialogs.openConfirmDialog({
      title: '踢出群组',
      description: '确定将「Bob」移出本群？',
      confirmText: '踢出群组',
      submit: async () => { throw new Error('') },
    })
    const channel = createConfirmChannel()
    harness.dialogs.confirmDestructiveAction(channel.resolve, channel.reject)
    await settle()

    expect(harness.errorText.value).toBe('操作失败')
  })

  it('确认型动作成功才 resolve、才清 spec', async () => {
    const { dialogs } = createDialogsHarness()
    const pending = createDeferred()
    const channel = createConfirmChannel()
    dialogs.openConfirmDialog({
      title: '删除好友',
      description: '确定删除好友「Alice」？',
      confirmText: '删除好友',
      submit: () => pending.promise,
    })

    dialogs.confirmDestructiveAction(channel.resolve, channel.reject)
    await settle()
    // 动作还在跑：既不能回话，也不能把 spec 收掉。
    expect(channel.settled).toEqual([])
    expect(dialogs.confirmDialogSpec.value?.title).toBe('删除好友')

    pending.resolve()
    await settle()

    expect(channel.settled).toEqual(['resolve'])
    expect(dialogs.confirmDialogSpec.value).toBeUndefined()
    expect(dialogs.confirmDialogOpen.value).toBe(false)
  })

  it('确认型动作失败时 reject、错误落进引用，spec 仍在场可重试', async () => {
    const harness = createDialogsHarness()
    const attempts: number[] = []
    let attempt = 0
    harness.dialogs.openConfirmDialog({
      title: '删除好友',
      description: '确定删除好友「Alice」？',
      confirmText: '删除好友',
      submit: async () => {
        attempts.push(++attempt)
        if (attempt === 1) throw new Error('删除好友失败')
      },
    })

    const failed = createConfirmChannel()
    harness.dialogs.confirmDestructiveAction(failed.resolve, failed.reject)
    await settle()

    expect(failed.settled).toEqual(['reject:删除好友失败'])
    expect(harness.errorText.value).toBe('删除好友失败')
    expect(harness.dialogs.confirmDialogSpec.value?.title).toBe('删除好友')
    expect(harness.dialogs.confirmDialogOpen.value).toBe(true)

    const retried = createConfirmChannel()
    harness.dialogs.confirmDestructiveAction(retried.resolve, retried.reject)
    await settle()

    expect(attempts).toEqual([1, 2])
    expect(retried.settled).toEqual(['resolve'])
    expect(harness.dialogs.confirmDialogSpec.value).toBeUndefined()
  })

  it('关闭两类对话框都清掉 spec 与提交回调', () => {
    const { dialogs } = createDialogsHarness()
    dialogs.openActionDialog({ title: '设置好友备注', submit: () => {} })
    dialogs.openConfirmDialog({ title: '删除好友', description: '确定删除好友「Alice」？', confirmText: '删除好友', submit: async () => {} })

    dialogs.actionDialogOpen.value = false
    dialogs.confirmDialogOpen.value = false

    expect(dialogs.actionDialogSpec.value).toBeUndefined()
    expect(dialogs.confirmDialogSpec.value).toBeUndefined()
  })

  it('关闭后再提交调不到上一次的回调', async () => {
    const harness = createDialogsHarness()
    const submitted: string[] = []
    const confirmed: string[] = []
    harness.dialogs.openActionDialog({ title: '修改群名片', submit: (value) => { submitted.push(value) } })
    harness.dialogs.openConfirmDialog({
      title: '踢出群组',
      description: '确定将「Bob」移出本群？',
      confirmText: '踢出群组',
      submit: async () => { confirmed.push('踢出群组') },
    })

    // 取消、Escape、点遮罩三条关闭路径都走这个开关的 setter。
    harness.dialogs.actionDialogOpen.value = false
    harness.dialogs.confirmDialogOpen.value = false

    const channel = createConfirmChannel()
    harness.dialogs.confirmActionDialog('已经作废的名片')
    harness.dialogs.confirmDestructiveAction(channel.resolve, channel.reject)
    await settle()

    expect(submitted).toEqual([])
    expect(confirmed).toEqual([])
    expect(harness.errorText.value).toBe('')
  })

  it('两类对话框先后打开互不干扰', async () => {
    const harness = createDialogsHarness()
    const submitted: string[] = []
    const confirmed: string[] = []
    harness.dialogs.openActionDialog({ title: '设置专属头衔', value: '旧头衔', submit: (value) => { submitted.push(value) } })
    harness.dialogs.openConfirmDialog({
      title: '退出群组',
      description: '确定退出群「测试群」？',
      confirmText: '退出群组',
      submit: async () => { confirmed.push('退出群组') },
    })

    expect(harness.dialogs.actionDialogOpen.value).toBe(true)
    expect(harness.dialogs.confirmDialogOpen.value).toBe(true)

    const channel = createConfirmChannel()
    harness.dialogs.confirmDestructiveAction(channel.resolve, channel.reject)
    await settle()

    expect(confirmed).toEqual(['退出群组'])
    expect(channel.settled).toEqual(['resolve'])
    expect(harness.dialogs.confirmDialogSpec.value).toBeUndefined()
    // 确认型走完一整轮，输入型那半必须原样在场。
    expect(harness.dialogs.actionDialogSpec.value?.title).toBe('设置专属头衔')
    expect(harness.dialogs.actionDialogOpen.value).toBe(true)

    harness.dialogs.confirmActionDialog('新头衔')
    await settle()

    expect(submitted).toEqual(['新头衔'])
    expect(harness.errorText.value).toBe('')
  })
})
