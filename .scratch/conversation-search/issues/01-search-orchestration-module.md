# 01 — 查找编排搬成 module

**What to build:** 会话内查找的编排从此可自动验证。目前竞态丢弃、客户端超时、续查游标累加、命中落地这四件事都散在观察窗 SFC 里（10 个 ref + 约 120 行），没有可调用的接口，只能断言源码里含 `searchWebQQMessages({` 这类字符串——测试能告诉你「那行字还在」，不能告诉你「竞态还对」。本 ticket 把编排收成一个可直接实例化的 module，查询、缓存、元数据、滚动、恢复焦点全部作为注入函数，于是「先返回慢的、再返回快的」「搜索途中切会话」这些时序场景第一次能在测试里精确造出来。

管理员看到的界面与交互不变。本轮唯一的两处行为改动都不可见，方向都是少做注定作废的功。

**Blocked by:** 无 — 可以立即开工。

**Status:** resolved

**参考:** `.scratch/conversation-search/spec.md` 的 Implementation Decisions 与 Testing Decisions；客户端超时的理由见 ADR 0006，模块形态的判据见 ADR 0004，跨界 import 的判据见 ADR 0003。

- [x] 查找编排成为 `stores/` 下的 composable，形状与既有 store 一致（注入 ref 与函数，返回状态与动作）；观察窗 SFC 不再持有查找状态与编排函数
- [x] 对外只暴露界面真正消费的状态；竞态序号与**续查游标**留在闭包里，调用方读不到
- [x] 纯函数（合并消息、本地筛选、日期范围转换、错误文案读取）直接 import，不做成注入项；查询能力没有单独命名的端口类型
- [x] 触发按钮的 DOM 引用、`visible` 与恢复焦点前那 50 毫秒的等待留在 SFC；module 只收一个「把焦点还回去」的回调
- [x] 客户端超时毫秒数是可选参数，生产调用点不传；计时器在 `finally` 里清掉
- [x] 存在断言覆盖 15 条行为：空**查找条件**不发请求且重置；本地**命中**先上屏；远端返回后与本地命中合并去重；本地池包含还没落盘的内存消息；竞态后发先回时先发的被丢弃；切会话时远端结果在途则丢弃；切会话时还在读缓存阶段则不写状态也不发请求；超时（注入 5 毫秒）文案为「查找聊天记录超时」；查找结束后超时计时器归零；本地有命中时远端失败不报错；本地无命中时远端失败报错；翻页带游标、不重置、结果追加、游标与「已到底」更新；命中落地（并入消息列表 + 记发送者元数据 + `nextTick` 后调滚动函数并传对的键）；关闭时重置并调恢复焦点回调；打开时重置结果
- [x] 行为修正一：读缓存阶段补齐竞态序号与会话校验，缓存读取期间切走会话不再把上一个会话的本地命中写进状态
- [x] 行为修正二：该守卫命中时整个返回，不再发出注定作废的查询请求
- [x] 「已扫描条数」的 module 累加、观察窗绑定与查找页 prop 声明一并删除；后端契约与前端响应归一化不动
- [x] 切会话时那三行与关闭动作重复的重置已清理，行为不变
- [x] 锁查找编排实现语句的 10 条源码断言已删除，删掉的每一条都能指出接管它的行为断言
- [x] 保留的源码断言未被改动：观察窗的门禁与模板结构 6 条、消息列表 `defineExpose` 契约 2 条、RPC 名 1 条
- [x] 逐条失效实测：故意改坏任一条行为时，对应断言失败
- [x] 全量测试通过

## Comments

- 编排落在 `client/webqq/stores/webqq-message-search.ts`（`useWebQQMessageSearch`）。注入项八个：`currentChat`、`messages`、`requestMessageSearch`、`loadCachedMessages`、`rememberMessageSenderMetadata`、`scrollToMessage`、`restoreTriggerFocus`、可选的 `searchTimeoutMs`。查询能力没有单独命名的端口类型，接缝就是 options 对象本身。
- 对外 8 条状态 + 5 个动作。`nextBeforeSequence` 与 `searchSerial` 是闭包里的普通 `let`，不是 ref——界面不消费它们，做成 ref 只会让调用点能读到。接口宽度本身也有断言（`Object.keys(store)` 全等），所以「已扫描条数」被重新加回来会立刻变红。
- 观察窗那边只留下触发按钮的 DOM 引用、`v-if="currentChat"` 的渲染门禁，以及 `restoreTriggerFocus` 回调里那 50 毫秒的等待（原注释一并搬过去了）。
- 行为修正一与二合成同一句守卫：读缓存后的 `if (!isCurrentSearch(serial, expectedChatKey)) return` 放在发查询之前，所以缓存读取期间切走会话时既不写状态，也不会让服务端去翻最多 10 页 OneBot 历史。
- 断言在 `tests/webqq-message-search.test.ts`（16 条，跑在默认 node 环境）。时序场景靠注入的假实现造：查询函数返回受测试控制的 deferred，于是「先返回慢的、再返回快的」是显式的 `deferreds[1].resolve()` 再 `deferreds[0].resolve()`；缓存读取也能挂住，用来造「还在读缓存就切会话」。超时注入 5 毫秒走真实计时器；只有「计时器归零」那条用假计时器 + `vi.getTimerCount()`。
- 删掉的 10 条源码断言与接管者：触发按钮聚焦语句 →「关闭时…把焦点还回触发按钮」；日期范围转换调用 →「翻页带上续查游标」等所有带 `localDate` 的用例（日期条件不生效时空条件早返回会触发）；查询 RPC 调用 →「本地命中在远端还没返回时先上屏」断言 `queries` 长度；本地筛选函数名 →「本地池包含还没落盘的内存消息」；缓存读取调用 → 同上，断言 `cacheReads` 内容；超时错误构造 →「客户端超时后报出『查找聊天记录超时』」；本地命中判断 →「本地命中…先上屏」与「本地已有命中时，远端失败不报错」；续查游标赋值 →「翻页带上续查游标」；滚动到命中的调用 →「命中落地后先并进消息列表，渲染完成才滚过去」；日期 `v-model` 绑定 →「日历选日期时发出日期更新与查找并收起浮层」（02 号票）加编排里 `messageSearchLocalDate` 的读写断言。
- 逐条失效实测：18 条变异全部让对应断言变红（脚本化跑的，每条改完即还原）。包括把 `mergeMessages(cached, options.messages.value)` 削成 `cached`、把 `serial === searchSerial` 拿掉、删掉 `await nextTick()`、删掉 `clearTimeout`、往返回对象里塞回 `messageSearchScannedCount`。
- 前端产物复查过 ADR 0003 的判据：`dist/index.js` 的 import 只有 `vue` 与 `@koishijs/client`，没有 `koishi`。
