# 01 — 开发者模拟环境切到虚拟 OneBot 机器人

**What to build:** 开启「启用 WebQQ 开发者模拟环境」后，**一级工作区**里出现的是**虚拟 OneBot 机器人**——由别的插件注册进 Koishi、对 UI 隐藏、action 通道由它自己实现的那种机器人。会话、消息、群成员、通知全部经真实 OneBot action 从它的场景读出，实时消息经真实 Koishi 事件抵达。开关期间真实机器人不出现，因为观察窗的撤回、踢人、禁言都真发 action，混列会让人在「模拟环境」里操作真实群。一台虚拟机器人都没有时给出说清原因的提示，而不是让人以为观察窗坏了。

这是整套改动的 expand 步骤：新路径接上、开关切过去，内存实现留在原地不再被引用，由 ticket 02 删除。

**Blocked by:** None — can start immediately.

**Status:** resolved

**参考:** `.scratch/virtual-bot-environment/spec.md`；源码分层见 ADR 0001，配置规格边界见 ADR 0003。

- [x] 配置项键名不变，现有配置文件升级后继续可用
- [x] **配置规格**里该项的说明文案改成新语义，写明需要另装一个提供虚拟 OneBot 机器人的插件
- [x] 该项仍不是**镜像配置项**，双向键集断言与配置面板契约断言全绿（ADR 0003）
- [x] 配置面板的分组、分组顺序、字段顺序、控件类型一处不变
- [x] 开关开启时，对 UI 隐藏且具备 action 通道的 onebot 机器人进入候选集合，有断言
- [x] 开关开启时，真实机器人不进入候选集合，有断言
- [x] 开关开启时，selfId 白名单不参与筛选，有断言——虚拟机器人的 selfId 不可能出现在管理员手写的白名单里
- [x] 开关关闭时的候选集合与今天逐字相同：排除隐藏机器人、白名单照常生效，既有断言一字不改地通过
- [x] 「哪些机器人算可用」的改动落在机器人选择层，不散进适配层（ADR 0001）
- [x] 可用性判定、action 通道探测、在线状态推导的判据均未改变，只改候选集合，既有断言一字不改地通过
- [x] 服务装配永远创建真实 WebQQ 实现，不再按开关分叉出第二种实现
- [x] 开关开启时不再派生额外模拟机器人画像；关闭时该配置项行为一字不变，两者都有断言
- [x] 开关开启时消息列表的好感度与关系徽标照常按真实 ChatLuna 数据渲染，那条只在模拟环境生效的跳过分支被删除，有断言
- [x] 虚拟机器人在 ChatLuna 数据库里查不到记录时徽标为空，而不是编出数值，有断言
- [x] 开关开启但没有任何虚拟机器人时，给出专属提示文案，不落到既有那句「未找到可用的 OneBot 机器人」，有断言
- [x] 开关关闭时的原有错误文案一字不变，有断言
- [x] 读取与写入都经真实 OneBot action：断言目标机器人的 action 通道真的被调用且参数正确，而不是只断言返回值
- [x] **主胶囊**上照常显示虚拟机器人的头像、昵称与在线状态；**胶囊对话状态**照常更新
- [x] 插件装配层做一次端到端确认：开关开启后控制台收到的机器人列表只含虚拟机器人
- [x] 领域文档补「虚拟 OneBot 机器人」与「开发者模拟环境」两条词条，后者的含义按本次改动重写
- [x] 写下 ADR：模拟环境靠通用形状接后端而不引用提供方插件（发布节奏解耦、语义通用、不引入类型依赖），为什么不 inject 提供方的 service，为什么不在本插件里自造虚拟机器人，以及「只列虚拟机器人」的安全理由；写明不推翻 ADR 0001 的分层、ADR 0002 的两插件共存隔离、ADR 0003 的配置边界
- [x] 内存实现与写死场景本票不删，但已不再被任何运行时路径引用
- [x] 完整测试、类型检查与构建通过

## Comments

- 候选集合的判据集中在 `src/onebot/bots.ts`：新增 `OneBotBotScope { includeVirtualBots？ }` 与 `isVirtualOneBotBot()`（platform 为 `onebot` 且 `hidden === true`）。`getOneBotBots()` 按这个标志二选一——纳入虚拟机器人时只留虚拟的，默认仍是原来那句 `hidden !== true`。真实一侧刻意不加 platform 判据：加了就会改变开关关闭时的候选集合。
- 白名单绕过做在 `getAvailableOneBotBots()` / `getProbeableOneBotBots()` 的入口：`readScopedSelfIds()` 在纳入虚拟机器人时把 `selfIds` 整体置为 `undefined`，因此「配了白名单但集合为空 → 返回 []」这条早退也一起绕过。可用性判定、探测判据、在线状态推导三个函数体一行未动。
- `selectBot()` 的缺失文案按 `includeVirtualBots` 分叉，且放在 `options.selfIds` 分支之前——模拟环境下白名单已被绕过，不能再落到「未找到配置 selfId 集合中的…」那句上。
- 事件扇出边界必须用同一判据，否则会出现「只列虚拟机器人，却继续把真实群的消息推进观察窗」。`isVisibleBotSession(session, scope)` 因此也接 scope，四个调用点（`runtime/register.ts` 的 message、`capsule/register.ts` 的 before send、`capsule/chatluna-activity.ts` 的 recordGenerating、`webqq/message-flow/live-runtime.ts` 的 isSelectedWebQQSession）统一传入。
- scope 由 `runtime/create-runtime.ts` 创建一次并往下传（ADR 0001：装配层创建共享依赖并传递），四个消费点不各自再读一次配置键。同一处顺带修掉一个隐患：`onebotUseRuntimeBots` 关闭时原本会把 `selfId` 钉在白名单第一项上，模拟环境下那个 selfId 不在候选集合里，报错会变成「未找到 selfId 为 X 的 OneBot 机器人」而不是缺提供方的提示。
- 服务装配不再三元分叉，永远 `createOneBotWebQQService(ctx, { ...botScope })`；`createMockWebQQService` 的 import 一并移除，内存实现只剩 `webqq/adapters/types.ts` 的类型引用（ticket 02 处理）。
- `webqq/console.ts` 删掉「模拟环境整体跳过好感度徽标」那一句 early return，模拟环境与真实环境走同一条渲染路径。
- 测试落在既有接缝上，没有新增接缝：`tests/onebot.test.ts` 在既有那条「隐藏 Bot 不进列表」旁边按开关取值补四条（候选集合互斥、白名单绕过、读写走虚拟机器人自己的 action 通道并断言参数、缺提供方的专属文案 + 两句旧文案不变）；`tests/plugin.test.ts` 把原来那条「模拟环境走内存并挡住真实 ChatLuna 数据」改写成装配层端到端（控制台机器人列表只含虚拟机器人且带头像与在线状态、联系人真经虚拟机器人的 action 通道、消息带真实好感度徽标、虚拟机器人自己查不到记录时徽标为空），另加一条实时链路（虚拟机器人的 Koishi 事件抵达 WebQQ 与胶囊对话状态，真实机器人的不抵达）。
- `tests/webqq-mock-environment.test.ts` 的两条按 spec 改写：「额外模拟机器人数量」那条改为断言模拟环境下不再派生假画像、真实环境下仍派生两个；「与真实 ChatLuna 数据隔离」那条改为反向断言（装配层不再引用内存实现、开关只作为选项传入、`console.ts` 不再出现 `webQQMockEnvironment`）。另三条覆盖内存实现的用例本票不动，由 ticket 02 处置。
- 配置面板契约表同步新文案，`webQQMockEnvironment` 仍不在镜像配置项里，分组与字段顺序未动。
- 验证：`yarn vitest run tests` 40 文件 613 通过；`yarn typecheck` 无输出；`yarn build` 服务端 `lib/index.js` 179.08 KB、前端 `dist/index.js` 586.92 kB（gzip 138.76 kB）、`dist/style.css` 114.18 kB。这三个数字是 ticket 02 体积比较的基线。

### 代码审查后的两处补正

- **通知菜单漏了同一判据。** `webqq/register.ts` 的 `friend-request` 与 `guild-member-removed` 两个 handler 只在 notice 工厂里判了 platform，没接 scope。开关开启时真实机器人的好友申请与退群通知照样进通知菜单，而菜单里的「同意」会拿事件里的真实 flag 去调**虚拟机器人**的 `set_friend_add_request`——正是「只列虚拟机器人」这条要防的那类事故。两个 handler 补上 `isVisibleBotSession(session, botScope)`，并在 `tests/plugin.test.ts` 加一条装配层断言（真实机器人的两类通知不进菜单、虚拟机器人的照常进）。副作用：开关关闭时隐藏机器人的这两类通知现在也被挡住了。这与 `runtime/register.ts` 里那句注释（hidden Bot 的事件必须在共享扇出边界阻断）本来就是同一个意图，此前只是漏了通知这条路径；没有任何既有断言依赖旧行为。
- **缺提供方文案的分支顺序。** 原先 `options.selfId` 分支排在虚拟机器人文案之前，前端残留一个真实 selfId 再 select 时会落到「未找到 selfId 为 X」。改成「候选集合为空且要虚拟机器人」优先，虚拟机器人存在但点名的那台不在时仍给精确的 selfId 文案。断言补在既有那条用例里。
- 保留 `getBotStatusDiagnostics()` 里新增的 `includeVirtualBots` 字段：这个对象的用途就是让调试日志解释「为什么某台机器人不在列表里」，而这个标志现在是该结论最主要的输入。
- **实机验收发现的第三处：头像。** 观察窗过去在所有位置都按 id 合成腾讯 CDN 地址（`q1.qlogo.cn` / `p.qlogo.cn`）。真实环境下这是 QQ 的既有约定，但虚拟机器人的 id 是场景编号，合成出来的地址会真的从腾讯拉回**同号真实用户**的头像，群头像则拉回 CDN 的默认图——用户看到的就是「要么默认头像、要么不显示」。改成：先用对方给出的头像（Satori 的 user/member 画像、OneBot 载荷里的 `avatar` / `avatarUrl` / `avatar_url` / `headUrl` / `head_url`），只有 id 确实是 QQ 号时才允许合成；判据是「这条数据来自哪台机器人」（`readOneBotAvatarScope`），不是一个全局模式，两种机器人混在同一运行时里也逐条成立。进不了 `<img>` 的取值（例如提供方的受管媒体引用）当作没有头像。前端补齐缺省分支：联系人列表、消息列表、群成员、合并转发四处原本是无条件 `<img>`，没有头像时会渲染成碎图，现在统一显示首字母占位，并有一条扫描全部 `.vue` 的守卫钉住「每个头像 img 都有缺省分支」（实测删掉其中一处会变红）。
- 补正后重新验证：`yarn vitest run tests` 41 文件 619 通过；`yarn typecheck` 无输出；`yarn build` 通过。
