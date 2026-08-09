## Agent skills

### Issue tracker

Issue 使用仓库内的本地 Markdown 文件管理，存放在 `.scratch/<feature>/`。参见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的五类 Triage 标签。参见 `docs/agents/triage-labels.md`。

### Domain docs

本仓库采用单上下文领域文档布局，领域词汇位于根目录 `CONTEXT.md`，架构决策位于 `docs/adr/`。参见 `docs/agents/domain.md`。

### 项目规则

全局使用自定义滚动条。

### WebQQ Dialog 生产兼容规则

修改 `client/components/ui/dialog/` 或 WebQQ 弹窗时，继续使用项目现有的 Vue `provide/inject` 受控状态、`Teleport` 和显式 `v-if` 挂载路径。遮罩与内容必须由同一个 `open` 状态分支同步创建。

不得把公共 Dialog 恢复为 Reka UI 的 `DialogRoot`、`DialogPortal`、`DialogOverlay`、`DialogContent` 或 `Presence` 挂载路径。该组合在生产 Koishi 运行时中会出现 Overlay 为 `data-state="open"`，但 Content 只留下 Vue 注释节点的兼容问题，表现为页面全屏模糊且弹窗内容不存在。

完成 Dialog 相关修改时必须：

- 运行完整生产构建，确认构建产物仍由原生 Vue 条件直接创建 `.webqq-dialog-layer` 和 `[data-slot="dialog-content"]`
- 在真实浏览器中打开至少一个 WebQQ Dialog，断言 Overlay 和 Content 同时存在，而不是只检查 `z-index` 或截图中的遮罩
- 验证遮罩点击、Escape、关闭按钮、打开后聚焦和关闭后焦点恢复
- 保持自定义滚动条指令挂在实际 DOM 元素上，不挂在可能返回 Fragment 或注释节点的组件上
