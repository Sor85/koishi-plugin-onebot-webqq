import { nextTick } from 'vue'

// 把 Teleport 浮层提升到 Top Layer：backdrop-filter 才能采样已经合成的观察窗
// （含外壳 ::before 的毛玻璃），而不是被窗口伪层这个 Backdrop Root 挡住。
// popover 是渐进增强，老引擎没有 showPopover 时保持普通 fixed 浮层。
export async function showWebQQPopover(element: HTMLElement | undefined): Promise<void> {
  await nextTick()
  if (!element || typeof element.showPopover !== 'function' || !element.isConnected) return
  try {
    if (!element.matches(':popover-open')) element.showPopover()
  } catch {
    // 已经打开，或当前文档还不支持 popover
  }
}
