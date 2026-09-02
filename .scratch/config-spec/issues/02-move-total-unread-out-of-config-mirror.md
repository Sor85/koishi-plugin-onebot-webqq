# 02 — 观察窗总未读数移出配置镜像

**What to build:** 让配置镜像只装配置。观察窗总未读数不来自配置、不参与下发，却和十几个配置镜像 ref 混在同一个 module 里，导致「每个镜像配置项都必须四端一致」这条不变量没有明确适用范围。把它挪进独立的运行时状态 module，小胶囊上的未读徽标行为完全不变。

**Blocked by:** None — can start immediately.

**Status:** resolved

**参考:** `.scratch/config-spec/spec.md` 的 Implementation Decisions「前端」一节；依赖方向约束见 ADR 0001。

- [x] 观察窗总未读数由独立的运行时状态 module 持有
- [x] 配置镜像 module 不再导出它，导出面只剩镜像配置项与其派生值
- [x] 小胶囊上的总未读徽标显示、随会话未读变化、以及插件卸载时清零的行为均不变
- [x] 小胶囊领域仍不直接依赖观察窗领域，既有依赖方向不变（ADR 0001）
- [x] 钉住旧 import 位置的断言已更新到新位置，而不是被删掉
- [x] 全量测试通过

## Comments

- 新增 `client/webqq/runtime-state.ts` 持有 `webQQTotalUnread`，沿用 settings.ts / entry-state.ts 的 globalThis 挂载写法（key `__onebot_webqq_client_webqq_runtime__`）。观察窗写、小胶囊读，必须同一个 ref 实例，否则头像徽标不更新。
- `client/webqq/settings.ts` 移除该 ref 的接口成员、初始值与导出，导出面只剩镜像配置项与派生的 `resolvedWebQQColorMode`。
- `client/entry-state.ts` 改为从 `./webqq/runtime-state` 引入并继续 re-export，`resetWebQQClientState()` 仍把它清零；`client/capsule/Capsule.vue` 的 import 路径不变，依赖方向没动。
- `client/webqq/WebQQObserver.vue` 的 `watch(totalUnreadCount, ...)` 写入目标改从 `./runtime-state` 引入。
- 钉住旧位置的三处断言都改到新位置：`tests/webqq-view.test.ts` 的 import 正则指向 `./runtime-state`，并补断言 settings.ts 不再出现 `webQQTotalUnread`；`tests/webqq-members.test.ts` 把初始值断言拆成独立用例，改从 runtime-state 引入，并用 `Object.keys(import * as settings)` 断言配置镜像不再导出它；`tests/capsule.test.ts` 在原有的「不 import ../webqq/settings」旁补上「不 import ../webqq/runtime-state」。
- 收紧成「Capsule.vue 完全不 import ../webqq/*」时测试变红：`Capsule.vue` 现存 `import { getWebQQAccentStyle } from '../webqq/utils/webqq-theme-view'`。搬动这个 util 超出本 ticket 范围，所以断言仍按 module 逐个点名。
- 代码审查后收回三条越界断言：`tests/webqq-view.test.ts` 里对 `runtime-state.ts` 的 `export const ...` 与 `globalThis` 子串断言、以及对 settings.ts 的 `not.toContain('webQQTotalUnread')`，都是新增的源码文本断言。本 ticket 只要求「更新旧 import 位置」，且 spec.md「不断言源码里出现过哪些字符串」；「配置镜像不再导出它」已由 `tests/webqq-members.test.ts` 读运行时导出面覆盖。现在这里只钉 import 位置。
