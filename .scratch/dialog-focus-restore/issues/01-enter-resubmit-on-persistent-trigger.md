# 01 — 输入对话框从常驻按钮打开时，回车提交会立刻重开它

**Status:** needs-triage

**来源:** `.scratch/action-dialogs/` 那轮的真机验证（Chromium 151 + Firefox 153）。当前用户看不到这个问题，属于潜伏形态，是否要修由维护者定。

## 现象

给输入对话框加一个**常驻的、可用键盘激活的**触发按钮，在输入框里按 Enter 提交，对话框会关闭后立刻重新打开，输入框里是刷新后的初始值。Chromium 复现，Firefox 不复现。

Chromium 实测的事件链：

```text
keydown  Enter  target=INPUT[input]            → 提交，宿主清掉 spec，对话框关闭
focusin         target=BUTTON#trigger          → DialogContent 把焦点恢复到触发按钮
keypress Enter  target=BUTTON#trigger          → 同一次 Enter 的 keypress 落到刚获得焦点的按钮
click           target=BUTTON#trigger          → Chromium 按 keypress 激活按钮，对话框重开
focusin         target=DIV[dialog-content]
keyup    Enter  target=DIV[dialog-content]
```

Firefox 只按 keydown 激活按钮，keydown 那一拍焦点还在输入框上，所以整条链走不完。

## 为什么现在不影响用户

三个输入对话框入口（设好友备注、改群名片、设专属头衔）都是右键菜单项。对话框打开时菜单已经关闭、菜单项已卸载，`DialogContent` 里 `previousFocus?.focus()` 作用在游离节点上是空操作，焦点落到 body，没有可激活元素接住那次 keypress。

在触发按钮上加 `@keydown.enter.prevent` **不够**：keydown 发生在输入框上，根本没经过按钮；要挡住得挡 keypress。

## 什么时候会变成真问题

任何一处改成从常驻控件打开输入对话框就会撞上：一级工作区的普通按钮、群资料栏里的行内按钮、工具栏图标。新增入口时没人会想到去测「按回车会不会重开」。

## 可能的处置（未定）

- 焦点恢复推迟到整条按键事件链结束之后（`DialogContent` 里那个 `previousFocus?.focus()` 挪进一次宏任务），与查找页恢复焦点时踩过的那条同类（见 `WebQQObserver.vue` 里 `restoreTriggerFocus` 的注释与 50ms 延时）。
- 提交路径在关闭前 `preventDefault` 掉那次 Enter，掐断 keypress。
- 判定为不修，只在新增入口时靠约定规避。

注意这三条都要改 `client/components/ui/dialog/DialogContent.vue`，属于项目「WebQQ Dialog 生产兼容规则」点名保护的挂载路径，动它必须跑完整生产构建加真实浏览器验证。

## 复现配方

`.scratch/action-dialogs/` 那轮用的临时探针已删除，重建方式记在
`.scratch/action-dialogs/issues/02-dialog-orchestration-module.md` 的 Comments 里。
