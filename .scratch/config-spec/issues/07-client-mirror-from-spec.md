# 07 — 前端配置镜像的类型与初始值由配置规格派生

**What to build:** 前端不再自带一份默认值。配置镜像的类型与 ref 初始值都改从配置规格派生，组合根里的逐项赋值改成由规格驱动。管理员能观察到的变化是：改配置后界面按预期生效，关掉一个默认开启的开关后它保持关闭而不回弹。配置镜像的 ref 仍由观察窗、小胶囊、入口三个领域各自持有，不集中。

**Blocked by:** 02 — 观察窗总未读数移出配置镜像；06 — 下发 payload 由配置规格驱动并统一空值语义。

**Status:** resolved

**参考:** `.scratch/config-spec/spec.md` 的 Implementation Decisions「前端」一节；前端依赖禁令见 ADR 0001，前端产物不得混入服务端框架依赖见 ADR 0003。

- [x] 前端配置镜像的类型由配置规格派生，只覆盖镜像配置项
- [x] 前端配置镜像的 ref 初始值来自配置规格，前端不再出现自带的默认值字面量
- [x] 组合根里的赋值由配置规格驱动，赋值目标仍是各领域自己持有的 ref
- [x] 前端未新建被两个前端领域共同依赖的 module（ADR 0001）
- [x] 前端产物里搜不到服务端框架依赖（ADR 0003）
- [x] 完整构建后关闭旧进程并重启，确认加载的是最新产物
- [x] 在浏览器里实测观察窗毛玻璃、消息发送栏、TIM 气泡小尖角三个开关真实生效
- [x] 关掉一个默认开启的开关后界面保持关闭，不回弹到默认值
- [x] 浏览器验证结束后关闭本次打开的标签页与自动化进程，清理工具生成的临时目录
- [x] 全量测试通过

## Comments

- 三个领域各自从规格取初始值，没有新建共享 module：`client/webqq/settings.ts` 用一张 `WEBQQ_SETTINGS_KEYS`（`as const satisfies readonly MirroredConfigKey[]`）循环建 17 个 ref；`client/capsule/state.ts` 与 `client/entry-state.ts` 各只有一个镜像配置项，直接 `ref(readConfigDefault(...))`。`ConfigMirrorRefs` 那行映射类型在 settings.ts 与 index.ts 各写一次——把它提出来就会造出一个被两个前端领域共同依赖的浅 module，撞 ADR 0001。
- 取值联合类型统一由规格声明，`client/webqq/settings.ts` 改成 `export type { WebQQChatStyle, WebQQColorMode, WebQQStorageBackend } from '../../src/config/spec'`，所有 `from '../settings'` 的现有引用零改动。
- 组合根 `client/index.ts`：`ClientData` 改成 `interface ClientData extends Partial<MirroredConfigValues>`，只手写 capsule / bots / selectedSelfId；19 行赋值收成 `for (const key of mirroredConfigKeys)`。`configMirror` 这张表用 `{ [K in MirroredConfigKey]: Ref<ConfigValue<K>> }` 标注，少一个键就编译报错——实测往规格里加一个镜像配置项后，`client/index.ts:27` 报 TS2741。
- 循环里必须经过泛型函数 `applyMirroredConfigValue`：直接写 `configMirror[key].value = ...` 时索引类型会退化成联合，赋值不通过。它的第二个参数是整份下发 payload，代码审查后从 `value` 改名成 `data`，避免读成「这个配置项的取值」。
- 顺手删掉 `client/entry-state.ts` 里 12 个只 import 不使用的 settings ref 与两个不使用的 bots import。
- 前端产物复查：`dist/index.js` 里 `from"koishi"` 计数为 0，仅剩 external 的 `@koishijs/client`，其余 `koishi` 字样都是字符串取值（如 `webQQStorageBackend: "koishi"`）。规格确实被打进了产物（能搜到 `blankIsUnset`），但它零 koishi 依赖。
- 浏览器实测（Chrome，`http://127.0.0.1:5140`，完整 `yarn build` 后杀掉旧 dev 进程组与孤儿 worker、确认 5140 释放再重启，只有一个新实例）：
  - 关掉 `enableWebQQFrostedGlass` → 观察窗根节点 `is-frosted` 变 `is-plain`、`document.body.dataset.onebotWebqqFrosted` 消失，保存后开关**保持关闭**没有回弹到默认 true。
  - 关掉 `webQQTimBubbleTail` → 根节点丢掉 `has-tim-bubble-tail`。
  - 关掉 `enableWebQQSend` → 聊天区的 contenteditable 消失，消息列表照常渲染 56 条。
  - 三个开关恢复原值后界面同步复原，dev 的 `koishi.yml` 键集与改动前一致（Koishi 自己把回到默认值的两项从文件里删掉了）。
- 浏览器会话已关闭（`playwright-cli list` 为空），`/tmp/.playwright-cli` 已清理；仍在运行的 Chrome 进程属于 Koishi 的 puppeteer 插件，不是本次任务打开的。
