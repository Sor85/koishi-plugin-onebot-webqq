// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  editingProfileCardFields,
  emojiPickerPage,
  emojiPickerSearchInput,
  mountWebQQEmojiPicker,
  mountWebQQProfileCard,
  openEvents,
  pointerDownOutsidePortalPage,
  pressEscapeOn,
  pressEscapeOnBody,
  profileCardFieldEditor,
  profileCardPage,
  setPortalPageProps,
  startProfileCardFieldEdit,
  trackWindowKeydown,
  unmountWebQQPortalPages,
} from './helpers/webqq-portal-pages'

vi.mock('@koishijs/client', () => ({
  useColorMode: () => ({ value: 'light' }),
  withProxy: (url: string) => url,
}))

afterEach(() => {
  unmountWebQQPortalPages()
})

describe('资料卡的 Escape', () => {
  it('没有字段处于编辑态时，Escape 关闭面板', async () => {
    const wrapper = await mountWebQQProfileCard()
    expect(profileCardPage()).not.toBeNull()

    await pressEscapeOnBody()

    expect(openEvents(wrapper)).toEqual([[false]])
  })

  it('Escape 关闭与点面板外面关闭发出同一个对外事件', async () => {
    const escaped = await mountWebQQProfileCard()
    await pressEscapeOnBody()
    // 宿主收到关闭会把 open 落下来；不落下来这张卡还在场，后面那次点外面会被它一起收到。
    await setPortalPageProps(escaped, { open: false })

    const pointed = await mountWebQQProfileCard()
    await pointerDownOutsidePortalPage()

    expect(openEvents(escaped)).toEqual([[false]])
    expect(openEvents(escaped)).toEqual(openEvents(pointed))
  })

  it('字段正在编辑时，第一次 Escape 只取消该字段的编辑，再按一次才关面板', async () => {
    const wrapper = await mountWebQQProfileCard()
    await startProfileCardFieldEdit('昵称')
    expect(editingProfileCardFields()).toEqual(['昵称'])

    await pressEscapeOn(profileCardFieldEditor('昵称').element)
    expect(editingProfileCardFields()).toEqual([])
    expect(openEvents(wrapper)).toEqual([])

    await pressEscapeOnBody()
    expect(openEvents(wrapper)).toEqual([[false]])
  })

  it('编辑中焦点不在输入框上时，Escape 同样先退出编辑', async () => {
    // 面板根节点没有 tabindex，焦点未必落在编辑框里；两条路径都必须先退编辑，不能直接关面板。
    const wrapper = await mountWebQQProfileCard()
    await startProfileCardFieldEdit('签名')

    await pressEscapeOnBody()

    expect(editingProfileCardFields()).toEqual([])
    expect(openEvents(wrapper)).toEqual([])
  })

  it('面板关着时 Escape 不发出关闭', async () => {
    const wrapper = await mountWebQQProfileCard({ open: false })

    await pressEscapeOnBody()

    expect(openEvents(wrapper)).toEqual([])
  })

  it('卸载后 Escape 不再发出关闭', async () => {
    const wrapper = await mountWebQQProfileCard()

    wrapper.unmount()
    await pressEscapeOnBody()

    expect(openEvents(wrapper)).toEqual([])
  })
})

describe('表情选择的 Escape', () => {
  it('Escape 关闭面板', async () => {
    const wrapper = await mountWebQQEmojiPicker()
    expect(emojiPickerPage()).not.toBeNull()

    await pressEscapeOnBody()

    expect(openEvents(wrapper)).toEqual([[false]])
  })

  it('焦点在搜索框里时 Escape 也直接关闭面板', async () => {
    // 表情选择没有内部层：搜索框里的 Escape 不该只清搜索词。
    const wrapper = await mountWebQQEmojiPicker()

    await pressEscapeOn(emojiPickerSearchInput().element)

    expect(openEvents(wrapper)).toEqual([[false]])
  })

  it('Escape 关闭与点面板外面关闭发出同一个对外事件', async () => {
    const escaped = await mountWebQQEmojiPicker()
    await pressEscapeOnBody()
    await setPortalPageProps(escaped, { open: false })

    const pointed = await mountWebQQEmojiPicker()
    await pointerDownOutsidePortalPage()

    expect(openEvents(escaped)).toEqual([[false]])
    expect(openEvents(escaped)).toEqual(openEvents(pointed))
  })

  it('面板关着时 Escape 不发出关闭', async () => {
    const wrapper = await mountWebQQEmojiPicker({ open: false })

    await pressEscapeOnBody()

    expect(openEvents(wrapper)).toEqual([])
  })

  it('卸载后 Escape 不再发出关闭', async () => {
    const wrapper = await mountWebQQEmojiPicker()

    wrapper.unmount()
    await pressEscapeOnBody()

    expect(openEvents(wrapper)).toEqual([])
  })
})

describe('门户页与观察窗的 Escape 分层', () => {
  it('面板关着时，Escape 照旧冒泡到 window：观察窗那条分支的入口不变', async () => {
    await mountWebQQProfileCard({ open: false })
    await mountWebQQEmojiPicker({ open: false })
    const windowKeydown = trackWindowKeydown()

    await pressEscapeOnBody()
    windowKeydown.stop()

    expect(windowKeydown.keys).toEqual(['Escape'])
  })

  it('面板打开时，Escape 被面板吃掉，不再传到 window', async () => {
    // 否则同一下 Escape 会既关面板、又清掉观察窗的回复目标或退出多选。
    const wrapper = await mountWebQQProfileCard()
    const windowKeydown = trackWindowKeydown()

    await pressEscapeOnBody()
    windowKeydown.stop()

    expect(openEvents(wrapper)).toEqual([[false]])
    expect(windowKeydown.keys).toEqual([])
  })

  it('资料卡退出字段编辑的那一下 Escape 同样不传到 window', async () => {
    const wrapper = await mountWebQQProfileCard()
    await startProfileCardFieldEdit('昵称')
    const windowKeydown = trackWindowKeydown()

    await pressEscapeOn(profileCardFieldEditor('昵称').element)
    windowKeydown.stop()

    expect(editingProfileCardFields()).toEqual([])
    expect(openEvents(wrapper)).toEqual([])
    expect(windowKeydown.keys).toEqual([])
  })
})
