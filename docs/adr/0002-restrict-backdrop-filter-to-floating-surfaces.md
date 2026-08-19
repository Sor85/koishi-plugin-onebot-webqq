# 一级区域禁用 backdrop-filter；观察窗外壳模糊挂在伪层

## 状态

已接受。

## 背景

CSS 规范（Filter Effects Level 2）规定带 `backdrop-filter` 的元素形成 Backdrop Root 边界：其内部后代的 `backdrop-filter` 采样不到边界外的内容，覆盖其上的兄弟浮层在重叠区域同样采样不到它的输出。Chromium 与 Firefox 均按此实现。

Sandbox 的工作区是铺满控制台页面的一级布局，外壳模糊没有可见收益，因此整层禁用。本插件的观察窗是浮在控制台上的窗口：外壳若只留 78% 半透明、不模糊，背后的插件市场文字会清晰穿出，看起来像半透明穿帮而不是毛玻璃。

同时，若把 `backdrop-filter` 写在 `.onebot-webqq-webqq` 本体上，窗口自己成为 Backdrop Root，Teleport 到 body 的右键菜单、资料卡、贴表情在重叠区会采不到聊天内容。

## 决策

- **观察窗外壳**在毛玻璃外观下必须模糊控制台。模糊和半透明填充写在 `.onebot-webqq-webqq.is-frosted::before` 上，外壳本身保持 `background: transparent` 且不声明 `backdrop-filter`。这样窗口看起来是毛玻璃，但不会变成 Backdrop Root，浮层仍能采样聊天内容。
- **盖在内容上的工具条**（绝对定位的聊天顶栏）同样把模糊写在 `::before` 上，否则滚上来的消息会透过半透明顶栏；顶栏宿主不声明 `backdrop-filter`，以免搜索下拉采不到消息。
- **一级区域**（侧栏、标签行、聊天区、群信息栏）只允许半透明叠层，禁止声明 `backdrop-filter`。这些区域嵌在窗口内，自身模糊本来就不生效，却会杀死其上的控件毛玻璃。
- **浮层与控件层**（二级面、右键菜单、发送控件、多选栏、搜索结果）继续使用 `backdrop-filter`。发送胶囊的模糊挂在 `::before`，避免输入栏本体成为 Backdrop Root。
- 全屏遮罩在毛玻璃外观下关闭 `backdrop-filter`（保留暗化），否则遮罩会挡住对话框对工作区的采样。
- 毛玻璃开关由 `useWebQQFrostedSurfaceFlag` 写入 `body[data-onebot-webqq-frosted]`，与 sandbox 的 `data-sandbox-frosted` 隔离。
- 实体覆盖必须同时覆写背景色，只关 `backdrop-filter` 会穿帮成“半透明但不模糊”。
- 贴表情、资料卡、通知、Dialog 使用 `popover="manual"` 进入 Top Layer，让浮层的 `backdrop-filter` 采样已经合成的观察窗，而不是被外壳 `::before` 这个 Backdrop Root 挡住。不支持 Popover API 的引擎保持普通 `position: fixed` 浮层。不得再用 `body:has(...)` 在打开浮层时关掉窗口模糊。
