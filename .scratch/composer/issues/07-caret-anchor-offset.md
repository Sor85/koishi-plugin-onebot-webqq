# 07 — 修掉光标锚点造成的提及查询串偏移

**What to build:** 修一处刚被新测试面照出来的老 Bug。空草稿的可编辑区里放着一个零宽字符当光标锚点，输入字符后这个锚点仍留在 DOM 里，但草稿 token 会把它剥掉。于是 DOM 偏移比 token 偏移多 1：光标停在文字中间键入 `@` 时，候选菜单按**光标后面那个字符**筛选，而不是按空查询串列出全部成员。

管理员看到的症状是：在「你好世界」中间点一下再打 `@`，候选列表莫名只剩一两个人，而且插入位置也可能偏一位。光标停在末尾时不会出现——`getComposerCaret` 的钳制正好把多出来的 1 削掉了，所以这个 Bug 只在「草稿自上次重渲染以来一直是纯键入」且「光标不在末尾」时出现。插入过任何提及之后可编辑区会被重渲染，锚点消失，症状也随之消失。

**Blocked by:** None — 03 已经建好提及的挂载断言，本 ticket 直接在上面加断言。

**Status:** resolved

**参考:** `.scratch/composer/spec.md` 的 Problem Statement 把「`@` 菜单插到错误位置」列为管理员症状之一；本轮只做搬迁与附件清空，没有修它。

实测复现（happy-dom，`tests/` 里的临时探针，已删）：

```
键入 'AB'                → 可编辑区文本 "<ZWSP>AB"，草稿 token "AB"
光标放到 DOM 偏移 2（A 与 B 之间）再键入 '@'
可编辑区文本变成 "<ZWSP>A@B"，DOM 偏移 3，token 偏移被算成 3（真值是 2）
detectWebQQMentionTrigger('A@B', 3) → query 'B'
候选菜单只剩 Bob；正确行为是 query '' 列出 Alice 与 Bob
```

- [x] 光标停在文字中间键入 `@` 时，候选菜单按空查询串列出全部成员
- [x] 同一状态下选中候选，提及插在光标处而不是偏一位
- [x] 修法不引入「渲染时不放锚点」的回退：空草稿仍要有可点击的光标落点
- [x] 存在挂载式断言覆盖上面两条，且去掉修复时断言变红
- [x] 已有的光标、提及、输入法断言全部不变
- [x] 全量测试通过

## Comments

- 修法是在读光标那一侧做一次显式换算。`webqq-composer-draft.ts` 新增两样东西：锚点常量 `WEBQQ_COMPOSER_CARET_ANCHOR` 与 `toWebQQComposerTokenOffset(domText, domOffset)`——后者把光标之前的锚点个数减掉。`getComposerCaret` 从可编辑区文本节点读 `range.startOffset` 时改走这个换算，`renderComposerDraft` 与 `normalizeWebQQComposerTokens` 也改用同一个常量，于是「放锚点、剥锚点、算偏移」三处第一次共用一个定义——这个 Bug 本来就是三处各自写死零宽字符、其中一处忘了它才出现的。
- 反方向（token 偏移 → DOM 偏移）**没有**加换算。`setComposerCaret` 只在 `applyComposerDraft` 里被调用，而它总是先 `renderComposerDraft`；重渲染之后带锚点的文本节点必然对应空 token，空 token 唯一合法的偏移就是 0，所以换算与原来的钳制恒等。第一版顺手写了对称的 `toWebQQComposerDomOffset`，失效实测里把它改坏不变红，确认是不会被执行到的分支，已删除。
- 断言：`tests/webqq-composer-mention.test.ts` 的「WebQQ 输入区在文字中间提及」两条（复现路径是 `focusComposerEnd` → 键入 `你好世界` → 把光标放回 `世` 之前 → 键入 `@`），加上 `tests/webqq-composer.test.ts` 的「空草稿里留着一个零宽锚点」——后者用码点断言锚点有且只有一个，锁住「不许靠删锚点来修」。
- 失效实测（改坏→变红→改回）：读侧退回 `range.startOffset`、`toWebQQComposerTokenOffset` 不减锚点、渲染时不放锚点——三条都各自变红。
- 真实浏览器验证（Chrome 152 / Firefox 153，走输入区独立探针页，细节见 02 号任务单）：先证实前提在真实浏览器里成立——点进空输入框后键入，可编辑区原文是 `"<ZWSP>你好世界"`，光标确实落在锚点之后，所以这不是无头 DOM 的产物；再用**真实鼠标点击**把光标放到「好」与「世」之间（按 Range 的 client rect 算坐标，落点由浏览器自己决定），键入 `@` 后候选菜单列出全部 3 名成员，点选 Alice 得到 `你好 @Alice<NBSP>世界`，继续键入接在提及后面。两端结果一致。
- 候选顺序在真实浏览器里是 `小明、Alice、Bob`，在 Node 里是 `Alice、Bob`：`filterWebQQMentionCandidates` 末尾用 `localeCompare(…, 'zh-Hans')`，排序表由运行环境的 ICU 决定。断言因此只锁「空查询串列出全部成员」，不锁顺序。
