# 01 — 配置面板契约断言改读 Schema 运行时节点

**What to build:** 让「配置面板长什么样」这件事由读取 Schema 对象本身来守护，而不是靠匹配源码文本。目前每个配置项的整段 Schema 写法（含默认值字面量）、五个分组名都被钉成源文件里的子串，后果是换个写法就误报、真改错默认值却抓不住。本 ticket 只改测试，生产代码零改动，为后续所有 ticket 拆掉这颗地雷。

**Blocked by:** None — can start immediately.

**Status:** resolved

**参考:** `.scratch/config-spec/spec.md` 的 Testing Decisions 一节。

- [x] 配置面板五个分组的名称与顺序改为读取 Schema 对象本身来断言
- [x] 每个配置项的默认值、控件 role、数值上下限改为读取 Schema 对象本身来断言
- [x] 生产代码零改动，不为测试新增任何导出
- [x] 把任一 Schema 声明换行或增删空格后，测试仍然通过
- [x] 故意改错任一配置项的默认值，测试失败
- [x] 故意调换两个分组的顺序，测试失败
- [x] 全量测试通过

## Comments

- 契约断言集中在 `tests/config-panel.test.ts`：一张契约表列出五个分组及组内 31 个配置项的类型、默认值、role、`min`/`max`/`step`、说明文案、union 取值顺序、array 元素类型，全部读 Schema 运行时节点。
- `tests/plugin.test.ts` 把 koishi 的 `Schema` 替换成只记录链式调用的替身，读不到真实默认值，所以契约断言无法落在该文件里。新文件改为 `vi.mock('koishi', () => ({ Schema: schemastery }))`——`koishi.Schema` 与 `schemastery` 是同一个对象，因此断言读到的是真实 Schema；直接 import 真实 koishi 包会在 vitest 的 ESM 环境里抛 `Class extends value is not a constructor`。
- 删除 `tests/plugin.test.ts` 的 `exports a Config schema for backend options`（67 行源码文本断言）与 `tests/webqq-mock-environment.test.ts` 的 `exposes webQQMockEnvironment in developer options with default false`，两处 `configSource` 绑定一并移除。原有的反向断言（`webQQTheme`、`webQQS3`、`界面外观`/`消息显示` 分组）被「分组名与字段名逐一相等」覆盖，强度更高。
- 三条验收行为已实测：拆行改写 `enableWebQQFrostedGlass` 的链式调用后 36 条测试仍全绿；把 `webQQTimBubbleTail` 默认值改成 `false` 后 2 条失败；调换「小胶囊设置」与「WebQQ 设置」两个分组后 21 条失败。验证完成后 `src/config.ts` 已还原，生产代码零改动。
