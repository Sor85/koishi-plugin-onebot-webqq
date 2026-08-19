# WebUI 设计规范

本文档记录 `koishi-plugin-onebot-webqq` WebUI 的稳定视觉约定。新增或调整界面时，应优先复用本文术语、主题令牌和既有语义类，避免为单个页面定义近似但不一致的样式。

## 界面层级

WebQQ 界面分为一级工作区和二级面。

- **一级工作区**：WebQQ 观察窗内持续存在的会话列表、聊天区、消息列表、群资料栏和输入区。
- **二级面**：从一级工作区之上打开、用于完成局部查看或操作的页面与浮层，例如 Dialog、查看资料、查找聊天记录、贴表情、通知、右键菜单和转发页面。

二级面按背景处理方式分为两类：**实体二级面**和**雾化二级面**。

## 实体二级面（Solid Secondary Surface）

实体二级面使用不透明或接近不透明的纯色背景，不通过 `backdrop-filter` 模糊其后方内容。

典型场景包括关闭毛玻璃外观时的全部二级面：表单对话框、右键菜单、查看资料、贴表情、日期选择器和通知面板。

实现约定：

- 使用纯色主题令牌 `--webqq-bg`、`--webqq-panel` 或 `--webqq-surface`；
- 不启用背景模糊，使用 `backdrop-filter: none`；
- 使用轻描边区分相邻的中性灰层级，描边颜色应基于 `--webqq-border`；
- 同层级实体二级面使用一致的阴影，不为单个页面增加近似但不同的阴影参数；
- 深色模式使用 `.is-color-dark` 显式取得中性灰 Portal 令牌，不依赖系统媒体查询猜测 Koishi 控制台主题；
- 实体二级面不得同时声明雾化语义。

当前通用 Dialog 的视觉基线位于 `client/webqq/styles/webqq-interactions.scss`：

```scss
.webqq-dialog-content {
  border: 1px solid var(--webqq-border);
  background: var(--webqq-bg);
  box-shadow: 0 18px 42px rgb(15 23 42 / 18%);
}
```

深色 Portal 令牌的基线为：

```scss
.onebot-webqq-webqq__secondary-page.is-color-dark,
.webqq-dialog-content.is-color-dark,
.webqq-context-menu-content.is-color-dark {
  --webqq-bg: #2c2c30;
  --webqq-surface: #2c2c30;
  --webqq-surface-muted: #323238;
  --webqq-border: #45454c;
  --webqq-text: #edf2f7;
  --webqq-muted: #a1a1aa;
  --webqq-hover: #39393f;
  --webqq-panel: #333338;
}
```

轻描边用于分隔相邻层级，阴影用于表达浮层高度；不得用高对比实线边框或强调色描边替代。

## 雾化二级面（Frosted Secondary Surface）

雾化二级面使用半透明背景，并通过 `backdrop-filter` 和 `-webkit-backdrop-filter` 模糊其后方内容。启用毛玻璃外观（`enableWebQQFrostedGlass`）时，全部二级面（表单对话框、右键菜单、查看资料、贴表情、日期选择器和通知面板）都应切换为雾化态。

实现约定：

- 毛玻璃开关由 `useWebQQFrostedSurfaceFlag` 统一写入 `body[data-onebot-webqq-frosted]`；Teleport 到 body 的面板一律用该属性驱动双态，不为单个浮层组件传递 frosted prop。工作区内元素可使用 `.onebot-webqq-webqq.is-frosted` 后代选择器；通知面板沿用组件内 `is-frosted`/`is-plain` 状态类。
- 保留半透明背景（面板色 92%）、饱和度和模糊效果；轻描边使用 `--webqq-secondary-outline` 的 64% 淡化值，阴影沿用统一阴影。
- Chrome 和 Firefox 均需具备可接受的显示效果；使用 `backdrop-filter` 时同步评估 `-webkit-backdrop-filter`。
- 同一容器不得同时表达实体和雾化两种视觉语义；实体覆盖必须同时覆写背景色，只关闭 `backdrop-filter` 会穿帮成“半透明但不模糊”的中间态。
- 观察窗外壳的模糊挂在 `.onebot-webqq-webqq.is-frosted::before`，外壳本身不声明 `backdrop-filter`；一级区域禁止声明 `backdrop-filter`。模糊只出现在外壳伪层、浮层与控件层，否则浮层毛玻璃会被 Backdrop Root 边界静默杀死（见 ADR 0002）。
- 浏览器不支持背景模糊时，半透明背景自身仍须保证文字对比度和内容可读性。

## Portal 与主题令牌

Teleport 到 `body` 的二级面不在 `.onebot-webqq-webqq` DOM 子树内，无法自然继承工作区 CSS 变量。

因此必须遵循以下规则：

- 在 Portal 根容器上显式添加 `` `is-color-${resolvedWebQQColorMode}` ``；
- 在 `client/webqq/styles/webqq-interactions.scss` 中维护完整的 Portal 令牌镜像；
- 强调色通过 `--onebot-webqq-webqq-accent` 映射到 `--webqq-accent`；
- 不允许因某个 Portal 缺少令牌而在组件内部散写另一套颜色；
- 新增令牌时，同步检查亮色和深色 Portal 镜像是否完整。

## 二级面滚动

本项目全局使用自定义滚动条，二级面同样遵循该约定。

- 内容超出容器时必须保留鼠标滚轮、触控板、触摸和键盘滚动能力；
- 在实际可滚动 DOM 元素上使用 `v-webqq-scrollbar`；
- 不得把指令挂在可能返回 Fragment 或注释节点的组件上；
- 浏览器原生滚动条由 `[data-onebot-webqq-scrollbar="true"]` 的 Firefox 和 WebKit 兼容规则隐藏；
- 自定义轨道由 `onebot-webqq-webqq__scrollbar-overlay` 和 `onebot-webqq-webqq__scrollbar-thumb` 提供；
- Portal 浮层必须设置足够的 `zIndex`，确保自定义滚动条高于对应二级面；
- 不得通过 `overflow: hidden` 代替滚动条方案，以免截断内容或破坏键盘访问；
- 查看资料、查找记录等自行隐藏原生滚动条的 Portal 页面，也必须继续保证内容可滚动。

## Dialog 生产兼容边界

公共 Dialog 使用项目现有的 Vue `provide/inject` 受控状态、`Teleport` 和显式 `v-if` 挂载路径。遮罩与内容必须由同一个 `open` 状态分支同步创建。

不得将其替换为 Reka UI 的 `DialogRoot`、`DialogPortal`、`DialogOverlay`、`DialogContent` 或 `Presence` 挂载组合。该组合在生产 Koishi 运行时可能只留下已打开的 Overlay，而 Content 退化为 Vue 注释节点，表现为页面全屏模糊但弹窗内容不存在。

修改 Dialog 后必须验证：

1. 生产构建产物仍由原生 Vue 条件直接创建 `.webqq-dialog-layer` 和 `[data-slot="dialog-content"]`。
2. 真实浏览器中 Overlay 与 Content 同时存在。
3. 遮罩点击、Escape 和关闭按钮均可关闭 Dialog。
4. 打开后焦点进入 Dialog，关闭后焦点回到原触发元素。
5. 自定义滚动条挂在实际 Dialog 内容元素上。

## 新增二级面的检查清单

1. 判断页面是实体二级面还是雾化二级面。
2. 复用对应主题令牌和状态类，不写页面专属的近似配色、描边或阴影。
3. Portal 页面显式传递解析后的亮色或深色状态。
4. 验证深色模式下背景、描边、阴影和文字对比度清晰。
5. 验证内容溢出时可以滚动，且自定义滚动条层级正确。
6. 验证 Chrome 和 Firefox 下布局、背景效果及滚动行为正常。
7. Dialog 改动额外遵守生产兼容边界并完成真实浏览器验证。
