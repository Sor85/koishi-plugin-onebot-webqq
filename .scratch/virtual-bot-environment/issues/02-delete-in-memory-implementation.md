# 02 — 删掉内存 WebQQ 实现与写死场景

**What to build:** 插件维护者改适配层时不再需要同步维护第二份实现。内存 WebQQ 实现与它那份写死的预设场景整体删除，WebQQ 服务类型从「真实实现 ∪ 内存实现」收敛成单一形状——「两份实现必须同构」这条约束连同它守护的问题一起消失，因为漏改它不报错、只会在某天表现成「模拟环境好用、真机不对」。

这是 expand–contract 的 contract 步骤：ticket 01 之后内存实现已无运行时引用，本票把它连同它的专项测试一起清掉，并加守卫防止它以任何形式回来。

**Blocked by:** 01 — 开发者模拟环境切到虚拟 OneBot 机器人。

**Status:** resolved

**参考:** `.scratch/virtual-bot-environment/spec.md`；源码分层见 ADR 0001。

- [x] 内存 WebQQ 实现与写死预设场景两个 module 整体删除
- [x] 删除后 WebQQ 适配层只剩 ADR 0001 点名的那一个适配器，比改动前更贴合该 ADR 的目标文件树
- [x] WebQQ 服务类型收敛为单一形状，不再是联合类型
- [x] 存在守卫断言：没有任何 module 引用被删掉的内存实现，且 WebQQ 服务类型不是联合类型；两条都实测过反向变红
- [x] 内存实现的专项测试按覆盖意图逐条处置，不整体保留：测预设联系人与消息元素类型、测视频消息落库、测内存状态变更这三条随实现删除
- [x] ticket 01 已改写的那两条断言（不再派生额外模拟机器人画像、好感度徽标照常渲染）保留，不因文件整理而丢失
- [x] 专项测试文件改名以反映新语义，文件内不再出现内存实现的构造入口
- [x] 删除未减少任何真实环境的覆盖：真实适配层与实时消息链路的既有断言一字不改地通过
- [x] 浏览器产物不因本次删除变大（只可能变小），构建产物体积记入 Comments
- [x] 开关开启与关闭两种模式的行为与 ticket 01 完成时逐字相同，本票不改变任何用户可见行为
- [x] 完整测试、类型检查与构建通过

## Comments

- 删除 `src/webqq/adapters/mock/service.ts`（750 行）与 `src/webqq/adapters/mock/scene.ts`（622 行）整个目录。`src/webqq/adapters/` 现在只剩 `onebot/` 与 `types.ts`，与 ADR 0001 的目标文件树一致。
- `src/webqq/adapters/types.ts` 的 `WebQQService` 从两个 `ReturnType` 的联合收敛成 `ReturnType<typeof createOneBotWebQQService>` 一个。
- 顺带删掉 `WebQQContacts.mockEnvironment`：它只由被删的实现写入，留着就是一个永远为假的字段和两条永远走不到的前端分支（观察窗跳过浏览器消息缓存）。服务端类型、前端类型、前端归一化与观察窗四处一起清掉，`tests/webqq-api.test.ts` 里钉这个字段的用例随之删除。这满足 spec 的「模拟环境不再有任何只在它里面生效的分支」，且不改变任何可达行为——该字段在 ticket 01 之后已经不可能为真。
- 专项测试文件 `tests/webqq-mock-environment.test.ts` 改名为 `tests/webqq-virtual-bot-environment.test.ts`。ticket 01 改写的两条断言原样搬过去；覆盖被删实现的三条（预设联系人与消息元素类型、视频消息落库、内存状态变更）随实现删除；文件内不再出现内存实现的构造入口，`MOCK_*` 常量与场景工厂的 import 一并移除。
- 两条守卫都放在这个文件里：
  - 「内存实现真的删干净了」= `src/webqq/adapters/` 下的子目录集合恰好等于 `['onebot']`，且 `git ls-files` 里 `src/`、`client/`、`tests/` 三个目录下没有任何文件包含被删目录的路径。被删路径刻意用 `['adapters', deletedAdapterName].join('/')` 拼出来，否则守卫文件本身就成了「引用内存实现」的那个 module（同 `tests/namespace.test.ts` 的写法）。扫描范围限定在 module 目录：`.scratch/` 与 `docs/` 里的 spec 与 ADR 正文本来就会提到这个路径。
  - 「服务类型不是联合类型」= 取 `export type WebQQService =` 到空行之间的声明体，断言其中没有 `|` 且包含唯一那个 `ReturnType`。用「不含 `|`」而不是逐字比对全文，避免把工厂函数名的一次重命名也变成红灯。
- 反向变红实测三次：① 重新建出 `src/webqq/adapters/mock/service.ts` → 目录守卫红；② 在 `src/webqq/adapters/types.ts` 里加一行引用被删路径的注释 → 引用守卫红（offenders 数组非空）；③ 把 `WebQQService` 改回联合类型 → 类型守卫红。三次都只有对应那一条失败，其余三条仍绿；验证后全部还原。
- 真实环境覆盖没有减少：`tests/onebot.test.ts`、`tests/plugin.test.ts`、`tests/plugin-bot-probe.test.ts`、`tests/webqq-live-messages.test.ts` 一字未改地通过。
- 构建产物体积（对比 ticket 01 完成时）：`dist/index.js` 591 284 → 591 154 字节（586.92 → 586.79 kB，gzip 138.76 → 138.71 kB），`dist/style.css` 114 185 字节不变，`lib/index.js` 183 951 字节不变。浏览器产物只减不增；服务端产物不变是因为 ticket 01 移除最后一处 import 后，被删实现对 tsup 已经不可达，那次构建就没再打进去（`grep` 两个产物都搜不到场景里的字符串）。
- 验证：`yarn vitest run tests` 40 文件 611 通过（613 − 3 条随实现删除 − 1 条 mockEnvironment 字段 + 2 条新守卫）；`yarn typecheck` 无输出；`yarn build` 通过。
