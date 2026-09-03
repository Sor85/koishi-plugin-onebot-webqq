# 03 — 查找失败路径补上会话校验

**What to build:** 会话内查找的失败路径现在只校验竞态序号，不校验会话。成功路径两样都查（`isCurrentSearch(serial, expectedChatKey)`），`catch` 只查 `serial`。于是「远端结果在途时切走会话」这条时序在成功路径上有守卫、在失败路径上没有：切走会话后远端报错，上一个会话的失败文案仍会写进状态。

这条差异是 01 号票逐字等价搬迁时从观察窗 SFC 一起搬过来的，不是新引入的。它现在不出事，形态和 01 号票修掉的那两处完全一样——被别处的顺手清理掩掉了，而不是因为守卫存在。

管理员看到的界面与交互不变。

**Blocked by:** 无 —— 01 号票已 resolved，可以立即开工。

**Status:** resolved

**来源:** `/code-review` 的 Standards 轴，被标为判断题（Repeated Switches）。核对后确认是真实缺口，但补它属于 spec 之外的第三处行为改动，所以从 01 号票里拆出来单独立票。

**参考:** `.scratch/conversation-search/spec.md` 的「本轮允许的两处行为改动」（本票是被那条边界挡在外面的第三处）；`client/webqq/stores/webqq-message-search.ts`；断言落点 `tests/webqq-message-search.test.ts`。

## 为什么现在不出事

切会话必然触发观察窗的 `watch(currentChat)` → `closeMessageSearch()` → `searchSerial++`，所以 `catch` 的序号检查事实上兜住了会话切换。即使赶上「远端 reject 与切会话落在同一轮微任务、排在 watcher 之前」这种极窄窗口，`closeMessageSearch()` 紧接着调的 `resetMessageSearchResults()` 也会把 `messageSearchErrorText` 清成 `''`。

也就是说：**这个守卫的缺失完全依赖观察窗「切会话就关掉查找框」这个当前行为来掩盖。** 哪天有人决定跨会话保留查找条件（是个合理的产品想法），失败路径就会开始静默地把上一个会话的错误写给当前会话，而现在没有任何断言会变红。

## 实测证据

直接实例化 module、切走会话后 reject 远端查询，当前实现的结果：

```
errorText = "群历史接口不可用"
searched  = true
loading    = false
```

期望是 `errorText` 保持 `''`、`searched` 保持 `false`。

## `finally` 不要一起改

`catch` 与 `finally` 看起来是同一种不对称，但只有 `catch` 是错的。

`finally` 里 `if (serial === searchSerial) messageSearchLoading.value = false` 只查序号是**正确的**：这一句的职责是「只有当这次查找还占着 loading 标志时才把它放下」。有更新的查找接手（序号已变）就不该动；而会话切走但没有更新的查找时，这次查找**仍然占着**那个标志，必须放下，否则「搜索中...」会永久卡住。加上会话校验反而会引入一个真实的卡死路径。

请把这条理由就地写成注释，否则下一轮「让两处守卫对称」的清理会把它改坏。

- [x] `catch` 分支改用会话校验（序号 + 会话键），与成功路径一致
- [x] `finally` 保持只查序号，并就地注释说明为什么不能一起改（会话切走但无新查找时，卡住的 loading 只能由这次查找放下）
- [x] 存在断言：远端结果在途时切走会话，远端失败既不写错误文案也不把 `searched` 置为 true，但 `loading` 仍归零
- [x] 现有的「本地没有命中时，远端失败报出真实原因」与「本地已有命中时，远端失败不报错」两条断言仍通过（会话没变时失败路径行为不变）
- [x] 逐条失效实测：把 `catch` 的守卫退回只查序号时新断言变红；把 `finally` 也加上会话校验时「loading 归零」那条变红
- [x] 全量测试通过

## Comments

- 改动只有一处：`catch` 开头的 `if (serial !== searchSerial) return` 换成 `if (!isCurrentSearch(serial, expectedChatKey)) return`，与成功路径同一句守卫。`finally` 一行没动，只补了注释。
- 断言是 `tests/webqq-message-search.test.ts` 的「远端结果在途时切走会话，远端失败也不写错误文案」，紧挨着成功路径那条同名场景，两条并排读就能看出这是一对。断言里同时钉住 `loading` 仍归零——这是 `finally` 那条决定的正向证据，不只是注释里的说法。
- 走的是 TDD：先加断言，实测变红（`expected '群历史接口不可用' to be ''`），再改守卫，转绿。
- 失效实测两条都如票里预测的那样变红：
  - `catch` 退回只查序号 → 新断言在 `errorText` 那行变红。
  - `finally` 也加上会话校验 → 新断言在 `loading` 那行变红（`expected true to be false`），正是票里说的「搜索中...」永久卡住那条路径。这条变异证明了「两处守卫看起来不对称，但只有 catch 是错的」不是猜测。
- 顺带复跑了 01/02 号票那 33 条变异，结果与上一轮完全一致（32/33，唯一不变红的仍是 02 号票里已记录的 `removeEventListener` 那条，原因是 Vue 的 `emit` 在 `isUnmounted` 时直接 return）。
- 验证：vue-tsc 通过；`yarn test` 45 文件 670 测试全通过（比上一轮多 1 条，就是本票新增的）；`yarn build` 两侧成功。
