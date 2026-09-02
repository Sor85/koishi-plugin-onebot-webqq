# 01 — 接入按文件生效的 DOM 测试环境

**What to build:** 让前端第一次拥有可挂载的测试面。目前 `tests/` 里零组件挂载，所有前端断言都是读源文件做字符串匹配。本 ticket 把无头 DOM 与组件挂载链路在 CI 里跑通，并用**现有的提及菜单组件**（它已经是独立组件）立第一条挂载式断言作为范例。生产代码零改动，其余测试文件继续跑在默认的 node 环境。

**Blocked by:** None — can start immediately.

**Status:** resolved

**参考:** `.scratch/composer/spec.md` 的 Testing Decisions 与「测试环境」一节。

- [x] 无头 DOM 实现与 Vue 组件测试工具以精确版本固化进开发期依赖
- [x] DOM 环境按测试文件开启，未声明的测试文件仍跑在默认 node 环境
- [x] 存在一条挂载式断言：挂载现有的提及菜单组件，断言其渲染结果与一次交互后的对外事件
- [x] 生产代码零改动，不为测试新增任何导出
- [x] 故意改坏该组件的一处渲染行为时，这条断言失败
- [x] 全量测试通过，且未声明 DOM 环境的测试文件运行条件不变

## Comments

- 依赖已在探针阶段固化：`happy-dom@20.12.0` 与 `@vue/test-utils@2.5.0`，两条都是精确版本。
- 零配置改动：vitest 本来就复用 `vite.config.mts`，其中的 `@vitejs/plugin-vue` 直接把 SFC 编译链带给了测试。所以既不需要新建 `vitest.config.*`，也不需要改构建配置——这一点实测确认过（第一版挂载断言直接跑通）。
- 范例断言是 `tests/webqq-mention-menu.test.ts`：挂载现有的提及候选菜单组件，断言候选顺序、选中项的 `aria-selected` 与 `is-active`、头像走控制台代理与缺头像回退首字母、`mousedown`/`mouseenter` 对外发出的 `select`/`hover`、以及空候选时的「无匹配成员」。生产代码零改动。
- 失效实测：把 `:class="{ 'is-active': index === activeIndex }"` 改成 `index === activeIndex + 1`，该断言立刻变红；改回后恢复。
- 环境守卫是 `tests/test-environment.test.ts`：断言默认环境里没有 `document`/`window`、每个引用组件测试工具的测试文件首行都自带 `@vitest-environment` docblock、并且 `vite.config.mts` 里没有全局 `test` 环境配置。
- 写这条守卫时踩到一个坑：vitest 判定环境是扫**整个文件内容**而不是只看首行注释，所以文件里出现完整的 docblock 字面量会把守卫自己切进 DOM 环境（表现为 `document` 存在、并且 `fs.readFile` 拒收 happy-dom 的 `URL` 实例）。守卫因此用正则拼出这个标记，并在文件里留了注释说明。
