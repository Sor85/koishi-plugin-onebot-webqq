// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  composerEditable,
  composerText,
  createComposerFile,
  focusComposerEnd,
  lastComposerSubmit,
  submittedComposerElements,
  mountWebQQComposer,
  pasteIntoComposer,
  pressComposerKey,
  selectComposerFiles,
  typeIntoComposer,
  unmountWebQQComposers,
} from './helpers/webqq-composer'

vi.mock('@koishijs/client', () => ({
  withProxy: (url: string) => url,
  Binary: { toBase64: (buffer: ArrayBuffer) => Buffer.from(buffer).toString('base64') },
}))

afterEach(unmountWebQQComposers)

let revokeObjectURL: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')
})

afterEach(() => {
  revokeObjectURL.mockRestore()
})

describe('WebQQ 待发附件的类型判定', () => {
  it('按 MIME 判定图片与视频，其余按文件渲染并拆出扩展名', async () => {
    const wrapper = mountWebQQComposer()
    await pasteIntoComposer(wrapper, [
      createComposerFile('shot.png', 'image/png'),
      createComposerFile('clip.mkv', 'video/x-matroska'),
      createComposerFile('report.final.pdf', 'application/pdf'),
    ])

    const thumbnails = wrapper.findAll('.onebot-webqq-webqq__send-image')
    expect(thumbnails).toHaveLength(2)
    expect(thumbnails[0].find('img').exists()).toBe(true)
    // 扩展名不在可播放白名单里，只有 MIME 能把它认成视频。
    expect(thumbnails[1].find('video').exists()).toBe(true)

    const attachment = wrapper.get('.onebot-webqq-webqq__send-file')
    expect(attachment.get('.onebot-webqq-webqq__send-file-base').text()).toBe('report.final')
    expect(attachment.get('.onebot-webqq-webqq__send-file-name').text()).toBe('report.final.pdf')
  })

  it('系统没给 MIME 时只有常见可播放扩展名回退成视频', async () => {
    const wrapper = mountWebQQComposer()
    await pasteIntoComposer(wrapper, [
      createComposerFile('clip.mov', ''),
      createComposerFile('archive.mkv', ''),
    ])

    expect(wrapper.get('.onebot-webqq-webqq__send-image').find('video').exists()).toBe(true)
    expect(wrapper.get('.onebot-webqq-webqq__send-file-name').text()).toBe('archive.mkv')
  })

  it('视频缩略图只取首帧且不可点击放大', async () => {
    const wrapper = mountWebQQComposer()
    await pasteIntoComposer(wrapper, [createComposerFile('clip.mp4', 'video/mp4')])

    const video = wrapper.get('.onebot-webqq-webqq__send-image').get('video')
    expect(video.attributes('preload')).toBe('metadata')
    expect(video.attributes('muted')).toBeDefined()
    expect(wrapper.find('button[aria-label="预览 clip.mp4"]').exists()).toBe(false)

    await wrapper.get('.onebot-webqq-webqq__send-image-preview').trigger('click')
    expect(wrapper.emitted('preview-attachment')).toBeUndefined()
  })
})

describe('WebQQ 待发附件的收取与移除', () => {
  it('粘贴带文件时收下文件并阻止浏览器默认粘贴', async () => {
    const wrapper = mountWebQQComposer()
    const event = await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png')])
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.findAll('.onebot-webqq-webqq__send-image')).toHaveLength(1)
  })

  it('粘贴纯文字时不拦默认行为，也不产生附件', async () => {
    const wrapper = mountWebQQComposer()
    const event = await pasteIntoComposer(wrapper, [], '晚上好')
    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.find('.onebot-webqq-webqq__send-context').exists()).toBe(false)
  })

  it('选择文件按钮的文件也进同一份待发附件', async () => {
    const wrapper = mountWebQQComposer()
    await selectComposerFiles(wrapper, [createComposerFile('shot.png', 'image/png')])
    expect(wrapper.findAll('.onebot-webqq-webqq__send-image')).toHaveLength(1)
  })

  it('移除单个附件并释放它的预览资源，其余附件留着', async () => {
    const wrapper = mountWebQQComposer()
    await pasteIntoComposer(wrapper, [
      createComposerFile('first.png', 'image/png'),
      createComposerFile('second.png', 'image/png'),
    ])
    const removed = wrapper.get('img').attributes('src')

    await wrapper.get('button[aria-label="移除 first.png"]').trigger('click')
    expect(wrapper.findAll('.onebot-webqq-webqq__send-image')).toHaveLength(1)
    expect(wrapper.get('img').attributes('src')).not.toBe(removed)
    expect(revokeObjectURL).toHaveBeenCalledWith(removed)
  })

  it('点待发图片只发出放大请求，浮层由观察窗决定', async () => {
    const wrapper = mountWebQQComposer()
    await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png')])
    const previewUrl = wrapper.get('img').attributes('src')

    await wrapper.get('button[aria-label="预览 shot.png"]').trigger('click')
    expect(wrapper.emitted('preview-attachment')).toEqual([[previewUrl]])
    expect(wrapper.findAll('.onebot-webqq-webqq__send-image')).toHaveLength(1)
  })

  it('卸载输入区时释放所有预览资源', async () => {
    const wrapper = mountWebQQComposer()
    await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png')])
    const previewUrl = wrapper.get('img').attributes('src')
    wrapper.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith(previewUrl)
  })
})

describe('WebQQ 待发附件的发送', () => {
  it('只有附件也可以发送，附件按字节转成发送元素', async () => {
    const wrapper = mountWebQQComposer()
    await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png', [1, 2, 250])])
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()

    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    const elements = await submittedComposerElements(wrapper)
    expect(elements).toHaveLength(1)
    expect(elements[0]).toMatchObject({ type: 'image', name: 'shot.png' })
    const [prefix, payload] = (elements[0].data ?? '').split(',')
    expect(prefix).toBe('data:image/png;base64')
    expect([...Buffer.from(payload, 'base64')]).toEqual([1, 2, 250])
  })

  it('回车同步交出构造器，会话层因此能先拿发送锁再转字节', async () => {
    const wrapper = mountWebQQComposer()
    await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png')])

    // 不 await：同步派发 keydown 后 submit 就该已经发出，转字节留给会话层在锁内触发。
    composerEditable(wrapper).element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(wrapper.emitted('submit')).toHaveLength(1)
    expect(typeof lastComposerSubmit(wrapper)[0]).toBe('function')
  })

  it('附件读不出字节时把失败交给会话层，输入区不自己咽掉', async () => {
    const wrapper = mountWebQQComposer()
    const file = createComposerFile('shot.png', 'image/png')
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('读取失败'))
    await pasteIntoComposer(wrapper, [file])

    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    await expect(submittedComposerElements(wrapper)).rejects.toThrow('读取失败')
  })

  it('草稿文字排在附件之前，没有 MIME 时回退成通用二进制类型', async () => {
    const wrapper = mountWebQQComposer()
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '看图')
    await pasteIntoComposer(wrapper, [createComposerFile('archive.mkv', '')])

    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    const elements = await submittedComposerElements(wrapper)
    expect(elements[0]).toEqual({ type: 'text', text: '看图' })
    expect(elements[1]).toMatchObject({ type: 'file', name: 'archive.mkv' })
    expect(elements[1].data?.startsWith('data:application/octet-stream;base64,')).toBe(true)
  })

  it('会话层确认已发出后清空附件与草稿', async () => {
    const wrapper = mountWebQQComposer()
    focusComposerEnd(wrapper)
    await typeIntoComposer(wrapper, '看图')
    await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png')])
    const previewUrl = wrapper.get('img').attributes('src')

    await pressComposerKey(wrapper, 'Enter')
    await flushPromises()
    lastComposerSubmit(wrapper)[1]({ sent: true, restoreFocus: true })
    await flushPromises()
    expect(wrapper.find('.onebot-webqq-webqq__send-context').exists()).toBe(false)
    expect(composerText(wrapper)).toBe('')
    expect(revokeObjectURL).toHaveBeenCalledWith(previewUrl)
  })
})

describe('WebQQ 切换会话清空待发附件', () => {
  it('上一个会话选的附件不跟着进新会话，预览资源一并释放', async () => {
    const wrapper = mountWebQQComposer({ chatKey: 'group:20000' })
    await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png')])
    const previewUrl = wrapper.get('img').attributes('src')

    await wrapper.setProps({ chatKey: 'friend:30000' })
    await flushPromises()
    expect(wrapper.find('.onebot-webqq-webqq__send-image').exists()).toBe(false)
    expect(wrapper.find('.onebot-webqq-webqq__send-context').exists()).toBe(false)
    expect(revokeObjectURL).toHaveBeenCalledWith(previewUrl)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('回复条还挂在会话层，切会话后仍由会话层决定是否显示', async () => {
    const wrapper = mountWebQQComposer({ replyingTo: { senderName: 'Alice', summary: '晚上好' } })
    await pasteIntoComposer(wrapper, [createComposerFile('shot.png', 'image/png')])
    await wrapper.setProps({ chatKey: 'friend:30000' })
    await flushPromises()
    expect(wrapper.find('.onebot-webqq-webqq__send-image').exists()).toBe(false)
    expect(composerText(wrapper)).toBe('')
    expect(wrapper.get('.onebot-webqq-webqq__reply-draft').text()).toContain('回复 Alice：晚上好')
  })
})
