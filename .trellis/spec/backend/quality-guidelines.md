# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

对这个插件来说，当前激活的 OneBot 机器人选择是跨层契约：

- 控制台入口会发布当前机器人列表和选中的 `selfId`
- 客户端通过 `onebot-webqq/webqq/bot/select` 切换机器人
- 实时会话、贴表情事件和缓存状态必须跟随当前选中的机器人

本项目保留单机器人路径不变。只有当运行时里存在多个可用 OneBot 机器人时，才启用多机器人分区。

## 场景：多 OneBot 机器人切换契约

### 1. 范围 / 触发

- 触发：需要让 WebQQ 在多个 OneBot 机器人之间切换
- 范围：配置项、OneBot 运行时机器人列表、console RPC、console broadcast、客户端全局状态、实时事件过滤、浏览器与 Koishi 缓存 key

### 2. 签名

- 配置：`onebotUseRuntimeBots?: boolean`，默认 `true`
- 配置：`onebotSelfId?: string`，表示默认打开的机器人
- 配置：`onebotSelfIds?: string[]`，表示关闭运行时全量模式时的显式集合
- RPC：`onebot-webqq/webqq/bot/select({ selfId: string }) => OneBotRobotState`
- 广播：`onebot-webqq/bots/update(OneBotRobotState)`
- 状态：`OneBotRobotState = { bots: OneBotRobotProfile[]; selectedSelfId?: string }`

### 3. 契约

- `onebotUseRuntimeBots` 开启时，候选机器人来自当前运行时里所有可用 OneBot 机器人
- `onebotUseRuntimeBots` 关闭时，候选机器人只来自 `onebotSelfId` 与 `onebotSelfIds`
- `selectedSelfId` 是运行时状态，不写入数据库
- WebQQ 历史、联系人、实时消息和通知都读取当前选中的机器人
- 当 `bots.length > 1` 时，缓存 key 追加当前 `selectedSelfId`；当只有一个可用机器人时，继续使用旧 key

### 4. 校验与错误矩阵

- `onebotUseRuntimeBots=false` 且显式集合为空：返回空机器人列表，后续读取 WebQQ 数据时报“未找到配置 selfId 集合中的可用 OneBot 机器人”
- 点击不存在或不可用的 `selfId`：`bot/select` 抛出“未找到 selfId 为 ... 的 OneBot 机器人”
- 当前选中机器人下线：下一次刷新机器人状态时切到第一个可用机器人
- 实时事件来自非当前选中机器人：忽略，不写入 live cache

### 5. Good / Base / Bad Cases

- Good：两个 OneBot 机器人在线，胶囊显示堆叠头像，点击第二个头像后 WebQQ 重新加载第二个机器人的联系人和消息
- Base：只有一个 OneBot 机器人在线，胶囊仍走单头像路径，缓存 key 不追加 `selfId`
- Bad：只切换前端头像，但后端 `createOneBotWebQQService()` 仍读取旧机器人

### 6. 必要测试

- `tests/state.test.ts`：快照携带可用机器人列表且会克隆数组
- `tests/webqq-api.test.ts`：客户端调用 `onebot-webqq/webqq/bot/select`
- `tests/capsule.test.ts`：胶囊包含可悬停展开的头像组和切换按钮
- `tests/webqq-storage.test.ts`：Koishi 消息缓存支持按 `selfId` 分区
- 变更完成后运行 `yarn test`、`yarn typecheck`、`yarn build`

### 7. Wrong vs Correct

错误做法：
```ts
// 只改前端头像，WebQQ 服务仍继续使用旧 selfId
selectedBotSelfId.value = selfId
```

正确做法：
```ts
webqq.selectSelfId(selfId)
ctx.console?.broadcast('onebot-webqq/bots/update', readBotState(), consoleAuthOptions)
```

---

## 场景：无多 bot 环境下模拟 OneBot 机器人

### 1. 范围与触发

- 触发：开发或验收环境只有一个真实 OneBot 机器人，但需要验证多机器人胶囊堆叠、展开和切换
- 范围：配置项、OneBot WebQQ 服务的可见机器人列表、console entry payload、`bot/select` RPC、实时事件过滤

### 2. 签名

- 配置：`onebotMockBotCount?: number`，默认 `0`，表示额外追加的模拟机器人数量
- 服务选项：`OneBotWebQQOptions.mockBotCount?: number`
- 服务方法：`isSelectedSelfId(selfId?: string) => boolean`

### 3. 契约

- `onebotMockBotCount=0` 时不追加模拟机器人，原有单机器人和多真实机器人行为不变
- `onebotMockBotCount>0` 时，`createOneBotWebQQService().listBots()` 在真实机器人列表后追加同等数量的模拟 profile
- 模拟 profile 的 `selfId` 使用 `<sourceSelfId>:mock:<index>`，并复用第一个可用真实机器人的头像和状态
- 点击模拟机器人时，`selectedSelfId` 仍返回模拟 `selfId`，用于前端高亮和多机器人缓存分区
- 真实 WebQQ action、实时消息和贴表情过滤必须通过服务层映射回源机器人 `selfId`
- 不要把模拟机器人写进 `ctx.bots`，避免污染 Koishi 当前运行时的真实适配器列表

### 4. 校验与错误矩阵

- `onebotMockBotCount=0`：`listBots()` 只返回真实机器人
- 没有可用真实机器人：不追加模拟 profile，WebQQ 读取继续按原逻辑报“未找到可用的 OneBot 机器人”
- 点击不存在的模拟 `selfId`：`bot/select` 抛出“未找到 selfId 为 ... 的 OneBot 机器人”
- 切到模拟 `selfId` 后收到源机器人实时事件：`isSelectedSelfId(sourceSelfId)` 必须返回 `true`

### 5. 正确 / 基线 / 错误案例

- 正确：一个真实机器人在线，`onebotMockBotCount=2`，胶囊显示三个头像，点击 `10000:mock:2` 后前端选中模拟头像，WebQQ 数据仍从真实 `10000` 读取
- 基线：`onebotMockBotCount=0`，只有一个真实机器人时仍走单头像路径
- 错误：前端本地伪造两个头像，但后端 `bot/select` 不认识模拟 `selfId`，点击后静默失败或无法打开 WebQQ

### 6. 必要测试

- `tests/onebot.test.ts`：`mockBotCount` 会追加模拟 profile，选择模拟 `selfId` 后仍调用真实 bot action
- `tests/plugin.test.ts`：console entry data 会返回真实机器人加模拟机器人，`bot/select` 能广播模拟 `selectedSelfId`
- 变更完成后运行 `yarn test`、`yarn typecheck`、`yarn build`

### 7. 错误与正确示例

错误做法：
```ts
ctx.bots?.push(mockBot)
```

正确做法：
```ts
const bots = webqq.listBots()
webqq.selectSelfId('10000:mock:1')
```

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

### 不要：让多个 OneBot 机器人共用同一份实时 WebQQ 会话

**问题**：
如果实时消息、贴表情或撤回事件没有按当前选中的机器人过滤，切换机器人后，不同适配器的状态会混进同一个 WebQQ 视图。

**为什么不好**：
界面看起来像是切换了机器人，但会话历史、未读数或最近缓存其实还属于另一个机器人。

**应该怎么做**：
在多机器人模式下，实时事件处理和缓存 key 都要按当前选中的机器人 `selfId` 分区。

---

## Required Patterns

<!-- Patterns that must always be used -->

### 约定：保留单机器人 key 路径

**是什么**：当只存在一个可用 OneBot 机器人时，存储 key 和缓存行为继续走原来的未分区路径。

**为什么**：这样可以避免迁移工作，也能让现有单机器人安装继续使用原来的缓存布局。

**示例**：
```ts
const scopeId = botState.bots.length > 1 ? botState.selectedSelfId : undefined
await loadWebQQStorage(ctx, config, scopeId)
```

---

## Testing Requirements

<!-- What level of testing is expected -->

### 测试要求

- 新增机器人选择或分区辅助函数时，要补单元测试
- 控制台入口 payload 增加字段时，要补契约测试
- 模板改动影响按钮或布局状态时，要补源码断言测试
- 变更跨层契约后，要运行 `yarn test`、`yarn typecheck` 和 `yarn build`

---

## Code Review Checklist

<!-- What reviewers should check -->

### 代码审查清单

- 选中的 OneBot 机器人是否从运行时一路传到了控制台入口和客户端状态？
- 实时事件是否已经过滤，避免其他机器人污染当前 WebQQ 会话？
- 单机器人场景下，浏览器和 Koishi 的缓存 key 是否保持稳定？
- 新增配置项的说明是否只描述本次行为，没有顺手改动无关逻辑？
