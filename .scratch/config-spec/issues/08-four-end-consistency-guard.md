# 08 — 四端一致性守卫测试

**What to build:** 把「每个镜像配置项必须四端一致」这条规则交给机器检查。这是整套改动的立论所在：在此之前，四端不一致只能靠 review 时人眼比对四个地方，而现存的源码文本断言既会误报又抓不住真错。本 ticket 补齐守卫测试与三类回归断言，并清掉最后一批锁死配置写法的源码断言。

**Blocked by:** 07 — 前端配置镜像的类型与初始值由配置规格派生。

**Status:** resolved

**参考:** `.scratch/config-spec/spec.md` 的 Testing Decisions 一节。

- [x] 存在一条守卫测试，对每个镜像配置项交叉断言四者相等：配置规格默认值、Schema 运行时默认值、下发 payload 默认值、配置镜像 ref 初始值
- [x] 同一条测试对每个非镜像配置项断言它不出现在下发 payload 里
- [x] 布尔关闭值、空字符串规范化、无默认值三类回归断言齐备
- [x] 在配置规格里新增一个镜像配置项而漏掉任一端时，该守卫测试失败
- [x] 断言只使用已有读取点：插件 apply 取 payload、读 Schema 对象、import 配置镜像 module；不新增任何生产导出
- [x] 剩余锁死配置写法的源码文本断言已删除，且删除的每一条都已被运行时断言覆盖
- [x] 全量测试通过

## Comments

- 守卫测试是 `tests/config-mirror.test.ts` 的 `describe('镜像配置项四端一致')`：`it.each(mirroredConfigKeys)` 对每个键交叉断言规格默认值 = `Config({})` 展开值 = 入口 payload 值 = 配置镜像 ref 初始值，另一条断言配置镜像不持有任何非镜像配置项。
- 第四端用 `import * as` 把三个领域的导出面摊平成一张表（`...webqqSettings` + `hiddenCapsuleActivityIds` + `debug`），所以新增镜像配置项而没在任何领域建 ref 时，`toBeDefined()` 先红。实测：往规格加一个 `webQQGuardProbe`（含 Config 与 Schema）后，`yarn typecheck` 在 `client/index.ts:27` 报 TS2741，守卫测试同时红。两道防线各自独立生效。
- 三类回归断言：布尔关闭值（含「默认关闭的开关打开后保持打开」）、四个 `blankIsUnset` 配置项的空串规范化、以及好感度 scopeId 即使被显式配置也不下发。空值语义在配置镜像那一侧直接以 payload 形状为输入断言 `readConfigValue`——前端写入走的就是同一个函数，不需要为此拉起组合根或渲染组件。
- 这个文件用两个替身：koishi 只换 `Schema`（换成真实 schemastery），`@koishijs/client` 只提供 `useColorMode`。没有引入 DOM 测试环境，也没有为可测性新增任何生产导出。
- 本轮删掉的源码文本断言（每条都已被运行时断言接管）：
  - `tests/plugin.test.ts`：图片缓存三行兜底文本、`webQQStorageBackend ?? 'koishi'` 两条。
  - `tests/webqq-mock-environment.test.ts`：`config.webQQMockEnvironment`、`createMockWebQQService(undefined, { mockBotCount: config.onebotMockBotCount })`。
  - `tests/capsule.test.ts`：`hiddenCapsuleActivityIds: ref(['logs'])`、`ClientData` 的 19 行字段类型、`applyClientData` 的 19 行赋值语句。
  - `tests/webqq-view.test.ts`：4 组 `?: boolean` 字段类型与 `.value = value?.X ?? 字面量` 赋值断言、`export type WebQQColorMode = 'auto' | 'light' | 'dark'`。
- 保留下来的 `webqqSettings` / `entryState` 源码断言只钉模块归属与 `globalThis` 挂载（例如 `export const enableWebQQSend = settingsState.enableWebQQSend`、`SETTINGS_STATE_KEY`），它们守的是依赖方向与多实例问题，不是配置写法，且没有运行时替代品。
- 代码审查后的三处修正：
  1. 收回一条自己新加的源码文本断言 `toContain('for (const key of mirroredConfigKeys)')`。它锁死循环写法，换等价写法就会红，正是 spec「不断言源码里出现过哪些字符串」要禁的东西；行为已由四端守卫覆盖。
  2. 删掉只有测试在用的两个生产导出 `configKeys` / `isMirroredConfigKey`（违反「不为可测性新增任何生产导出」）。全部配置项的键集改从 Schema 运行时节点读（`Config.list` → `group.dict`），非镜像清单 = Schema 键集减去 `mirroredConfigKeys`。这同时更强：从规格自己取键集会让断言变成同义反复，从 Schema 取则「规格漏一项 / Schema 多一项」也能被抓到。
  3. 「非镜像配置项不出现在 payload」与四端断言合进同一个 `describe`，与 spec 的措辞一致。
- 守卫失效实测两遍：往规格加一个镜像配置项 `webQQGuardProbe`（同步 Config 与 Schema、不建前端 ref）→ typecheck 报错且守卫红；把已有的非镜像项 `webQQMarkRecalledMessages` 改标成 `mirrored: true` → 守卫红。
- 全量测试 34 个文件 548 条通过；`yarn typecheck` 与 `yarn build`（build:types + tsup + vite lib）均通过。
