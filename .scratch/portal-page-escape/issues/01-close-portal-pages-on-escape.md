# 01 — 资料卡与表情选择支持 Escape 关闭

**What to build:** 让这两个浮层跟其余四个一样能按 Escape 关掉。现在资料卡和表情选择是唯二不响应 Escape 的二级面：打开后只能点关闭按钮或点面板外面。资料卡更容易误解——它有 Escape，但只作用于正在编辑的那个字段，面板本身不关，于是按一下像是「没反应」。

这是一处可见的行为改动，方向是补齐一致性。

**Blocked by:** 无 — 可以立即开工。与二级面对话框那轮（`.scratch/action-dialogs/`）没有交叉：那轮只碰输入对话框与确认对话框，不碰这两个面板。

**Status:** ready-for-agent

**参考:** 浮层挂载约束见 ADR 0002；Escape 分层不做统一栈的理由见 ADR 0007。

已核对的现状：

- 资料卡与表情选择同形——都 `Teleport` 到 body、`popover="manual"`、表头可拖拽、在 `onMounted` 里挂 document 的 `pointerdown` 实现点外面关闭，**都没有面板级 Escape**。两者也是唯二带 `__portal-page` 类的浮层。
- 资料卡只有字段编辑级的 Escape（取消该字段的编辑）。
- 另外四个都能关：图片预览与合并转发的根节点有 `tabindex="0"` 加 `@keydown.esc`；确认框、输入框、转发目标由 `DialogContent` 的 `@keydown.esc.stop.prevent` 处理。
- 实现要注意：这两个面板的根节点没有 `tabindex`，焦点未必落在面板内，所以把 `@keydown.esc` 挂在根节点上不一定收得到事件。它们已经在用 document 级监听做点外面关闭，keydown 走同一条路更一致，且必须在 `onBeforeUnmount` 里摘掉。

- [ ] 没有字段处于编辑态时，资料卡按 Escape 关闭面板
- [ ] 有字段正在编辑时，第一次 Escape 只取消该字段的编辑（现有行为不变），再按一次才关面板
- [ ] 表情选择按 Escape 关闭面板（它没有内部层，直接关）
- [ ] 两者的关闭走各自现有的对外事件，宿主侧状态与点面板外面关闭时完全一致
- [ ] 监听器在卸载时摘掉，断言写成行为形式（卸载后按 Escape 不再发出关闭），不是对 `removeEventListener` 的 spy
- [ ] 其余四个浮层的 Escape 行为不变；观察窗那条 Escape 分支（查找 → 转发目标 → 多选模式 → 回复目标）不受影响
- [ ] 两个面板都有挂载式断言，按文件开无头 DOM 环境；其余测试文件的运行条件不变
- [ ] 浮层挂载方式不变（仍是 `Teleport` + 显式 `v-if` + `popover="manual"`，ADR 0002）
- [ ] 逐条失效实测：去掉任一处 Escape 分支时，对应断言失败
- [ ] 全量测试通过
