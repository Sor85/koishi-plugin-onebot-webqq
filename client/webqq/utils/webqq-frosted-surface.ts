import { onBeforeUnmount, watchEffect } from 'vue'
import { enableWebQQFrostedGlass } from '../settings'

// 毛玻璃开关同样写到 body：Teleport 到 body 的右键菜单、Dialog 和二级页
// 拿不到观察窗根节点上的 is-frosted 状态类，统一由 body[data-onebot-webqq-frosted]
// 驱动实体/雾化双态，避免给每个浮层组件都穿一条 frosted prop 链。
// dataset 键必须带 onebot-webqq 命名空间：sandbox 使用 data-sandbox-frosted，
// 两个插件可能同时运行在同一个控制台页面，不能共用同一个 body 属性。
export function useWebQQFrostedSurfaceFlag(): void {
  watchEffect(() => {
    if (enableWebQQFrostedGlass.value) {
      document.body.dataset.onebotWebqqFrosted = 'true'
    } else {
      delete document.body.dataset.onebotWebqqFrosted
    }
  })
  onBeforeUnmount(() => {
    delete document.body.dataset.onebotWebqqFrosted
  })
}
