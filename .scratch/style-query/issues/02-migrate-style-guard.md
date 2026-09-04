# 02 — 样式守卫迁到样式查询 module

**What to build:** 样式守卫那 735 条断言从此都经过样式查询 module，三处正在瞎测的断言变红并被修好。

这一票是 expand–contract 的 migrate 加 contract：迁完调用点，顺手删掉那 6 个旧助手。**中间态会红，那是产出不是事故**——打开唯一性检查、补上最大那个样式文件之后，凡是原来在瞎测的地方都会报错，每一处都要判断「它原本想测什么」，然后收窄来源或改用别的方法。

断言的**参数一条都不改**。外部行为完全不动，动的只是读取方式。管理员看不到任何变化，样式一行不改。

**Blocked by:** 01 — 样式查询 module 立起来。

**Status:** resolved

**参考:** `.scratch/style-query/spec.md` 的「断言怎么迁」、「查询来源与歧义」、「消歧发现样式该改时本轮不改样式」、「组件源码断言与样式查询分开」、「失效实测要做两种」；三处 live 缺陷的位置与形状见 Problem Statement。

- [x] 全部调用点改走样式查询 module；断言的**参数**一条不改
- [x] 三处 live 缺陷各自先变红再修好：那条测空串的死断言、那对子串型冗余断言、最大那个样式文件对规则查询不可见
- [x] 那条死断言的选择器只作为逗号列表成员出现，修法是改用会校验前导的访问器，**不是**把选择器改成能匹配的样子
- [x] 依赖嵌套内容的那 9 条分三拨：`@keyframes` 与 `@media` 改用块访问器；真正要子规则内容的改成嵌套查询（先取父规则本级 body，再在里面查）；唯一那条依赖嵌套语法 `&` 的正则**原样保留**——它测的是 SCSS 源码的嵌套写法本身
- [x] 25 个多处定义的选择器逐个收窄来源；有 6 个是**同一文件内**重复，所以「指定文件」不够，要收窄到父规则 body
- [x] 若某个选择器找不到任何能消歧的收窄，**记进本票 Comments，不改样式**——合并同选择器块会改变声明顺序进而可能改层叠结果，会失掉「样式一行没改」这张安全网
- [x] 17 条负向断言里，凡是整个测试对同一个 body **只有**负向断言的，补一条最小的正向断言；不逐条都配
- [x] 三处**故意**依赖「找不到」的判据（「这条规则不该存在」）改用「问规则是否存在」，判据方向不能反过来
- [x] 整文件 `toContain(选择器)` 收紧成「问规则是否存在」；整文件 `toMatch` **保留**（跨规则模式与全文禁令，主体本来就该是整份源码）
- [x] 7 处手写惰性正则提属性值改用声明值访问器
- [x] 5 处临时把源码再拼一次的写法删掉——它们存在的唯一原因就是最大那个文件没进默认来源
- [x] 17 条读组件单文件组件源码的断言**不动**，且不经过样式查询 module（它们守的是组件契约不是样式契约）
- [x] 迁完删掉那 6 个旧助手，文件里不留第二套查询实现
- [x] 第一种失效实测：改坏 SCSS，对应断言变红
- [x] 第二种失效实测（本票验收核心）：那条死断言迁移后必须报错；那对子串型断言收紧后，删掉逗号列表里的那处用法必须让前一条**独立**变红；那个写了两个块的选择器交给规则访问器必须触发唯一性报错；给某条被查询的规则加一句带花括号的注释不得让断言量错对象
- [x] 样式一行不改，生产代码零改动
- [x] **不需要浏览器验证**
- [x] `yarn typecheck`、`yarn test` 与 `yarn build` 通过

## Comments

### 迁移后的读数

95 个测试全绿。断言的参数没动——只有票里点名要收紧的那些例外：13 条整文件 `toContain(选择器)` 收紧成 `hasRule(…)).toBe(true)`，三处「这条规则不该存在」的判据改用存在性表达，另加四条最小正向断言。样式一行没改（`git diff client/ src/` 为空）。

### 三处 live 缺陷各自的处理

- **测空串的死断言**（撤回气泡不该有 `top: 50%`）：选择器 `.onebot-webqq-webqq__message.is-recalled .onebot-webqq-webqq__bubble` 在 `webqq-messages.scss` 里是逗号列表的首项，旧访问器只认「选择器 后跟空格花括号」，永远返回空串。改用会校验前导的访问器后它真的量到了那条规则（本级只有 `opacity: 0.62`），并补了一条最小正向断言。**没有改选择器，也没有改样式。**
- **子串型冗余的一对**：`.onebot-webqq-webqq__notice-menu--desktop` 与 `…--desktop.is-color-dark` 两条整文件 `toContain`，前者是后者的子串。两条都收紧成 `hasRule`，现在各自独立。
第 14 条整文件 `toContain(选择器)` 没有收紧：`.onebot-webqq-webqq__profile-card-select-menu` 在样式源里只作为后代选择器的一节出现（`.onebot-webqq-webqq__portal-page .onebot-webqq-webqq__profile-card-select-menu`），没有自己的规则。收紧成存在性就得给参数加上祖先前缀，而「改动任何一条断言的参数」在 Out of Scope 里，所以它留在整文件 `toContain`，理由写在断言旁边。想收紧就得连参数一起改，那是另一票。

- **最大那个样式文件对规则查询不可见**：`webqq-interactions.scss`（1503 行）与 `webqq-box-model.scss`、`webqq-typography.scss` 一起补进默认来源，覆盖率 71% → 100%。四处 `${style}\n${webqqInteractionsStyle}` 之类的临时拼接随之消失。

### 迁移中发现的第四处 live 缺陷

`ruleBody('.onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble')` 量的根本不是这条规则。这个选择器在样式源里没有扁平写法（SCSS 里是 `.onebot-webqq-webqq__message` 的 `&.is-outgoing` 子规则），旧访问器的 `indexOf(选择器 + ' {')` 命中了 `theme-colors.scss` 里 `.onebot-webqq-webqq.is-plain .onebot-webqq-webqq__message.is-outgoing .onebot-webqq-webqq__bubble {` 的**尾部子串**，于是它一直在量 `.is-plain` 那条主题覆盖。改成嵌套查询（先取 `.onebot-webqq-webqq__message` 的块，再取 `&.is-outgoing` 的块，再查 `.onebot-webqq-webqq__bubble`）。

### 消歧发现的样式问题（本轮不改样式）

按票里的约定记在这里，值得的话另开票：

- `webqq-interactions.scss` 给 Teleport 面板先写了一个**只放主题令牌**的同选择器块（文件开头 4–34 行的两个逗号列表），真规则写在后面。受影响的是 `.onebot-webqq-webqq__portal-page`、`.onebot-webqq-webqq__notice-menu--desktop`、`.webqq-dialog-content`、`.webqq-context-menu-content`。
- `.webqq-dialog-content` 在同一个文件里有**三处**定义：令牌块、真规则（129 行）、以及把整段转发目标弹窗规则包起来的包装块（1353–1503 行）。包装块里的子规则缩进写在第 0 列，看上去像顶层规则，实际是 `.webqq-dialog-content` 的后代。
- `.onebot-webqq-webqq__secondary-page.onebot-webqq-webqq__portal-page` 有两个顶层块（248 行是本体，313 行是和 `*` 共用的滚动条声明）。
- `.onebot-webqq-webqq__search-icon` 在 `webqq-shell.scss` 里两块（一块尺寸、一块定位）；`.onebot-webqq-webqq__send-image-preview video` 在 `webqq-chat.scss` 里两块（一块与 `img` 共用尺寸、一块视频专属）；`.onebot-webqq__avatar`、`.onebot-webqq__title`、`.onebot-webqq__bot-overflow-avatar`、`.onebot-webqq-webqq__bubble` 同样是「共用形态 + 专属覆盖」两块。
- `.onebot-webqq-webqq.is-color-dark .onebot-webqq-webqq__chat-header` 在 `theme-colors.scss` 里两块，后一块只重复了前一块已经声明过的 `background: color-mix(in srgb, var(--webqq-bg) 88%, transparent)`，是一处纯冗余。

收窄手段全部是「指定样式文件」或「用 `sourceBetween` 切到目标那一处」，没有引入序号参数。

### 依赖嵌套内容的那几条

- `@keyframes` / `@media` / `@container` 共 11 处改用块访问器。
- 真正「规则却要子规则内容」的改成块访问器或嵌套查询：`.onebot-webqq__avatar` 的 `img` 圆角、`.onebot-webqq__bot-switch` 的 `&::before/&::after`、`.onebot-webqq__bot-overflow-avatar` 的 `img`、`.onebot-webqq__bot-stack` 的 `&.is-expanded`、`.onebot-webqq__bot-stack.is-overflow-collapsing .onebot-webqq__bot-overflow` 的两条 animation、`.onebot-webqq-webqq__chat-header` 的通用 `button`、`.onebot-webqq-webqq` 在浮层样式里的包装块、`.onebot-webqq-webqq__message` 的 `&.is-outgoing`。
- 群信息按钮那条 `/&\.is-active\s*\{[\s\S]*background:\s*transparent/` **原样保留**——它量的是 SCSS 的嵌套写法本身。

### 补的正向断言

只有负向断言的 body 各补一条最小正向：撤回气泡（`opacity: 0.62`）、文本气泡（`word-break: break-word`）、TIM 发出消息的贴表情（`background: var(--onebot-webqq-webqq-reaction-bg)`）、群信息顶栏（`align-items: center`）。`backdrop-filter` 那条测试有九个负向 body，改成带标签的清单遍历，每个 body 先断言「真的切出了本级声明」再断言「不含 backdrop-filter」——一条正向覆盖九处，没有新增几十条低价值断言。

### 三处故意依赖「找不到」的判据

改用 `hasRule`，判据方向不变：TIM 气泡尖角的基类规则不该存在、清爽主题不该给群信息按钮加卡片背景、毛玻璃主题同理。

### 手写惰性正则

六条提 z-index 的正则改用声明值访问器。迁移前后读数一致（外壳 10001、右键菜单 10140、二级页 10130、Dialog 遮罩 10200、Dialog 内容 1、资料卡 10300），但旧写法是从令牌块的花括号开始惰性往后扫第一个 `z-index:`，只是碰巧扫到了正确的那一处。读 `.vue` 源码的两条 `zIndex` 正则不动。

### 失效实测

第一种（改坏 SCSS）：把 `.onebot-webqq-webqq__notify` 的 `border-radius: 8px 8px 0 0` 改成 6px，「matches the notification selection shape to the contact tabs」变红。

第二种（证明新访问器抓得到旧访问器抓不到的东西）：

- 把 `.onebot-webqq-webqq__message.is-recalled .onebot-webqq-webqq__bubble` 从逗号列表里删掉：新访问器报「样式源里没有规则 …」，旧访问器在同一份源码上返回空串、`not.toContain('top: 50%')` 照样通过。
- 删掉浮层样式令牌块里的 `.onebot-webqq-webqq__notice-menu--desktop,`：那一对断言的前一条独立变红，后一条仍然通过。
- 不收窄地把 `.webqq-dialog-content` 交给规则访问器：报「有 3 处定义，请把来源收窄到其中一处」。
- 给 `.webqq-context-menu-item` 前面插一句 `/* 假规则 .webqq-context-menu-item { z-index: 1 } */`：切片结果不变，断言不受影响。

### 验收命令

`yarn typecheck`、`yarn test`（53 个文件 751 个测试）、`yarn build` 全部通过。按票里的要求没有做浏览器验证。

### 代码评审之后的三处收拾

- 删掉四处死分支。把「缺少某条规则」的判据从「切出来是空串吗」改成 `hasRule` 之后，同一个选择器上一行已经用规则访问器取过（找不到就抛错），那四个 `hasRule(…) ? '' : '缺少…'` 永远拿不到 `false` 分支。访问器的报错本身就是判据。判据方向为「不该存在」的三处保留，它们是活的。
- 两处重复查询提了局部变量（`.onebot-webqq__body` 七次、`.onebot-webqq-host` 五次连同同一测试里的 `.onebot-webqq` 与 `.onebot-webqq__bot-switch`），沿用文件里既有的 `body`/`host`/`shell` 命名。其余十余处重复调用保持原样：逐个改会把 diff 铺开到票的范围之外，而重复调用是迁移前就有的写法。
- `sourceBetween` 那批收窄用紧邻的下一条规则当右边界，也就是依赖那两条规则在文件里前后相邻。已在注释里点明，并写了「重复块合并掉之后这些收窄该跟着删」。选它而不是序号参数的理由：边界字面量一旦消失会当场报错，而序号会静默取到另一处定义。

### 逐字核对的读数

- 断言参数的增删正好是票里允许的那些：14 条整文件 `toContain(选择器)` 收紧成存在性、三处「不该存在」的判据、四条新增的最小正向断言。`backdrop-filter` 那条测试的九条负向合成了一次遍历，参数 `/backdrop-filter\s*:/` 本身没动，运行时仍然断言九次。
- 读组件单文件组件源码的 24 行断言与 HEAD 逐字一致。
- 六个旧助手在文件里已经搜不到。
- `git diff HEAD -- client/ src/` 与 `git diff HEAD -- CONTEXT.md` 均为空。

### 一处越出票面的改动，记在这里备查

- **全树遍历 `collectClientSources` 进了 module**。票 03 只授权共享剥注释。它服务的是代码评审新加的那条清单完整性守卫（module 声明的样式源清单要与磁盘实况一致），同时消掉了「全部样式源」原有的两份定义。ADR 0011 的「接口要保持窄」约束的是**查询方法**，这个是来源装配不是查询，但确实超出票面。

另有一处曾经越界又撤回：给剥注释加过记忆化，Spec 轴按 spec 的「这一票不为性能做任何事」判为 creep，复议后撤掉——300ms 与 190ms 都在三秒量级的套件里没人感觉得到，不值得花偏离 spec 的代价。
