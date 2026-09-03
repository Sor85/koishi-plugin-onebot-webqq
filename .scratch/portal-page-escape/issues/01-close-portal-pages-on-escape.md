# 01 — 资料卡与表情选择支持 Escape 关闭

**What to build:** 让这两个浮层跟其余四个一样能按 Escape 关掉。现在资料卡和表情选择是唯二不响应 Escape 的二级面：打开后只能点关闭按钮或点面板外面。资料卡更容易误解——它有 Escape，但只作用于正在编辑的那个字段，面板本身不关，于是按一下像是「没反应」。

这是一处可见的行为改动，方向是补齐一致性。

**Blocked by:** 无 — 可以立即开工。与二级面对话框那轮（`.scratch/action-dialogs/`）没有交叉：那轮只碰输入对话框与确认对话框，不碰这两个面板。

**Status:** resolved

**参考:** 浮层挂载约束见 ADR 0002；Escape 分层不做统一栈的理由见 ADR 0007。

已核对的现状：

- 资料卡与表情选择同形——都 `Teleport` 到 body、`popover="manual"`、表头可拖拽、在 `onMounted` 里挂 document 的 `pointerdown` 实现点外面关闭，**都没有面板级 Escape**。两者也是唯二带 `__portal-page` 类的浮层。
- 资料卡只有字段编辑级的 Escape（取消该字段的编辑）。
- 另外四个都能关：图片预览与合并转发的根节点有 `tabindex="0"` 加 `@keydown.esc`；确认框、输入框、转发目标由 `DialogContent` 的 `@keydown.esc.stop.prevent` 处理。
- 实现要注意：这两个面板的根节点没有 `tabindex`，焦点未必落在面板内，所以把 `@keydown.esc` 挂在根节点上不一定收得到事件。它们已经在用 document 级监听做点外面关闭，keydown 走同一条路更一致，且必须在 `onBeforeUnmount` 里摘掉。

- [x] 没有字段处于编辑态时，资料卡按 Escape 关闭面板
- [x] 有字段正在编辑时，第一次 Escape 只取消该字段的编辑（现有行为不变），再按一次才关面板
- [x] 表情选择按 Escape 关闭面板（它没有内部层，直接关）
- [x] 两者的关闭走各自现有的对外事件，宿主侧状态与点面板外面关闭时完全一致
- [x] 监听器在卸载时摘掉，断言写成行为形式（卸载后按 Escape 不再发出关闭），不是对 `removeEventListener` 的 spy
- [x] 其余四个浮层的 Escape 行为不变；观察窗那条 Escape 分支（查找 → 转发目标 → 多选模式 → 回复目标）不受影响
- [x] 两个面板都有挂载式断言，按文件开无头 DOM 环境；其余测试文件的运行条件不变
- [x] 浮层挂载方式不变（仍是 `Teleport` + 显式 `v-if` + `popover="manual"`，ADR 0002）
- [x] 逐条失效实测：去掉任一处 Escape 分支时，对应断言失败
- [x] 全量测试通过

## Comments

落地位置：面板级 Escape 的判断收进 `client/webqq/utils/floating-panel.ts` 的 `createFloatingPanelEscapeHandler`（两个面板本来就从这个 module 取浮层定位与拖拽判定，没有新增依赖边界），两个组件各自在现有的 `onMounted` / `onBeforeUnmount` 里把它挂到 `document` 的 `keydown` 上，和点外面关闭同一条路、同一对钩子。断言在 `tests/webqq-portal-page-escape.test.ts`（14 条，按文件开 happy-dom）与 `tests/helpers/webqq-portal-pages.ts`（挂载脚手架）。

**门户页吃掉这一下 Escape。** 处理器里除了 `preventDefault()` 还有 `stopPropagation()`。观察窗那条分支挂在 `window` 上，document 的冒泡阶段在 `window` 之前，不拦住的话同一次 Escape 会先关面板、再顺手清掉回复目标或退出多选——搜索开着时更明显，关一张资料卡会把查找一起关了。分支代码一行没动，面板关着时按键照旧冒到 `window`；这条由一对断言守着：面板关着时 `window` 收到 Escape，打开时收不到。判据与 ADR 0007 里 `DialogContent` 那个 `.stop` 一致：分层靠上层截住，而不是靠收一个统一的 Escape 栈。

资料卡的两层因此各拦一次：编辑框里的 `handleEditorKeydown` 在 Escape 分支上补了 `stopPropagation()`。不补的话按键冒到 document 时编辑态已经被它自己退干净，面板级判断只看得到「没有字段在编辑」，一下 Escape 会连编辑带面板一起关。焦点不在编辑框上（面板根节点没有 tabindex，这是常态）时，document 上那份判断自己先退编辑，两条路径的第一下 Escape 结果一致。

测试脚手架里编辑态的探针读的是字段行里的 `.onebot-webqq-webqq__profile-card-field-editor`，没有读 `is-editing`。顺带发现：`is-editing` 绑的是 `editingField === field.editKey`，不可编辑字段的 `editKey` 是 `undefined`，没有任何字段在编辑时 `undefined === undefined` 成立，于是这些行全都挂上了 `is-editing`。样式表里没有任何 `.is-editing` 规则，眼下没有可见后果，也不在本 ticket 的范围内，只是将来给它加样式前得先修这处绑定。

逐条失效实测跑了 8 处改坏，全部有对应断言变红：两个面板各去掉 `addEventListener('keydown', …)`（3 条 / 5 条红）、各去掉 `removeEventListener`（各 1 条红，即卸载后那条行为断言）、去掉资料卡的内层分支（1 条红）、去掉编辑框里的 `stopPropagation()`（2 条红）、去掉处理器里的 `stopPropagation()`（1 条红，只有分层那条）、去掉 `isOpen()` 判断（3 条红）。

验证：`yarn typecheck`、`yarn test`（48 个文件 710 条）、`yarn build` 全过；构建产物里 `!e.isOpen() || t.key !== "Escape" || (t.preventDefault(), t.stopPropagation(), e.dismiss())` 与观察窗那条 `window` 分支同时在场，`.webqq-dialog-layer` 与 `dialog-content` 仍在、没有 `DialogRoot` / `DialogPortal`。未做真机浏览器验证——本次没碰 Dialog 挂载路径，只动了两个面板的键盘分支。
