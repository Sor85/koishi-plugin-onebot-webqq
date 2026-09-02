# 06 — 下发 payload 由配置规格驱动并统一空值语义

**What to build:** 让「哪些配置项会送到前端」只有一处答案，并修掉一处既存不一致。下发给控制台的 payload 改由配置规格的镜像配置项列表生成，不再逐项手写。同时统一空值语义：默认只有未设置才落默认值，四个枚举与颜色配置项额外按规格标记把空字符串视为未设置——这修掉了「服务端保留空串、前端却兜成默认值」的两侧行为差异。

**Blocked by:** 04 — 配置规格 module 与双向键集断言。

**Status:** resolved

**参考:** `.scratch/config-spec/spec.md` 的 Implementation Decisions「服务端」与「空值语义」两节；接缝选择见 Testing Decisions。

- [x] 下发 payload 由配置规格的镜像配置项列表生成，不再逐项手写
- [x] 非镜像配置项不出现在 payload 里；好感度 scopeId 即使被显式配置也不出现
- [x] 聊天样式、颜色模式、强调色、存储后端传入空字符串时，payload 落到各自默认值
- [x] 默认开启的布尔开关传入关闭值时，payload 仍是关闭而不是被兜回默认值
- [x] 数值配置项传入边界值时，payload 不被替换成默认值
- [x] 上述断言通过插件 apply 加内存 Console 替身取 payload 完成，不新增任何生产导出
- [x] 新增一个镜像配置项时，无需再编辑下发逻辑即可出现在 payload 里
- [x] 全量测试通过

## Comments

- `src/capsule/console-entry.ts` 的 18 行逐项赋值收成 `...readMirroredConfigValues(config)`。payload 现在是「胶囊快照 + Bot 状态 + 全部镜像配置项」，19 个镜像配置项一个不多一个不少。
- 空值语义集中在 `readConfigValue`：只有 `undefined` / `null` 落默认值；标了 `blankIsUnset` 的四项（聊天样式、颜色模式、强调色、存储后端）额外把空字符串视为未设置。使用点不再各写运算符，服务端的 `??` 与前端的 `||` 也就不可能再分叉。
- 数组默认值逐次复制（`cloneDefault`）。直接返回规格里的那个实例的话，任何消费方对 `hiddenCapsuleActivityIds` 的一次 push 都会永久污染默认值；`tests/config-mirror.test.ts` 有一条断言钉住这点。
- `debug` 不再由 runtime 预先算成 `!!config.debug` 再塞进 payload：它就是一个普通的镜像配置项，走同一条规格读取路径。`registerConsoleEntry` / `registerCapsule` 的 `debug` 入参与 `createPluginRuntime` 返回值里的 `debug` 因此成为死参数，一并删掉。
- 新增 `tests/config-mirror.test.ts`，主接缝是插件 apply + 内存 Console 替身取入口回调 payload。koishi 只被替换掉 `Schema`（换成真实的 schemastery），所以同一个文件里既能 apply 插件、又能读真实 Schema 运行时节点。
- 三个枚举配置项的空串没法先过 `Config()` 再喂给 apply——schemastery 的 union 会直接抛验证错误。因此 payload 断言把裸 config 交给 `apply`（插件对外签名本来就接受 `Config = {}`），Schema 那一端单独用 `Config({})` 交叉断言。
- 删掉 `tests/plugin.test.ts` 里两条钉住 `webQQStorageBackend: config.webQQStorageBackend ?? 'koishi'` 的源码文本断言；payload 内容已由新文件的运行时断言覆盖。
