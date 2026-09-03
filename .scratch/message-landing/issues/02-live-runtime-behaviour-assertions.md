# 02 — 实时消息落地的行为断言

**What to build:** 实时消息落地这条链路的行为从此可自动验证。它 423 行、七个对外动作，目前**一条行为断言都没有**——唯一"覆盖"它的方式是把它当源码文本读。里面有几件事坏掉会直接伤到管理员：角色思考过程挂错一条消息、token 用量重复贴到后面几条、被撤回的消息在标记模式下从历史里消失、好感度徽标在配置关闭时照样出现。还有一处按容量淘汰最旧会话的缓存逻辑，是全链路唯一会**静默丢数据**的分支。

它本来就是「注入九项依赖、返回七个动作」的形状，不需要改造就能直接实例化；缺的只是有人去测。**生产代码零改动。**

本 ticket 不拆这个 module。423 行的问题是没测不是没拆，拆不拆等断言在手之后再判断——反过来先拆是没有安全网的重构，而这是每条消息都要过的主链路。

**Blocked by:** 01 — Koishi 上下文替身提取到共享测试脚手架（本票需要那个替身：实时消息落地在构造时就注册三个 ChatLuna 事件监听，撤回缓存与好感度徽标还要走数据库）。

**Status:** resolved

**参考:** `.scratch/message-landing/spec.md` 的 Testing Decisions；本轮不拆的理由见其 Implementation Decisions。

- [x] 会话选择门禁：非选中 Bot 的会话不被记录
- [x] 实时消息按会话键进入缓存
- [x] 缓存容量超限时最旧的会话被淘汰（唯一会静默丢数据的分支，不可省）
- [x] token 用量事件记下后，下一条外发消息带上它
- [x] 用量取用后不再重复附加到第二条消息
- [x] 用量不满足展示条件时不附加
- [x] 角色思考过程挂到最后一条外发消息上
- [x] 外发消息还没到时思考过程先存起来，到了再合并
- [x] 撤回广播对应载荷；标记撤回模式下另存一份显示缓存
- [x] 好感度徽标在配置关闭时不附加
- [x] 用量那三条各自独立，不合并成一条——记、取、不重复取是三个失效点，那四个模块级可变量的状态机靠它们钉住
- [x] 通知与表情回应两个子运行时的内部行为不在本票范围内，只测组合它们的那一层
- [x] 生产代码零改动
- [x] 逐条失效实测：故意改坏任一条行为时，对应断言失败
- [x] 全量测试通过

## Comments

逐条失效实测：把生产代码的对应位置逐个改坏、只跑该条断言、再还原，11 处全部变红。

| 注入 | 位置 |
| --- | --- |
| 去掉会话选择门禁 | `recordWebQQLiveMessage` 里的 `isSelectedWebQQSession` 提前返回 |
| 缓存不写入 | `rememberLiveMessages` 不再 `set` |
| 容量上限抬高 1000 | `trimOldestMapEntries(liveMessages, …)` |
| 用量永不记下 | `rememberCurrentWebQQUsage` 提前 `return false` |
| 取用后不重置 | `consumeCurrentWebQQUsage` 去掉 `resetCurrentWebQQUsage()` |
| 展示条件恒真 | `shouldDisplayModelUsage` |
| 思考挂第一条而非最后一条 | 去掉 `.slice().reverse()` |
| 思考不先存起来 | 去掉 `rememberPendingWebQQThinking` |
| 撤回不落库 | 去掉 `persistMarkedWebQQRecall` 调用 |
| 徽标忽略 `showWebQQAffinity` | `createWebQQAffinityBadge` 恒附加 `senderAffinity` |
| 忽略加载门 | `readWebQQAffinityBadges` 去掉 `shouldLoadWebQQAffinity` |

最后两条说明为什么这条断言要同时看三种开关组合：`shouldLoadWebQQAffinity` 与
`createWebQQAffinityBadge` 两道门互为冗余，只断言「两个开关都关时没有徽标」的话，单独改坏任一道
都不会变红。因此断言拆成三段——两关（连库都不查）、只开好感度、只开关系——每道门各自可被杀死。

超出规格所列的两处断言（好感度开启方向、撤回 `remove` 模式）是同一条行为的反向半边：没有它们，
「关闭时不附加」「标记模式下另存」可以靠整条功能坏掉而蒙对。
