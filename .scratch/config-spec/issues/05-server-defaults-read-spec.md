# 05 — 服务端兜底改读配置规格

**What to build:** 消掉服务端的第二份默认值。服务端有约三十处「配置项 ?? 字面量」形式的兜底，其中撤回标记和 character thinking 显示这两项的兜底各写了两遍。全部改为读配置规格。这是 expand–contract 里的一个迁移批次，运行时行为不变，没有用户可见变化。

**Blocked by:** 04 — 配置规格 module 与双向键集断言。

**Status:** resolved

**参考:** `.scratch/config-spec/spec.md` 的 Implementation Decisions「服务端」一节。

- [x] 服务端不再出现「配置项 ?? 字面量」形式的第二份默认值
- [x] 历史条数、图片代理缓存三项、运行时 bot 模式、bot selfId 集合、协议选择、模拟 bot 数量、撤回标记、character thinking 显示、模拟环境、调试开关的默认值全部来自配置规格
- [x] 同一配置项在多处消费时读到同一个默认值
- [x] 依赖具体配置值的既有运行时行为测试全部仍然通过，包括撤回标记、character thinking 显示、协议选择、模拟环境
- [x] 本 ticket 作废的源码文本断言在本 ticket 内删除，不留给后续 ticket
- [x] 服务端构建通过
- [x] 全量测试通过

## Comments

- 改动点：`runtime/create-runtime.ts`（历史条数、debug、selfId 集合、运行时 bot 模式、图片缓存三项、模拟 bot 数量、模拟环境、协议）、`runtime/register.ts` 与 `webqq/message-flow/live-runtime.ts`（character thinking 显示、撤回标记，这两项原本各写两遍）、`webqq/console.ts`（撤回标记、模拟环境）、`webqq/storage/message-cache.ts`、`webqq/storage/recall-cache.ts`、`webqq/storage/state.ts`。
- 两处常量本身就是第二份默认值，一并改成从规格换算：`media/image-url-resolver.ts` 的 `WEBQQ_IMAGE_CACHE_LIMIT` / `WEBQQ_IMAGE_CACHE_ITEM_LIMIT`（原来硬写 `100 * 1024 * 1024` / `10 * 1024 * 1024`），以及 `storage/message-cache.ts` 导出的 `defaultWebQQMessageCacheLimit`（已删除，两个消费点直接 `readConfigValue`）。
- `adapters/onebot/service.ts` 的 `options.protocol ?? 'napcat'` 改读规格默认值而不是收成必填参数：`createOneBotWebQQService` 的 options 类型里 protocol 本来就是可选的，让它自己兜到规格默认值比要求每个调用方都先解析一次更少出错。
- 顺带修掉一类同类不一致：`webQQStorageBackend` 在 `storage/message-cache.ts`、`storage/state.ts` 里是裸比较 `=== 'koishi'`，未设置时会走 browser 分支，而下发 payload 兜的是 `'koishi'`。三处现在都读规格，未设置时统一按 `koishi` 处理，与配置面板默认值一致。严格说这超出了「`?? 字面量` 改读规格」的字面范围，spec 的 Out of Scope 也写着不改语义；保留它的理由是本 ticket 有一条「同一配置项在多处消费时读到同一个默认值」，而这正是同一个配置项被两种方式读出两种默认值。生产路径上 Koishi 已按 Schema 填好默认值，因此没有用户可见变化，只影响直接 `apply(ctx, {})` 的调用方。
- 代码审查后补掉一处漏改：`media/image-url-resolver.ts` 的 `options.cacheEnabled ?? true` 也是图片缓存三项之一，同样改成读规格默认值。之前只改了两个 MB 上限。
- 删掉两条作废的源码文本断言并换成运行时断言：
  - `tests/plugin.test.ts` 原来钉住 `create-runtime.ts` 里三行图片缓存兜底的文本，改成 `createPluginRuntime` + 假 server 的运行时断言：单张上限配 1 MB 时，2 MB 的响应在读 body 之前就返回 413。这条同时覆盖了 MB→字节的换算，比原来的子串匹配强。
  - `tests/webqq-mock-environment.test.ts` 原来钉住 `config.webQQMockEnvironment` 与 `createMockWebQQService(undefined, { mockBotCount: config.onebotMockBotCount })` 的写法，改成 `tests/plugin.test.ts` 里的插件 apply 断言：开着模拟环境时 contacts 返回 `mockEnvironment: true`、入口数据带上两个模拟 bot、且即使 `showWebQQAffinity` 为真也不会去查 `chatluna_affinity_v2`。实测把 console.ts 的模拟环境判断改坏后这条会红。
