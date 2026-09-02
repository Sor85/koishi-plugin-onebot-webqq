# 02 — 输入区组件搬迁与草稿光标断言

**What to build:** 输入区从观察窗 SFC 里独立出来，成为一个可挂载的组件——模板一并搬入，对外只有 props 与 emits。管理员观察到的行为完全不变；维护者拿到的是：输入区的草稿与光标行为第一次可以自动验证。搬迁与草稿光标断言必须同刀落地，否则输入区会处在「刚搬完、旧断言已删、新断言未立」的状态，保护比动手前更少。

**Blocked by:** 01 — 接入按文件生效的 DOM 测试环境。

**Status:** resolved

**参考:** `.scratch/composer/spec.md` 的 Implementation Decisions；浮层挂载约束见 ADR 0002，前端依赖方向见 ADR 0001。

光标契约（抛弃型探针实测确认可原样往返，作为断言的形状依据）：

```
setCaret(编辑器, tokenIndex=2, offset=3) → getCaret(编辑器) === { tokenIndex: 2, offset: 3 }
```

- [x] 输入区成为独立组件，模板与草稿、光标往返、输入法、提及菜单状态、待发附件、发送区占位观测全部搬入
- [x] 对外只有 props 与 emits；提及候选由父层传入，输入区不认识群成员领域
- [x] 发送动作仍由父层完成，输入区不持有当前会话、回复目标、发送 RPC 与共用的错误文案
- [x] 发送功能开关与多选模式的门禁留在父层，关闭时输入区整块不渲染
- [x] 发送区占位对外只暴露一个数字，不对外暴露 DOM 元素引用
- [x] 存在挂载式断言覆盖：草稿渲染、从 DOM 反读草稿、光标往返（含提及之后的文字位置）、输入法进行中回车不触发发送
- [x] 锁草稿与光标实现语句的源码文本断言已删除，删掉的每一条都能指出接管它的行为断言
- [x] 锁样式契约的断言未被改动
- [x] 浮层挂载方式与自定义滚动条指令挂点不变（ADR 0002）
- [ ] 完整构建后关闭旧进程并重启，在真实浏览器里走一遍中文输入法连续上屏、插入提及、粘贴截图、发送成功后焦点回到输入框
- [ ] 浏览器验证结束后关闭本次打开的标签页与自动化进程，清理工具生成的临时目录
- [x] 全量测试通过

## Comments

- 输入区落地为 `client/webqq/components/WebQQComposer.vue`（约 610 行），观察窗 SFC 从 2042 行降到 1549 行。搬进去的是：模板（发送控件、回复条、待发附件、可编辑区、提及菜单、文件输入与两个按钮）、草稿与 token、光标往返、输入法 composition、提及菜单状态、待发附件、发送区占位观测。
- 对外接口只有 props 与 emits，没有 `defineExpose`，也不交出任何 DOM 引用。接口形状与理由写进了 ADR 0004：
  - props：`visible`、`sending`、`mention-candidates`、`chat-key`、`bot-avatar`、`replying-to`、`mention-request`
  - emits：`submit(elements, complete)`、`clear-reply`、`preview-attachment`、`update:sendSpace`、`update:mentionRequest`
- 发送仍在会话层：`submit` 带出 `elements` 与 `complete` 回调，会话层执行 RPC 后用 `complete({ sent, restoreFocus })` 回报。原先「捕获发起时的 textarea 和会话，异步期间切会话不抢焦点」那条约束改由 `restoreFocus` 表达——会话层比较会话键，输入区只负责在收到许可后 `await nextTick()` 再聚焦。
- 发送区占位对外只有一个数字。`--onebot-webqq-webqq-send-height` 不再挂在观察窗根上，改挂输入区的 `form`：它唯一的消费者是 `.onebot-webqq-webqq__send-image`（附件缩略图），就在 `form` 内部，`grep` 确认过没有第二处消费点。
- 切会话的清空由 `chat-key` prop 驱动，没有用父层换 `key` 重挂载的写法，理由见 ADR 0004。
- 浮层挂载方式与滚动条挂点原样搬迁：提及菜单仍是 `.onebot-webqq-webqq__send-main` 里的 `v-if` 子节点（没有换成 Teleport），`v-webqq-scrollbar="{ tone: 'accent' }"` 仍挂在真实的可编辑区元素上。
- 本轮删掉的源码文本断言（每条都注明接管者，均在挂载面上）：
  - `tests/webqq-view.test.ts`：`@keydown="handleComposerKeydown"`、`const composerDraft = ref<...>`、`...serializeWebQQComposerDraft(...)`、`WebQQMentionMenu`、`not.toContain('pendingMentionUserIds')`、`not.toContain('class="onebot-webqq-webqq__send-mentions"')`、`const contextHeight = ...`、`webQQSendSpace.value = ...`、`ref="sendTextInput"`、`const requestInput = ...`、`await nextTick()`、`requestInput?.focus()`、`@paste="handleSendPaste"`、`Binary.toBase64(...)`、`onebot-webqq-webqq__send-file-icon`、`onebot-webqq-webqq__send-file-base`、`function getSendFileNameParts`、`type WebQQSendFileKind = ...`、`if (mime.startsWith('video/'))`、`webQQVideoFileExtensions.has(...)`、`URL.createObjectURL(file)`、`ref="sendContext"`、`sendContextResizeObserver.observe(...)`、`v-else-if="file.kind === 'video'"`、`<video`、`preload="metadata"`、`videoDraftSource not.toContain('openLocalImagePreview')`、`openLocalImagePreview(file.previewUrl)`、`class="onebot-webqq-webqq__send-image-remove"`、`URL.revokeObjectURL(file.previewUrl)`。接管者分别是 `tests/webqq-composer-editor.test.ts`（草稿、光标、输入法、提交交接、禁用态、焦点恢复）、`webqq-composer-mention.test.ts`（提及全套）、`webqq-composer-attachments.test.ts`（三类判定、粘贴、移除、放大请求、字节、清空）、`webqq-composer-send-space.test.ts`（占位公式）。
  - `tests/webqq-composer-ui.test.ts`：`contenteditable`、`WebQQMentionMenu`、`serializeWebQQComposerDraft`、`not.toContain('onebot-webqq-webqq__send-mentions')`、`class="onebot-webqq-webqq__send-context"`、`replyingToMessage || sendFiles.length`，以及整条「中途输入 @ 时使用本次 DOM 草稿计算光标」（4 条实现语句断言）。最后这条的行为接管者是 `webqq-composer-mention.test.ts` 的「在已有文字后面键入 @ 一样打开菜单」与「可编辑区的 input 早于光标更新时，下一微任务按真实光标补开菜单」。
- 保留的源码断言只剩两条，都不是输入区逻辑：`v-if="enableWebQQSend && currentChat && !selectionMode"`（门禁在父层）与 `'--onebot-webqq-webqq-send-space': ${selectionMode.value ? 64 : webQQSendSpace.value}px`（多选模式固定占位）。两者都没有可挂载的替代读取点——观察窗 SFC 依赖数十个 store 与 RPC，挂不起来。
- 锁样式契约的断言一条没动：`tests/webqq-composer-ui.test.ts` 里候选菜单不产生内部滚动条、上下文层 `flex-wrap: wrap`、回复条 `line-height: 18px`、mention token `display: inline-flex`，以及 `tests/style.test.ts` 里发送控件与候选菜单的毛玻璃断言，全部原文保留。
- 失效实测（改坏→变红→改回，用一次性脚本批量跑，脚本已删）：光标读回恒返回 0、输入法进行中回车照发、`complete({sent:true})` 不清草稿、`restoreFocus` 取反——四条都各自变红。
- 未完成：真实浏览器人工回归。本机 `koishi-dev` 会连真实 OneBot 与数据库，按项目既有约定不擅自启动；中文输入法连续上屏与真实截图粘贴也必须由人操作。清单留给用户执行。
- 代码审查后的四处修正：
  1. 测试脚手架的 `composerEditor` 改名 `composerEditable`，测试文件 `webqq-composer-editor.test.ts` 改名 `webqq-composer.test.ts`：`CONTEXT.md` 的输入区词条把「编辑器」列进 _Avoid_，而 spec 通篇用「可编辑区」。
  2. `lastSubmit` 原本在两个测试文件各写一份，收进 `tests/helpers/webqq-composer.ts` 的 `lastComposerSubmit`。
  3. 搬迁过来的光标代码里，「这个子节点算不算一个 token」判断重复三处，抽成 `isComposerTokenNode`；`handleComposerInput` 的 `nextTick` 回调与 `syncComposerCaretFromDom` 是同一段钳制逻辑，让后者返回是否读到光标，前者改成 `if (syncComposerCaretFromDom()) updateMentionMenuFromDraft(...)`。两处都是等价改写，行为不变，改完全量测试与失效实测都重跑过（`isComposerTokenNode` 改坏会变红）。把这个返回值恒真化则不会变红——那是个等价变异：读不到光标时草稿与上一次同步调用之间没有变化，重算提及菜单是幂等的。保留这个判断只为与搬迁前的语义逐字对齐。
  4. ADR 0004 里把发送区占位写成 `v-model:send-space` 有误——它只有 `update:send-space` 事件，没有对应 prop，已改成事件说法。提及请求那条才是真的 `v-model`。
