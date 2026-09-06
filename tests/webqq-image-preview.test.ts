// @vitest-environment happy-dom
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebQQImagePreview from '../client/webqq/components/WebQQImagePreview.vue'

const mounted: VueWrapper[] = []

afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function preview() {
  const wrapper = mount(WebQQImagePreview, { attachTo: document.body, props: { url: '/first.png' } })
  mounted.push(wrapper)
  const image = wrapper.get('img')
  // happy-dom 不做布局；只替代尺寸读取，事件与渲染仍执行实际组件。
  Object.defineProperties(image.element, { offsetWidth: { value: 400 }, offsetHeight: { value: 300 } })
  Object.defineProperties(wrapper.element, { clientWidth: { value: 800 }, clientHeight: { value: 600 } })
  return { wrapper, image }
}

describe('WebQQ 图片预览', () => {
  it('滚轮阻止页面滚动，缩放写入 transform 并显示倍率', async () => {
    const { wrapper, image } = preview()
    const wheel = new WheelEvent('wheel', { deltaY: -100, clientX: 400, clientY: 300, bubbles: true, cancelable: true })
    image.element.dispatchEvent(wheel)
    await wrapper.vm.$nextTick()
    expect(wheel.defaultPrevented).toBe(true)
    expect(image.attributes('style')).toContain('scale(1.2)')
    expect(wrapper.get('output').text()).toBe('120%')
    expect(wrapper.classes()).toContain('is-zoomed')
    expect(image.attributes('draggable')).toBe('false')
    await wrapper.trigger('wheel', { deltaY: 100, clientX: 0, clientY: 0 })
    expect(image.attributes('style')).toContain('scale(1)')
    expect(wrapper.find('output').exists()).toBe(false)
  })

  it('换图和图片加载后回到贴合态', async () => {
    const { wrapper, image } = preview()
    await wrapper.trigger('wheel', { deltaY: -100, clientX: 0, clientY: 0 })
    await wrapper.setProps({ url: '/second.png' })
    expect(image.attributes('src')).toBe('/second.png')
    expect(image.attributes('style')).toContain('scale(1)')
    await wrapper.trigger('wheel', { deltaY: -100, clientX: 0, clientY: 0 })
    await image.trigger('load')
    expect(wrapper.find('output').exists()).toBe(false)
    expect(image.attributes('style')).toContain('translate(0px, 0px) scale(1)')
  })

  it('放大拖动平移并抑制随后一次遮罩点击，下一次点击仍可关闭', async () => {
    const { wrapper, image } = preview()
    const captured = new Set<number>()
    Object.assign(image.element, {
      setPointerCapture: (id: number) => captured.add(id),
      hasPointerCapture: (id: number) => captured.has(id),
      releasePointerCapture: (id: number) => captured.delete(id),
    })
    for (let i = 0; i < 6; i++) await wrapper.trigger('wheel', { deltaY: -100, clientX: 0, clientY: 0 })
    await image.trigger('pointerdown', { pointerId: 1, button: 0, clientX: 400, clientY: 300 })
    await image.trigger('pointermove', { pointerId: 1, clientX: 440, clientY: 320 })
    expect(captured.has(1)).toBe(true)
    expect(image.attributes('style')).toContain('translate(40px, 20px)')
    await image.trigger('pointerup', { pointerId: 1, clientX: 440, clientY: 320 })
    expect(captured.has(1)).toBe(false)
    await wrapper.trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('图片单击不关闭，遮罩、Escape 和按钮分别可以关闭', async () => {
    const { wrapper, image } = preview()
    await image.trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.trigger('click')
    await wrapper.trigger('keydown', { key: 'Escape' })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(3)
  })

  it('打开时聚焦预览，卸载时将焦点还给触发元素', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const { wrapper } = preview()
    expect(document.activeElement).toBe(wrapper.element)
    mounted.splice(mounted.indexOf(wrapper), 1)
    wrapper.unmount()
    expect(document.activeElement).toBe(trigger)
  })
})
