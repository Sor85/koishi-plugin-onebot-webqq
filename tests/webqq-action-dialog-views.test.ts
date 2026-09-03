// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clickDialogContent,
  clickDialogOverlay,
  confirmRequests,
  dialogCancelButton,
  dialogConfirmButton,
  dialogDescriptionText,
  dialogInput,
  dialogLayers,
  dialogTitleText,
  lastConfirmRequest,
  mountWebQQActionDialog,
  mountWebQQConfirmDialog,
  openEvents,
  pressDialogEnter,
  pressDialogEscape,
  setDialogProps,
  settleDialog,
  submittedValues,
  trackUnhandledRejections,
  typeIntoDialog,
  unmountWebQQDialogs,
} from './helpers/webqq-action-dialogs'

vi.mock('@koishijs/client', () => ({
  useColorMode: () => ({ value: 'light' }),
}))

afterEach(() => {
  unmountWebQQDialogs()
})

describe('输入对话框', () => {
  it('打开时遮罩与内容同时存在，关闭时两者都不在', async () => {
    const wrapper = await mountWebQQActionDialog()
    expect(dialogLayers()).toEqual({ overlay: true, content: true })
    expect(dialogTitleText()).toBe('设置好友备注')

    await setDialogProps(wrapper, { open: false })
    expect(dialogLayers()).toEqual({ overlay: false, content: false })
  })

  it('打开时输入框预填初始值', async () => {
    await mountWebQQActionDialog({ value: '旧备注', placeholder: '留空可删除备注' })

    expect(dialogInput().element.value).toBe('旧备注')
    expect(dialogInput().attributes('placeholder')).toBe('留空可删除备注')
  })

  it('重开时刷新成最新初始值', async () => {
    const wrapper = await mountWebQQActionDialog({ value: '旧备注' })
    await typeIntoDialog('改了一半')

    await setDialogProps(wrapper, { open: false })
    await setDialogProps(wrapper, { value: '新备注' })
    await setDialogProps(wrapper, { open: true })

    expect(dialogInput().element.value).toBe('新备注')
  })

  it('打开期间外部改初始值会同步进输入框', async () => {
    const wrapper = await mountWebQQActionDialog({ value: '旧备注' })

    await setDialogProps(wrapper, { value: '服务端回填的备注' })

    expect(dialogInput().element.value).toBe('服务端回填的备注')
  })

  it('回车提交并带上当前输入值', async () => {
    const wrapper = await mountWebQQActionDialog({ value: '旧备注' })

    await typeIntoDialog('新备注')
    await pressDialogEnter()

    expect(submittedValues(wrapper)).toEqual([['新备注']])
  })

  it('点确认按钮提交，同样带上当前输入值', async () => {
    const wrapper = await mountWebQQActionDialog({ value: '旧备注' })

    await typeIntoDialog('新备注')
    await dialogConfirmButton().trigger('click')
    await settleDialog()

    expect(submittedValues(wrapper)).toEqual([['新备注']])
  })

  it('点取消只发出关闭，不发出确认', async () => {
    const wrapper = await mountWebQQActionDialog({ value: '旧备注' })

    await typeIntoDialog('不想改了')
    await dialogCancelButton().trigger('click')
    await settleDialog()

    expect(openEvents(wrapper)).toEqual([[false]])
    expect(submittedValues(wrapper)).toEqual([])
  })

  it('按 Escape 关闭', async () => {
    const wrapper = await mountWebQQActionDialog()

    await pressDialogEscape()

    expect(openEvents(wrapper)).toEqual([[false]])
  })

  it('点遮罩关闭，点内容不关', async () => {
    const wrapper = await mountWebQQActionDialog()

    await clickDialogContent()
    expect(openEvents(wrapper)).toEqual([])

    await clickDialogOverlay()
    expect(openEvents(wrapper)).toEqual([[false]])
  })

  it('确认按钮文案默认「保存」，传入时用传入的', async () => {
    const wrapper = await mountWebQQActionDialog()
    expect(dialogConfirmButton().text()).toBe('保存')

    await setDialogProps(wrapper, { confirmText: '设置头衔' })
    expect(dialogConfirmButton().text()).toBe('设置头衔')
  })
})

describe('确认对话框', () => {
  it('处理中两个按钮都禁用，且确认按钮文案变「处理中...」', async () => {
    const wrapper = await mountWebQQConfirmDialog({ confirmText: '删除好友' })
    expect(dialogDescriptionText()).toBe('确定删除好友「Alice」？')
    expect(dialogConfirmButton().text()).toBe('删除好友')

    await dialogConfirmButton().trigger('click')
    await settleDialog()

    expect(confirmRequests(wrapper)).toHaveLength(1)
    expect(dialogConfirmButton().text()).toBe('处理中...')
    expect(dialogConfirmButton().element.hasAttribute('disabled')).toBe(true)
    expect(dialogCancelButton().element.hasAttribute('disabled')).toBe(true)
    expect(openEvents(wrapper)).toEqual([])
  })

  it('动作成功后关闭', async () => {
    const wrapper = await mountWebQQConfirmDialog({ confirmText: '删除好友' })

    await dialogConfirmButton().trigger('click')
    lastConfirmRequest(wrapper)[0]()
    await settleDialog()

    expect(openEvents(wrapper)).toEqual([[false]])
  })

  it('动作失败后保持打开、按钮恢复可用，且不产生未处理的 promise rejection', async () => {
    const rejections = trackUnhandledRejections()
    const wrapper = await mountWebQQConfirmDialog({ confirmText: '删除好友' })

    await dialogConfirmButton().trigger('click')
    lastConfirmRequest(wrapper)[1](new Error('删除好友失败'))
    await settleDialog()

    expect(openEvents(wrapper)).toEqual([])
    expect(dialogLayers()).toEqual({ overlay: true, content: true })
    expect(dialogConfirmButton().text()).toBe('删除好友')
    expect(dialogConfirmButton().element.hasAttribute('disabled')).toBe(false)
    expect(dialogCancelButton().element.hasAttribute('disabled')).toBe(false)
    expect(await rejections.collect()).toEqual([])
  })

  it('处理中再点确认不会二次提交', async () => {
    const wrapper = await mountWebQQConfirmDialog({ confirmText: '踢出群组' })

    // 同一轮内连点：DOM 还没打上 disabled，拦住第二次的只有组件自己的提交态判断。
    const confirmButton = dialogConfirmButton()
    confirmButton.element.click()
    confirmButton.element.click()
    await settleDialog()

    expect(confirmRequests(wrapper)).toHaveLength(1)
  })

  it('每次打开把提交态重置，上次失败后重开不会还卡在「处理中...」', async () => {
    const wrapper = await mountWebQQConfirmDialog({ confirmText: '删除好友' })

    // 宿主一次都没回话就被关掉：提交态只能靠打开时的重置放下。
    await dialogConfirmButton().trigger('click')
    expect(dialogConfirmButton().text()).toBe('处理中...')

    await setDialogProps(wrapper, { open: false })
    await setDialogProps(wrapper, { open: true })

    expect(dialogConfirmButton().text()).toBe('删除好友')
    expect(dialogConfirmButton().element.hasAttribute('disabled')).toBe(false)
    expect(dialogCancelButton().element.hasAttribute('disabled')).toBe(false)
  })
})
