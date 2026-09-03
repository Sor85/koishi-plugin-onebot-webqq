# 02 — 查找页的挂载式断言

**What to build:** 查找页的交互从此可自动验证。防抖、日历排布、Escape 的三层收起顺序、点外面关闭、卸载后不再响应外部点击——这些行为目前一条守卫都没有，改样式或调结构时很容易顺手改坏而没人发现。查找页本来就是纯 props/emits 组件，不需要任何改造就能挂载，所以这是本轮最便宜的一块。

生产代码零改动。

**Blocked by:** 无 — 可以立即开工。与 01 号票并行时唯一的交叉点是查找页那个「已扫描条数」prop：删除动作归 01 号票，本票只要不把它重新引入。

**Status:** resolved

**参考:** `.scratch/conversation-search/spec.md` 的 Testing Decisions；挂载式断言的范本是输入区那四个测试文件与 `tests/helpers/webqq-composer.ts`。

已实测的能力边界：happy-dom 20.12.0 **没有 Popover API**（`showPopover` 是 `undefined`）。这不妨碍挂载——项目的浮层提升工具本来就守了这个判断并静默返回，popover 是渐进增强。日历的开合、月/年菜单、选日期、Escape 分层全是普通 DOM，都能断言；测不到的只有「浮层被提升到 Top Layer」，那条由保留的源码契约断言覆盖。

- [x] 查找页有可挂载的测试脚手架，按文件开无头 DOM 环境；其余测试文件的运行条件不变
- [x] 存在断言覆盖 13 条行为：防抖（250 毫秒内连续输入只发一次查找）；清空输入立刻发、不等防抖；每次输入都同步发出查询串更新；无**查找条件**时结果面板不存在；状态文案三态优先级（错误 > 搜索中 > 无匹配）；点**命中**发出选中事件并带那条消息；「加载更多结果」的显示条件与加载中禁用；日历选日期发出日期更新与查找并关闭浮层；Escape 三层收起顺序（月/年菜单 → 日期浮层 → 关闭查找）；外部 pointerdown 关闭、点内部不关；挂载后输入框自动聚焦且带 `preventScroll`；卸载后再点外面不再发出关闭；日历排布（42 格、周一起始、跨月与今天/选中的标记）
- [x] 防抖那条用假计时器；日历排布只断言排布性质，不逐格比对
- [x] 卸载清理写成行为形式（卸载后点外面不发出关闭），不是对 `removeEventListener` 的 spy
- [x] 锁实现语句的 4 条源码断言已删除（聚焦状态类、失焦处理器绑定、输入框聚焦语句、浮层提升调用），每条都能指出接管它的行为断言
- [x] 3 条模板结构断言改成挂载后的渲染断言（查找框容器类、占位文案、日历网格类）
- [x] 6 条契约守卫原文保留：`popover="manual"`、毛玻璃三元、命名空间 `not.toContain`、滚动条指令、`not.toContain('<Teleport')`、`not.toContain('message-search-backdrop')`
- [x] 日期浮层那个 data 属性的断言保留 —— 它是跨文件契约，胶囊的外部点击判定在用它
- [x] 生产代码零改动
- [x] 逐条失效实测：故意改坏任一条交互时，对应断言失败
- [x] 全量测试通过

## Comments

- 脚手架是 `tests/helpers/webqq-message-search-page.ts`，断言在 `tests/webqq-message-search-page.test.ts`（14 条，首行 `@vitest-environment happy-dom`）。查找页确实不需要任何改造就能挂：`attachTo: document.body` + 一组默认 props 就够了。
- `@koishijs/client` 要连 `useColorMode` 一起 mock，不只是 `withProxy`：查找页 import `../settings`，而 settings 在模块作用域就调了 `useColorMode()`。
- 删掉的 4 条源码断言与接管者：聚焦状态类 `'is-focused': searchFocused` 与失焦处理器绑定 `@focusout` →「挂载后自动聚焦输入框且不滚动外壳」（`document.activeElement` 落在输入框上，是这两句真正要保证的结果）；输入框聚焦语句 → 同一条，并额外断言 `preventScroll: true`；浮层提升调用 `showWebQQPopover` →「日历选日期时发出日期更新与查找并收起浮层」加保留的 `popover="manual"` 契约。
- 3 条改成渲染断言的：查找框容器类与占位文案 →「挂载后渲染查找框容器与占位文案，日历网格按需出现」；日历网格类 → 同一条（先断言不存在，点开日期按钮后断言存在，顺带把「日历默认收起」也钉住了）。
- 日历那条只断言排布性质：42 格、周一起始（首格 `getDay() === 1`）、42 格是连续自然日、非 `is-outside` 的恰好是当月 1..31、`is-outside` 的月份都不是当月、`is-selected` 唯一且落在 3 月 15 日。今天的标记另挂一份 `localDate = 今天` 断言唯一且非跨月。
- 逐条失效实测：15 条变异里 14 条让对应断言变红（周一偏移改成 `firstDay.getDay()`、42 改 35、防抖 250 改 0、`v-if="hasCriteria"` 改 `true`、状态文案换序、`emit('select')` 换掉、`:disabled` 删掉、`datePopoverOpen = false` 删掉、Escape 中间那层删掉、`contains` 守卫删掉、`preventScroll` 删掉等）。
- **一条没能变红，是断言形式本身的限制**：删掉 `document.removeEventListener('pointerdown', closeOnOutsidePointer)` 后测试仍全绿。原因实测确认过——Vue 的 `emit` 开头就有 `if (instance.isUnmounted) return`，所以卸载后泄漏的监听器照样被调用（探针里计数从 1 涨到 2），但 `close` 事件被 Vue 自己吞掉。也就是说这个泄漏透过组件对外接口没有任何可观测后果，「卸载后点外面不发出关闭」这条断言无论清不清监听器都会过。要让它变红只能去 spy `removeEventListener`，而本票明确排除了这种写法，所以保持票里指定的行为形式。
- 作为补偿，同一条测试里加了一个**确实敏感**的卸载清理断言：卸载时挂着的防抖计时器必须被清掉（假计时器 + `vi.getTimerCount()` 归零，再推进 500 毫秒确认不会补发一次查找）。删掉 `clearTimeout(debounceTimer)` 会让它立刻变红。
